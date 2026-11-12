<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\DungeonAoe;
use App\Models\DungeonAtmosphere;
use App\Models\DungeonFog;
use App\Models\DungeonMarker;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\GameSessionMap;
use App\Models\MapDrawing;
use App\Models\MapPing;
use App\Models\User;
use App\Support\BoardVersion;
use App\Support\Navigation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use App\Support\Sounds;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Battlemap da masmorra (DungeonMap.tsx): tokens, névoa de guerra, áreas
 * de efeito, marcadores, desenhos, sinais e combate por turnos. A tela
 * consulta o estado por polling (public/js/dungeon/).
 *
 * Diferente do sistema antigo, o servidor filtra o que cada um vê: tokens
 * ocultos e criaturas sob a névoa não chegam aos jogadores.
 */
class DungeonController extends Controller
{
    use AuthorizesMapAccess;

    public function index(Request $request): View
    {
        $user = $request->user();
        $sessions = $this->sessionsFor($user);
        $session = $sessions->firstWhere('id', $request->integer('campanha')) ?? $sessions->first();

        if ($session === null) {
            return view('dungeon.index', ['sessions' => $sessions, 'session' => null, 'map' => null, 'maps' => collect(), 'isGm' => false]);
        }

        $isGm = $user->can('update', $session) && Navigation::for($request)->isGmView();
        $maps = $session->mapsOfType(MapType::Dungeon)->filter(static fn (CampaignMap $map): bool => $isGm || $map->active_in_session)->values();
        $map = $maps->firstWhere('id', $request->integer('mapa')) ?? $maps->firstWhere('active_in_session', true) ?? $maps->first();

        $config = null;
        $actionCharacter = null;

        if ($map !== null) {
            $base = [$session, $map];
            $myCharacters = $user->characters()->where('game_session_id', $session->id)->orderBy('name')->get();
            $actionCharacter = $myCharacters->first();
            $myCharacters = $myCharacters->map(static fn ($character): array => ['id' => $character->id, 'name' => $character->name]);

            $config = [
                'stateUrl' => route('dungeon.state', $base),
                'tokensUrl' => route('dungeon.tokens.store', $base),
                'aoesUrl' => route('dungeon.aoes.store', $base),
                'markersUrl' => route('dungeon.markers.store', $base),
                'fogUrl' => route('dungeon.fog', $base),
                'combatUrl' => route('dungeon.combat', $base),
                'weatherUrl' => route('dungeon.weather', $base),
                'drawingsUrl' => route('maps.drawings.store', $base),
                'pingsUrl' => route('maps.pings.store', $base),
                'isGm' => $isGm,
                'userId' => $user->id,
                'grid' => ['cols' => $map->gridCols(), 'rows' => $map->gridRows()],
                'entrance' => ['x' => $map->entrance_x ?? 10, 'y' => $map->entrance_y ?? 50],
                'conditions' => array_map(static fn (array $c): array => ['name' => $c[0], 'symbol' => $c[1], 'color' => $c[2]], DungeonToken::CONDITIONS),
                'markerCategories' => array_map(static fn (array $c): array => ['label' => $c[0], 'icon' => $c[1], 'color' => $c[2]], DungeonMarker::CATEGORIES),
                'presets' => array_map(static fn (array $p): array => ['name' => $p[0], 'type' => $p[1], 'hp' => $p[2], 'color' => $p[3], 'size' => $p[4]], DungeonToken::PRESETS),
                'myCharacters' => $myCharacters,
                'campaignCharacters' => $isGm
                    ? $session->characters()->with('user:id,name')->orderBy('name')->get(['id', 'name', 'user_id'])
                        ->map(static fn ($character): array => ['id' => $character->id, 'name' => $character->name, 'owner' => $character->user?->name])
                    : [],
            ];
        }

        return view('dungeon.index', compact('sessions', 'session', 'maps', 'map', 'isGm', 'config', 'actionCharacter'));
    }

