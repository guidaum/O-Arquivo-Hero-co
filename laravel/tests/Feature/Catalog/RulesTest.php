<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Game\GameRules;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Editor de regras: Configurações Base (globais) e regras da campanha.
 */
class RulesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'max_attribute_points' => 120,
            'max_single_attribute_value' => 20,
            'initial_skill_points' => 10,
            'initial_power_points' => 5,
            'initial_money' => 100,
            'attr_points_per_level' => 2,
            'skill_points_per_level' => 3,
            'power_points_per_level' => 1,
            'npc_default_min_attr' => 1,
            'npc_default_max_attr' => 10,
            'npc_default_attr_points' => 60,
            'npc_default_skill_points' => 5,
            'npc_default_power_points' => 2,
            'diff_easy_mod' => '',
            'diff_hard_div' => 3,
            'diff_extreme_div' => '',
            'pv_formula' => '(FOR + CON) * 5',
            'atp_formula' => '',
            'en_formula' => '20 - (LUTA * 2)',
            'attributes' => [
                ['id' => 'FOR', 'label' => 'Força'],
                ['id' => 'con', 'label' => 'Constituição'],
                ['id' => '', 'label' => ''],
            ],
            'talent_categories' => ['Combate', ''],
            'skill_types' => [
                ['name' => 'Luta', 'var' => 'FOR', 'original' => 'Luta'],
                ['name' => 'Geral', 'var' => '', 'original' => ''],
            ],
            'power_types' => [],
            'calculation_vars' => [['name' => 'BONUS', 'formula' => 'LUTA + FOR']],
            'enable_email_password_auth' => 1,
            ...$overrides,
        ];
    }

    public function test_global_rules_are_admin_only(): void
    {
        $gm = User::factory()->gm()->create();

        $this->actingAs($gm)->get('/catalogos/regras')->assertForbidden();
        $this->actingAs($gm)->put('/catalogos/regras', $this->payload())->assertForbidden();
        $this->actingAs($this->admin)->get('/catalogos/regras')->assertOk()->assertSee('Configurações Base');
    }

    public function test_admin_saves_global_rules(): void
    {
        $this->actingAs($this->admin)->put('/catalogos/regras', $this->payload())
            ->assertRedirect(route('catalog.rules.edit'))
            ->assertSessionHasNoErrors();

        $ruleSet = RuleSet::query()->global()->firstOrFail();
        $rules = new GameRules($ruleSet);

        $this->assertSame(120, $ruleSet->max_attribute_points);
        $this->assertSame('(FOR + CON) * 5', $rules->formula('pv'));
        $this->assertSame('(INT + 3) * 3', $rules->formula('atp'), 'Fórmula vazia usa o padrão.');
        $this->assertSame(3.0, $rules->hardDivisor());
        $this->assertSame(2.0, $rules->easyModifier(), 'Dificuldade vazia usa o padrão.');
        $this->assertSame([['id' => 'for', 'label' => 'Força'], ['id' => 'con', 'label' => 'Constituição']], $rules->attributes());
        $this->assertSame(['Combate'], $rules->talentCategories());
        $this->assertSame(['Luta' => 'FOR', 'Geral' => '1'], $rules->skillTypeVars());
        $this->assertSame(['BONUS' => 'LUTA + FOR'], $rules->calculationVars());
        $this->assertTrue($ruleSet->enable_email_password_auth);
    }

    public function test_invalid_formulas_and_names_are_rejected(): void
    {
        $this->actingAs($this->admin)->put('/catalogos/regras', $this->payload([
            'pv_formula' => '(FOR + CON',
            'calculation_vars' => [['name' => '1BONUS', 'formula' => 'FOR']],
            'attributes' => [['id' => 'for', 'label' => 'Força'], ['id' => 'for', 'label' => 'Outra']],
        ]))->assertSessionHasErrors(['pv_formula', 'calculation_vars.0.name', 'attributes.0.id']);

        $this->assertSame(0, RuleSet::query()->count());
    }

    public function test_renaming_a_skill_type_updates_skills_and_formulas(): void
    {
        $this->actingAs($this->admin)->put('/catalogos/regras', $this->payload())->assertSessionHasNoErrors();
        $skill = Skill::query()->create(['name' => 'Espadas', 'type' => 'Luta']);

        $this->actingAs($this->admin)->put('/catalogos/regras', $this->payload([
            'en_formula' => '20 - (LUTA * 2) + LUTAS',
            'skill_types' => [['name' => 'Briga', 'var' => 'FOR', 'original' => 'Luta']],
        ]))->assertSessionHasNoErrors();

        $rules = GameRules::global();

        $this->assertSame('Briga', $skill->fresh()->type);
        $this->assertSame('20 - (BRIGA * 2) + BRIGAS', $rules->formula('en'));
        $this->assertSame(['BONUS' => 'BRIGA + FOR'], $rules->calculationVars());
        $this->assertSame(['Briga' => 'FOR'], $rules->skillTypeVars());
    }

    public function test_session_gm_creates_campaign_rules_from_the_global_ones(): void
    {
        $this->actingAs($this->admin)->put('/catalogos/regras', $this->payload())->assertSessionHasNoErrors();

        $gm = User::factory()->gm()->create();
        $session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN001']);
        $session->gm_id = $gm->id;
        $session->save();

        $this->actingAs($gm)->get(route('gm.sessions.rules.edit', $session))
            ->assertOk()
            ->assertSee('ainda usa as regras globais')
            ->assertSee('value="(FOR + CON) * 5"', false);

        $this->actingAs($gm)->put(route('gm.sessions.rules.update', $session), $this->payload([
            'max_attribute_points' => 200,
            'skill_types' => [['name' => 'Luta', 'var' => 'FOR', 'original' => 'Luta']],
        ]))->assertRedirect(route('gm.sessions.rules.edit', $session));

        $this->assertSame(200, RuleSet::forSession($session->fresh())->max_attribute_points);
        $this->assertSame(120, RuleSet::query()->global()->firstOrFail()->max_attribute_points);
        $this->assertSame(2, RuleSet::query()->count());

        $this->actingAs(User::factory()->gm()->create())->get(route('gm.sessions.rules.edit', $session))->assertForbidden();
    }
}
