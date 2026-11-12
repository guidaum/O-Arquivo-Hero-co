<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\TraitType;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Suggestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Criação de Personagem: o servidor recalcula o rascunho com as regras da
 * campanha (pontos padrão: 28 de atributos, 10 de perícia, 5 de poder, 500 MO).
 */
class CharacterCreationTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private User $gm;

    private GameSession $session;

    private Skill $skill;

    private Power $power;

    private CatalogItem $potion;

    protected function setUp(): void
    {
        parent::setUp();

        $this->player = User::factory()->create();
        $this->gm = User::factory()->gm()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN001']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();

        $this->skill = Skill::query()->create(['name' => 'Esgrima', 'type' => 'Luta', 'purchase_cost' => 3]);
        $this->power = Power::query()->create(['name' => 'Chama', 'type' => 'Elemental', 'purchase_cost' => 2]);
        $this->potion = CatalogItem::query()->create(['name' => 'Poção de Cura', 'category' => 'consumables', 'value' => 50, 'is_starting_item' => true]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'basics' => ['name' => 'Alden', 'class' => 'Paladino', 'color' => 'gold', 'icon' => 'Sword', 'game_session_id' => $this->session->id],
            'traits' => [],
            'stats' => ['for' => 5, 'con' => 5, 'agi' => 4],
            'skills' => [],
            'powers' => [],
            'equipment' => ['catalog' => [], 'custom' => []],
        ], $overrides);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function forge(array $payload, ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->player)
            ->from(route('characters.create'))
            ->post(route('characters.store'), ['payload' => json_encode($payload)]);
    }

    public function test_wizard_page_lists_campaigns_and_library(): void
    {
        $this->actingAs($this->player)->get(route('characters.create'))
            ->assertOk()
            ->assertSee('Forjar uma Nova Lenda')
            ->assertSee('Crônicas')
            ->assertSee('Esgrima')
            ->assertSee('js/creation/wizard.js', false);
    }

    public function test_character_is_forged_with_remaining_points_and_items(): void
    {
        $this->forge($this->payload([
            'skills' => [['id' => $this->skill->id, 'level' => 2, 'type' => 'Luta', 'description' => 'Escola do norte']],
            'powers' => [['id' => $this->power->id, 'level' => 1, 'type' => 'Elemental']],
            'equipment' => [
                'catalog' => [$this->potion->id, $this->potion->id],
                'custom' => [['name' => 'Amuleto da avó', 'category' => 'misc']],
            ],
        ]))->assertSessionHasNoErrors()->assertRedirect();

        $character = Character::query()->where('name', 'Alden')->firstOrFail();

        $this->assertSame($this->player->id, $character->user_id);
        $this->assertSame($this->session->id, $character->game_session_id);
        $this->assertSame('Paladino', $character->class);
        $this->assertSame(1, $character->level);
        $this->assertSame(14, $character->attribute_points);
        $this->assertSame(4, $character->skill_points);
        $this->assertSame(3, $character->power_points);
        $this->assertSame(400, $character->money);
        $this->assertSame(5, $character->stats['for']);
        $this->assertSame('Escola do norte', $character->skills()->first()->pivot->description);
        $this->assertSame(2, $character->items()->where('name', 'Poção de Cura')->value('quantity'));
        $this->assertTrue($character->items()->where('name', 'Amuleto da avó')->exists());
        $this->assertGreaterThan(0, $character->current_pv);

        // Quem cria numa campanha alheia passa a jogar nela.
        $this->assertTrue($this->session->players()->whereKey($this->player->id)->exists());
    }

    public function test_advantages_need_points_from_disadvantages(): void
    {
        $advantage = CharacterTrait::query()->create(['name' => 'Força Bruta', 'type' => TraitType::Advantage, 'modifier' => 2, 'modifier_attribute' => 'for']);
        $disadvantage = CharacterTrait::query()->create(['name' => 'Frágil', 'type' => TraitType::Disadvantage, 'modifier' => -3, 'modifier_attribute' => 'con']);

        $this->forge($this->payload(['traits' => [$advantage->id]]))->assertSessionHasErrors('traits');
        $this->assertSame(0, Character::query()->count());

        $this->forge($this->payload(['traits' => [$advantage->id, $disadvantage->id]]))->assertSessionHasNoErrors();
        $this->assertSame(2, Character::query()->firstOrFail()->traits()->count());
    }

    public function test_attributes_respect_the_campaign_limits(): void
    {
        $this->forge($this->payload(['stats' => ['for' => 11]]))->assertSessionHasErrors('stats');
        $this->forge($this->payload(['stats' => ['for' => 10, 'con' => 10, 'agi' => 9]]))->assertSessionHasErrors('stats');

        $this->assertSame(0, Character::query()->count());
    }

    public function test_skills_and_equipment_cannot_exceed_the_budget(): void
    {
        $this->forge($this->payload(['skills' => [['id' => $this->skill->id, 'level' => 4]]]))->assertSessionHasErrors('skills');

        $expensive = CatalogItem::query()->create(['name' => 'Espada Rúnica', 'category' => 'weapons', 'value' => 600, 'is_starting_item' => true]);
        $this->forge($this->payload(['equipment' => ['catalog' => [$expensive->id]]]))->assertSessionHasErrors('equipment');

        $notStarting = CatalogItem::query()->create(['name' => 'Coroa', 'category' => 'misc', 'value' => 1]);
        $this->forge($this->payload(['equipment' => ['catalog' => [$notStarting->id]]]))->assertSessionHasErrors('equipment');

        $this->assertSame(0, Character::query()->count());
    }

    public function test_library_of_another_campaign_is_not_available(): void
    {
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT001']);
        $other->gm_id = $this->gm->id;
        $other->save();

        $foreign = new Skill(['name' => 'Segredo', 'type' => 'Luta', 'purchase_cost' => 1]);
        $foreign->game_session_id = $other->id;
        $foreign->save();

        $this->forge($this->payload(['skills' => [['id' => $foreign->id, 'level' => 1]]]))->assertSessionHasErrors('skills');
    }

    public function test_inactive_campaign_of_another_gm_is_rejected(): void
    {
        $this->session->active = false;
        $this->session->save();

        $this->forge($this->payload())->assertSessionHasErrors('basics.game_session_id');

        // O mestre ainda pode criar personagens na própria campanha inativa.
        $this->forge($this->payload(), $this->gm)->assertSessionHasNoErrors();
        $this->assertFalse($this->session->players()->whereKey($this->gm->id)->exists());
    }

    public function test_errors_keep_the_draft_for_the_wizard(): void
    {
        $payload = $this->payload(['stats' => ['for' => 99]]);

        $this->forge($payload)->assertSessionHasErrors('stats');

        $this->actingAs($this->player)->get(route('characters.create'))
            ->assertOk()
            ->assertSee('"for":99', false);
    }

    public function test_players_can_suggest_library_entries(): void
    {
        $this->actingAs($this->player)
            ->postJson(route('suggestions.store'), ['type' => 'skill', 'name' => 'Arco Longo', 'category' => 'Luta', 'purchase_cost' => 2])
            ->assertCreated()
            ->assertJson(['message' => 'Sugestão enviada para o administrador!']);

        $suggestion = Suggestion::query()->firstOrFail();
        $this->assertSame($this->player->id, $suggestion->user_id);
        $this->assertSame('Arco Longo', $suggestion->data['name']);
        $this->assertSame(2, $suggestion->data['purchaseCost']);

        $this->actingAs($this->player)->postJson(route('suggestions.store'), ['type' => 'monstro', 'name' => 'X'])
            ->assertUnprocessable();
    }
}