    /**
     * Estado do battlemap. Tudo (menos os sinais) só volta quando a versão muda.
     */
    public function state(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $isGm = $this->authorizeDungeon($request, $gameSession, $campaignMap);
        $user = $request->user();
        $scope = static fn ($query) => $query->where('game_session_id', $gameSession->id)->where('campaign_map_id', $campaignMap->id);

        $pivot = $gameSession->maps()->whereKey($campaignMap->id)->first()?->pivot;
        $atmosphere = DungeonAtmosphere::query()->tap($scope)->first();

        // Tokens, AoEs, marcadores, desenhos e névoa trocam a versão do tabuleiro
        // no cache a cada escrita (App\Support\BoardVersion), então "nada mudou"
        // custa poucas consultas. Camadas, combate/clima (milissegundos) e a
        // grade do mapa entram pelos próprios updated_at, já carregados aqui.
        $version = md5(implode('|', [
            BoardVersion::fingerprint($gameSession->id, $campaignMap->id),
            $campaignMap->updated_at,
            $atmosphere?->updated_at?->format('Y-m-d H:i:s.v'),
            $pivot?->updated_at,
            $isGm ? 'gm' : 'player',
        ]));

        $pings = MapPing::query()->tap($scope)->with('user:id,name')
            ->where('created_at', '>=', now()->subSeconds(WorldMapController::PING_SECONDS))
            ->get()
            ->map(static fn (MapPing $ping): array => ['id' => $ping->id, 'x' => $ping->x, 'y' => $ping->y, 'color' => $ping->color, 'user_name' => $ping->user?->name ?? 'Aventureiro', 'mine' => $ping->user_id === $user->id]);

        if ($request->query('versao') === $version) {
            return response()->json(['version' => $version, 'changed' => false, 'pings' => $pings]);
        }

        $fog = $campaignMap->fogIn($gameSession, $pivot?->layer_settings);
        $allTokens = DungeonToken::query()->tap($scope)
            ->with(DungeonToken::BOARD_RELATIONS)
            ->orderBy('id')
            ->get();

        $cols = $campaignMap->gridCols();
        $rows = $campaignMap->gridRows();
        $revealed = array_flip($fog['revealed_cells']);
        // Jogador vê o próprio personagem sempre; qualquer outro token (inclusive
        // de outros jogadores e criaturas do mestre) só fora da névoa e se não
        // estiver oculto. Tokens de jogador revelam a névoa ao redor quando se
        // movem, então os companheiros aparecem assim que andam.
        // O mestre no modo Jogador também vê como jogador: suas criaturas não contam como "dele".
        $tokens = $allTokens->filter(static function (DungeonToken $token) use ($isGm, $user, $fog, $revealed, $cols, $rows): bool {
            if ($isGm || $token->isPlayerTokenOf($user)) {
                return true;
            }
            if ($token->is_hidden) {
                return false;
            }
            if (! $fog['enabled']) {
                return true;
            }

            return isset($revealed[self::cellOf($token->x, $token->y, $cols, $rows)]);
        });

        return response()->json([
            'version' => $version,
            'changed' => true,
            'layers' => GameSessionMap::normalizeLayers($pivot?->layer_settings),
            'fog' => $fog,
            'tokens' => $tokens->map(static fn (DungeonToken $token): array => $token->toBoardArray($user, $isGm))->values(),
            'aoes' => DungeonAoe::query()->tap($scope)->orderBy('id')->get()->map(static fn (DungeonAoe $aoe): array => [
                'id' => $aoe->id, 'type' => $aoe->type, 'name' => $aoe->name, 'color' => $aoe->color ?: '#ef4444',
                'x' => $aoe->x, 'y' => $aoe->y, 'radius_feet' => $aoe->radius_feet, 'rotation' => $aoe->rotation,
                'can_edit' => $isGm || $aoe->user_id === $user->id,
            ]),
            'markers' => DungeonMarker::query()->tap($scope)->orderBy('id')->get()->map(static fn (DungeonMarker $marker): array => [
                'id' => $marker->id, 'label' => $marker->label, 'category' => array_key_exists((string) $marker->category, DungeonMarker::CATEGORIES) ? $marker->category : 'note',
                'description' => (string) $marker->description, 'x' => $marker->x, 'y' => $marker->y,
                'can_delete' => $isGm || $marker->user_id === $user->id,
            ]),
            'drawings' => WorldMapController::drawingsFor(MapDrawing::query()->tap($scope)->orderBy('id')->get(), $user, $isGm),
            'combat' => [
                'in_combat' => (bool) $atmosphere?->in_combat,
                'round' => $atmosphere?->combat_round ?? 1,
                'active_token_id' => $atmosphere?->active_token_id,
            ],
            'weather' => array_key_exists((string) $atmosphere?->weather, Sounds::WEATHER) ? $atmosphere->weather : 'none',
            'pings' => $pings,
        ]);
    }

