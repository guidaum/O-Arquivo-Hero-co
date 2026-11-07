<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Enums\MapType;
use App\Http\Controllers\DungeonTokenController;
use App\Models\CampaignMap;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\User;

/**
 * Criaturas colocadas pelo painel do mestre numa masmorra da campanha:
 * perto da entrada, em fileiras de cinco, encaixadas na grade.
 */
trait SpawnsDungeonTokens
{
    protected function dungeonMapOf(GameSession $session, int $mapId): CampaignMap
    {
        $map = $session->mapsOfType(MapType::Dungeon)->firstWhere('id', $mapId);
        abort_if($map === null, 404, 'Masmorra não encontrada nesta campanha.');

        return $map;
    }

    /**
     * @param  array{name: string, type: string, color: string, hp: int, max_hp: int, size: int|float, initiative: int, is_hidden: bool, character_id?: int|null, avatar_path?: string|null}  $attributes
     */
    protected function spawnToken(GameSession $session, CampaignMap $map, User $gm, array $attributes, int $index = 0): DungeonToken
    {
        $cols = $map->gridCols();
        $rows = $map->gridRows();
        $size = (float) max(1, min(4, $attributes['size']));

        $token = new DungeonToken;
        $token->fill([
            ...$attributes,
            'size' => $size,
            'conditions' => [],
        ]);
        $token->game_session_id = $session->id;
        $token->campaign_map_id = $map->id;
        $token->user_id = $gm->id;

        $x = min(95.0, max(5.0, (float) ($map->entrance_x ?? 10) + ($index % 5) * (100 / $cols)));
        $y = min(95.0, max(5.0, (float) ($map->entrance_y ?? 50) + intdiv($index, 5) * (100 / $rows)));
        $token->x = DungeonTokenController::snap($x, $cols, $size);
        $token->y = DungeonTokenController::snap($y, $rows, $size);
        $token->last_moved_by = $gm->id;
        $token->last_moved_at = now();
        $token->save();

        return $token;
    }
}
