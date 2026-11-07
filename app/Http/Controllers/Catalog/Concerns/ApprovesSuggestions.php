<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog\Concerns;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Models\Suggestion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Aprovação de sugestões dos jogadores: o formulário de cadastro abre
 * preenchido com a sugestão (?sugestao=ID) e, ao salvar, ela é aprovada
 * com os dados revisados pelo mestre.
 */
trait ApprovesSuggestions
{
    protected function pendingSuggestion(Request $request, SuggestionType $type): ?Suggestion
    {
        $id = $request->input('sugestao', $request->input('suggestion_id'));

        if (! is_numeric($id)) {
            return null;
        }

        $suggestion = Suggestion::query()
            ->whereKey((int) $id)
            ->where('type', $type)
            ->where('status', SuggestionStatus::Pending)
            ->first();

        if ($suggestion !== null) {
            Gate::authorize('review', $suggestion);
        }

        return $suggestion;
    }

    /**
     * @param  array<string, mixed>  $approvedData
     */
    protected function approveSuggestion(?Suggestion $suggestion, array $approvedData): void
    {
        if ($suggestion === null) {
            return;
        }

        $suggestion->status = SuggestionStatus::Approved;
        $suggestion->data = $approvedData;
        $suggestion->save();
    }
}
