<?php

declare(strict_types=1);

namespace Tests\Unit\Game;

use App\Game\CharacterCalculator;
use App\Game\GameRules;
use App\Models\RuleSet;
use Tests\TestCase;

class CharacterCalculatorTest extends TestCase
{
    private CharacterCalculator $calculator;

    /** @var array<string, int> */
    private array $attributes = ['for' => 10, 'con' => 12, 'agi' => 8, 'per' => 6, 'vel' => 4, 'ini' => 3, 'int' => 5, 'cor' => 7];

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new CharacterCalculator;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function rules(array $attributes = []): GameRules
    {
        $ruleSet = new RuleSet;
        $ruleSet->forceFill($attributes);

        return new GameRules($ruleSet);
    }

    public function test_formula_stats_include_attributes_and_skill_counts(): void
    {
        $stats = $this->calculator->formulaStats($this->attributes, ['Luta', 'Luta', 'Mística'], 1, new GameRules);

        $this->assertSame(10, $stats['FOR']);
        $this->assertSame(7, $stats['COR']);
        $this->assertSame(2, $stats['LUTA']);
        $this->assertSame(2, $stats['LUTAS']);
        $this->assertSame(1, $stats['MISTICA']);
        $this->assertSame(1, $stats['MISTICAS']);
        $this->assertSame(3, $stats['SKILLS']);
        $this->assertSame(1, $stats['POWERS']);
    }

    public function test_categories_ending_in_s_get_singular_alias(): void
    {
        $stats = $this->calculator->formulaStats([], ['Artes'], 0, $this->rules(['skill_type_vars' => ['Artes' => 'INI']]));

        $this->assertSame(1, $stats['ARTES']);
        $this->assertSame(1, $stats['ARTE']);
        $this->assertArrayNotHasKey('LUTA', $stats);
    }

    public function test_formula_stats_resolve_calculation_variables(): void
    {
        $rules = $this->rules(['calculation_vars' => ['Bonus' => 'LUTA + FOR']]);

        $stats = $this->calculator->formulaStats($this->attributes, ['Luta'], 0, $rules);

        $this->assertSame(11, $stats['BONUS']);
    }

    public function test_derived_stats_with_default_formulas(): void
    {
        $stats = $this->calculator->formulaStats($this->attributes, ['Luta'], 0, new GameRules);

        $this->assertSame([
            'pv' => 170,
            'atp' => 24,
            'soco' => 10,
            'chute' => 15,
            'en' => 7,
            'dm' => 9,
            'defesa' => 18,
            'esquiva' => 24,
        ], $this->calculator->derivedStats($stats, new GameRules));
    }

    public function test_derived_stats_with_configured_formula(): void
    {
        $rules = $this->rules(['pv_formula' => 'CON * 5', 'atp_formula' => '  ']);
        $stats = $this->calculator->formulaStats($this->attributes, [], 0, $rules);

        $derived = $this->calculator->derivedStats($stats, $rules);

        $this->assertSame(60, $derived['pv']);
        $this->assertSame(24, $derived['atp']);
    }

    public function test_skill_cost_divides_by_type_variable_and_rounds_up(): void
    {
        $rules = $this->rules(['skill_type_vars' => ['Luta' => 'FOR', 'Geral' => '1']]);
        $stats = ['FOR' => 4];

        $this->assertSame(2, $this->calculator->abilityCost(3, 2, 'Luta', false, $stats, $rules));
        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Geral', false, $stats, $rules));
        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Desconhecido', false, $stats, $rules));
    }

    public function test_type_variable_is_at_least_one(): void
    {
        $rules = $this->rules(['skill_type_vars' => ['Luta' => 'FOR']]);

        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Luta', false, ['FOR' => 0], $rules));
    }

    public function test_cost_without_rules_is_cost_times_level(): void
    {
        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Luta', false, [], new GameRules));
        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Físico', true, [], new GameRules));
    }

    public function test_zero_cost_and_level_count_as_one(): void
    {
        $this->assertSame(1, $this->calculator->abilityCost(0, 0, null, false, [], new GameRules));
    }

    public function test_power_cost_ignores_the_skill_default_formula(): void
    {
        $rules = $this->rules([
            'power_cost_formula' => '(COST * LVL) / VAR',
            'power_type_vars' => ['Físico' => 'FOR'],
        ]);

        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Físico', true, ['FOR' => 4], $rules));
    }

    public function test_custom_power_cost_formula(): void
    {
        $rules = $this->rules([
            'power_cost_formula' => 'COST * LVL / VAR + 1',
            'power_type_vars' => ['Físico' => 'FOR'],
        ]);

        $this->assertSame(3, $this->calculator->abilityCost(3, 2, 'Físico', true, ['FOR' => 4], $rules));
    }

    public function test_cost_formula_with_other_variables_falls_back_to_cost_times_level(): void
    {
        $rules = $this->rules(['skill_cost_formula' => 'COST * FOR']);

        $this->assertSame(6, $this->calculator->abilityCost(3, 2, 'Luta', false, ['FOR' => 4], $rules));
    }

    public function test_attribute_total_disregards_trait_modifier_when_attribute_has_its_own(): void
    {
        $this->assertSame(12, $this->calculator->attributeTotal(10, 2, 2));
        $this->assertSame(12, $this->calculator->attributeTotal(10, 0, 2));
        $this->assertSame(15, $this->calculator->attributeTotal(10, 0, 2, 1, 2));
        $this->assertSame(8, $this->calculator->attributeTotal(10, -2, 0));
    }

    public function test_rules_for_the_browser_are_fully_resolved(): void
    {
        $rules = $this->rules([
            'pv_formula' => 'CON * 5',
            'power_cost_formula' => '(COST * LVL) / VAR',
            'skill_type_vars' => ['Luta' => 'FOR'],
        ])->toArray();

        $this->assertSame('CON * 5', $rules['formulas']['pv']);
        $this->assertSame('(INT + 3) * 3', $rules['formulas']['atp']);
        $this->assertSame('(COST * LVL)', $rules['formulas']['power_cost']);
        $this->assertSame(['easy_mod' => 2.0, 'hard_div' => 2.0, 'extreme_div' => 5.0], $rules['difficulty']);
        $this->assertSame(['Luta'], $rules['skill_categories']);
        $this->assertCount(8, $rules['attributes']);
    }
}
