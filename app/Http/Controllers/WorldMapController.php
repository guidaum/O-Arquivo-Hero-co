<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\MapDrawing;
use App\Models\MapPin;
use App\Models\MapPing;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Mapa do Mundo (WorldMap.tsx): mapa da campanha com marcadores,
 * desenhos e sinais (pings). A tela pede o estado por polling.
 */
class WorldMapController extends Controller
{
    use AuthorizesMapAccess;

    /** Sinais somem depois de alguns segundos, como no sistema antigo. */
    public const PING_SECONDS = 6;

    public function index(Request $request): View
    {
        $user = $request->user();
        $sessions = $this->sessionsFor($user);
        $session = $sessions->firstWhere('id', $request->integer('campanha')) ?? $sessions->first();

        if ($session === null) {
            return view('world-map.index', ['sessions' => $sessions, 'session' => null, 'map' => null, 'maps' => collect(), 'isGm' => false]);
        }

        $isGm = $user->can('update', $session) && Navigation::for($request)->isGmView();
        $maps = $session->mapsOfType(MapType::World)->filter(static fn (CampaignMap $map): bool => $isGm || $map->active_in_session)->values();
        $map = $maps->firstWhere('id', $request->integer('mapa')) ?? $maps->firstWhere('active_in_session', true) ?? $maps->first();

        return view('world-map.index', [
            'sessions' => $sessions,
            'session' => $session,
            'maps' => $maps,
            'map' => $map,
            'isGm' => $isGm,
            'config' => $map === null ? null : [
                'stateUrl' => route('world-map.state', [$session, $map]),
                'pinsUrl' => route('world-map.pins.store', [$session, $map]),
                'drawingsUrl' => route('maps.drawings.store', [$session, $map]),
                'pingsUrl' => route('maps.pings.store', [$session, $map]),
                'isGm' => $isGm,
                'userId' => $user->id,
                'categories' => MapPin::CATEGORIES,
                'icons' => array_map(static fn (array $icon): array => ['id' => $icon[0], 'label' => $icon[1]], MapPin::ICONS),
                'dangerLevels' => MapPin::DANGER_LEVELS,
                'statuses' => MapPin::STATUSES,
                'dungeonUrl' => $user->can('use-feature', 'dungeon') ? route('dungeon.index') : null,
            ],
        ]);
    }

    /**
     * Estado do mapa para o polling. Marcadores e desenhos só voltam quando
     * a versão mudou; os sinais (pings) recentes vêm sempre.
     */
    public function state(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $isGm = $this->authorizeMap($request, $gameSession, $campaignMap);
        $user = $request->user();

        $pins = MapPin::query()
            ->where('game_session_id', $gameSession->id)
            ->where('campaign_map_id', $campaignMap->id)
            ->when(! $isGm, static fn ($query) => $query->where('is_secret', false));
        $drawings = MapDrawing::query()
            ->where('game_session_id', $gameSession->id)
            ->where('campaign_map_id', $campaignMap->id);

        $version = md5(implode('|', [
            (clone $pins)->count(), (clone $pins)->max('updated_at'),
            (clone $drawings)->count(), (clone $drawings)->max('updated_at'),
            $isGm ? 'gm' : 'player',
        ]));

        $pings = MapPing::query()
            ->with('user:id,name')
            ->where('game_session_id', $gameSession->id)
            ->where('campaign_map_id', $campaignMap->id)
            ->where('created_at', '>=', now()->subSeconds(self::PING_SECONDS))
            ->get()
            ->map(static fn (MapPing $ping): array => [
                'id' => $ping->id,
                'x' => $ping->x,
                'y' => $ping->y,
                'color' => $ping->color,
                'user_name' => $ping->user?->name ?? 'Aventureiro',
                'mine' => $ping->user_id === $user->id,
            ]);

        if ($request->query('versao') === $version) {
            return response()->json(['version' => $version, 'changed' => false, 'pings' => $pings]);
        }

        return response()->json([
            'version' => $version,
            'changed' => true,
            'pins' => $pins->orderBy('id')->get()->map(static fn (MapPin $pin): array => $pin->toMapArray($user, $isGm)),
            'drawings' => self::drawingsFor($drawings->orderBy('id')->get(), $user, $isGm),
            'pings' => $pings,
        ]);
    }

    /**
     * Ativar ou desativar o mapa na campanha (atalho do mestre no seletor de mapas).
     */
    public function toggleActive(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        Gate::authorize('update', $gameSession);
        abort_unless($campaignMap->isPreset() || $campaignMap->game_session_id === $gameSession->id, 404);

        $active = $request->validate(['active' => ['required', 'boolean']])['active'];
        $gameSession->setMapActive($campaignMap, (bool) $active);

        return response()->json([
            'active' => (bool) $active,
            'message' => $active ? 'Mapa ativado para os jogadores.' : 'Mapa ocultado dos jogadores.',
        ]);
    }

    /**
     * @param  Collection<int, MapDrawing>  $drawings
     * @return list<array<string, mixed>>
     */
    public static function drawingsFor(Collection $drawings, User $user, bool $isGm): array
    {
        return $drawings->map(static fn (MapDrawing $drawing): array => [
            'id' => $drawing->id,
            'points' => $drawing->points,
            'color' => $drawing->color,
            'fill_color' => $drawing->fill_color,
            'size' => $drawing->size,
            'is_closed' => $drawing->is_closed,
            'is_polygon' => $drawing->is_polygon,
            'mine' => $drawing->user_id === $user->id,
            'can_delete' => $isGm || $drawing->user_id === $user->id,
        ])->all();
    }

    /**
     * Campanhas que o usuário mestra ou joga (administradores veem todas).
     *
     * @return \Illuminate\Support\Collection<int, GameSession>
     */
    private function sessionsFor(User $user): \Illuminate\Support\Collection
    {
        if ($user->isAdmin()) {
            return GameSession::query()->orderBy('name')->get(['id', 'name', 'gm_id', 'active']);
        }

        return $user->gmSessions()->get(['id', 'name', 'gm_id', 'active'])
            ->merge($user->playerSessions()->get(['game_sessions.id', 'name', 'gm_id', 'active']))
            ->unique('id')
            ->sortBy('name')
            ->values();
    }
}
