<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\TraitType;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inventário e loja (Inventory.tsx do sistema antigo).
 */
class InventoryTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        $this->player = User::factory()->create();
        $this->character = $this->characterOf($this->player, money: 100);
    }

    private function characterOf(User $owner, int $money = 0, ?GameSession $session = null): Character
    {
        $character = new Character(['name' => 'Alden', 'money' => $money, 'stats' => ['for' => 4], 'stats_mods' => ['for' => 1]]);
        $character->user_id = $owner->id;
        $character->game_session_id = $session?->id;
        $character->save();

        return $character;
    }

    private function item(array $attributes): CharacterItem
    {
        $item = new CharacterItem(['quantity' => 1, ...$attributes]);
        $item->position = $attributes['position'] ?? 0;
        $this->character->items()->save($item);

        return $item;
    }

    private function campaign(bool $shop): GameSession
    {
        $gm = User::factory()->gm()->create();
        $session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN'.random_int(100, 999), 'shop_enabled' => $shop]);
        $session->gm_id = $gm->id;
        $session->save();

        return $session;
    }

    public function test_single_character_opens_directly(): void
    {
        $this->actingAs($this->player)->get('/inventario')->assertRedirect(route('inventory.show', $this->character));
    }

    public function test_inventory_lists_items_by_category_with_totals(): void
    {
        $this->item(['name' => 'Espada Longa', 'category' => 'weapons', 'damage' => '1D8', 'weight' => 3, 'value' => 50]);
        $this->item(['name' => 'Flechas', 'category' => 'ammo', 'quantity' => 20, 'weight' => 0.1, 'value' => 1]);
        // Item antigo sem categoria: com defesa vira armadura.
        $this->item(['name' => 'Cota de Malha', 'defense' => 3, 'weight' => 10, 'rarity' => 'Raro']);

        $this->actingAs($this->player)->get(route('inventory.show', $this->character))
            ->assertOk()
            ->assertSee('Espada Longa')
            ->assertDontSee('Cota de Malha')
            ->assertSee('15 / 150')
            ->assertSee('Patrimônio: 170 MO');

        $this->actingAs($this->player)->get(route('inventory.show', [$this->character, 'categoria' => 'armor']))
            ->assertSee('Cota de Malha')
            ->assertSee('Raro');
    }

    public function test_only_owner_or_session_gm_changes_the_inventory(): void
    {
        $stranger = User::factory()->create();
        $item = $this->item(['name' => 'Espada', 'category' => 'weapons']);

        $this->actingAs($stranger)->get(route('inventory.show', $this->character))->assertForbidden();
        $this->actingAs($stranger)->post(route('inventory.items.equip', [$this->character, $item]))->assertForbidden();
    }

    public function test_items_of_another_character_can_not_be_reached_through_the_url(): void
    {
        $other = $this->characterOf($this->player);
        $foreign = new CharacterItem(['name' => 'Alheio', 'quantity' => 1]);
        $other->items()->save($foreign);

        $this->actingAs($this->player)->post(route('inventory.items.equip', [$this->character, $foreign]))->assertNotFound();
    }

    public function test_custom_stackable_items_merge_by_name(): void
    {
        $this->item(['name' => 'Poção de Cura', 'category' => 'consumables', 'quantity' => 2]);

        $this->actingAs($this->player)->post(route('inventory.items.store', $this->character), [
            'name' => 'poção de cura', 'category' => 'consumables', 'rarity' => 'Common', 'quantity' => 3,
            'weight' => 0.5, 'value' => 10, 'defense' => 0, 'stats' => ['for' => 0, 'agi' => 2],
        ])->assertSessionHas('status', 'Quantidade adicionada a "Poção de Cura".');

        $this->assertSame(1, $this->character->items()->count());
        $this->assertSame(5, $this->character->items()->first()->quantity);
    }

    public function test_using_a_consumable_spends_one_unit(): void
    {
        $potion = $this->item(['name' => 'Poção', 'category' => 'consumables', 'quantity' => 2]);

        $this->actingAs($this->player)->post(route('inventory.items.consume', [$this->character, $potion]))->assertSessionHas('status');
        $this->assertSame(1, $potion->fresh()->quantity);

        $this->actingAs($this->player)->post(route('inventory.items.consume', [$this->character, $potion]));
        $this->assertModelMissing($potion);
    }

    public function test_equip_toggles_and_manual_order_moves(): void
    {
        $first = $this->item(['name' => 'Espada', 'category' => 'weapons', 'position' => 0]);
        $second = $this->item(['name' => 'Machado', 'category' => 'weapons', 'position' => 1]);

        $this->actingAs($this->player)->post(route('inventory.items.equip', [$this->character, $first]));
        $this->assertTrue($first->fresh()->equipped);

        $this->actingAs($this->player)->post(route('inventory.items.move', [$this->character, $second]), ['direction' => 'up']);
        $this->assertSame(['Machado', 'Espada'], $this->character->items()->orderBy('position')->pluck('name')->all());
    }

    public function test_damage_roll_uses_attributes_and_consumes_ammo(): void
    {
        $bow = CatalogItem::query()->create(['name' => 'Arco', 'category' => 'weapons']);
        $arrowsCatalog = CatalogItem::query()->create(['name' => 'Flechas', 'category' => 'ammo']);
        $arrowsCatalog->relatedItems()->attach($bow);

        $weapon = $this->item(['name' => 'Arco', 'category' => 'weapons', 'damage' => 'FOR + 2', 'catalog_item_id' => $bow->id]);

        $this->actingAs($this->player)->post(route('inventory.items.roll', [$this->character, $weapon]))
            ->assertSessionHasErrors(['roll' => 'FALHA: sem munição para Arco!']);

        $arrows = $this->item(['name' => 'Flechas', 'category' => 'ammo', 'quantity' => 2, 'catalog_item_id' => $arrowsCatalog->id]);

        // FOR 4 + modificador 1 + 2 = 7.
        $this->actingAs($this->player)->post(route('inventory.items.roll', [$this->character, $weapon]))
            ->assertSessionHas('roll', fn (array $roll): bool => $roll['total'] === 7 && str_contains((string) $roll['ammo'], 'restam 1'));

        $this->actingAs($this->player)->post(route('inventory.items.roll', [$this->character, $weapon]))
            ->assertSessionHas('roll', fn (array $roll): bool => str_contains((string) $roll['ammo'], 'ESGOTADA'));

        $this->assertModelMissing($arrows);
    }

    public function test_damage_roll_uses_the_total_attribute_of_the_sheet(): void
    {
        // FOR base 5 + 2 de traço = 7 (como na ficha): "1D4 + 4 + FOR" vai de 12 a 15.
        $this->character->forceFill(['stats' => ['for' => 5], 'stats_mods' => []])->save();
        $strength = CharacterTrait::query()->create(['name' => 'Força Bruta', 'type' => TraitType::Advantage, 'modifier' => 2, 'modifier_attribute' => 'for']);
        $this->character->traits()->attach($strength);

        $weapon = $this->item(['name' => 'Adaga', 'category' => 'weapons', 'damage' => '1D4 + 4 + FOR']);

        for ($i = 0; $i < 10; $i++) {
            $this->actingAs($this->player)->post(route('inventory.items.roll', [$this->character, $weapon]))
                ->assertSessionHas('roll', fn (array $roll): bool => $roll['total'] >= 12 && $roll['total'] <= 15);
        }

        // Itens equipados e ajustes do mestre também entram: 7 + 1 + 3 = 11.
        $this->item(['name' => 'Anel da Força', 'category' => 'misc', 'equipped' => true, 'stats' => ['for' => 1]]);
        $this->character->forceFill(['gm_modifiers' => ['for' => [['id' => 'a1', 'value' => 3, 'justification' => 'Bênção']]]])->save();

        $this->assertSame(11, $this->character->fresh()->rollStats()['FOR']);
    }

    public function test_damage_roll_answers_json_for_the_roll_dialog(): void
    {
        $bow = CatalogItem::query()->create(['name' => 'Arco', 'category' => 'weapons']);
        $arrowsCatalog = CatalogItem::query()->create(['name' => 'Flechas', 'category' => 'ammo']);
        $arrowsCatalog->relatedItems()->attach($bow);
        $weapon = $this->item(['name' => 'Arco', 'category' => 'weapons', 'damage' => 'FOR + 2', 'catalog_item_id' => $bow->id]);

        $this->actingAs($this->player)->postJson(route('inventory.items.roll', [$this->character, $weapon]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['roll' => 'FALHA: sem munição para Arco!']);

        $arrows = $this->item(['name' => 'Flechas', 'category' => 'ammo', 'quantity' => 2, 'catalog_item_id' => $arrowsCatalog->id]);

        $this->actingAs($this->player)->postJson(route('inventory.items.roll', [$this->character, $weapon]))
            ->assertOk()
            ->assertJsonPath('result.title', 'Dano · Arco')
            ->assertJsonPath('result.value', 7)
            ->assertJsonPath('result.outcome', null)
            ->assertJsonPath('ammo', ['id' => $arrows->id, 'quantity' => 1]);
    }

    public function test_money_never_goes_below_zero(): void
    {
        $this->actingAs($this->player)->put(route('inventory.money', $this->character), ['amount' => 50, 'operation' => 'add']);
        $this->assertSame(150, $this->character->fresh()->money);

        $this->actingAs($this->player)->put(route('inventory.money', $this->character), ['amount' => 500, 'operation' => 'remove']);
        $this->assertSame(0, $this->character->fresh()->money);
    }

    public function test_shop_purchase_stacks_ammo_and_charges_money(): void
    {
        $arrows = CatalogItem::query()->create(['name' => 'Flechas', 'category' => 'ammo', 'value' => 2, 'weight' => 0.1]);
        $sword = CatalogItem::query()->create(['name' => 'Espada', 'category' => 'weapons', 'value' => 40, 'damage' => '1D8', 'rarity' => 'Rare']);

        $this->actingAs($this->player)->post(route('inventory.shop.purchase', [$this->character, $arrows]), ['quantity' => 10])
            ->assertSessionHas('status', '10x Flechas adquirido! (-20 MO)');
        $this->actingAs($this->player)->post(route('inventory.shop.purchase', [$this->character, $arrows]), ['quantity' => 5]);
        // Armas não são compradas em quantidade.
        $this->actingAs($this->player)->post(route('inventory.shop.purchase', [$this->character, $sword]), ['quantity' => 3]);

        $this->assertSame(100 - 30 - 40, $this->character->fresh()->money);
        $this->assertSame(15, $this->character->items()->where('name', 'Flechas')->value('quantity'));
        $this->assertSame(1, $this->character->items()->where('name', 'Espada')->value('quantity'));
        $this->assertSame('Rare', $this->character->items()->where('name', 'Espada')->value('rarity'));
    }

    public function test_purchase_without_money_is_refused(): void
    {
        $crown = CatalogItem::query()->create(['name' => 'Coroa', 'category' => 'misc', 'value' => 500]);

        $this->actingAs($this->player)->post(route('inventory.shop.purchase', [$this->character, $crown]))
            ->assertSessionHasErrors('purchase');

        $this->assertSame(100, $this->character->fresh()->money);
        $this->assertSame(0, $this->character->items()->count());
    }

    public function test_campaign_shop_follows_the_gm_settings(): void
    {
        $closed = $this->characterOf($this->player, money: 100, session: $this->campaign(shop: false));
        $this->actingAs($this->player)->get(route('inventory.shop', $closed))->assertForbidden();

        $session = $this->campaign(shop: true);
        $listed = CatalogItem::query()->create(['name' => 'Escudo à Venda', 'category' => 'armor', 'value' => 10]);
        $hidden = CatalogItem::query()->create(['name' => 'Cajado Proibido', 'category' => 'weapons', 'value' => 10]);
        $session->shopItems()->attach($listed);
        $open = $this->characterOf($this->player, money: 100, session: $session);

        $this->actingAs($this->player)->get(route('inventory.shop', $open))->assertSee('Escudo à Venda')->assertDontSee('Cajado Proibido');
        $this->actingAs($this->player)->post(route('inventory.shop.purchase', [$open, $hidden]))->assertNotFound();
    }
}
