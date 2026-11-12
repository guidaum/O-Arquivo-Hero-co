<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\CharacterSheet;
use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\Character;
use App\Models\DungeonFog;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Tokens do battlemap. O jogador entra com o próprio personagem e move,
 * ajusta PV e condições só do próprio token; o mestre controla todos,
 * coloca criaturas e oculta tokens. Posições se encaixam na grade.
 */
class DungeonTokenController extends Controller
{
    use AuthorizesMapAccess;

    /** Raio revelado ao redor de um jogador que se move (5×5 células, como no sistema antigo). */
    private const REVEAL_RADIUS = 3;

    public function store(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        $user = $request->user();
        $isGm = $user->can('update', $gameSession);

        $data = $request->validate([
            'mode' => ['required', Rule::in(['character', 'preset', 'custom'])],
            'character_id' => ['required_if:mode,character', 'nullable', 'integer'],
            'preset' => ['required_if:mode,preset', 'nullable', Rule::in(array_keys(DungeonToken::PRESETS))],
            'name' => ['required_if:mode,custom', 'nullable', 'string', 'max:255'],
            'type' => ['nullable', Rule::in(['monster', 'npc'])],
            'hp' => ['nullable', 'integer', 'min:1', 'max:99999'],
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'size' => ['nullable', 'numeric', Rule::in([1, 2, 3, 4])],
            'is_hidden' => ['boolean'],
            'x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'y' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [], ['name' => 'nome', 'hp' => 'PV']);

        if ($data['mode'] !== 'character' && ! $isGm) {
            abort(403, 'Só o mestre coloca criaturas no mapa.');
        }

        $token = new DungeonToken;
        $token->game_session_id = $gameSession->id;
        $token->campaign_map_id = $campaignMap->id;

        if ($data['mode'] === 'character') {
            $character = Character::query()->whereKey((int) $data['character_id'])->where('game_session_id', $gameSession->id)->first();
            abort_if($character === null, 404, 'Personagem não encontrado nesta campanha.');
            abort_unless($isGm || $character->user_id === $user->id, 403, 'Você só pode entrar com o seu próprio personagem.');

            $existing = DungeonToken::query()
                ->where('game_session_id', $gameSession->id)
                ->where('campaign_map_id', $campaignMap->id)
                ->where('character_id', $character->id)
                ->first();

            if ($existing !== null) {
                return response()->json(['message' => $character->name.' já está no mapa.', 'token' => $existing->load(DungeonToken::BOARD_RELATIONS)->toBoardArray($user, $isGm)]);
            }

            [$hp, $maxHp] = self::vitals($character);
            $ini = (int) ($character->rollStats()['INI'] ?? 0);
            // NPCs e monstros da campanha (colocados pelo mestre) seguem a névoa como criaturas.
            $type = $character->is_monster ? 'monster' : ($character->is_npc ? 'npc' : 'player');
            $players = DungeonToken::query()->where('game_session_id', $gameSession->id)->where('campaign_map_id', $campaignMap->id)->where('type', 'player')->count();

            $token->fill([
                'name' => $character->name,
                'type' => $type,
                'color' => $type === 'player' ? DungeonToken::PLAYER_COLORS[$players % count(DungeonToken::PLAYER_COLORS)] : ($character->color ?: ($type === 'monster' ? '#ef4444' : '#10b981')),
                'hp' => $hp,
                'max_hp' => $maxHp,
                'initiative' => random_int(1, 20) + $ini,
                'size' => $character->is_monster ? (float) max(1, min(4, (int) $character->monster_size)) : 1,
                'is_hidden' => false,
            ]);
            $token->character_id = $character->id;
            $token->user_id = $character->user_id;
            $token->avatar_path = $character->image_path;
        } else {
            [$name, $type, $hp, $color, $size] = $data['mode'] === 'preset'
                ? DungeonToken::PRESETS[$data['preset']]
                : [$data['name'], $data['type'] ?? 'monster', (int) ($data['hp'] ?? 10), $data['color'] ?? '#ef4444', (float) ($data['size'] ?? 1)];

            $token->fill([
                'name' => $name,
                'type' => $type,
                'color' => $color,
                'hp' => $hp,
                'max_hp' => $hp,
                'size' => $size,
                'initiative' => random_int(1, 20),
                'is_hidden' => (bool) ($data['is_hidden'] ?? false),
            ]);
            $token->user_id = $user->id;
        }

        $cols = $campaignMap->gridCols();
        $rows = $campaignMap->gridRows();
        $token->x = self::snap((float) ($data['x'] ?? $campaignMap->entrance_x ?? 10), $cols, (float) $token->size);
        $token->y = self::snap((float) ($data['y'] ?? $campaignMap->entrance_y ?? 50), $rows, (float) $token->size);
        $token->conditions = [];
        $token->last_moved_by = $user->id;
        $token->last_moved_at = now();
        $token->save();

        $this->revealAround($token, $gameSession, $campaignMap, $user);

        return response()->json([
            'message' => $token->name.' entrou no mapa.',
            'token' => $token->load(DungeonToken::BOARD_RELATIONS)->toBoardArray($user, $isGm),
        ], 201);
    }

    public function update(Request $request, GameSession $gameSession, CampaignMap $campaignMap, DungeonToken $token): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        $this->ensureOnMap($token, $gameSession, $campaignMap);
        $user = $request->user();
        $isGm = $user->can('update', $gameSession);
        abort_unless($isGm || $token->user_id === $user->id, 403, 'Você só controla o seu próprio token.');

        $data = $request->validate([
            'x' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'y' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'hp' => ['sometimes', 'integer', 'min:0', 'max:99999'],
            'max_hp' => ['sometimes', 'integer', 'min:1', 'max:99999'],
            'conditions' => ['sometimes', 'array', 'max:10'],
            'conditions.*' => [Rule::in(array_keys(DungeonToken::CONDITIONS))],
            'initiative' => ['sometimes', 'integer', 'min:-99', 'max:999'],
            'name' => ['sometimes', 'string', 'max:255'],
            'is_hidden' => ['sometimes', 'boolean'],
            'size' => ['sometimes', 'numeric', Rule::in([1, 2, 3, 4])],
        ]);

        // Só o mestre muda nome, PV máximo, tamanho e visibilidade.
        if (! $isGm) {
            $data = array_intersect_key($data, array_flip(['x', 'y', 'hp', 'conditions', 'initiative']));
        }

        if (isset($data['size'])) {
            $token->size = (float) $data['size'];
        }

        $moved = isset($data['x']) || isset($data['y']);
        if ($moved) {
            $token->x = self::snap((float) ($data['x'] ?? $token->x), $campaignMap->gridCols(), (float) $token->size);
            $token->y = self::snap((float) ($data['y'] ?? $token->y), $campaignMap->gridRows(), (float) $token->size);
            $token->last_moved_by = $user->id;
            $token->last_moved_at = now();
        }

        if (isset($data['max_hp'])) {
            $token->max_hp = (int) $data['max_hp'];
        }
        if (isset($data['hp'])) {
            $token->hp = min((int) $data['hp'], max($token->max_hp, 0));
        }
        if (isset($data['conditions'])) {
            $token->conditions = array_values(array_unique($data['conditions']));
        }
        foreach (['initiative', 'name', 'is_hidden'] as $field) {
            if (array_key_exists($field, $data)) {
                $token->{$field} = $data[$field];
            }
        }

        $token->save();

        if ($moved) {
            $this->revealAround($token, $gameSession, $campaignMap, $user);
        }

        return response()->json(['token' => $token->load(DungeonToken::BOARD_RELATIONS)->toBoardArray($user, $isGm)]);
    }

    public function destroy(Request $request, GameSession $gameSession, CampaignMap $campaignMap, DungeonToken $token): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        $this->ensureOnMap($token, $gameSession, $campaignMap);
        $user = $request->user();
        abort_unless($user->can('update', $gameSession) || $token->user_id === $user->id, 403, 'Você só pode remover o seu próprio token.');

        $token->delete();

        return response()->json(['message' => $token->name.' saiu do mapa.']);
    }

