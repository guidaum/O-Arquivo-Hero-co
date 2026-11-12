<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ManagesCampaignEntries;
use App\Http\Controllers\Controller;
use App\Models\GameSession;
use App\Models\Talent;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Biblioteca de Talentos: combinações de atributos (ex.: Esquiva = AGI + VEL).
 * Na campanha, a composição usa os atributos das regras da campanha.
 */
class TalentController extends Controller
{
    use ManagesCampaignEntries;

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $category = trim((string) $request->query('categoria'));

        $talents = Talent::query()
            ->base()
            ->when($search !== '', static fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($category !== '', static fn ($query) => $query->where('category', $category))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.talents.index', [
            'talents' => $talents,
            'search' => $search,
            'category' => $category,
            'categories' => $this->categories(null),
            'attributes' => GameRules::global()->attributes(),
        ]);
    }

    public function create(): View
    {
        Gate::authorize('create', Talent::class);

        return $this->form(new Talent(['composition' => []]), self::baseForm(null));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Talent::class);

        $data = $this->validatedEntry($request, null, null);

        $talent = DB::transaction(static function () use ($request, $data): Talent {
            $talent = new Talent($data);
            $talent->created_by = $request->user()->id;
            $talent->save();
            CampaignLibrary::baseCreated($talent);

            return $talent;
        });

        return redirect()->route('catalog.talents.index')->with('status', 'Talento "'.$talent->name.'" criado! As campanhas existentes o recebem como sugestão.');
    }

    public function edit(Talent $talent): View
    {
        Gate::authorize('update', $talent);
        abort_unless($talent->isBase(), 404);

        return $this->form($talent, self::baseForm($talent));
    }

    public function update(Request $request, Talent $talent): RedirectResponse
    {
        Gate::authorize('update', $talent);
        abort_unless($talent->isBase(), 404);

        $data = $this->validatedEntry($request, null, $talent);

        DB::transaction(static function () use ($talent, $data): void {
            $talent->fill($data);
            CampaignLibrary::baseUpdating($talent);
            $talent->save();
        });

        return redirect()->route('catalog.talents.index')->with('status', 'Talento "'.$talent->name.'" atualizado! As campanhas recebem a mudança como sugestão.');
    }

    public function destroy(Talent $talent): RedirectResponse
    {
        Gate::authorize('delete', $talent);
        abort_unless($talent->isBase(), 404);

        // Sai da base e das campanhas novas; as campanhas existentes ficam com a sua cópia.
        DB::transaction(static fn () => CampaignLibrary::baseArchived($talent));

        return back()->with('status', 'Talento "'.$talent->name.'" excluído da base. As campanhas que já o usavam continuam com ele.');
    }

    protected function libraryModel(): string
    {
        return Talent::class;
    }

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    protected function form(Model $entry, array $form, ?int $suggestionId = null): View
    {
        return view('catalog.talents.form', [
            'talent' => $entry,
            'categories' => $this->categories($form['session']),
            'attributes' => GameRules::forSession($form['session'])->attributes(),
            'form' => $form,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedEntry(Request $request, ?GameSession $session, ?Model $entry): array
    {
        $attributeIds = array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::forSession($session)->attributes());

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
     * @return array{action: string, method: string, cancel: string, session: null, notice: ?string, version: bool}
     */
    private static function baseForm(?Talent $talent): array
    {
        return [
            'action' => $talent !== null ? route('catalog.talents.update', $talent) : route('catalog.talents.store'),
            'method' => $talent !== null ? 'PUT' : 'POST',
            'cancel' => route('catalog.talents.index'),
            'session' => null,
            'notice' => null,
            'version' => false,
        ];
    }

    /**
     * Categorias das regras (da campanha ou globais) e as já usadas pelos talentos.
     *
     * @return list<string>
     */
    private function categories(?GameSession $session): array
    {
        $used = $session !== null
            ? CampaignLibrary::for($session)->entries(Talent::class)->pluck('category')->all()
            : Talent::query()->base()->whereNotNull('category')->distinct()->pluck('category')->all();
        $categories = array_values(array_unique(array_filter([...GameRules::forSession($session)->talentCategories(), ...$used])));
        sort($categories);

        return $categories;
    }
}
