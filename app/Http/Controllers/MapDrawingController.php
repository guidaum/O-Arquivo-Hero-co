<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\MapDrawing;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Desenhos livres e polígonos sobre um mapa (MapDrawingOverlay.tsx),
 * usados pelo Mapa do Mundo e, depois, pela masmorra. Coordenadas em %.
 */
class MapDrawingController extends Controller
{
    use AuthorizesMapAccess;

    private const COLOR = 'regex:/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/';

    public function store(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $isGm = $this->authorizeMap($request, $gameSession, $campaignMap);

        $data = $request->validate([
            'points' => ['required', 'array', 'min:2', 'max:2000'],
            'points.*.x' => ['required', 'numeric', 'min:0', 'max:100'],
            'points.*.y' => ['required', 'numeric', 'min:0', 'max:100'],
            'color' => ['required', self::COLOR],
            'fill_color' => ['nullable', self::COLOR],
            'size' => ['required', 'integer', 'min:1', 'max:20'],
            'is_closed' => ['boolean'],
            'is_polygon' => ['boolean'],
        ], [
            'points.min' => 'O traço precisa de pelo menos dois pontos.',
        ]);

        $drawing = new MapDrawing([
            ...$data,
            'points' => array_map(static fn (array $point): array => [
                'x' => round((float) $point['x'], 2),
                'y' => round((float) $point['y'], 2),
            ], $data['points']),
        ]);
        $drawing->game_session_id = $gameSession->id;
        $drawing->campaign_map_id = $campaignMap->id;
        $drawing->user_id = $request->user()->id;
        $drawing->save();

        return response()->json([
            'drawing' => WorldMapController::drawingsFor(new Collection([$drawing]), $request->user(), $isGm)[0],
        ], 201);
    }

    public function destroy(Request $request, GameSession $gameSession, CampaignMap $campaignMap, MapDrawing $drawing): JsonResponse
    {
        $this->authorizeMap($request, $gameSession, $campaignMap);
        abort_unless($drawing->game_session_id === $gameSession->id && $drawing->campaign_map_id === $campaignMap->id, 404);
        Gate::authorize('delete', $drawing);

        $drawing->delete();

        return response()->json(['message' => 'Traço apagado.']);
    }

    /**
     * Limpar desenhos: os próprios, ou todos (?todos=1, só o mestre).
     */
    public function clear(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeMap($request, $gameSession, $campaignMap);
        $all = $request->boolean('todos');

        if ($all) {
            Gate::authorize('update', $gameSession);
        }

        $deleted = MapDrawing::query()
            ->where('game_session_id', $gameSession->id)
            ->where('campaign_map_id', $campaignMap->id)
            ->when(! $all, static fn ($query) => $query->where('user_id', $request->user()->id))
            ->delete();

        return response()->json([
            'message' => $deleted === 0 ? 'Não havia desenhos para limpar.' : ($all ? 'Todos os desenhos foram apagados.' : 'Seus desenhos foram apagados.'),
        ]);
    }
}
