<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Models\Suggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Envio de sugestões pelos jogadores (perícia, poder ou traço), feito pelo
 * assistente de criação via fetch. O mestre revisa em Catálogos > Sugestões.
 * Os dados ficam com as chaves do sistema antigo, que a revisão já entende.
 */
class SuggestionSubmissionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Suggestion::class);

        $data = $request->validate([
            'type' => ['required', Rule::enum(SuggestionType::class)],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:5000'],
            'purchase_cost' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'atp_cost' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'damage' => ['nullable', 'string', 'max:64'],
            'cost' => ['nullable', 'string', 'max:64'],
            'effect' => ['nullable', 'string', 'max:5000'],
            'modifier' => ['nullable', 'integer', 'min:-100', 'max:100'],
            'modifier_type' => ['nullable', 'string', 'max:32'],
        ], [], [
            'name' => 'nome',
            'description' => 'descrição',
            'purchase_cost' => 'custo de compra',
            'effect' => 'efeito',
        ]);

        $type = SuggestionType::from($data['type']);

        $suggestion = new Suggestion([
            'type' => $type,
            'data' => array_filter([
                'name' => $data['name'],
                'type' => $data['category'] ?? null ?: ($type === SuggestionType::Trait ? 'advantage' : 'Geral'),
                'description' => $data['description'] ?? null,
                'purchaseCost' => $data['purchase_cost'] ?? 1,
                ...match ($type) {
                    SuggestionType::Skill => ['atpCost' => $data['atp_cost'] ?? 0, 'damage' => $data['damage'] ?? null],
                    SuggestionType::Power => ['cost' => $data['cost'] ?? null, 'effect' => $data['effect'] ?? null],
                    SuggestionType::Trait => ['modifier' => $data['modifier'] ?? 0, 'modifierType' => $data['modifier_type'] ?? 'for', 'effect' => $data['effect'] ?? null],
                },
            ], static fn (mixed $value): bool => $value !== null && $value !== ''),
        ]);
        $suggestion->user_id = $request->user()->id;
        $suggestion->status = SuggestionStatus::Pending;
        $suggestion->save();

        return response()->json([
            'message' => 'Sugestão enviada para o mestre!',
            'id' => $suggestion->id,
        ], 201);
    }
}
