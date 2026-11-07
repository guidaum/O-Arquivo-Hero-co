<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\DungeonFog;
use App\Models\GameSession;
use App\Models\GameSessionMap;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Gerenciador de Mapas (MapManager.tsx): o mestre envia mapas do mundo e
 * masmorras para a campanha, decide quais ficam visíveis para os jogadores
 * e ajusta camadas, névoa de guerra e escala da régua de cada mapa.
 */
class MapManagerController extends Controller
{
    private const IMAGE_RULES = ['image', 'mimes:jpeg,png,webp', 'max:10240'];

    public function index(Request $request): View
    {
        $user = $request->user();
        $navigation = Navigation::for($request);

        if (! $navigation->isGmView()) {
            return view('map-manager.player-mode', ['canBeGm' => $navigation->canBeGm()]);
        }

        $sessions = $this->sessionsFor($user);
        $session = $sessions->firstWhere('id', $request->integer('campanha')) ?? $sessions->first();
        $type = MapType::tryFrom((string) $request->query('tipo'));
        $source = in_array($request->query('origem'), ['custom', 'presets'], true) ? $request->query('origem') : 'all';

        $maps = collect();
        $all = collect();

        if ($session !== null) {
            $all = $session->mapsOfType(MapType::World)->concat($session->mapsOfType(MapType::Dungeon));
            $all->each(static function (CampaignMap $map) use ($session): void {
                $map->setAttribute('fog', $map->fogIn($session, $map->session_layer_settings));
            });
            $maps = $all
                ->when($type !== null, static fn (Collection $maps) => $maps->where('type', $type))
                ->when($source === 'custom', static fn (Collection $maps) => $maps->reject->isPreset())
                ->when($source === 'presets', static fn (Collection $maps) => $maps->filter->isPreset())
                ->values();
        }

        return view('map-manager.index', [
            'sessions' => $sessions,
            'session' => $session,
            'maps' => $maps,
            'type' => $type,
            'source' => $source,
            'stats' => [
                'total' => $all->count(),
                'active' => $all->where('active_in_session', true)->count(),
                'world' => $all->where('type', MapType::World)->count(),
                'dungeon' => $all->where('type', MapType::Dungeon)->count(),
                'custom' => $all->reject->isPreset()->count(),
            ],
        ]);
    }

    public function store(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $this->validated($request, 'createMap', true);
        $map = new CampaignMap([...$data, 'active' => true]);
        $map->game_session_id = $gameSession->id;
        $map->created_by = $request->user()->id;
        $map->image_path = $request->file('image')->store('maps/custom', 'public');

        if ($map->type === MapType::Dungeon) {
            $map->entrance_x = 10;
            $map->entrance_y = 50;
        }

        $map->save();

        return redirect()
            ->route('map-manager.index', ['campanha' => $gameSession->id])
            ->with('status', 'Mapa "'.$map->name.'" criado na campanha. Já está visível para os jogadores.');
    }

    public function update(Request $request, GameSession $gameSession, CampaignMap $campaignMap): RedirectResponse
    {
        $this->ensureCampaignMap($gameSession, $campaignMap);
        Gate::authorize('update', $campaignMap);

        $data = $this->validated($request, 'editMap', false, $campaignMap->type);
        $oldImage = null;

        if ($request->hasFile('image')) {
            $oldImage = $campaignMap->image_path;
            $campaignMap->image_path = $request->file('image')->store('maps/custom', 'public');
        }

        $campaignMap->fill($data)->save();
        $gameSession->setMapActive($campaignMap, $request->boolean('active'));
        self::deleteStoredImage($oldImage);

        return redirect()
            ->route('map-manager.index', ['campanha' => $gameSession->id])
            ->with('status', 'Mapa "'.$campaignMap->name.'" atualizado.');
    }

    public function destroy(GameSession $gameSession, CampaignMap $campaignMap): RedirectResponse
    {
        $this->ensureCampaignMap($gameSession, $campaignMap);
        Gate::authorize('delete', $campaignMap);

        $image = $campaignMap->image_path;
        $campaignMap->delete();
        self::deleteStoredImage($image);

        return redirect()
            ->route('map-manager.index', ['campanha' => $gameSession->id])
            ->with('status', 'Mapa "'.$campaignMap->name.'" excluído, com seus marcadores e desenhos.');
    }

    /**
     * Ativar/ocultar para os jogadores (também vale para os mapas padrão, por campanha).
     */
    public function toggleActive(Request $request, GameSession $gameSession, CampaignMap $campaignMap): RedirectResponse
    {
        Gate::authorize('update', $gameSession);
        $this->ensureAvailable($gameSession, $campaignMap);

        $active = $request->boolean('active');
        $gameSession->setMapActive($campaignMap, $active);

        return back()->with('status', 'Mapa "'.$campaignMap->name.'" '.($active ? 'ativado (visível aos jogadores).' : 'desativado (oculto dos jogadores).'));
    }

