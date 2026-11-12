<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Loja: compra de itens do catálogo com as moedas do personagem.
 * Personagens de uma campanha só compram se a loja dela estiver aberta,
 * e apenas os itens escolhidos pelo mestre (quando ele escolheu algum).
 */
class ShopController extends Controller
{
    /** Respostas bem-humoradas do mercador quando falta dinheiro (do sistema antigo). */
    private const NO_MONEY = [
        'Seu bolso tem um eco maior que o Grande Cânion.',
        'O vendedor olhou para as suas moedas imaginárias e deu risada.',
        'MO não nasce em árvore, aventureiro!',
        'Sua carteira está mais vazia que a cabeça de um ogro.',
        'Tente pagar com gratidão. Spoiler: não funcionou.',
        'Você sacudiu a bolsa e só saiu poeira e uma teia de aranha.',
        'Erro 404: Ouro não encontrado.',
        'O mercador te deu um abraço de consolação. Mas o item continua custando o mesmo.',
        'Você ofereceu amizade em troca do item. O mercador disse que prefere ouro.',
    ];

    public static function isOpen(Character $character): bool
    {
        return $character->gameSession === null || $character->gameSession->shop_enabled;
    }

    public function index(Request $request, Character $character): View
    {
        Gate::authorize('update', $character);
        abort_unless(self::isOpen($character), 403, 'A loja desta campanha está fechada.');

        $search = trim((string) $request->query('busca'));
        $category = (string) $request->query('categoria');

        $items = $this->catalog($character)
            ->when($search !== '', static fn (Collection $items) => $items->filter(
                static fn (CatalogItem $item): bool => str_contains(mb_strtolower($item->name), mb_strtolower($search)),
            ))
            ->when(array_key_exists($category, CatalogItem::CATEGORIES), static fn (Collection $items) => $items->where('category', $category))
            ->sortBy(static fn (CatalogItem $item): string => $item->category.'|'.mb_strtolower($item->name))
            ->values();
        $items = CampaignLibrary::paginate($items, $request, 24);

        return view('inventory.shop', [
            'character' => $character,
            'items' => $items,
            'search' => $search,
            'category' => $category,
        ]);
    }

    public function purchase(Request $request, Character $character, CatalogItem $catalogItem): RedirectResponse
    {
        Gate::authorize('update', $character);
        abort_unless(self::isOpen($character), 403, 'A loja desta campanha está fechada.');
        // Item à venda na campanha, com o preço e os dados da versão da campanha.
        $catalogItem = $this->catalog($character)->get($catalogItem->id) ?? abort(404);

        $request->validate(['quantity' => ['nullable', 'integer', 'min:1', 'max:1000']], [], ['quantity' => 'quantidade']);

        // Só munição e consumíveis são comprados em quantidade.
        $stackable = in_array($catalogItem->category, CatalogItem::STACKABLE_CATEGORIES, true);
        $quantity = $stackable ? max(1, $request->integer('quantity', 1)) : 1;
        $price = (int) $catalogItem->value * $quantity;

        $result = DB::transaction(static function () use ($character, $catalogItem, $stackable, $quantity, $price): ?int {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);

            if ($price > $locked->money) {
                return null;
            }

            $existing = $stackable
                ? $locked->items()->where(static fn (Builder $query) => $query
                    ->where('catalog_item_id', $catalogItem->id)
                    ->orWhere(static fn (Builder $byName) => $byName->whereNull('catalog_item_id')->where('name', $catalogItem->name)))
                    ->first()
                : null;

            if ($existing !== null) {
                $existing->increment('quantity', $quantity);
            } else {
                $item = new CharacterItem([
                    'catalog_item_id' => $catalogItem->id,
                    'name' => $catalogItem->name,
                    'category' => $catalogItem->category,
                    'rarity' => CatalogItem::normalizeRarity($catalogItem->rarity),
                    'description' => $catalogItem->description,
                    'damage' => $catalogItem->damage,
                    'defense' => $catalogItem->defense,
                    'weight' => (float) $catalogItem->weight,
                    'value' => (int) $catalogItem->value,
                    'quantity' => $quantity,
                    'equipped' => false,
                    'stats' => $catalogItem->stats ?? [],
                    // A imagem do catálogo é compartilhada (não é apagada com o item do inventário).
                    'image_path' => $catalogItem->image_path,
                ]);
                $item->position = (int) $locked->items()->max('position') + 1;
                $locked->items()->save($item);
            }

            $locked->money -= $price;
            $locked->save();

            return $locked->money;
        });

        if ($result === null) {
            return back()->withErrors([
                'purchase' => self::NO_MONEY[array_rand(self::NO_MONEY)].' (Preço: '.$price.' MO, você tem: '.$character->money.' MO)',
            ]);
        }

        return back()->with('status', ($quantity > 1 ? $quantity.'x ' : '').$catalogItem->name.' adquirido! (-'.$price.' MO)');
    }

    /**
     * Itens à venda para o personagem: a biblioteca da campanha, limitada
     * aos itens escolhidos pelo mestre quando ele escolheu algum.
     *
     * @return Collection<int, CatalogItem>
     */
    private function catalog(Character $character): Collection
    {
        $session = $character->gameSession;
        $shopIds = $session?->shopItems()->pluck('catalog_items.id')->all() ?? [];
        $items = CampaignLibrary::for($session)->entries(CatalogItem::class);

        return $shopIds !== [] ? $items->only($shopIds) : $items;
    }
}
