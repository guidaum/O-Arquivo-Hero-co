<?php

declare(strict_types=1);

namespace Tests\Unit\Game;

use App\Enums\TraitType;
use App\Game\TraitCalculator;
use App\Models\CharacterTrait;
use App\Models\Talent;
use Tests\TestCase;

/**
 * Porte de tests/character-system.test.ts (Vantagens e Defeitos) do
 * sistema antigo, mais os casos de custo.
 */
class TraitCalculatorTest extends TestCase
{
    private TraitCalculator $traits;

    /** @var list<array{id: string, name: string}> */
    private array $talents = [
        ['id' => 'esquiva', 'name' => 'Esquiva'],
        ['id' => 'bloqueio', 'name' => 'Bloqueio'],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->traits = new TraitCalculator;
    }

    public function test_advantage_modifier_on_attribute(): void
    {
        $advantage = ['name' => 'Força Bruta', 'type' => 'advantage', 'modifier' => 2, 'target' => 'for'];

        $this->assertSame(2, $this->traits->effectiveModifier($advantage));
        $this->assertContains('for', $this->traits->targets($advantage)->attributeIds);
    }

    public function test_modifier_sign_is_kept_for_disadvantages(): void
    {
        // O teste antigo esperava -2 aqui, mas o sistema antigo em produção
        // respeita o sinal cadastrado. O comportamento em produção foi mantido.
        $positive = ['name' => 'Miopia Severa', 'type' => 'disadvantage', 'modifier' => 2, 'target' => 'per'];
        $negative = ['name' => 'Fraqueza', 'type' => 'defeito', 'modifier' => -3, 'target' => 'for'];

        $this->assertSame(2, $this->traits->effectiveModifier($positive));
        $this->assertSame(-3, $this->traits->effectiveModifier($negative));
        $this->assertContains('per', $this->traits->targets($positive)->attributeIds);
    }

    public function test_modifier_comes_from_effect_when_not_informed(): void
    {
        $this->assertSame(2, $this->traits->effectiveModifier(['type' => 'advantage', 'modifier' => null, 'effect' => '+2 em AGI']));
        $this->assertSame(-1, $this->traits->effectiveModifier(['type' => 'advantage', 'effect' => 'Recebe - 1 em Coragem']));
        $this->assertSame(0, $this->traits->effectiveModifier(['type' => 'advantage', 'modifier' => 0, 'effect' => '+2 em AGI']));
        $this->assertSame(0, $this->traits->effectiveModifier(['type' => 'advantage']));
    }

    public function test_targets_ignore_accents_and_case(): void
    {
        $this->assertContains('for', $this->traits->targets(['name' => 'Músculos de Ferro', 'target' => 'FOR'])->attributeIds);
        $this->assertContains('agi', $this->traits->targets(['name' => 'Reflexos Rápidos', 'target' => 'Agilidade'])->attributeIds);
        $this->assertContains('int', $this->traits->targets(['name' => 'Mente Brilhante', 'target' => 'inteligência'])->attributeIds);

        $targets = $this->traits->targets(['name' => 'Guerreiro Indômito', 'effect' => '+2 em Força e Constituição']);
        $this->assertSame(['for', 'con'], $targets->attributeIds);
    }

    public function test_attribute_modifiers_sum_the_traits(): void
    {
        $modifiers = $this->traits->attributeModifiers([
            ['type' => 'advantage', 'modifier' => 2, 'target' => 'for'],
            ['type' => 'disadvantage', 'modifier' => -2, 'target' => 'per'],
            ['type' => 'advantage', 'modifier' => 1, 'target' => 'for'],
        ]);

        $this->assertSame(['for' => 3, 'per' => -2], $modifiers);
    }

    public function test_same_attribute_in_modifier_and_effect_is_not_counted_twice(): void
    {
        $trait = ['name' => 'Vigor Extremo', 'type' => 'advantage', 'modifier' => 2, 'target' => 'for', 'effect' => '+2 em Força'];

        $this->assertSame(['for'], $this->traits->targets($trait)->attributeIds);
        $this->assertSame(['for' => 2], $this->traits->attributeModifiers([$trait]));
        $this->assertTrue($this->traits->isModifierSameAsEffect($trait));
    }

    public function test_same_talent_in_modifier_and_effect(): void
    {
        $trait = ['name' => 'Reflexos de Gato', 'type' => 'advantage', 'modifier' => 3, 'target' => 'esquiva', 'effect' => '+3 no talento Esquiva'];

        $targets = $this->traits->targets($trait, [], $this->talents);

        $this->assertSame(['esquiva'], $targets->talentIds);
        $this->assertSame([], $targets->attributeIds);
        $this->assertSame(['esquiva' => 3, 'bloqueio' => 0], $this->traits->talentModifiers([$trait], [], $this->talents));
        $this->assertTrue($this->traits->isModifierSameAsEffect($trait, [], $this->talents));
    }

    public function test_modifier_and_effect_on_different_attributes_add_both(): void
    {
        $trait = ['name' => 'Equilíbrio Místico', 'type' => 'advantage', 'modifier' => 2, 'target' => 'for', 'effect' => '+1 em Agilidade'];

        $this->assertSame(['for', 'agi'], $this->traits->targets($trait)->attributeIds);
        $this->assertFalse($this->traits->isModifierSameAsEffect($trait));
    }