    /**
     * Inspetor de camadas: camadas visuais, névoa de guerra e régua.
     */
    public function layers(GameSession $gameSession, CampaignMap $campaignMap): View
    {
        Gate::authorize('update', $gameSession);
        $this->ensureAvailable($gameSession, $campaignMap);

        $pivot = $gameSession->maps()->whereKey($campaignMap->id)->first()?->pivot;
        $legacy = $pivot?->layer_settings;

        return view('map-manager.layers', [
            'session' => $gameSession,
            'map' => $campaignMap,
            'config' => [
                'saveUrl' => route('map-manager.layers.update', [$gameSession, $campaignMap]),
                'backUrl' => route('map-manager.index', ['campanha' => $gameSession->id]),
                'imageUrl' => $campaignMap->image_url,
                'cols' => $campaignMap->gridCols(),
                'rows' => $campaignMap->gridRows(),
                'entrance' => ['x' => $campaignMap->entrance_x ?? 10, 'y' => $campaignMap->entrance_y ?? 50],
                'layers' => GameSessionMap::normalizeLayers($legacy),
                'fog' => $campaignMap->fogIn($gameSession, $legacy),
                'units' => array_map(static fn (array $unit): string => $unit[0], GameSessionMap::SCALE_UNITS),
            ],
        ]);
    }

    public function saveLayers(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        Gate::authorize('update', $gameSession);
        $this->ensureAvailable($gameSession, $campaignMap);

        $total = $campaignMap->gridCols() * $campaignMap->gridRows();
        $data = $request->validate([
            'layers.show_background' => ['required', 'boolean'],
            'layers.background_opacity' => ['required', 'integer', 'min:0', 'max:100'],
            'layers.show_grid' => ['required', 'boolean'],
            'layers.grid_opacity' => ['required', 'integer', 'min:0', 'max:100'],
            'layers.show_tokens' => ['required', 'boolean'],
            'layers.fog_opacity' => ['required', 'integer', 'min:0', 'max:100'],
            'layers.grid_scale.unit' => ['required', Rule::in(array_keys(GameSessionMap::SCALE_UNITS))],
            'layers.grid_scale.value_per_square' => ['required', 'numeric', 'min:0.1', 'max:10000'],
            'fog.enabled' => ['required', 'boolean'],
            'fog.revealed_cells' => ['present', 'array', 'max:'.$total],
            'fog.revealed_cells.*' => ['integer', 'min:0', 'max:'.($total - 1)],
        ], [], ['layers.grid_scale.value_per_square' => 'valor por quadrado']);

        $layers = GameSessionMap::normalizeLayers($data['layers']);
        $user = $request->user();

        DB::transaction(static function () use ($gameSession, $campaignMap, $layers, $data, $user): void {
            if ($gameSession->maps()->whereKey($campaignMap->id)->exists()) {
                $gameSession->maps()->updateExistingPivot($campaignMap->id, ['layer_settings' => $layers]);
            } else {
                $gameSession->maps()->attach($campaignMap->id, ['active' => $campaignMap->active, 'layer_settings' => $layers]);
            }

            DungeonFog::saveFor($gameSession, $campaignMap, (bool) $data['fog']['enabled'], $data['fog']['revealed_cells'], $user);
        });

        return response()->json(['message' => 'Camadas, névoa de guerra e régua do mapa "'.$campaignMap->name.'" salvas.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, string $bag, bool $creating, ?MapType $type = null): array
    {
        $type ??= MapType::tryFrom((string) $request->input('type'));

        $data = $request->validateWithBag($bag, [
            'type' => $creating ? ['required', Rule::enum(MapType::class)] : ['prohibited'],
            'name' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'image' => [$creating ? 'required' : 'nullable', ...self::IMAGE_RULES],
            'default_scale' => ['nullable', 'string', 'max:64'],
            'theme' => ['nullable', 'string', 'max:64'],
            'grid_cols' => [$type === MapType::Dungeon ? 'required' : 'nullable', 'integer', 'min:4', 'max:80'],
            'grid_rows' => [$type === MapType::Dungeon ? 'required' : 'nullable', 'integer', 'min:4', 'max:80'],
        ], [
            'image.required' => 'Envie a imagem do mapa.',
        ], [
            'type' => 'tipo',
            'name' => 'nome do mapa',
            'subtitle' => 'subtítulo',
            'image' => 'imagem',
            'default_scale' => 'escala',
            'theme' => 'tema',
            'grid_cols' => 'colunas',
            'grid_rows' => 'linhas',
        ]);

        unset($data['image']);

        if ($type === MapType::World) {
            unset($data['grid_cols'], $data['grid_rows'], $data['theme']);
            $data['default_scale'] = ($data['default_scale'] ?? '') !== '' ? $data['default_scale'] : '1 cm = 25 léguas';
            $data['subtitle'] = ($data['subtitle'] ?? '') !== '' ? $data['subtitle'] : 'Mapa do mundo personalizado';
        } else {
            unset($data['default_scale']);
            $data['theme'] = ($data['theme'] ?? '') !== '' ? $data['theme'] : 'Personalizado';
            $data['subtitle'] = ($data['subtitle'] ?? '') !== '' ? $data['subtitle'] : 'Mapa tático de batalha';
        }

        return $data;
    }

    private function ensureCampaignMap(GameSession $session, CampaignMap $map): void
    {
        abort_if($map->isPreset() || $map->game_session_id !== $session->id, 404);
    }

    private function ensureAvailable(GameSession $session, CampaignMap $map): void
    {
        abort_unless($map->isPreset() || $map->game_session_id === $session->id, 404);
    }

    private static function deleteStoredImage(?string $path): void
    {
        if ($path !== null && $path !== '' && ! str_starts_with($path, 'http') && ! str_starts_with($path, 'maps/presets/')) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * Campanhas que o usuário mestra (administradores: todas).
     *
     * @return Collection<int, GameSession>
     */
    private function sessionsFor(User $user): Collection
    {
        return ($user->isAdmin() ? GameSession::query() : $user->gmSessions())
            ->orderBy('name')
            ->get(['id', 'name', 'gm_id', 'active']);
    }
}
