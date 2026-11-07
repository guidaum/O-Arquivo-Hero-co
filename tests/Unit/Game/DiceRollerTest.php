<?php

declare(strict_types=1);

namespace Tests\Unit\Game;

use App\Enums\AdvantageMode;
use App\Enums\RollOutcome;
use App\Enums\TestDifficulty;
use App\Game\DiceRoller;
use App\Game\FormulaEvaluator;
use App\Game\GameRules;
use App\Models\RuleSet;
use LogicException;
use Random\Engine;
use Random\Randomizer;
use Tests\TestCase;

class DiceRollerTest extends TestCase
{
    /**
     * Rolador cujos dados saem na ordem informada.
     */
    private function rollerWith(int ...$values): DiceRoller
    {
        $engine = new class($values) implements Engine
        {
            /**
             * @param  list<int>  $values
             */
            public function __construct(private array $values)
            {
            }

            public function generate(): string
            {
                $value = array_shift($this->values) ?? throw new LogicException('Nenhum dado restante.');

                // Randomizer::getInt(1, N) devolve 1 + (valor gerado % N).
                return pack('V', $value - 1);
            }
        };

        return new DiceRoller(new FormulaEvaluator, new Randomizer($engine));
    }

    public function test_formula_with_dice_and_attributes(): void
    {
        $roll = $this->rollerWith(4, 5)->rollFormula('2d6 + FOR', ['for' => 3]);

        $this->assertSame(12, $roll->total);
        $this->assertSame([['die' => '2D6', 'values' => [4, 5]]], $roll->rolls);
        $this->assertSame('(9) + 3', $roll->detail);
    }

    public function test_die_without_quantity_rolls_one(): void
    {
        $roll = $this->rollerWith(17)->rollFormula('D20 - 2');

        $this->assertSame(15, $roll->total);
        $this->assertSame('(17) - 2', $roll->detail);
    }

    public function test_real_random_rolls_stay_within_the_die(): void
    {
        $roller = new DiceRoller;

        for ($i = 0; $i < 50; $i++) {
            $roll = $roller->rollFormula('3d6');

            $this->assertGreaterThanOrEqual(3, $roll->total);
            $this->assertLessThanOrEqual(18, $roll->total);
            $this->assertSame($roll->total, array_sum($roll->rolls[0]['values']));
        }
    }

    public function test_too_many_dice_count_as_zero(): void
    {
        $roll = (new DiceRoller)->rollFormula('101d6 + 2');

        $this->assertSame(2, $roll->total);
        $this->assertSame([], $roll->rolls);
    }

    public function test_unknown_words_count_as_zero(): void
    {
        $this->assertSame(4, $this->rollerWith(4)->rollFormula('1d6 + DANO')->total);
    }

    public function test_invalid_or_empty_formula(): void
    {
        $this->assertSame(['total' => 0, 'rolls' => [], 'detail' => 'Erro'], (new DiceRoller)->rollFormula('1d6 +')->toArray());
        $this->assertSame(['total' => 0, 'rolls' => [], 'detail' => ''], (new DiceRoller)->rollFormula('  ')->toArray());
    }

    public function test_advantage_keeps_the_lowest_die_in_roll_under(): void
    {
        $roll = $this->rollerWith(15, 6)->roll(20, advantageMode: AdvantageMode::Advantage);

        $this->assertSame([6], $roll->rolls);
        $this->assertSame([15], $roll->discardedRolls);
    }

    public function test_disadvantage_keeps_the_highest_die_in_roll_under(): void
    {
        $roll = $this->rollerWith(15, 6)->roll(20, advantageMode: AdvantageMode::Disadvantage);

        $this->assertSame([15], $roll->rolls);
        $this->assertSame([6], $roll->discardedRolls);
    }

    public function test_advantage_keeps_the_highest_die_in_roll_over(): void
    {
        $roll = $this->rollerWith(15, 6)->roll(20, advantageMode: AdvantageMode::Advantage, rollUnder: false);

        $this->assertSame([15], $roll->rolls);
    }

    public function test_advantage_is_ignored_with_more_than_one_die(): void
    {
        $roll = $this->rollerWith(3, 4)->roll(6, quantity: 2, advantageMode: AdvantageMode::Advantage);

        $this->assertSame([3, 4], $roll->rolls);
        $this->assertSame([], $roll->discardedRolls);
    }

