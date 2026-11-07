<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CustomSound;
use App\Models\DungeonAtmosphere;
use App\Models\GameSession;
use App\Support\Sounds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Ambientação sonora da campanha (GMAudioController.tsx): o mestre escolhe a
 * trilha (procedural ou da biblioteca) e dispara efeitos "para a mesa"; os
 * participantes recebem pelo polling (menu de ações, public/js/tools/ambience.js).
 * Fica na linha de dungeon_atmospheres sem mapa, que vale para toda a campanha.
 */
class AmbienceController extends Controller
{
    /** Efeitos mais antigos que isto não tocam ao chegar (polling atrasado). */
    public const EFFECT_TTL_SECONDS = 15;

    public function state(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('view', $gameSession);

        $atmosphere = self::campaignRow($gameSession);
        $version = md5(($atmosphere?->updated_at?->format('Y-m-d H:i:s.u') ?? '').'|'.($atmosphere?->effect_at?->format('Y-m-d H:i:s.v') ?? ''));

        if ($request->query('versao') === $version) {
            return response()->json(['version' => $version, 'changed' => false]);
        }

        return response()->json(['version' => $version, 'changed' => true, ...self::payload($atmosphere)]);
    }

    /**
     * Trilha da campanha: uma ambientação procedural, um som da biblioteca ou silêncio.
     */
    public function update(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);
        $user = $request->user();

        $data = $request->validate([
            'soundscape' => ['required', Rule::in(['none', 'custom', ...array_keys(Sounds::SOUNDSCAPES)])],
            'sound_id' => ['required_if:soundscape,custom', 'nullable', 'integer'],
            'volume' => ['nullable', 'integer', 'min:0', 'max:100'],
        ], [], ['soundscape' => 'ambientação', 'sound_id' => 'trilha']);

        $atmosphere = self::campaignRow($gameSession) ?? new DungeonAtmosphere;
        $atmosphere->game_session_id = $gameSession->id;
        $atmosphere->campaign_map_id = null;

        if ($data['soundscape'] === 'custom') {
            $sound = CustomSound::query()->availableTo($user, $gameSession)->find((int) $data['sound_id']);
            abort_if($sound === null, 422, 'A trilha escolhida não está na biblioteca da campanha.');
            $atmosphere->soundscape = 'custom';
            $atmosphere->custom_ambient_path = $sound->path;
            $atmosphere->custom_ambient_name = $sound->name;
        } else {
            $atmosphere->soundscape = $data['soundscape'] === 'none' ? null : $data['soundscape'];
            $atmosphere->custom_ambient_path = null;
            $atmosphere->custom_ambient_name = null;
        }

        if (isset($data['volume'])) {
            $atmosphere->volume = (int) $data['volume'];
        }

        $atmosphere->updated_by = $user->id;
        $atmosphere->save();

        return response()->json([
            'message' => $atmosphere->soundscape === null ? 'Ambientação desligada.' : 'Ambientação: '.self::label($atmosphere).'.',
            ...self::payload($atmosphere),
        ]);
    }

    /**
     * Efeito sonoro tocado para todos os participantes conectados.
     */
    public function effect(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $key = $request->validate(['effect' => ['required', Rule::in(array_keys(Sounds::EFFECTS))]], [], ['effect' => 'efeito'])['effect'];

        $atmosphere = self::campaignRow($gameSession) ?? new DungeonAtmosphere;
        $atmosphere->game_session_id = $gameSession->id;
        $atmosphere->campaign_map_id = null;
        $atmosphere->effect_key = $key;
        $atmosphere->effect_at = now();
        $atmosphere->updated_by = $request->user()->id;
        $atmosphere->save();

        return response()->json(['message' => Sounds::EFFECTS[$key][0].' tocado para a mesa.', ...self::payload($atmosphere)]);
    }

    private static function campaignRow(GameSession $session): ?DungeonAtmosphere
    {
        return DungeonAtmosphere::query()
            ->where('game_session_id', $session->id)
            ->whereNull('campaign_map_id')
            ->first();
    }

    private static function label(DungeonAtmosphere $atmosphere): string
    {
        return $atmosphere->soundscape === 'custom'
            ? ($atmosphere->custom_ambient_name ?: 'Trilha personalizada')
            : (Sounds::SOUNDSCAPES[$atmosphere->soundscape][0] ?? 'Silêncio');
    }

    /**
     * @return array<string, mixed>
     */
    private static function payload(?DungeonAtmosphere $atmosphere): array
    {
        $soundscape = $atmosphere?->soundscape;
        $custom = $soundscape === 'custom' && $atmosphere?->custom_ambient_url !== null;

        if (! $custom && ! array_key_exists((string) $soundscape, Sounds::SOUNDSCAPES)) {
            $soundscape = null;
        }

        $effectAt = $atmosphere?->effect_at;

        return [
            'soundscape' => $soundscape,
            'label' => $atmosphere !== null && $soundscape !== null ? self::label($atmosphere) : 'Silêncio',
            'track_url' => $custom ? $atmosphere->custom_ambient_url : null,
            'volume' => $atmosphere?->volume ?? 50,
            'effect' => $effectAt !== null && $atmosphere->effect_key !== null ? [
                'key' => $atmosphere->effect_key,
                'at' => (int) $effectAt->getTimestampMs(),
                'fresh' => $effectAt->greaterThan(now()->subSeconds(self::EFFECT_TTL_SECONDS)),
            ] : null,
        ];
    }
}
