<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Game\GameRules;
use App\Http\Controllers\Controller;
use App\Models\Talent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Biblioteca de Talentos: combinações de atributos (ex.: Esquiva = AGI + VEL).
 */
class TalentController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $category = trim((string) $request->query('categoria'));

        $talents = Talent::query()
            ->when($search !== '', static fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($category !== '', static fn ($query) => $query->where('category', $category))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.talents.index', [
            'talents' => $talents,
            'search' => $search,
            'category' => $category,
            'categories' => $this->categories(),
            'attributes' => GameRules::global()->attributes(),
        ]);
    }

    public function create(): View
    {
        Gate::authorize('create', Talent::class);

        return $this->form(new Talent(['composition' => []]));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Talent::class);

        $talent = new Talent($this->validated($request));
        $talent->created_by = $request->user()->id;
        $talent->save();

        return redirect()->route('catalog.talents.index')->with('status', 'Talento "'.$talent->name.'" criado!');
    }

    public function edit(Talent $talent): View
    {
        Gate::authorize('update', $talent);

        return $this->form($talent);
    }

    public function update(Request $request, Talent $talent): RedirectResponse
    {
        Gate::authorize('update', $talent);

        $talent->update($this->validated($request));

        return redirect()->route('catalog.talents.index')->with('status', 'Talento "'.$talent->name.'" atualizado!');
    }

    public function destroy(Talent $talent): RedirectResponse
    {
        Gate::authorize('delete', $talent);

        $talent->delete();

        return back()->with('status', 'Talento "'.$talent->name.'" excluído.');
    }

    private function form(Talent $talent): View
    {
        return view('catalog.talents.form', [
            'talent' => $talent,
            'categories' => $this->categories(),
            'attributes' => GameRules::global()->attributes(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $attributeIds = array_column(GameRules::global()->attributes(), 'id');

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:5000'],
            'composition' => ['required', 'array', 'min:1', 'max:6'],
            'composition.*' => ['required', 'string', Rule::in($attributeIds)],
        ], [
            'composition.required' => 'Escolha ao menos um atributo para compor o talento.',
        ]);
    }

    /**
     * Categorias das regras globais e as já usadas pelos talentos.
     *
     * @return list<string>
     */
    private function categories(): array
    {
        $used = Talent::query()->whereNotNull('category')->distinct()->pluck('category')->all();
        $categories = array_values(array_unique(array_filter([...GameRules::global()->talentCategories(), ...$used])));
        sort($categories);

        return $categories;
    }
}