    /**
     * Névoa de guerra (mestre): liga/desliga e as células reveladas.
     */
    public function fog(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        Gate::authorize('update', $gameSession);

        $total = $campaignMap->gridCols() * $campaignMap->gridRows();
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'revealed_cells' => ['present', 'array', 'max:'.$total],
            'revealed_cells.*' => ['integer', 'min:0', 'max:'.($total - 1)],
        ]);

        DungeonFog::saveFor($gameSession, $campaignMap, (bool) $data['enabled'], $data['revealed_cells'], $request->user());

        return response()->json(['message' => 'Névoa de guerra atualizada.']);
    }

    /**
     * Combate (mestre): iniciar, próximo/anterior turno, rolar iniciativa e encerrar.
     * A ordem segue a iniciativa (maior primeiro) dos tokens visíveis.
     */
    public function combat(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        Gate::authorize('update', $gameSession);

        $action = $request->validate(['action' => ['required', Rule::in(['start', 'next', 'prev', 'reset', 'reroll'])]])['action'];

        $atmosphere = DB::transaction(static function () use ($gameSession, $campaignMap, $action): DungeonAtmosphere {
            $atmosphere = DungeonAtmosphere::query()
                ->where('game_session_id', $gameSession->id)
                ->where('campaign_map_id', $campaignMap->id)
                ->lockForUpdate()
                ->first() ?? new DungeonAtmosphere;
            $atmosphere->game_session_id = $gameSession->id;
            $atmosphere->campaign_map_id = $campaignMap->id;

            $tokens = DungeonToken::query()
                ->where('game_session_id', $gameSession->id)
                ->where('campaign_map_id', $campaignMap->id);

            if ($action === 'reroll') {
                foreach ((clone $tokens)->get() as $token) {
                    $token->forceFill(['initiative' => random_int(1, 20)])->save();
                }
            }

            $order = (clone $tokens)->where('is_hidden', false)->orderByDesc('initiative')->orderBy('id')->pluck('id')->all();
            $index = array_search($atmosphere->active_token_id, $order, true);
            $round = $atmosphere->combat_round ?: 1;

            [$inCombat, $round, $active] = match ($action) {
                'start', 'reroll' => [true, $action === 'start' ? 1 : $round, $order[0] ?? null],
                'reset' => [false, 1, null],
                'next' => $index === false || $index >= count($order) - 1
                    ? [true, $index === false ? $round : $round + 1, $order[0] ?? null]
                    : [true, $round, $order[$index + 1]],
                'prev' => $index === false || $index === 0
                    ? [true, max(1, $index === false ? $round : $round - 1), $order[count($order) - 1] ?? null]
                    : [true, $round, $order[$index - 1]],
            };

            $atmosphere->forceFill(['in_combat' => $inCombat, 'combat_round' => $round, 'active_token_id' => $active])->save();

            return $atmosphere;
        });

        return response()->json(['combat' => [
            'in_combat' => $atmosphere->in_combat,
            'round' => $atmosphere->combat_round,
            'active_token_id' => $atmosphere->active_token_id,
        ]]);
    }

    /**
     * Clima visual do battlemap (mestre): chuva, névoa, brasas ou neve.
     */
    public function weather(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        Gate::authorize('update', $gameSession);

        $weather = $request->validate(['weather' => ['required', Rule::in(array_keys(Sounds::WEATHER))]], [], ['weather' => 'clima'])['weather'];

        $atmosphere = DungeonAtmosphere::query()
            ->where('game_session_id', $gameSession->id)
            ->where('campaign_map_id', $campaignMap->id)
            ->first() ?? new DungeonAtmosphere;
        $atmosphere->game_session_id = $gameSession->id;
        $atmosphere->campaign_map_id = $campaignMap->id;
        $atmosphere->weather = $weather === 'none' ? null : $weather;
        $atmosphere->updated_by = $request->user()->id;
        $atmosphere->save();

        return response()->json(['weather' => $weather, 'message' => 'Clima: '.Sounds::WEATHER[$weather].'.']);
    }

    /** Índice da célula da grade que contém o ponto (em %). */
    public static function cellOf(float $x, float $y, int $cols, int $rows): int
    {
        $col = min($cols - 1, max(0, (int) floor($x / 100 * $cols)));
        $row = min($rows - 1, max(0, (int) floor($y / 100 * $rows)));

        return $row * $cols + $col;
    }

    /**
     * @return Collection<int, GameSession>
     */
    private function sessionsFor(User $user): Collection
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