    /**
     * Encaixa a posição na grade: centro da célula para tokens de tamanho
     * ímpar, cruzamento das linhas para tamanho par, sempre dentro do mapa.
     */
    public static function snap(float $value, int $cells, float $size): float
    {
        $cell = 100 / max(1, $cells);
        $size = max(1.0, $size);
        $snapped = ((int) $size) % 2 === 1
            ? (floor($value / $cell) + 0.5) * $cell
            : round($value / $cell) * $cell;
        $half = $size * $cell / 2;

        return round(min(100 - $half, max($half, $snapped)), 3);
    }

    /**
     * PV atuais e máximos da ficha (máximo pela fórmula da campanha).
     *
     * @return array{0: int, 1: int}
     */
    public static function vitals(Character $character): array
    {
        $max = CharacterSheet::maxPv($character);
        $current = $character->current_pv ?? $max;

        return [max(0, min((int) $current, $max)), $max];
    }

    /** Jogador que se move revela a névoa ao redor (autoRevealOnMove do sistema antigo). */
    private function revealAround(DungeonToken $token, GameSession $session, CampaignMap $map, User $user): void
    {
        $type = $token->type instanceof \BackedEnum ? $token->type->value : (string) $token->type;

        if ($type !== 'player') {
            return;
        }

        $fog = $map->fogIn($session, $session->maps()->whereKey($map->id)->first()?->pivot?->layer_settings);

        if (! $fog['enabled']) {
            return;
        }

        $cols = $map->gridCols();
        $rows = $map->gridRows();
        $cell = DungeonController::cellOf($token->x, $token->y, $cols, $rows);
        $col = $cell % $cols;
        $row = intdiv($cell, $cols);
        $reach = self::REVEAL_RADIUS - 1;
        $cells = $fog['revealed_cells'];

        for ($dy = -$reach; $dy <= $reach; $dy++) {
            for ($dx = -$reach; $dx <= $reach; $dx++) {
                if ($col + $dx >= 0 && $col + $dx < $cols && $row + $dy >= 0 && $row + $dy < $rows) {
                    $cells[] = ($row + $dy) * $cols + $col + $dx;
                }
            }
        }

        if (count(array_unique($cells)) !== count($fog['revealed_cells'])) {
            DungeonFog::saveFor($session, $map, true, $cells, $user);
        }
    }

    private function ensureOnMap(DungeonToken $token, GameSession $session, CampaignMap $map): void
    {
        abort_unless($token->game_session_id === $session->id && $token->campaign_map_id === $map->id, 404);
    }
}