    public function test_natural_one_is_critical_and_twenty_is_fumble_in_roll_under(): void
    {
        $this->assertSame(RollOutcome::Critical, $this->rollerWith(1)->roll(20, target: 12)->outcome);
        $this->assertSame(RollOutcome::Fumble, $this->rollerWith(20)->roll(20, target: 12)->outcome);
    }

    public function test_roll_over_inverts_critical_and_fumble(): void
    {
        $this->assertSame(RollOutcome::Critical, $this->rollerWith(20)->roll(20, target: 12, rollUnder: false)->outcome);
        $this->assertSame(RollOutcome::Fumble, $this->rollerWith(1)->roll(20, target: 12, rollUnder: false)->outcome);
    }

    public function test_success_is_rolling_up_to_the_target(): void
    {
        $success = $this->rollerWith(10)->roll(20, target: 12);
        $failure = $this->rollerWith(16)->roll(20, target: 14);

        $this->assertSame(RollOutcome::Success, $success->outcome);
        $this->assertSame('Sucesso! (≤ 12)', $success->outcomeLabel);
        $this->assertSame(RollOutcome::Failure, $failure->outcome);
        $this->assertSame('Falha! (> 14)', $failure->outcomeLabel);
    }

    public function test_modifier_counts_against_the_target(): void
    {
        $this->assertSame(RollOutcome::Failure, $this->rollerWith(11)->roll(20, modifier: 2, target: 12)->outcome);
    }

    public function test_without_target_compares_with_the_average(): void
    {
        $this->assertSame('Sucesso! (≤ média)', $this->rollerWith(10)->roll(20)->outcomeLabel);
        $this->assertSame('Falha! (> média)', $this->rollerWith(11)->roll(20)->outcomeLabel);
    }

    public function test_roll_description_for_the_chat(): void
    {
        $roll = $this->rollerWith(15, 6)->roll(20, modifier: 2, advantageMode: AdvantageMode::Advantage, target: 12);

        $this->assertSame('1d20 (Vantagem) + 2 vs ≤12', $roll->formula);
        $this->assertSame('[6] (desc. 15) + 2', $roll->details);
        $this->assertSame(8, $roll->total);

        $this->assertSame('2d6 - 1', $this->rollerWith(2, 3)->roll(6, quantity: 2, modifier: -1)->formula);
    }

    public function test_quick_attribute_test(): void
    {
        $rules = new GameRules;

        $this->assertTrue($this->rollerWith(12)->test(12, TestDifficulty::Normal, $rules)->success);
        $this->assertFalse($this->rollerWith(13)->test(12, TestDifficulty::Normal, $rules)->success);

        $critical = $this->rollerWith(1)->test(12, TestDifficulty::Normal, $rules);
        $fumble = $this->rollerWith(20)->test(12, TestDifficulty::Normal, $rules);

        $this->assertTrue($critical->isCritical);
        $this->assertTrue($fumble->isFumble);
        $this->assertSame('1D20 <= 12', $fumble->detail());
    }

    public function test_difficulty_targets_use_default_rules(): void
    {
        $roller = new DiceRoller;
        $rules = new GameRules;

        $this->assertSame(14, $roller->testTarget(12, TestDifficulty::Easy, $rules));
        $this->assertSame(12, $roller->testTarget(12, TestDifficulty::Normal, $rules));
        $this->assertSame(6, $roller->testTarget(13, TestDifficulty::Hard, $rules));
        $this->assertSame(2, $roller->testTarget(13, TestDifficulty::Extreme, $rules));
    }

    public function test_difficulty_targets_use_configured_rules(): void
    {
        $ruleSet = new RuleSet;
        $ruleSet->forceFill(['diff_easy_mod' => 3, 'diff_hard_div' => 3, 'diff_extreme_div' => 0]);
        $rules = new GameRules($ruleSet);
        $roller = new DiceRoller;

        $this->assertSame(15, $roller->testTarget(12, TestDifficulty::Easy, $rules));
        $this->assertSame(4, $roller->testTarget(12, TestDifficulty::Hard, $rules));
        // Divisor zero é inválido: usa o padrão (5).
        $this->assertSame(2, $roller->testTarget(12, TestDifficulty::Extreme, $rules));
    }
}
