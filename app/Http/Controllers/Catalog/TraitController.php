<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Enums\TraitType;
use App\Game\GameRules;
use App\Game\TraitCalculator;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Controller;
use App\Models\CharacterTrait;
use App\Models\Talent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Vantagens & Defeitos. O alvo do modificador é um atributo ("attr:for")
 * ou um talento ("talent:12") no formulário.
 */
class TraitController extends Controller
{
    use ApprovesSuggestions;

    public function index(Request $request, TraitCalculator $calculator): View
    {
        $search = trim((string) $request->query('busca'));
        $type = TraitType::tryFrom((string) $request->query('tipo'));

        $traits = CharacterTrait::query()
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
        $trait = new CharacterTrait(['type' => TraitType::Advantage, 'modifier' => 0]);
        $target = 'attr:for';

        if ($suggestion !== null) {
            $data = $suggestion->formData();
            $trait->fill(array_intersect_key($data, array_flip(['name', 'description', 'effect', 'modifier'])));
            $trait->type = TraitType::tryFrom((string) ($data['type'] ?? '')) ?? TraitType::Advantage;
            $target = $this->targetFromLegacy((string) ($data['target'] ?? ''));
        }

        return $this->form($trait, $target, $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', CharacterTrait::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Trait);
        $data = $this->validated($request);

        $trait = DB::transaction(function () use ($data, $suggestion): CharacterTrait {
            $trait = new CharacterTrait($data);
            $trait->save();
            $this->approveSuggestion($suggestion, $data);

            return $trait;
        });

        return redirect()->route('catalog.traits.index')
            ->with('status', $suggestion ? 'Sugestão aprovada: "'.$trait->name.'" adicionado à biblioteca!' : '"'.$trait->name.'" criado!');
    }

    public function edit(CharacterTrait $trait): View
    {
        Gate::authorize('update', $trait);

        $target = $trait->modifier_talent_id !== null
            ? 'talent:'.$trait->modifier_talent_id
            : ($trait->modifier_attribute !== null ? 'attr:'.$trait->modifier_attribute : '');

        return $this->form($trait, $target);
    }

    public function update(Request $request, CharacterTrait $trait): RedirectResponse
    {
        Gate::authorize('update', $trait);

        $trait->update($this->validated($request));

        return redirect()->route('catalog.traits.index')->with('status', '"'.$trait->name.'" atualizado!');
    }

    public function destroy(CharacterTrait $trait): RedirectResponse
    {
        Gate::authorize('delete', $trait);

        $trait->delete();

        return back()->with('status', '"'.$trait->name.'" excluído.');
    }

    private function form(CharacterTrait $trait, string $target, ?int $suggestionId = null): View
    {
        return view('catalog.traits.form', [
            'trait' => $trait,
            'target' => $target,
            'attributes' => GameRules::global()->attributes(),
            'talents' => Talent::query()->orderBy('name')->get(['id', 'name']),
            'suggestionId' => $suggestionId,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $targets = [
            '',
            ...array_map(static fn (array $attribute): string => 'attr:'.strtolower($attribute['id']), GameRules::global()->attributes()),
            ...Talent::query()->pluck('id')->map(static fn (int $id): string => 'talent:'.$id)->all(),
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
     * Alvo gravado pelo sistema antigo (ID de atributo ou de talento no Firebase).
     */
    private function targetFromLegacy(string $target): string
    {
        $target = strtolower(trim($target));

        return in_array($target, array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::global()->attributes()), true)
            ? 'attr:'.$target
            : '';
    }
}
