<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\GameSession;
use App\Models\Suggestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Item do inventário que não existe na loja, sugerido pelo jogador ao mestre
 * da campanha, que o revisa na biblioteca da campanha (loja).
 */
class ItemSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private Character $character;

    private CharacterItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->character = new Character(['name' => 'Alden', 'stats' => ['for' => 4]]);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();

        $this->item = new CharacterItem([
            'name' => 'Lâmina de Exemplo', 'category' => 'weapons', 'rarity' => 'Raro', 'damage' => '1D8',
            'weight' => 2, 'value' => 80, 'quantity' => 1, 'stats' => ['for' => 1],
        ]);
        $this->item->position = 0;
        $this->character->items()->save($this->item);
    }

    private function suggest(?User $user = null): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user ?? $this->player)
            ->from(route('inventory.show', $this->character))
            ->post(route('inventory.items.suggest', [$this->character, $this->item]));
    }

    public function test_player_suggests_an_item_to_the_campaign_gm(): void
    {
        $this->actingAs($this->player)->get(route('inventory.show', $this->character))
            ->assertSee(route('inventory.items.suggest', [$this->character, $this->item]), false);

        $this->suggest()->assertSessionHas('status');

        $suggestion = Suggestion::query()->sole();
        $this->assertSame(SuggestionType::Item, $suggestion->type);
        $this->assertSame($this->session->id, $suggestion->game_session_id);
        $this->assertSame($this->item->id, $suggestion->character_item_id);
        $this->assertSame('Rare', $suggestion->data['rarity']);
        $this->assertSame(['for' => 1], $suggestion->data['stats']);

        // Uma sugestão pendente por item.
        $this->suggest()->assertSessionHasErrors('suggestion');
        $this->assertSame(1, Suggestion::query()->count());

        // O inventário mostra a situação.
        $this->actingAs($this->player)->get(route('inventory.show', $this->character))->assertSee('Sugerido ao mestre');
    }

    public function test_only_the_owner_of_a_non_shop_item_in_a_campaign_can_suggest(): void
    {
        // Item que veio da loja.
        $catalog = new CatalogItem(['name' => 'Adaga', 'category' => 'weapons', 'rarity' => 'Common', 'value' => 5]);
        $catalog->save();
        $this->item->forceFill(['catalog_item_id' => $catalog->id])->save();
        $this->suggest()->assertSessionHasErrors('suggestion');

        // O mestre não sugere para si mesmo; outro jogador não tem acesso ao inventário.
        $this->item->forceFill(['catalog_item_id' => null])->save();
        $this->suggest($this->gm)->assertForbidden();
        $this->suggest(User::factory()->create())->assertForbidden();

        // Sem campanha não há mestre para receber.
        $this->character->forceFill(['game_session_id' => null])->save();
        $this->suggest()->assertSessionHasErrors('suggestion');

        $this->assertSame(0, Suggestion::query()->count());
    }

    public function test_item_with_the_name_of_a_shop_item_is_not_suggested(): void
    {
        $catalog = new CatalogItem(['name' => 'lâmina de exemplo', 'category' => 'weapons', 'rarity' => 'Common', 'value' => 5]);
        $catalog->save();

        $this->suggest()->assertSessionHasErrors('suggestion');
    }

    public function test_gm_reviews_and_adds_the_item_to_the_campaign_shop(): void
    {
        $this->suggest();
        $suggestion = Suggestion::query()->sole();

        // A biblioteca de itens da campanha lista a sugestão; o admin não a recebe.
        $this->actingAs($this->gm)->get(route('gm.sessions.library.index', [$this->session, 'tipo' => 'itens']))
            ->assertOk()
            ->assertSee('Lâmina de Exemplo')
            ->assertSee(route('gm.sessions.library.itens.create', [$this->session, 'sugestao' => $suggestion->id]), false);
        $this->assertSame(0, Suggestion::query()->forAdmin()->count());

        // O formulário abre preenchido.
        $this->actingAs($this->gm)->get(route('gm.sessions.library.itens.create', [$this->session, 'sugestao' => $suggestion->id]))
            ->assertOk()
            ->assertSee('Revisar Sugestão de Item')
            ->assertSee('value="Lâmina de Exemplo"', false);

        $this->actingAs($this->gm)->post(route('gm.sessions.library.itens.store', $this->session), [
            'suggestion_id' => $suggestion->id,
            'name' => 'Lâmina de Exemplo',
            'category' => 'weapons',
            'rarity' => 'Rare',
            'weight' => 2,
            'value' => 90,
            'damage' => '1D8',
            'defense' => 0,
        ])->assertRedirect()->assertSessionHas('status');

        $entry = CatalogItem::query()->where('game_session_id', $this->session->id)->sole();
        $this->assertSame(90, (int) $entry->value);
        $this->assertSame(SuggestionStatus::Approved, $suggestion->fresh()->status);
        // O item do jogador passa a ser o da loja.
        $this->assertSame($entry->id, $this->item->fresh()->catalog_item_id);
    }

    public function test_gm_rejects_and_others_cannot_review(): void
    {
        $this->suggest();
        $suggestion = Suggestion::query()->sole();
        $reject = route('gm.sessions.library.player-suggestions.reject', [$this->session, $suggestion]);

        $this->actingAs($this->player)->put($reject)->assertForbidden();
        $this->actingAs(User::factory()->gm()->create())->put($reject)->assertForbidden();

        $this->actingAs($this->gm)->put($reject)->assertRedirect();
        $this->assertSame(SuggestionStatus::Rejected, $suggestion->fresh()->status);
        $this->assertNull($this->item->fresh()->catalog_item_id);

        // Recusada, pode ser enviada de novo.
        $this->actingAs($this->player)->get(route('inventory.show', $this->character))->assertSee('Sugestão recusada');
        $this->suggest()->assertSessionHas('status');
    }

    public function test_creation_suggestions_do_not_accept_items(): void
    {
        $this->actingAs($this->player)->postJson(route('suggestions.store'), ['type' => 'item', 'name' => 'Lâmina'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');
    }
}
