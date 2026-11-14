<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ficha como ponto de partida: as telas abertas por ela voltam para ela, e os
 * itens equipados com dano rolam direto da ficha (também no Status de Combate).
 */
class SheetNavigationTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        $this->player = User::factory()->create();
        $this->character = new Character(['name' => 'Alden', 'stats' => ['for' => 4]]);
        $this->character->user_id = $this->player->id;
        $this->character->save();
    }

    private function item(array $attributes): CharacterItem
    {
        $item = new CharacterItem(['quantity' => 1, 'rarity' => 'Common', ...$attributes]);
        $item->position = 0;
        $this->character->items()->save($item);

        return $item;
    }

    public function test_inventory_and_journal_go_back_to_the_sheet(): void
    {
        $this->actingAs($this->player)->get(route('inventory.show', $this->character))
            ->assertOk()
            ->assertSee('Voltar à ficha de Alden')
            ->assertSee(route('characters.show', $this->character), false);

        $this->actingAs($this->player)->get(route('journal.index', ['visao' => 'personagem', 'personagem' => $this->character->id]))
            ->assertOk()
            ->assertSee('Voltar à ficha de Alden');

        $this->actingAs($this->player)->get(route('journal.index'))->assertDontSee('Voltar à ficha');
    }

    public function test_back_link_from_the_query_string_respects_the_sheet_permission(): void
    {
        $gm = User::factory()->gm()->create();

        // O mestre não vê a ficha de um personagem sem campanha de outra pessoa: sem link.
        $this->actingAs($gm)->get(route('map-manager.index', ['ficha' => $this->character->id]))
            ->assertOk()
            ->assertDontSee('Voltar à ficha');

        $own = new Character(['name' => 'Brienne', 'stats' => []]);
        $own->user_id = $gm->id;
        $own->save();

        $this->actingAs($gm)->get(route('map-manager.index', ['ficha' => $own->id]))
            ->assertOk()
            ->assertSee('Voltar à ficha de Brienne');
    }

    public function test_equipped_weapons_roll_from_the_sheet_and_appear_in_combat(): void
    {
        $sword = $this->item(['name' => 'Espada Longa', 'category' => 'weapons', 'damage' => '1D8 + FOR', 'equipped' => true]);
        $this->item(['name' => 'Cota de Malha', 'category' => 'armor', 'defense' => 3, 'equipped' => true]);
        $this->item(['name' => 'Machado Guardado', 'category' => 'weapons', 'damage' => '1D10', 'equipped' => false]);

        $this->actingAs($this->player)->get(route('characters.show', $this->character))
            ->assertOk()
            ->assertSeeInOrder(['Status de Combate', 'Armas e proteções equipadas', 'Espada Longa', 'Cota de Malha'])
            ->assertSee(route('inventory.items.roll', [$this->character, $sword]), false)
            ->assertSee('Dano · Espada Longa')
            ->assertDontSee('Machado Guardado');

        // A rolagem da ficha usa a rota do inventário (atributos totais).
        $this->actingAs($this->player)->postJson(route('inventory.items.roll', [$this->character, $sword]))
            ->assertOk()
            ->assertJsonPath('result.title', 'Dano · Espada Longa');
    }
}
