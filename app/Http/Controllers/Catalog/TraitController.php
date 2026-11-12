<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Enums\TraitType;
use App\Game\GameRules;
use App\Game\TraitCalculator;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Catalog\Concerns\ManagesCampaignEntries;
use App\Http\Controllers\Controller;
use App\Models\CharacterTrait;
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
 * Vantagens & Defeitos. O alvo do modificador é um atributo ("attr:for")
 * ou um talento ("talent:12") no formulário; na campanha, os da campanha.
 */
class TraitController extends Controller
{
    use ApprovesSuggestions;
    use ManagesCampaignEntries;

    public function index(Request $request, TraitCalculator $calculator): View
    {
        $search = trim((string) $request->query('busca'));
        $type = TraitType::tryFrom((string) $request->query('tipo'));

        $traits = CharacterTrait::query()
            ->base()
            ->with('modifierTalent:id,name')
            ->when($search !== '', static function ($query) use ($search): void {
                $query->where(static function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('effect', 'like', '%'.$search.'%');
                });
            })
            ->when($type !== null, static fn ($query) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.traits.index', [
            'traits' => $traits,
            'search' => $search,
            'type' => $type,
            'calculator' => $calculator,
            'attributes' => GameRules::global()->attributes(),
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', CharacterTrait::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Trait);
        $trait = new CharacterTrait(['type' => TraitType::Advantage, 'modifier' => 0, 'modifier_attribute' => 'for']);

        if ($suggestion !== null) {
            $data = $suggestion->formData();
            $trait->fill(array_intersect_key($data, array_flip(['name', 'description', 'effect', 'modifier'])));
            $trait->type = TraitType::tryFrom((string) ($data['type'] ?? '')) ?? TraitType::Advantage;
            $trait->modifier_attribute = $this->attributeFromLegacy((string) ($data['target'] ?? ''));
        }

        return $this->form($trait, self::baseForm(null), $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', CharacterTrait::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Trait);
        $data = $this->validatedEntry($request, null, null);

        $trait = DB::transaction(function () use ($data, $suggestion): CharacterTrait {
            $trait = new CharacterTrait($data);
            $trait->save();
            CampaignLibrary::baseCreated($trait);
            $this->approveSuggestion($suggestion, $data);

            return $trait;
        });

        // Sugestão aprovada volta para a lista do Painel Admin.
        return redirect()->to($suggestion ? route('admin.suggestions.index', ['origem' => 'jogadores']) : route('catalog.traits.index'))
            ->with('status', $suggestion ? 'Sugestão aprovada: "'.$trait->name.'" adicionado à biblioteca!' : '"'.$trait->name.'" criado! As campanhas existentes o recebem como sugestão.');
    }

    public function edit(CharacterTrait $trait): View
    {
        Gate::authorize('update', $trait);
        abort_unless($trait->isBase(), 404);

        return $this->form($trait, self::baseForm($trait));
    }

    public function update(Request $request, CharacterTrait $trait): RedirectResponse
    {
        Gate::authorize('update', $trait);
        abort_unless($trait->isBase(), 404);

        $data = $this->validatedEntry($request, null, $trait);

        DB::transaction(static function () use ($trait, $data): void {
            $trait->fill($data);
            CampaignLibrary::baseUpdating($trait);
            $trait->save();
        });

        return redirect()->route('catalog.traits.index')->with('status', '"'.$trait->name.'" atualizado! As campanhas recebem a mudança como sugestão.');
    }

    public function destroy(CharacterTrait $trait): RedirectResponse
    {
        Gate::authorize('delete', $trait);
        abort_unless($trait->isBase(), 404);

        // Sai da base e das campanhas novas; as campanhas existentes ficam com a sua cópia.
        DB::transaction(static fn () => CampaignLibrary::baseArchived($trait));

        return back()->with('status', '"'.$trait->name.'" excluído da base. As campanhas que já o usavam continuam com ele.');
    }

    protected function libraryModel(): string
    {
        return CharacterTrait::class;
    }

    /**
     * Traços não guardam autoria.
     *
     * @return list<string>
     */
    protected function ownerColumns(): array
    {
        return [];
    }

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    protected function form(Model $entry, array $form, ?int $suggestionId = null): View
    {
        $talentId = $entry->getAttribute('modifier_talent_id');
        $attribute = $entry->getAttribute('modifier_attribute');

        return view('catalog.traits.form', [
            'trait' => $entry,
            'target' => $talentId !== null ? 'talent:'.$talentId : ($attribute !== null ? 'attr:'.$attribute : ''),
            'attributes' => GameRules::forSession($form['session'])->attributes(),
            'talents' => CampaignLibrary::for($form['session'])->entries(Talent::class)->values(),
            'suggestionId' => $suggestionId,
            'form' => $form,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedEntry(Request $request, ?GameSession $session, ?Model $entry): array
    {
        $targets = [
            '',
            ...array_map(static fn (array $attribute): string => 'attr:'.strtolower($attribute['id']), GameRules::forSession($session)->attributes()),
            ...CampaignLibrary::for($session)->entries(Talent::class)->keys()->map(static fn (int $id): string => 'talent:'.$id)->all(),
        ];

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::enum(TraitType::class)],
            'modifier' => ['required', 'integer', 'min:-100', 'max:100'],
            'target' => ['nullable', 'string', Rule::in($targets)],
            'effect' => ['nullable', 'string', 'max:5000'],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        [$kind, $id] = array_pad(explode(':', (string) ($data['target'] ?? ''), 2), 2, null);
        unset($data['target']);

        return [
            ...$data,
            'modifier_attribute' => $kind === 'attr' ? $id : null,
            'modifier_talent_id' => $kind === 'talent' ? (int) $id : null,
        ];
    }

    /**
     * @return array{action: string, method: string, cancel: string, session: null, notice: ?string, version: bool}
     */
    private static function baseForm(?CharacterTrait $trait): array
    {
        return [
            'action' => $trait !== null ? route('catalog.traits.update', $trait) : route('catalog.traits.store'),
            'method' => $trait !== null ? 'PUT' : 'POST',
            'cancel' => route('catalog.traits.index'),
            'session' => null,
            'notice' => null,
            'version' => false,
        ];
    }

    /**
     * Alvo gravado pelo sistema antigo (ID de atributo no Firebase).
     */
    private function attributeFromLegacy(string $target): ?string
    {
        $target = strtolower(trim($target));

        return in_array($target, array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::global()->attributes()), true)
            ? $target
            : null;
    }
}
