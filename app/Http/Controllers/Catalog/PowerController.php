<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Enums\SuggestionType;
use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ApprovesSuggestions;
use App\Http\Controllers\Controller;
use App\Models\Power;
use App\Rules\Formula;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Biblioteca de Poderes.
 */
class PowerController extends Controller
{
    use ApprovesSuggestions;

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $type = trim((string) $request->query('tipo'));

        $powers = Power::query()
            ->with('gameSession:id,name')
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
            'types' => $this->types(),
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', Power::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Power);

        return $this->form(new Power(['type' => 'Geral', ...($suggestion?->formData() ?? [])]), $suggestion?->id);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Power::class);

        $suggestion = $this->pendingSuggestion($request, SuggestionType::Power);
        $data = $this->validated($request);

        $power = DB::transaction(function () use ($request, $data, $suggestion): Power {
            $power = new Power($data);
            $power->created_by = $request->user()->id;
            $power->save();
            $this->approveSuggestion($suggestion, $data);

            return $power;
        });

        return redirect()->route('catalog.powers.index')
            ->with('status', $suggestion ? 'Sugestão aprovada: poder "'.$power->name.'" adicionado à biblioteca!' : 'Poder "'.$power->name.'" criado!');
    }

    public function edit(Power $power): View
    {
        Gate::authorize('update', $power);

        return $this->form($power);
    }

    public function update(Request $request, Power $power): RedirectResponse
    {
        Gate::authorize('update', $power);

        $power->update($this->validated($request));

        return redirect()->route('catalog.powers.index')->with('status', 'Poder "'.$power->name.'" atualizado!');
    }

    public function destroy(Power $power): RedirectResponse
    {
        Gate::authorize('delete', $power);

        $power->delete();

        return back()->with('status', 'Poder "'.$power->name.'" excluído.');
    }

    private function form(Power $power, ?int $suggestionId = null): View
    {
        return view('catalog.powers.form', [
            'power' => $power,
            'types' => $this->types($power->type),
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
            'cost' => ['nullable', 'string', 'max:64'],
            'effect' => ['nullable', 'string', 'max:5000'],
            'difficulty_formula' => ['nullable', 'string', 'max:255', new Formula],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /**
     * @return list<string>
     */
    private function types(?string $current = null): array
    {
        $used = Power::query()->distinct()->pluck('type')->all();
        $types = array_values(array_unique(array_filter([...GameRules::global()->powerTypes(), ...$used, $current])));
        sort($types);

        return $types;
    }
}
