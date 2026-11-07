<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Controller;
use App\Models\Skill;
use App\Rules\Formula;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Biblioteca de Perícias.
 */
class SkillController extends Controller
{
    use ApprovesSuggestions;

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $type = trim((string) $request->query('tipo'));

        $skills = Skill::query()
            ->with('gameSession:id,name')
            ->when($search !== '', static fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($type !== '', static fn ($query) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.skills.index', [
            'skills' => $skills,
            'search' => $search,
            'type' => $type,
            'types' => $this->types(),
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', Skill::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Skill);

        return $this->form(new Skill(['type' => 'Geral', ...($suggestion?->formData() ?? [])]), $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Skill::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Skill);
        $data = $this->validated($request);

        $skill = DB::transaction(function () use ($request, $data, $suggestion): Skill {
            $skill = new Skill($data);
            $skill->created_by = $request->user()->id;
            $skill->save();
            $this->approveSuggestion($suggestion, $data);

            return $skill;
        });

        return redirect()->route('catalog.skills.index')
            ->with('status', $suggestion ? 'Sugestão aprovada: perícia "'.$skill->name.'" adicionada à biblioteca!' : 'Perícia "'.$skill->name.'" criada!');
    }

    public function edit(Skill $skill): View
    {
        Gate::authorize('update', $skill);

        return $this->form($skill);
    }

    public function update(Request $request, Skill $skill): RedirectResponse
    {
        Gate::authorize('update', $skill);

        $skill->update($this->validated($request));

        return redirect()->route('catalog.skills.index')->with('status', 'Perícia "'.$skill->name.'" atualizada!');
    }

    public function destroy(Skill $skill): RedirectResponse
    {
        Gate::authorize('delete', $skill);

        $skill->delete();

        return back()->with('status', 'Perícia "'.$skill->name.'" excluída.');
    }

    private function form(Skill $skill, ?int $suggestionId = null): View
    {
        return view('catalog.skills.form', [
            'skill' => $skill,
            'types' => $this->types($skill->type),
            'suggestionId' => $suggestionId,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:64'],
            'purchase_cost' => ['required', 'integer', 'min:0', 'max:1000'],
            'atp_cost' => ['required', 'integer', 'min:0', 'max:1000'],
            'damage' => ['nullable', 'string', 'max:64'],
            'difficulty_formula' => ['nullable', 'string', 'max:255', new Formula],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /**
     * Tipos das regras globais, os já usados e o tipo atual.
     *
     * @return list<string>
     */
    private function types(?string $current = null): array
    {
        $used = Skill::query()->distinct()->pluck('type')->all();
        $types = array_values(array_unique(array_filter([...array_keys(GameRules::global()->skillTypeVars()), ...$used, $current])));
        sort($types);

        return $types;
    }
}
