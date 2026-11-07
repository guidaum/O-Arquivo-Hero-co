<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\MapPing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sinais (pings) sobre um mapa: um pulso visto por todos durante alguns
 * segundos. Âmbar para o mestre, ciano para os jogadores (sistema antigo).
 */
class MapPingController extends Controller
{
    use AuthorizesMapAccess;

    public const GM_COLOR = '#f59e0b';

    public const PLAYER_COLOR = '#38bdf8';

    public function store(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $isGm = $this->authorizeMap($request, $gameSession, $campaignMap);

        $data = $request->validate([
            'x' => ['required', 'numeric', 'min:0', 'max:100'],
            'y' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        // Sinais antigos não servem para nada: são apagados a cada novo sinal.
        MapPing::query()->where('created_at', '<', now()->subMinutes(5))->delete();

        $ping = new MapPing([
            'x' => round((float) $data['x'], 3),
            'y' => round((float) $data['y'], 3),
            'color' => $isGm ? self::GM_COLOR : self::PLAYER_COLOR,
        ]);
        $ping->game_session_id = $gameSession->id;
        $ping->campaign_map_id = $campaignMap->id;
        $ping->user_id = $request->user()->id;
        $ping->save();

        return response()->json([
            'ping' => [
                'id' => $ping->id,
                'x' => $ping->x,
                'y' => $ping->y,
                'color' => $ping->color,
                'user_name' => $request->user()->name,
                'mine' => true,
            ],
        ], 201);
    }
}
