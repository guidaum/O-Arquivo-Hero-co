<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\DiceRoller;
use App\Game\GameRules;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\ChatMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Itens do inventário: cadastro de itens personalizados, usar, equipar,
 * reordenar e rolar o dano (com consumo de munição).
 */
class InventoryItemController extends Controller
{
    private const DISK = 'public';

    public function create(Request $request, Character $character): View
    {
        Gate::authorize('update', $character);

        $category = (string) $request->query('categoria', 'misc');

        return $this->form($character, new CharacterItem([
            'category' => array_key_exists($category, CatalogItem::CATEGORIES) ? $category : 'misc',
            'rarity' => 'Common',
            'quantity' => 1,
            'stats' => [],
        ]));
    }

    public function store(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('update', $character);

        $data = $this->validated($request);

        $message = DB::transaction(function () use ($request, $character, $data): string {
            // Munição e consumíveis com o mesmo nome se acumulam em pilha.
            if (in_array($data['category'], CatalogItem::STACKABLE_CATEGORIES, true)) {
                $existing = $character->items()
                    ->where('category', $data['category'])
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])
                    ->lockForUpdate()
                    ->first();

                if ($existing !== null) {
                    $existing->increment('quantity', $data['quantity']);

                    return 'Quantidade adicionada a "'.$existing->name.'".';
                }
            }

            $item = new CharacterItem($data);
            $item->position = (int) $character->items()->max('position') + 1;

            if ($request->hasFile('image')) {
                $item->image_path = $request->file('image')->store('character-items', self::DISK);
            }

            $character->items()->save($item);

            return 'Item "'.$item->name.'" adicionado ao inventário.';
        });

        return redirect()->route('inventory.show', [$character, 'categoria' => $data['category']])->with('status', $message);
    }

    public function edit(Character $character, CharacterItem $item): View
    {
        Gate::authorize('update', $character);

        return $this->form($character, $item);
    }

    public function update(Request $request, Character $character, CharacterItem $item): RedirectResponse
    {
        Gate::authorize('update', $character);

        $data = $this->validated($request);
        $previous = $item->image_path;

        $item->fill($data);

        if ($request->hasFile('image')) {
            $item->image_path = $request->file('image')->store('character-items', self::DISK);
        } elseif ($request->boolean('remove_image')) {
            $item->image_path = null;
        }

        $item->save();

        if ($previous !== $item->image_path) {
            self::deleteFile($previous);
        }

        return redirect()->route('inventory.show', [$character, 'categoria' => $item->categoryKey()])->with('status', 'Item atualizado.');
    }

    public function destroy(Character $character, CharacterItem $item): RedirectResponse
    {
        Gate::authorize('update', $character);

        $item->delete();
        self::deleteFile($item->image_path);

        return back()->with('status', 'Item "'.$item->name.'" removido.');
    }

    /**
     * Gasta uma unidade (consumíveis); a última remove o item.
     */
    public function consume(Character $character, CharacterItem $item): RedirectResponse
    {
        Gate::authorize('update', $character);

        $remaining = $this->takeOne($item);

        return back()->with('status', $remaining > 0
            ? 'Você usou um(a) '.$item->name.'. Restam '.$remaining.'.'
            : 'Você usou o último '.$item->name.'.');
    }

    public function toggleEquip(Character $character, CharacterItem $item): RedirectResponse
    {
        Gate::authorize('update', $character);

        $item->equipped = ! $item->equipped;
        $item->save();

        return back()->with('status', $item->equipped ? 'Item equipado.' : 'Item desequipado.');
    }

    /**
     * Ordem manual: troca o item de lugar com o vizinho da mesma categoria.
     */
    public function move(Request $request, Character $character, CharacterItem $item): RedirectResponse
    {
        Gate::authorize('update', $character);

        $direction = $request->validate(['direction' => ['required', 'in:up,down']])['direction'];

        DB::transaction(static function () use ($character, $item, $direction): void {
            $siblings = $character->items()->orderBy('position')->orderBy('id')->lockForUpdate()->get()
                ->filter(static fn (CharacterItem $other): bool => $other->categoryKey() === $item->categoryKey())
                ->values();

            // Normaliza as posições antes da troca (itens importados podem ter posições repetidas).
            $siblings->each(static function (CharacterItem $other, int $index): void {
                $other->position = $index;
            });

            $index = $siblings->search(static fn (CharacterItem $other): bool => $other->id === $item->id);
            $target = $direction === 'up' ? $index - 1 : $index + 1;

            if ($index !== false && $siblings->has($target)) {
                [$siblings[$index]->position, $siblings[$target]->position] = [$siblings[$target]->position, $siblings[$index]->position];
            }

            $siblings->each(static fn (CharacterItem $other) => $other->isDirty('position') ? $other->save() : null);
        });

        return back();
    }

    /**
     * Rola o dano da arma com os atributos do personagem. Armas que têm
     * munição no catálogo gastam uma unidade compatível; sem munição, falham.
     */
    public function roll(Request $request, Character $character, CharacterItem $item, DiceRoller $roller): RedirectResponse|JsonResponse
    {
        Gate::authorize('update', $character);

        // ValidationException: volta com o erro no formulário ou 422 na janela de rolagem.
        if (blank($item->damage)) {
            throw ValidationException::withMessages(['roll' => 'Este item não tem dano para rolar.']);
        }

        // Com campanha, rolagens e avisos de munição também vão para o chat da sessão.
        $session = $character->gameSession;
        $chat = $session !== null && $request->user()->can('view', $session)
            ? static fn (array $attributes) => ChatMessage::post($session, $request->user(), $character->name, $attributes)
            : static fn (array $attributes) => null;

        $ammoMessage = null;

        if ($item->catalog_item_id !== null) {
            $ammoIds = CatalogItem::query()
                ->where('category', 'ammo')
                ->whereHas('relatedItems', static fn ($query) => $query->whereKey($item->catalog_item_id))
                ->pluck('id');

            if ($ammoIds->isNotEmpty()) {
                $ammo = $character->items()
                    ->where('category', 'ammo')
                    ->whereIn('catalog_item_id', $ammoIds)
                    ->where('quantity', '>', 0)
                    ->orderBy('position')
                    ->first();

                if ($ammo === null) {
                    $chat(['type' => ChatMessage::TYPE_SYSTEM, 'text' => '⚠️ A arma de '.$character->name.' ('.$item->name.') falhou! Está sem munição.']);

                    throw ValidationException::withMessages(['roll' => 'FALHA: sem munição para '.$item->name.'!']);
                }

                $remaining = $this->takeOne($ammo);
                $ammoMessage = $remaining > 0
                    ? 'Munição consumida: '.$ammo->name.' (restam '.$remaining.').'
                    : 'Munição ESGOTADA: '.$ammo->name.'!';
            }
        }

        $roll = $roller->rollFormula($item->damage, $character->rollStats());

        $chat([
            'type' => ChatMessage::TYPE_ROLL,
            'text' => 'Rolou '.$item->name.': '.$roll->total,
            'roll_data' => ['total' => $roll->total, 'formula' => $roll->detail, 'details' => ChatMessage::describeRolls($roll->rolls), 'rolls' => $roll->rolls],
        ]);

        if (isset($remaining) && $remaining === 0) {
            $chat(['type' => ChatMessage::TYPE_SYSTEM, 'text' => '❗ A munição ('.$ammo->name.') de '.$character->name.' acabou!']);
        }

        // Inventário: a janela de rolagem mostra o dano e atualiza a munição sem recarregar.
        if ($request->expectsJson()) {
            return response()->json([
                'result' => [
                    'title' => 'Dano · '.$item->name,
                    'label' => 'Rolagem de dano',
                    'value' => $roll->total,
                    'outcome' => null,
                    'detail' => ChatMessage::describeRolls($roll->rolls) ?: $roll->detail,
                    'note' => $ammoMessage,
                ],
                'ammo' => isset($ammo, $remaining) ? ['id' => $ammo->id, 'quantity' => $remaining] : null,
            ]);
        }

        return back()->with('roll', [
            'label' => $item->name,
            'total' => $roll->total,
            'detail' => $roll->detail,
            'dice' => ChatMessage::describeRolls($roll->rolls),
            'ammo' => $ammoMessage,
        ]);
    }

    /**
     * Gasta uma unidade do item; devolve quantas restam (0 = item removido).
     */
    private function takeOne(CharacterItem $item): int
    {
        return DB::transaction(static function () use ($item): int {
            $locked = CharacterItem::query()->lockForUpdate()->findOrFail($item->id);

            if ($locked->quantity > 1) {
                $locked->decrement('quantity');

                return $locked->quantity;
            }

            $locked->delete();
            DB::afterCommit(static fn () => self::deleteFile($locked->image_path));

            return 0;
        });
    }

    private function form(Character $character, CharacterItem $item): View
    {
        return view('inventory.item-form', [
            'character' => $character,
            'item' => $item,
            'attributes' => GameRules::forSession($character->gameSession)->attributes(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(CatalogItem::CATEGORIES))],
            'rarity' => ['required', Rule::in(array_keys(CatalogItem::RARITIES))],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'weight' => ['required', 'numeric', 'min:0', 'max:100000'],
            'value' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'damage' => ['nullable', 'string', 'max:64'],
            'defense' => ['required', 'integer', 'min:0', 'max:1000'],
            'description' => ['nullable', 'string', 'max:5000'],
            'stats' => ['array'],
            'stats.*' => ['nullable', 'integer', 'min:-100', 'max:100'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:2048'],
            'remove_image' => ['boolean'],
        ], [], [
            'name' => 'nome',
            'category' => 'categoria',
            'rarity' => 'raridade',
            'quantity' => 'quantidade',
            'weight' => 'peso',
            'value' => 'valor',
            'defense' => 'defesa',
        ]);

        $stats = [];

        foreach ($data['stats'] ?? [] as $attribute => $bonus) {
            if ((int) $bonus !== 0) {
                $stats[strtolower((string) $attribute)] = (int) $bonus;
            }
        }

        return [
            ...collect($data)->only(['name', 'category', 'rarity', 'quantity', 'weight', 'value', 'damage', 'defense', 'description'])->all(),
            'stats' => $stats,
        ];
    }

    private static function deleteFile(?string $path): void
    {
        // Imagens do catálogo são compartilhadas: só apaga as próprias do inventário.
        if ($path !== null && Str::startsWith($path, 'character-items/')) {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
