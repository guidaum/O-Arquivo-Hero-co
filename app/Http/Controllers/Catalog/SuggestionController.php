<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Http\Controllers\Controller;
use App\Models\Suggestion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Sugestões de Jogadores: o mestre revisa e aprova (o formulário do
 * catálogo abre preenchido) ou recusa.
 */
class SuggestionController extends Controller
{
    public function index(Request $request): View
    {
        $status = SuggestionStatus::tryFrom((string) $request->query('status')) ?? SuggestionStatus::Pending;

        $suggestions = Suggestion::query()
            ->with('user:id,name')
            ->where('status', $status)
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('catalog.suggestions.index', [
            'suggestions' => $suggestions,
            'status' => $status,
        ]);
    }

    /**
     * Abre o formulário de cadastro correspondente, preenchido com a sugestão.
     */
    public function review(Suggestion $suggestion): RedirectResponse
    {
        Gate::authorize('review', $suggestion);

        if ($suggestion->status !== SuggestionStatus::Pending) {
            return back()->withErrors(['suggestion' => 'Esta sugestão já foi revisada.']);
        }

        $route = match ($suggestion->type) {
            SuggestionType::Skill => 'catalog.skills.create',
            SuggestionType::Power => 'catalog.powers.create',
            SuggestionType::Trait => 'catalog.traits.create',
        };

        return redirect()->route($route, ['sugestao' => $suggestion->id]);
    }

    public function reject(Suggestion $suggestion): RedirectResponse
    {
        Gate::authorize('review', $suggestion);

        $suggestion->status = SuggestionStatus::Rejected;
        $suggestion->save();

        return back()->with('status', 'Sugestão "'.$suggestion->name().'" recusada.');
    }

    public function destroy(Suggestion $suggestion): RedirectResponse
    {
        Gate::authorize('delete', $suggestion);

        $suggestion->delete();

        return back()->with('status', 'Sugestão "'.$suggestion->name().'" excluída.');
    }
}
