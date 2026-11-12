<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\TraitType;
use App\Game\CharacterSheet;
use App\Game\DiceRoller;
use App\Game\FormulaEvaluator;
use App\Game\GameRules;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Random\Engine;
use Random\Randomizer;
use Tests\TestCase;

/**
 * Ficha Geral (CharacterSheet.tsx do sistema antigo).
 */
class CharacterSheetTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private Character $character;

    private Talent $dodge;

    protected function setUp(): void
    {
        parent::setUp();

        $this->player = User::factory()->create();
        $this->dodge = Talent::query()->create(['name' => 'Esquiva', 'composition' => ['agi', 'vel']]);

        $this->character = new Character([
            'name' => 'Alden',
            'class' => 'Paladino',
            'level' => 3,
            'stats' => ['for' => 10, 'con' => 12, 'agi' => 8, 'per' => 6, 'vel' => 4, 'ini' => 3, 'int' => 5, 'cor' => 7],
            'stats_mods' => ['con' => 2],
            'talent_mods' => [(string) $this->dodge->id => 1],
            'current_pv' => 100,
            'sanity' => 7,
        ]);
        $this->character->user_id = $this->player->id;
        $this->character->gm_modifiers = [
            'for' => [['value' => 1, 'justification' => 'Bênção do templo']],
            'talent:'.$this->dodge->id => [['value' => 2, 'justification' => 'Treino com o mestre']],
        ];
        $this->character->save();

        $strength = CharacterTrait::query()->create(['name' => 'Força Bruta', 'type' => TraitType::Advantage, 'modifier' => 2, 'modifier_attribute' => 'for']);
        $tough = CharacterTrait::query()->create(['name' => 'Robusto', 'type' => TraitType::Advantage, 'modifier' => 1, 'modifier_attribute' => 'con']);
        $quick = CharacterTrait::query()->create(['name' => 'Reflexos', 'type' => TraitType::Advantage, 'modifier' => 3, 'modifier_talent_id' => $this->dodge->id]);
        $this->character->traits()->attach([$strength->id, $tough->id, $quick->id]);

        $armor = new CharacterItem(['name' => 'Cota de Malha', 'category' => 'armor', 'defense' => 3, 'equipped' => true, 'stats' => ['for' => 1], 'quantity' => 1]);
        $this->character->items()->save($armor);
        $this->character->items()->save(new CharacterItem(['name' => 'Elmo guardado', 'category' => 'armor', 'defense' => 5, 'equipped' => false, 'quantity' => 1]));

        $skill = Skill::query()->create(['name' => 'Espadas', 'type' => 'Luta', 'purchase_cost' => 2, 'difficulty_formula' => '10 + FOR']);
        $this->character->skills()->attach($skill, ['level' => 2, 'type' => null]);
    }

    private function sheet(): array
    {
        $character = $this->character->fresh(['skills', 'powers', 'traits', 'items', 'gameSession']);

        return CharacterSheet::for($character, new GameRules, Talent::query()->get())->data;
    }

    /**
     * Rolador cujos dados saem na ordem informada.
     */
    private function fakeDice(int ...$values): void
    {
        $engine = new class($values) implements Engine
        {
            public function __construct(private array $values)
            {
            }

            public function generate(): string
            {
                $value = array_shift($this->values) ?? throw new LogicException('Nenhum dado restante.');

                return pack('V', $value - 1);
            }
        };

        $this->app->instance(DiceRoller::class, new DiceRoller(new FormulaEvaluator, new Randomizer($engine)));
    }

    public function test_attribute_total_adds_every_source(): void
    {
        $strength = collect($this->sheet()['attributes'])->firstWhere('id', 'for');

        // 10 base + 2 traço + 1 item equipado + 1 mestre.
        $this->assertSame(['base' => 10, 'mod' => 0, 'trait' => 2, 'item' => 1, 'gm' => 1, 'total' => 14], array_intersect_key($strength, array_flip(['base', 'mod', 'trait', 'item', 'gm', 'total'])));
    }

    public function test_trait_is_disregarded_when_attribute_has_its_own_modifier(): void
    {
        $constitution = collect($this->sheet()['attributes'])->firstWhere('id', 'con');

        $this->assertTrue($constitution['trait_disregarded']);
        $this->assertSame(14, $constitution['total']);
    }

    public function test_talent_sums_composition_and_modifiers(): void
    {
        $talent = collect($this->sheet()['talents'])->firstWhere('name', 'Esquiva');

        // AGI 8 + VEL 4 + mod 1 + mestre 2; o traço (+3) é ignorado porque há modificador próprio.
        $this->assertSame(12, $talent['base']);
        $this->assertSame(0, $talent['trait']);
        $this->assertSame(15, $talent['total']);
    }

    public function test_derived_stats_skills_and_armor(): void
    {
        $sheet = $this->sheet();
        $skill = $sheet['skills'][0];

        // PV padrão: ((FOR / 2) + CON) * 10 = ((14 / 2) + 14) * 10.
        $this->assertSame(210, $sheet['derived']['pv']);
        $this->assertSame(24, $skill['difficulty'], '10 + FOR (14)');
        $this->assertSame(4, $skill['cost'], 'COST 2 * LVL 2 / VAR 1');
        $this->assertSame(3, $sheet['armor_bonus'], 'Só armaduras equipadas contam.');
    }

    public function test_sheet_page_shows_the_calculated_values(): void
    {
        $this->actingAs($this->player)->get(route('characters.show', $this->character))
            ->assertOk()
            ->assertSee('Alden')
            ->assertSee('Bênção do templo')
            ->assertSee('Esquiva')
            ->assertSee('Espadas')
            ->assertSee('Força Bruta')
            ->assertSee('Cota de Malha')
            ->assertDontSee('Elmo guardado');
    }

    public function test_attribute_test_rolls_d10_against_the_server_value(): void
    {
        $this->fakeDice(9);

        $this->actingAs($this->player)
            ->post(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal'])
            ->assertRedirect(route('characters.show', $this->character).'#atributos')
            ->assertSessionHas('test', fn (array $test): bool => $test['target'] === 14 && $test['sides'] === 10 && $test['roll'] === 9 && $test['success']);
    }

    public function test_hard_talent_test_uses_d20_and_divides_the_value(): void
    {
        $this->fakeDice(20);

        $this->actingAs($this->player)
            ->post(route('characters.test', $this->character), ['target' => 'talent:'.$this->dodge->id, 'difficulty' => 'hard'])
            ->assertSessionHas('test', fn (array $test): bool => $test['target'] === 7 && $test['sides'] === 20 && $test['is_fumble']);
    }

    public function test_quick_test_answers_json_for_the_roll_dialog(): void
    {
        $this->fakeDice(9);

        $this->actingAs($this->player)
            ->postJson(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal'])
            ->assertOk()
            ->assertJsonPath('result.value', 9)
            ->assertJsonPath('result.outcome', 'success')
            ->assertJsonPath('result.detail', '1D10 <= 14')
            ->assertJsonPath('result.note', null)
            ->assertJsonPath('test.target', 14);

        $this->get(route('characters.show', $this->character))
            ->assertOk()
            ->assertSee('data-roll-dialog-modal', false)
            ->assertDontSee('test-result__roll', false);
    }

    public function test_unknown_test_target_is_rejected(): void
    {
        $this->actingAs($this->player)
            ->post(route('characters.test', $this->character), ['target' => 'attr:xyz', 'difficulty' => 'normal'])
            ->assertNotFound();
    }

    public function test_vitals_respect_the_sheet_limits(): void
    {
        $this->actingAs($this->player)->put(route('characters.vitals', $this->character), [
            'current_pv' => 150, 'temp_pv' => 5, 'current_atp' => 10, 'protection' => 4, 'sanity' => 8, 'awakening' => 2,
        ])->assertSessionHasErrors(['protection', 'sanity']);

        $this->actingAs($this->player)->put(route('characters.vitals', $this->character), [
            'current_pv' => 150, 'temp_pv' => 5, 'current_atp' => 10, 'protection' => 3, 'sanity' => 6, 'awakening' => 2,
        ])->assertSessionHasNoErrors();

        $this->assertSame(150, $this->character->fresh()->current_pv);
        $this->assertSame(3, $this->character->fresh()->protection);
    }

    public function test_campaign_members_read_but_only_owner_and_gm_play(): void
    {
        $gm = User::factory()->gm()->create();
        $session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN001']);
        $session->gm_id = $gm->id;
        $session->save();
        $companion = User::factory()->create();
        $session->players()->attach([$this->player->id, $companion->id]);
        $this->character->game_session_id = $session->id;
        $this->character->save();

        $this->actingAs($companion)->get(route('characters.show', $this->character))->assertOk()->assertDontSee('Salvar estado');
        $this->actingAs($companion)->post(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal'])->assertForbidden();

        $this->fakeDice(5);
        $this->actingAs($gm)->post(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal'])->assertSessionHas('test');

        $this->actingAs(User::factory()->create())->get(route('characters.show', $this->character))->assertForbidden();
    }

    public function test_old_links_and_single_character_open_the_sheet(): void
    {
        $this->actingAs($this->player)->get('/ficha?personagem='.$this->character->id)->assertRedirect(route('characters.show', $this->character));
        $this->actingAs($this->player)->get('/ficha')->assertRedirect(route('characters.show', $this->character));
    }
}
