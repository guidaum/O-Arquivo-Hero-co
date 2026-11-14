<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\SuggestionType;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\Suggestion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Inventário (Inventory.tsx do sistema antigo): itens por categoria,
 * dinheiro, carga e acesso à loja.
 */
class InventoryController extends Controller
{
    private const SORTS = ['manual' => 'Manual', 'raridade' => 'Raridade', 'peso' => 'Peso', 'valor' => 'Valor'];

    /**
     * Sem personagem escolhido: lista os personagens do usuário (com um só, abre direto).
     */
    public function index(Request $request): View|RedirectResponse
    {
        $characters = $request->user()->characters()->orderBy('name')->get();

        if ($characters->count() === 1) {
            return redirect()->route('inventory.show', $characters->first());
        }

        return view('inventory.choose', ['characters' => $characters]);
    }

    public function show(Request $request, Character $character): View
    {
        Gate::authorize('view', $character);

        $category = (string) $request->query('categoria', 'weapons');
        $category = array_key_exists($category, CatalogItem::CATEGORIES) && $category !== 'Geral' ? $category : 'weapons';
        $rarity = (string) $request->query('raridade');
        $sort = array_key_exists((string) $request->query('ordem'), self::SORTS) ? (string) $request->query('ordem') : 'manual';

        $items = $character->items()->orderBy('position')->orderBy('id')->get();

        $visible = $items->filter(static fn (CharacterItem $item): bool => $item->categoryKey() === $category
            && ($rarity === '' || $item->rarityKey() === $rarity));

        // "Manual" mantém a posição gravada; as outras ordens são decrescentes.
        if ($sort !== 'manual') {
            $visible = $visible->sortByDesc(static fn (CharacterItem $item): float|int => match ($sort) {
                'raridade' => (int) array_search($item->rarityKey(), array_keys(CatalogItem::RARITIES), true),
                'peso' => $item->weight,
                default => $item->value,
            });
        }

        $visible = $visible->values();

        // Sugestão ao mestre: o dono, numa campanha que não mestra, para itens que não vieram da loja.
        $user = $request->user();
        $session = $character->gameSession;
        $canSuggest = $session !== null && $character->user_id === $user->id && ! $user->can('update', $session);

        return view('inventory.show', [
            'canSuggest' => $canSuggest,
            // Situação da última sugestão de cada item (pendente, aprovada ou recusada).
            'itemSuggestions' => $canSuggest
                ? Suggestion::query()
                    ->where('type', SuggestionType::Item)
                    ->whereIn('character_item_id', $visible->modelKeys())
                    ->orderBy('id')
                    ->get(['id', 'character_item_id', 'status'])
                    ->keyBy('character_item_id')
                : collect(),
            'character' => $character,
            'items' => $visible,
            'counts' => $items->countBy(static fn (CharacterItem $item): string => $item->categoryKey()),
            'category' => $category,
            'rarity' => $rarity,
            'sort' => $sort,
            'sorts' => self::SORTS,
            'totalWeight' => $items->sum(static fn (CharacterItem $item): float => $item->weight * $item->quantity),
            'totalValue' => $items->sum(static fn (CharacterItem $item): int => $item->value * $item->quantity),
            'capacity' => (int) config('arquivo.rules.carry_capacity', 150),
            'canEdit' => $request->user()->can('update', $character),
            'shopOpen' => ShopController::isOpen($character),
        ]);
    }

    /**
     * Adiciona ou retira moedas (nunca abaixo de zero).
     */
    public function updateMoney(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('update', $character);

        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'operation' => ['required', 'in:add,remove'],
        ], [], ['amount' => 'quantidade']);

        $money = DB::transaction(static function () use ($character, $data): int {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);
            $delta = $data['operation'] === 'add' ? (int) $data['amount'] : -(int) $data['amount'];
            $locked->money = max(0, $locked->money + $delta);
            $locked->save();

            return $locked->money;
        });

        return back()->with('status', ($data['operation'] === 'add' ? 'Moedas adicionadas.' : 'Moedas retiradas.').' Saldo: '.number_format($money, 0, ',', '.').' MO.');
    }
}
