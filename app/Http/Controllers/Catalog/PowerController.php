<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Catalog\Concerns\ManagesCampaignEntries;
use App\Http\Controllers\Controller;
use App\Models\GameSession;
use App\Models\Power;
use App\Rules\Formula;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Biblioteca de Poderes. As rotas /catalogos editam a base (mudanças chegam
 * às campanhas como sugestão); as do Painel do Mestre, a versão da campanha.
 */
class PowerController extends Controller
{
    use ApprovesSuggestions;
    use ManagesCampaignEntries;

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $type = trim((string) $request->query('tipo'));

        $powers = Power::query()
            ->base()
            ->when($search !== '', static function ($query) use ($search): void {
                $query->where(static function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('effect', 'like', '%'.$search.'%');
                });
            })
            ->when($type !== '', static fn ($query) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.powers.index', [
            'powers' => $powers,
            'search' => $search,
            'type' => $type,
            'types' => $this->types(null),
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', Power::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Power);

        return $this->form(new Power(['type' => 'Geral', ...($suggestion?->formData() ?? [])]), self::baseForm(null), $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Power::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Power);
        $data = $this->validatedEntry($request, null, null);

        $power = DB::transaction(function () use ($request, $data, $suggestion): Power {
            $power = new Power($data);
            $power->created_by = $request->user()->id;
            $power->save();
            CampaignLibrary::baseCreated($power);
            $this->approveSuggestion($suggestion, $data);

            return $power;
        });

        // Sugestão aprovada volta para a lista do Painel Admin.
        return redirect()->to($suggestion ? route('admin.suggestions.index', ['origem' => 'jogadores']) : route('catalog.powers.index'))
            ->with('status', $suggestion ? 'Sugestão aprovada: poder "'.$power->name.'" adicionado à biblioteca!' : 'Poder "'.$power->name.'" criado! As campanhas existentes o recebem como sugestão.');
    }

    public function edit(Power $power): View
    {
        Gate::authorize('update', $power);
        abort_unless($power->isBase(), 404);

        return $this->form($power, self::baseForm($power));
    }

    public function update(Request $request, Power $power): RedirectResponse
    {
        Gate::authorize('update', $power);
        abort_unless($power->isBase(), 404);

        $data = $this->validatedEntry($request, null, $power);

        DB::transaction(static function () use ($power, $data): void {
            $power->fill($data);
            CampaignLibrary::baseUpdating($power);
            $power->save();
        });

        return redirect()->route('catalog.powers.index')->with('status', 'Poder "'.$power->name.'" atualizado! As campanhas recebem a mudança como sugestão.');
    }

    public function destroy(Power $power): RedirectResponse
    {
        Gate::authorize('delete', $power);
        abort_unless($power->isBase(), 404);

        // Sai da base e das campanhas novas; as campanhas existentes ficam com a sua cópia.
        DB::transaction(static fn () => CampaignLibrary::baseArchived($power));

        return back()->with('status', 'Poder "'.$power->name.'" excluído da base. As campanhas que já o usavam continuam com ele.');
    }

    protected function libraryModel(): string
    {
        return Power::class;
    }

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    protected function form(Model $entry, array $form, ?int $suggestionId = null): View
    {
        return view('catalog.powers.form', [
            'power' => $entry,
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
            'cost' => ['nullable', 'string', 'max:64'],
            'effect' => ['nullable', 'string', 'max:5000'],
            'difficulty_formula' => ['nullable', 'string', 'max:255', new Formula],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /**
     * @return array{action: string, method: string, cancel: string, session: null, notice: ?string, version: bool}
     */
    private static function baseForm(?Power $power): array
    {
        return [
            'action' => $power !== null ? route('catalog.powers.update', $power) : route('catalog.powers.store'),
            'method' => $power !== null ? 'PUT' : 'POST',
            'cancel' => route('catalog.powers.index'),
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
            ? CampaignLibrary::for($session)->entries(Power::class)->pluck('type')->all()
            : Power::query()->base()->distinct()->pluck('type')->all();
        $types = array_values(array_unique(array_filter([...GameRules::forSession($session)->powerTypes(), ...$used, $current])));
        sort($types);

        return $types;
    }
}
