<?php

declare(strict_types=1);

namespace Tests\Unit\Game;

use App\Game\FormulaEvaluator;
use App\Game\InvalidFormulaException;
use Tests\TestCase;

class FormulaEvaluatorTest extends TestCase
{
    private FormulaEvaluator $formulas;

    protected function setUp(): void
    {
        parent::setUp();

        $this->formulas = new FormulaEvaluator;
    }

    public function test_evaluates_default_hit_points_formula(): void
    {
        $this->assertSame(170, $this->formulas->evaluate('((FOR / 2) + CON) * 10', ['FOR' => 10, 'CON' => 12]));
    }

    public function test_result_is_rounded_down(): void
    {
        $this->assertSame(7, $this->formulas->evaluate('(INT + 3) * 3 / 2', ['INT' => 2]));
        $this->assertSame(-3, $this->formulas->evaluate('0 - 5 / 2'));
    }

    public function test_respects_operator_precedence(): void
    {
        $this->assertSame(14, $this->formulas->evaluate('2 + 3 * 4'));
        $this->assertSame(20, $this->formulas->evaluate('(2 + 3) * 4'));
        $this->assertSame(512, $this->formulas->evaluate('2 ^ 3 ^ 2'));
        $this->assertSame(8, $this->formulas->evaluate('2 ** 3'));
        $this->assertSame(-4, $this->formulas->evaluate('-2 ^ 2'));
        $this->assertSame(2, $this->formulas->evaluate('10 % 4'));
        $this->assertSame(5, $this->formulas->evaluate('--5'));
    }

    public function test_unknown_variables_are_zero(): void
    {
        $this->assertSame(3, $this->formulas->evaluate('FOR + XYZ', ['FOR' => 3]));
        $this->assertSame(3, $this->formulas->evaluate('FORCA + FOR', ['FOR' => 3]));
    }

    public function test_variable_names_ignore_case_and_accents(): void
    {
        $this->assertSame(6, $this->formulas->evaluate('Mística * 2', ['MISTICA' => 3]));
        $this->assertSame(6, $this->formulas->evaluate('MISTICA * 2', ['Mística' => 3]));
        $this->assertSame(4, $this->formulas->evaluate('for + 1', ['for' => 3]));
    }

    public function test_negative_values_keep_the_expression_valid(): void
    {
        $this->assertSame(12, $this->formulas->evaluate('10 - FOR', ['FOR' => -2]));
        $this->assertSame(4, $this->formulas->evaluate('FOR ^ 2', ['FOR' => -2]));
    }

    public function test_invalid_formulas_are_zero(): void
    {
        foreach (['', '   ', 'FOR +', '(1 + 2', '1 + 2)', '2 ** ', '10 / 0', '10 % (FOR - FOR)', '1,5 + 1'] as $formula) {
            $this->assertSame(0, $this->formulas->evaluate($formula, ['FOR' => 3]), "Fórmula: {$formula}");
        }

        $this->assertSame(0, $this->formulas->evaluate(null));
    }

    public function test_code_is_never_executed(): void
    {
        foreach (["system('ls')", 'process.exit()', 'FOR; phpinfo()', '`id`', '$x = 1', 'constructor.constructor("return 1")()'] as $formula) {
            $this->assertSame(0, $this->formulas->evaluate($formula, ['FOR' => 3]), "Fórmula: {$formula}");
        }
    }

    public function test_abusive_formulas_are_rejected(): void
    {
        $this->assertSame(0, $this->formulas->evaluate(str_repeat('1 + ', 200).'1'));
        $this->assertSame(0, $this->formulas->evaluate(str_repeat('(', 60).'1'.str_repeat(')', 60)));
        $this->assertSame(0, $this->formulas->evaluate('10 ^ 400'));
    }

    public function test_calculate_accepts_only_numbers_and_operators(): void
    {
        $this->assertSame(2.5, $this->formulas->calculate('5 / 2'));

        $this->expectException(InvalidFormulaException::class);
        $this->formulas->calculate('FOR + 1');
    }

    public function test_substitute_keeps_unknown_variables_and_dice(): void
    {
        $this->assertSame('2D6 + 3 + DANO', $this->formulas->substitute('2d6 + for + dano', ['FOR' => 3]));
    }

    public function test_calculation_variables_can_depend_on_each_other(): void
    {
        $stats = $this->formulas->resolveVariables(['for' => 5], [
            'Ataque' => 'BASE + 1',
            'Base' => 'FOR * 2',
        ]);

        $this->assertSame(5, $stats['FOR']);
        $this->assertSame(10, $stats['BASE']);
        $this->assertSame(11, $stats['ATAQUE']);
    }

    public function test_resolve_variables_without_variables_only_normalizes_names(): void
    {
        $this->assertSame(['FOR' => 5, 'MISTICA' => 0], $this->formulas->resolveVariables(['for' => '5', 'Mística' => null], null));
    }
}
