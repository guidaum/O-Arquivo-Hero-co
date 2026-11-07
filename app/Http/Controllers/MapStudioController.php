<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Support\AiHordeMapRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use RuntimeException;

/**
 * Estúdio de Esboços (MapSketchStudio.tsx): o mestre desenha o esboço, o
 * cartógrafo do navegador o transforma num mapa ilustrado e, se quiser, a
 * IA gratuita (AI Horde) refina o resultado. O mapa escolhido vira um mapa
 * personalizado da campanha.
 *
 * Pedidos de IA ficam no cache por 15 minutos (o AI Horde descarta pedidos
 * após 10); as variações baixadas ficam em maps/renders por um dia.
 */
class MapStudioController extends Controller
{
    private const RENDER_TTL_MINUTES = 15;

    private const RENDERS_DIR = 'maps/renders';

    public function __construct(private readonly AiHordeMapRenderer $renderer)
    {
    }

    public function show(GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        return view('map-manager.studio', [
            'session' => $gameSession,
            'config' => [
                'renderUrl' => route('map-manager.studio.render', $gameSession),
                'statusUrl' => route('map-manager.studio.status', [$gameSession, '__ID__']),
                'saveUrl' => route('map-manager.studio.save', $gameSession),
                'aiEnabled' => $this->renderer->enabled(),
                'aiAnonymous' => $this->renderer->isAnonymous(),
                'worldThemes' => array_map(static fn (array $theme): string => $theme[0], AiHordeMapRenderer::WORLD_THEMES),
                'dungeonThemes' => array_map(static fn (array $theme): string => $theme[0], AiHordeMapRenderer::DUNGEON_THEMES),
            ],
        ]);
    }

    public function render(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);
        abort_unless($this->renderer->enabled(), 404);