    public function test_numeric_talent_ids_are_not_confused_with_effect_values(): void
    {
        $talents = [['id' => '3', 'name' => 'Lábia']];

        $byName = $this->traits->targets(['target' => 'for', 'effect' => '-3 em testes de lábia'], [], $talents);
        $byNumber = $this->traits->targets(['target' => 'for', 'effect' => '+3 em Força'], [], $talents);
        $byId = $this->traits->targets(['target' => '3', 'effect' => '-3 em testes'], [], $talents);

        $this->assertSame(['3'], $byName->talentIds);
        $this->assertSame([], $byNumber->talentIds);
        $this->assertSame(['3'], $byId->talentIds);
    }

    public function test_all_attributes_keyword(): void
    {
        $targets = $this->traits->targets(['name' => 'Abençoado', 'effect' => '+1 em todos os atributos']);

        $this->assertSame(['for', 'con', 'agi', 'per', 'vel', 'ini', 'int', 'cor'], $targets->attributeIds);
    }

    public function test_targets_fall_back_to_name_and_description(): void
    {
        $this->assertSame(['for'], $this->traits->targets(['name' => 'Força Bruta'])->attributeIds);
        $this->assertSame(['per'], $this->traits->targets(['name' => 'Olhos', 'description' => 'Melhora a percepção'])->attributeIds);
    }

    public function test_works_with_trait_models(): void
    {
        $talent = new Talent(['name' => 'Esquiva']);
        $talent->id = 7;

        $onAttribute = new CharacterTrait(['name' => 'Miopia', 'type' => TraitType::Disadvantage, 'modifier' => -2, 'modifier_attribute' => 'per']);
        $onTalent = new CharacterTrait(['name' => 'Ágil', 'type' => TraitType::Advantage, 'modifier' => 1, 'modifier_talent_id' => 7]);

        $this->assertSame(['per'], $this->traits->targets($onAttribute)->attributeIds);
        $this->assertSame(-2, $this->traits->effectiveModifier($onAttribute));
        $this->assertTrue($this->traits->isDisadvantage($onAttribute));
        $this->assertSame(['7'], $this->traits->targets($onTalent, [], [$talent])->talentIds);
        $this->assertSame('Esquiva', $this->traits->targetDisplayName('7', [], [$talent]));
    }

    public function test_effect_values_keep_signs_and_skip_dice_and_durations(): void
    {
        $this->assertSame([2, -1], $this->traits->effectValues('+2 FOR, -1 AGI'));
        $this->assertSame([2], $this->traits->effectValues('1d6 de dano e +2 em Força por 2 turnos'));
        $this->assertSame([1], $this->traits->effectValues('1 vez por dia, +1 em Percepção'));
        $this->assertSame([-2], $this->traits->effectValues('Reduz 2 de Agilidade'));
        $this->assertSame([3], $this->traits->effectValues('Bônus de 3 em Coragem'));
        $this->assertSame([2, -1], $this->traits->effectValues([['value' => 2], '-1 AGI']));
        $this->assertSame([3], $this->traits->effectValues(['modifier' => 3]));
        $this->assertSame([4], $this->traits->effectValues(4));
        $this->assertSame([], $this->traits->effectValues(null));
    }

    public function test_advantage_cost_rounds_half_effect_up(): void
    {
        $cost = $this->traits->costDetails(['type' => 'advantage', 'modifier' => 2, 'effect' => '+3 em Força']);

        $this->assertTrue($cost->isAdvantage);
        $this->assertSame(2, $cost->halfEffect);
        $this->assertSame(4, $cost->total);
    }

    public function test_disadvantage_cost_rounds_half_effect_down_using_absolute_values(): void
    {
        $cost = $this->traits->costDetails(['type' => 'disadvantage', 'modifier' => -2, 'effect' => '-3 em AGI']);

        $this->assertFalse($cost->isAdvantage);
        $this->assertSame(-3, $cost->rawEffectSum);
        $this->assertSame(1, $cost->halfEffect);
        $this->assertSame(2, $cost->modifier);
        $this->assertSame(3, $cost->total);
    }

    public function test_mixed_effect_values_are_summed_before_halving(): void
    {
        $this->assertSame(2, $this->traits->cost(['type' => 'advantage', 'modifier' => 0, 'effect' => '+2 FOR, -5 AGI']));
    }

    public function test_balance_is_disadvantages_minus_advantages(): void
    {
        $this->assertSame(-1, $this->traits->balance([
            ['type' => 'disadvantage', 'modifier' => -2, 'effect' => '-3 em AGI'],
            ['type' => 'advantage', 'modifier' => 2, 'effect' => '+3 em Força'],
        ]));
    }

    public function test_target_display_name(): void
    {
        $this->assertSame('Força', $this->traits->targetDisplayName('for'));
        $this->assertSame('Inteligência', $this->traits->targetDisplayName('INT'));
        $this->assertSame('Esquiva', $this->traits->targetDisplayName('esquiva', [], $this->talents));
        $this->assertSame('Geral', $this->traits->targetDisplayName(null));
        $this->assertSame('Xyz', $this->traits->targetDisplayName('xyz'));
    }

    public function test_custom_attribute_list(): void
    {
        $attributes = [['id' => 'mag', 'label' => 'Magia']];

        $this->assertSame(['mag'], $this->traits->targets(['effect' => '+2 em Magia'], $attributes)->attributeIds);
        $this->assertSame([], $this->traits->targets(['effect' => '+2 em Força'], $attributes)->attributeIds);
    }
}
