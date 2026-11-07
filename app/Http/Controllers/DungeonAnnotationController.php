<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\DungeonAoe;
use App\Models\DungeonMarker;
use App\Models\GameSession;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Áreas de efeito (moldes de magia) e marcadores táticos da masmorra.
 * Qualquer participante cria; o autor ou o mestre altera e remove.
 */
class DungeonAnnotationController extends Controller
{
    use AuthorizesMapAccess;

    public const AOE_TYPES = ['circle' => 'Esfera', 'cone' => 'Cone', 'line' => 'Linha', 'cube' => 'Cubo'];

    private const COLOR = 'regex:/^#[0-9a-fA-F]{6}$/';

    // Áreas de efeito

    public function storeAoe(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(self::AOE_TYPES))],
            'name' => ['nullable', 'string', 'max:255'],
            'color' => ['required', self::COLOR],
            'x' => ['required', 'numeric', 'min:0', 'max:100'],
            'y' => ['required', 'numeric', 'min:0', 'max:100'],
            'radius_feet' => ['required', 'integer', 'min:5', 'max:500'],
            'rotation' => ['required', 'integer', 'min:0', 'max:359'],
        ], [], ['radius_feet' => 'tamanho', 'rotation' => 'rotação']);

        $aoe = new DungeonAoe($data);
        $this->attach($aoe, $gameSession, $campaignMap, $request);

        return response()->json(['message' => 'Área de efeito posicionada.', 'id' => $aoe->id], 201);
    }

    public function updateAoe(Request $request, GameSession $gameSession, CampaignMap $campaignMap, DungeonAoe $aoe): JsonResponse
    {
        $this->authorizeOwnOrGm($request, $gameSession, $campaignMap, $aoe);

        $aoe->update($request->validate([
            'x' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'y' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'rotation' => ['sometimes', 'integer', 'min:0', 'max:359'],
            'radius_feet' => ['sometimes', 'integer', 'min:5', 'max:500'],
        ]));

        return response()->json(['message' => 'Área de efeito atualizada.']);
    }

    public function destroyAoe(Request $request, GameSession $gameSession, CampaignMap $campaignMap, DungeonAoe $aoe): JsonResponse
    {
        $this->authorizeOwnOrGm($request, $gameSession, $campaignMap, $aoe);
        $aoe->delete();

        return response()->json(['message' => 'Área de efeito removida.']);
    }

    public function clearAoes(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);
        Gate::authorize('update', $gameSession);

        DungeonAoe::query()->where('game_session_id', $gameSession->id)->where('campaign_map_id', $campaignMap->id)->delete();

        return response()->json(['message' => 'Todas as áreas de efeito foram removidas.']);
    }

    // Marcadores táticos

    public function storeMarker(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $this->authorizeDungeon($request, $gameSession, $campaignMap);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(DungeonMarker::CATEGORIES))],
            'description' => ['nullable', 'string', 'max:2000'],
            'x' => ['required', 'numeric', 'min:0', 'max:100'],
            'y' => ['required', 'numeric', 'min:0', 'max:100'],
        ], ['label.required' => 'Dê um nome ao marcador.']);

        $marker = new DungeonMarker([...$data, 'color' => DungeonMarker::CATEGORIES[$data['category']][2]]);
        $this->attach($marker, $gameSession, $campaignMap, $request);

        return response()->json(['message' => 'Marcador "'.$marker->label.'" adicionado.', 'id' => $marker->id], 201);
    }

    public function destroyMarker(Request $request, GameSession $gameSession, CampaignMap $campaignMap, DungeonMarker $marker): JsonResponse
    {
        $this->authorizeOwnOrGm($request, $gameSession, $campaignMap, $marker);
        $marker->delete();

        return response()->json(['message' => 'Marcador removido.']);
    }

    // Comum

    private function attach(DungeonAoe|DungeonMarker $model, GameSession $session, CampaignMap $map, Request $request): void
    {
        $model->game_session_id = $session->id;
        $model->campaign_map_id = $map->id;
        $model->user_id = $request->user()->id;
        $model->save();
    }

    private function authorizeOwnOrGm(Request $request, GameSession $session, CampaignMap $map, Model $model): void
    {
        $this->authorizeDungeon($request, $session, $map);
        abort_unless($model->game_session_id === $session->id && $model->campaign_map_id === $map->id, 404);

        $user = $request->user();
        abort_unless($user->can('update', $session) || $model->user_id === $user->id, 403, 'Só quem criou ou o mestre pode alterar.');
    }
}