        $data = $request->validate([
            'image' => ['required', 'string', 'max:12000000', static function (string $attribute, mixed $value, \Closure $fail): void {
                $data = preg_match('/^data:image\/(webp|png|jpeg);base64,/', (string) $value) === 1 ? Str::after((string) $value, 'base64,') : '';

                if ($data === '' || strspn($data, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=') !== strlen($data)) {
                    $fail('A imagem do esboço é inválida.');
                }
            }],
            'type' => ['required', Rule::enum(MapType::class)],
            'theme' => ['required', 'string', 'max:32'],
            'elements' => ['array', 'max:40'],
            'elements.*' => ['string', 'max:32'],
            'prompt' => ['nullable', 'string', 'max:300'],
            'width' => ['required', 'integer', 'min:64', 'max:4096'],
            'height' => ['required', 'integer', 'min:64', 'max:4096'],
            'fidelity' => ['required', 'integer', 'min:0', 'max:100'],
            'follow_lines' => ['boolean'],
            'variations' => ['integer', 'min:1', 'max:4'],
        ]);

        $this->pruneOldRenders();

        $prompt = $this->renderer->prompt($data['type'], $data['theme'], $data['elements'] ?? [], (string) ($data['prompt'] ?? ''));

        try {
            $hordeId = $this->renderer->submit(
                Str::after($data['image'], 'base64,'),
                $prompt,
                (int) $data['width'],
                (int) $data['height'],
                (int) $data['fidelity'],
                (bool) ($data['follow_lines'] ?? false),
                (int) ($data['variations'] ?? 2),
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }

        $id = (string) Str::uuid();
        Cache::put($this->cacheKey($id), [
            'user_id' => $request->user()->id,
            'game_session_id' => $gameSession->id,
            'horde_id' => $hordeId,
            'images' => null,
        ], now()->addMinutes(self::RENDER_TTL_MINUTES));

        return response()->json([
            'id' => $id,
            'message' => $this->renderer->isAnonymous()
                ? 'Pedido enviado à IA gratuita (fila anônima: pode levar alguns minutos).'
                : 'Pedido enviado à IA gratuita.',
        ], 202);
    }

    /**
     * Andamento do pedido, consultado por polling (core/realtime.js).
     */
    public function status(Request $request, GameSession $gameSession, string $render): JsonResponse
    {
        Gate::authorize('update', $gameSession);
        $job = $this->job($request, $gameSession, $render);

        if ($job['images'] !== null) {
            return response()->json(['done' => true, 'images' => $this->imageUrls($job['images'])]);
        }

        // Várias abas consultando: o AI Horde é perguntado no máximo a cada 3 s.
        $check = Cache::remember($this->cacheKey($render).':check', 3, fn (): array => $this->renderer->check($job['horde_id']));

        if (($check['faulted'] ?? false) || ($check['is_possible'] ?? true) === false) {
            Cache::forget($this->cacheKey($render));

            return response()->json([
                'done' => true,
                'failed' => true,
                'message' => ($check['expired'] ?? false)
                    ? 'O pedido expirou na fila da IA. Tente de novo.'
                    : 'Nenhum servidor da IA conseguiu gerar este mapa agora. Tente de novo ou use o mapa ilustrado.',
            ]);
        }

        if (! ($check['done'] ?? false)) {
            return response()->json([
                'done' => false,
                'queue_position' => $check['queue_position'] ?? null,
                'wait_time' => $check['wait_time'] ?? null,
                'processing' => $check['processing'] ?? 0,
            ]);
        }

        $paths = [];
        foreach ($this->renderer->images($job['horde_id']) as $index => $binary) {
            $path = self::RENDERS_DIR.'/'.$render.'-'.$index.'.webp';
            Storage::disk('public')->put($path, $binary);
            $paths[] = $path;
        }

        if ($paths === []) {
            return response()->json(['done' => true, 'failed' => true, 'message' => 'A IA terminou, mas não devolveu imagens. Tente de novo.']);
        }

        Cache::put($this->cacheKey($render), [...$job, 'images' => $paths], now()->addDay());

        return response()->json(['done' => true, 'images' => $this->imageUrls($paths)]);
    }

    /**
     * Salva o mapa escolhido na campanha: uma variação da IA (render + índice)
     * ou a imagem do cartógrafo do navegador enviada como arquivo.
     */
    public function save(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $type = MapType::tryFrom((string) $request->input('type'));
        $data = $request->validate([
            'type' => ['required', Rule::enum(MapType::class)],
            'name' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'theme' => ['nullable', 'string', 'max:64'],
            'default_scale' => ['nullable', 'string', 'max:64'],
            'grid_cols' => [$type === MapType::Dungeon ? 'required' : 'nullable', 'integer', 'min:4', 'max:80'],
            'grid_rows' => [$type === MapType::Dungeon ? 'required' : 'nullable', 'integer', 'min:4', 'max:80'],
            'render' => ['nullable', 'uuid', 'required_without:image'],
            'variation' => ['nullable', 'integer', 'min:0', 'max:3'],
            'image' => ['nullable', 'required_without:render', 'image', 'mimes:png,jpeg,webp', 'max:12288'],
        ], [], ['name' => 'nome do mapa', 'image' => 'imagem']);

        if (isset($data['render'])) {
            $job = $this->job($request, $gameSession, $data['render']);
            $source = $job['images'][(int) ($data['variation'] ?? 0)] ?? null;
            abort_if($source === null || ! Storage::disk('public')->exists($source), 404);

            $path = 'maps/custom/'.Str::uuid().'.webp';
            Storage::disk('public')->copy($source, $path);
        } else {
            $path = $request->file('image')->store('maps/custom', 'public');
        }

        $isDungeon = $type === MapType::Dungeon;
        $map = new CampaignMap([
            'type' => $type,
            'name' => $data['name'],
            'subtitle' => ($data['subtitle'] ?? '') !== '' ? $data['subtitle'] : ($isDungeon ? 'Masmorra forjada no Estúdio de Esboços' : 'Mapa forjado no Estúdio de Esboços'),
            'theme' => $isDungeon ? (($data['theme'] ?? '') !== '' ? $data['theme'] : 'Personalizado') : null,
            'default_scale' => $isDungeon ? null : (($data['default_scale'] ?? '') !== '' ? $data['default_scale'] : '1 cm = 25 léguas'),
            'grid_cols' => $isDungeon ? (int) $data['grid_cols'] : null,
            'grid_rows' => $isDungeon ? (int) $data['grid_rows'] : null,
            'active' => true,
        ]);
        $map->game_session_id = $gameSession->id;
        $map->created_by = $request->user()->id;
        $map->image_path = $path;

        if ($isDungeon) {
            $map->entrance_x = 10;
            $map->entrance_y = 50;
        }

        $map->save();

        return response()->json([
            'message' => 'Mapa "'.$map->name.'" salvo na campanha.',
            'redirect' => route('map-manager.index', ['campanha' => $gameSession->id]),
        ], 201);
    }

    /**
     * @return array{user_id: int, game_session_id: int, horde_id: string, images: list<string>|null}
     */
    private function job(Request $request, GameSession $session, string $render): array
    {
        $job = Str::isUuid($render) ? Cache::get($this->cacheKey($render)) : null;

        abort_if(
            ! is_array($job) || $job['user_id'] !== $request->user()->id || $job['game_session_id'] !== $session->id,
            404,
            'Pedido de renderização não encontrado ou expirado.',
        );

        return $job;
    }

    /**
     * @param  list<string>  $paths
     * @return list<string>
     */
    private function imageUrls(array $paths): array
    {
        return array_map(static fn (string $path): string => Storage::disk('public')->url($path), $paths);
    }

    private function cacheKey(string $render): string
    {
        return 'map-render:'.$render;
    }

    /** Variações com mais de um dia são apagadas a cada novo pedido. */
    private function pruneOldRenders(): void
    {
        $disk = Storage::disk('public');
        $limit = now()->subDay()->getTimestamp();

        foreach ($disk->files(self::RENDERS_DIR) as $file) {
            if ($disk->lastModified($file) < $limit) {
                $disk->delete($file);
            }
        }
    }
}
