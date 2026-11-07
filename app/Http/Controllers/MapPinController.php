<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesMapAccess;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\MapPin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Marcadores do Mapa do Mundo. Qualquer participante cria; quem criou ou
 * o mestre altera e exclui (MapPinPolicy). Segredos e marcadores secretos
 * são do mestre: jogadores não os enviam nem os recebem.
 */
class MapPinController extends Controller
{
    use AuthorizesMapAccess;

    public function store(Request $request, GameSession $gameSession, CampaignMap $campaignMap): JsonResponse
    {
        $isGm = $this->authorizeMap($request, $gameSession, $campaignMap);
        $user = $request->user();

        $pin = new MapPin([
            ...$this->validated($request, $isGm, true),
            'discovered_by_name' => $user->name,
        ]);
        $pin->game_session_id = $gameSession->id;
        $pin->campaign_map_id = $campaignMap->id;
        $pin->created_by = $user->id;
        $pin->save();

        return response()->json([
            'message' => 'Marcador "'.$pin->title.'" adicionado ao mapa.',
            'pin' => $pin->toMapArray($user, $isGm),
        ], 201);
    }

    public function update(Request $request, GameSession $gameSession, CampaignMap $campaignMap, MapPin $pin): JsonResponse
    {
        $isGm = $this->authorizeMap($request, $gameSession, $campaignMap);
        $this->ensureBelongs($pin, $gameSession, $campaignMap);
        Gate::authorize('update', $pin);

        $pin->update($this->validated($request, $isGm, false));

        return response()->json([
            'message' => 'Marcador atualizado.',
            'pin' => $pin->toMapArray($request->user(), $isGm),
        ]);
    }

    public function destroy(Request $request, GameSession $gameSession, CampaignMap $campaignMap, MapPin $pin): JsonResponse
    {
        $this->authorizeMap($request, $gameSession, $campaignMap);
        $this->ensureBelongs($pin, $gameSession, $campaignMap);
        Gate::authorize('delete', $pin);

        $pin->delete();

        return response()->json(['message' => 'Marcador excluído.']);
    }

    private function ensureBelongs(MapPin $pin, GameSession $session, CampaignMap $map): void
    {
        abort_unless($pin->game_session_id === $session->id && $pin->campaign_map_id === $map->id, 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $isGm, bool $creating): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(MapPin::CATEGORIES))],
            'custom_icon' => ['nullable', Rule::in(array_keys(MapPin::ICONS))],
            'danger_level' => ['required', Rule::in(array_keys(MapPin::DANGER_LEVELS))],
            'status' => ['required', Rule::in(array_keys(MapPin::STATUSES))],
            'description' => ['nullable', 'string', 'max:5000'],
            'secrets' => ['nullable', 'string', 'max:5000'],
            'is_secret' => ['boolean'],
            'discovered_on' => ['nullable', 'date'],
            'x' => [$creating ? 'required' : 'sometimes', 'numeric', 'min:0', 'max:100'],
            'y' => [$creating ? 'required' : 'sometimes', 'numeric', 'min:0', 'max:100'],
        ], [
            'title.required' => 'O título do marcador é obrigatório.',
        ], [
            'title' => 'título',
            'category' => 'categoria',
            'custom_icon' => 'ícone',
            'danger_level' => 'nível de perigo',
            'status' => 'situação',
            'description' => 'descrição',
            'secrets' => 'segredos',
            'discovered_on' => 'data da descoberta',
        ]);

        if (! $isGm) {
            unset($data['secrets'], $data['is_secret']);
        }

        foreach (['x', 'y'] as $axis) {
            if (isset($data[$axis])) {
                $data[$axis] = round((float) $data[$axis], 3);
            }
        }

        return $data;
    }
}
