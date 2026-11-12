<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Catalog\Concerns\ManagesCampaignEntries;
use App\Http\Controllers\Controller;
use App\Models\GameSession;
use App\Models\Skill;
use App\Rules\Formula;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Biblioteca de Perícias. As rotas /catalogos editam a base (mudanças chegam
 * às campanhas como sugestão); as do Painel do Mestre, a versão da campanha.
 */
class SkillController extends Controller
{
    use ApprovesSuggestions;
    use ManagesCampaignEntries;

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $type = trim((string) $request->query('tipo'));

        $skills = Skill::query()
            ->base()
            ->when($search !== '', static fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($type !== '', static fn ($query) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.skills.index', [
            'skills' => $skills,
            'search' => $search,
            'type' => $type,
            'types' => $this->types(null),
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', Skill::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Skill);

        return $this->form(new Skill(['type' => 'Geral', ...($suggestion?->formData() ?? [])]), self::baseForm(null), $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Skill::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Skill);
        $data = $this->validatedEntry($request, null, null);

        $skill = DB::transaction(function () use ($request, $data, $suggestion): Skill {
            $skill = new Skill($data);
            $skill->created_by = $request->user()->id;
            $skill->save();
            CampaignLibrary::baseCreated($skill);
            $this->approveSuggestion($suggestion, $data);

            return $skill;
        });

        // Sugestão aprovada volta para a lista do Painel Admin.
        return redirect()->to($suggestion ? route('admin.suggestions.index', ['origem' => 'jogadores']) : route('catalog.skills.index'))
            ->with('status', $suggestion ? 'Sugestão aprovada: perícia "'.$skill->name.'" adicionada à biblioteca!' : 'Perícia "'.$skill->name.'" criada! As campanhas existentes a recebem como sugestão.');
    }

    public function edit(Skill $skill): View
    {
        Gate::authorize('update', $skill);
        abort_unless($skill->isBase(), 404);

        return $this->form($skill, self::baseForm($skill));
    }

    public function update(Request $request, Skill $skill): RedirectResponse
    {
        Gate::authorize('update', $skill);
        abort_unless($skill->isBase(), 404);

        $data = $this->validatedEntry($request, null, $skill);

        DB::transaction(static function () use ($skill, $data): void {
            $skill->fill($data);
            CampaignLibrary::baseUpdating($skill);
            $skill->save();
        });

        return redirect()->route('catalog.skills.index')->with('status', 'Perícia "'.$skill->name.'" atualizada! As campanhas recebem a mudança como sugestão.');
    }

    public function destroy(Skill $skill): RedirectResponse
    {
        Gate::authorize('delete', $skill);
        abort_unless($skill->isBase(), 404);

        // Sai da base e das campanhas novas; as campanhas existentes ficam com a sua cópia.
        DB::transaction(static fn () => CampaignLibrary::baseArchived($skill));

        return back()->with('status', 'Perícia "'.$skill->name.'" excluída da base. As campanhas que já o usavam continuam com ele.');
    }

    protected function libraryModel(): string
    {
        return Skill::class;
    }

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    protected function form(Model $entry, array $form, ?int $suggestionId = null): View
    {
        return view('catalog.skills.form', [
            'skill' => $entry,
            'types' => $this->types($form['session'], $entry->getAttribute('type')),
            'suggestionId' => $suggestionId,
            'form' => $form,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedEntry(Request $request, ?GameSession $session, ?Model $entry): array
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
     * Formulário do catálogo base.
     *
     * @return array{action: string, method: string, cancel: string, session: null, notice: ?string, version: bool}
     */
    private static function baseForm(?Skill $skill): array
    {
        return [
            'action' => $skill !== null ? route('catalog.skills.update', $skill) : route('catalog.skills.store'),
            'method' => $skill !== null ? 'PUT' : 'POST',
            'cancel' => route('catalog.skills.index'),
            'session' => null,
            'notice' => null,
            'version' => false,
        ];
    }

    /**
     * Tipos das regras (da campanha ou globais), os já usados e o tipo atual.
     *
     * @return list<string>
     */
    private function types(?GameSession $session, ?string $current = null): array
    {
        $used = $session !== null
            ? CampaignLibrary::for($session)->entries(Skill::class)->pluck('type')->all()
            : Skill::query()->base()->distinct()->pluck('type')->all();
        $types = array_values(array_unique(array_filter([...array_keys(GameRules::forSession($session)->skillTypeVars()), ...$used, $current])));
        sort($types);

        return $types;
    }
}
