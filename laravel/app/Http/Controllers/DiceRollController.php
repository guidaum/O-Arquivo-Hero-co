<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\AdvantageMode;
use App\Game\DiceRoller;
use App\Models\Character;
use App\Models\ChatMessage;
use App\Models\GameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rolador de Dados (DiceRoller.tsx). O servidor rola e, com uma campanha
 * informada, publica o resultado no chat dela. Histórico e som ficam no navegador.
 */
class DiceRollController extends Controller
{
    public const DICE = [4, 6, 8, 10, 12, 20, 100];

    public const MAX_QUANTITY = 20;

    public function __invoke(Request $request, DiceRoller $roller): JsonResponse
    {
        $data = $request->validate([
            'sides' => ['required', 'integer', Rule::in(self::DICE)],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.self::MAX_QUANTITY],
            'modifier' => ['required', 'integer', 'min:-100', 'max:100'],
            'advantage_mode' => ['required', Rule::enum(AdvantageMode::class)],
            'target' => ['nullable', 'integer', 'min:-100', 'max:1000'],
            'roll_under' => ['required', 'boolean'],
            'game_session_id' => ['nullable', 'integer'],
            'character_id' => ['nullable', 'integer'],
        ], [], [
            'sides' => 'dado',
            'quantity' => 'quantidade',
            'modifier' => 'modificador',
            'target' => 'meta',
        ]);

        $roll = $roller->roll(
            (int) $data['sides'],
            (int) $data['quantity'],
            (int) $data['modifier'],
            AdvantageMode::from($data['advantage_mode']),
            isset($data['target']) ? (int) $data['target'] : null,
            (bool) $data['roll_under'],
        );

        $user = $request->user();
        $session = isset($data['game_session_id']) ? GameSession::query()->find((int) $data['game_session_id']) : null;
        $posted = false;

        if ($session !== null && $user->can('view', $session)) {
            $character = isset($data['character_id'])
                ? Character::query()->whereKey((int) $data['character_id'])->where('user_id', $user->id)->where('game_session_id', $session->id)->first(['id', 'name'])
                : null;

            ChatMessage::post($session, $user, $character?->name ?? $user->name, [
                'type' => ChatMessage::TYPE_ROLL,
                'text' => sprintf('🎲 %s ➔ %d (%s) [%s]', $roll->formula, $roll->total, $roll->details, $roll->outcomeLabel),
                'roll_data' => [
                    'total' => $roll->total,
                    'formula' => $roll->formula,
                    'details' => $roll->details,
                    'rolls' => [['die' => $roll->quantity.'d'.$roll->sides, 'values' => $roll->rolls]],
                    'outcome' => $roll->outcome->value,
                    'isNat20' => $roll->isNat20,
                    'isNat1' => $roll->isNat1,
                ],
            ]);
            $posted = true;
        }

        return response()->json(['roll' => $roll->toArray(), 'posted' => $posted]);
    }
}
