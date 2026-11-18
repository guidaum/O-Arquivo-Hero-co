<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\User;
use App\Support\BoardGrid;

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

        $gridType = $map->gridTypeIn($session);
        $entranceX = (float) ($map->entrance_x ?? 10);
        $entranceY = (float) ($map->entrance_y ?? 50);

        if ($gridType === BoardGrid::HEX) {
            // Hexágonos: conta células a partir da entrada (cinco por fileira).
            [$col, $row] = BoardGrid::colRowOf($entranceX, $entranceY, $cols, $rows, $gridType);
            [$x, $y] = BoardGrid::center(min($cols - 1, $col + $index % 5), min($rows - 1, $row + intdiv($index, 5)), $cols, $rows, $gridType);
            $token->x = round($x, 3);
            $token->y = round($y, 3);
        } else {
            $x = min(95.0, max(5.0, $entranceX + ($index % 5) * (100 / $cols)));
            $y = min(95.0, max(5.0, $entranceY + intdiv($index, 5) * (100 / $rows)));
            [$token->x, $token->y] = BoardGrid::snap($x, $y, $cols, $rows, $size);
        }
        $token->last_moved_by = $gm->id;
        $token->last_moved_at = now();
        $token->save();

        return $token;
    }
}
