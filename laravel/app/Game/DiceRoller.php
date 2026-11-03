<?php

declare(strict_types=1);

namespace App\Game;

use App\Enums\AdvantageMode;
use App\Enums\RollOutcome;
use App\Enums\TestDifficulty;
use Random\Randomizer;

/**
 * Rolagens de dados. O servidor é a autoridade: o resultado que vale é o
 * calculado aqui, o navegador apenas anima.
 *
 * O sistema usa "menor é melhor" por padrão: 1 natural é acerto crítico,
 * o valor máximo do dado é falha crítica e o sucesso é rolar até a meta.
 */
final class DiceRoller
{
    /** Limite de dados por termo da fórmula, igual ao sistema antigo. */
    public const MAX_DICE_PER_TERM = 100;

    private const DICE = '/(?<![A-Z0-9_.])([0-9]*)D([0-9]+)(?![A-Z0-9_])/';

    public function __construct(
        private readonly FormulaEvaluator $formulas = new FormulaEvaluator,
        private readonly Randomizer $randomizer = new Randomizer,
    ) {
    }

    /**
     * Rola uma fórmula com dados e variáveis ("2D6 + FOR", "/r 1d20+3" no chat).
     * Fórmula inválida resulta em total 0 com detalhe "Erro".
     *
     * @param  array<string, mixed>  $stats
     */
    public function rollFormula(?string $formula, array $stats = []): FormulaRoll
    {
        if ($formula === null || trim($formula) === '') {
            return new FormulaRoll(0, [], '');
        }

        try {
            $rolls = [];
            $detail = (string) preg_replace_callback(
                self::DICE,
                function (array $match) use (&$rolls): string {
                    $quantity = $match[1] === '' ? 1 : (int) $match[1];
                    $sides = (int) $match[2];

                    if ($quantity > self::MAX_DICE_PER_TERM || $sides < 1) {
                        return '0';
                    }

                    $values = $this->rollMany($sides, $quantity);
                    $rolls[] = ['die' => $match[0], 'values' => $values];

                    return '('.array_sum($values).')';
                },
                $this->formulas->substitute($formula, $stats),
            );
            $detail = FormulaEvaluator::zeroUnknown($detail);

            return new FormulaRoll(
                FormulaEvaluator::toInteger(floor($this->formulas->calculate($detail))),
                $rolls,
                $detail,
            );
        } catch (InvalidFormulaException) {
            return new FormulaRoll(0, [], 'Erro');
        }
    }

    /**
     * Rolador de dados: N dados de X lados + modificador, com vantagem ou
     * desvantagem (só em rolagens de um dado) e meta opcional.
     */
    public function roll(
        int $sides,
        int $quantity = 1,
        int $modifier = 0,
        AdvantageMode $advantageMode = AdvantageMode::Normal,
        ?int $target = null,
        bool $rollUnder = true,
    ): DiceRoll {
        $sides = max(1, $sides);
        $quantity = max(1, min(self::MAX_DICE_PER_TERM, $quantity));
        $discarded = [];

        if ($advantageMode === AdvantageMode::Normal || $quantity > 1) {
            $rolls = $this->rollMany($sides, $quantity);
        } else {
            $pair = $this->rollMany($sides, 2);
            // Vantagem fica com o melhor dado: o menor em "menor é melhor", o maior no contrário.
            $keepLowest = ($advantageMode === AdvantageMode::Advantage) === $rollUnder;
            $rolls = [$keepLowest ? min($pair) : max($pair)];
            $discarded = [$keepLowest ? max($pair) : min($pair)];
        }

        $rawSum = array_sum($rolls);
        $total = $rawSum + $modifier;
        $isNat20 = $sides === 20 && in_array(20, $rolls, true);
        $isNat1 = $sides === 20 && in_array(1, $rolls, true);
        $single = $quantity === 1;
        $lowest = $isNat1 || ($single && $rolls[0] === 1);
        $highest = $isNat20 || ($single && $rolls[0] === $sides);

        [$outcome, $label] = match (true) {
            $rollUnder && $lowest, ! $rollUnder && $highest => [RollOutcome::Critical, RollOutcome::Critical->label()],
            $rollUnder && $highest, ! $rollUnder && $lowest => [RollOutcome::Fumble, RollOutcome::Fumble->label()],
            default => $this->regularOutcome($total, $rawSum, $sides * $quantity, $target, $rollUnder),
        };

        return new DiceRoll(
            sides: $sides,
            quantity: $quantity,
            modifier: $modifier,
            advantageMode: $advantageMode,
            target: $target,
            rollUnder: $rollUnder,
            rolls: $rolls,
            discardedRolls: $discarded,
            total: $total,
            isNat20: $isNat20,
            isNat1: $isNat1,
            outcome: $outcome,
            outcomeLabel: $label,
            formula: $this->rollFormulaText($sides, $quantity, $modifier, $advantageMode, $target, $rollUnder),
            details: '['.implode(', ', $rolls).']'
                .($discarded !== [] ? ' (desc. '.implode(', ', $discarded).')' : '')
                .self::signedModifier($modifier),
        );
    }

    /**
     * Teste rápido da ficha: 1 dado contra o valor ajustado pela dificuldade.
     */
    public function test(int $value, TestDifficulty $difficulty, GameRules $rules, int $sides = 20): AttributeTestRoll
    {
        $sides = max(1, $sides);
        $target = $this->testTarget($value, $difficulty, $rules);
        $roll = $this->randomizer->getInt(1, $sides);

        return new AttributeTestRoll(
            value: $value,
            difficulty: $difficulty,
            target: $target,
            sides: $sides,
            roll: $roll,
            success: $roll <= $target,
            isCritical: $roll === 1,
            isFumble: $roll === $sides,
        );
    }

    /**
     * Meta do teste: fácil soma o bônus; difícil e extremo dividem o valor.
     */
    public function testTarget(int $value, TestDifficulty $difficulty, GameRules $rules): int
    {
        return FormulaEvaluator::toInteger(floor(match ($difficulty) {
            TestDifficulty::Easy => $value + $rules->easyModifier(),
            TestDifficulty::Normal => $value,
            TestDifficulty::Hard => $value / $rules->hardDivisor(),
            TestDifficulty::Extreme => $value / $rules->extremeDivisor(),
        }));
    }

    /**
     * @return list<int>
     */
    private function rollMany(int $sides, int $quantity): array
    {
        $values = [];

        for ($i = 0; $i < $quantity; $i++) {
            $values[] = $this->randomizer->getInt(1, $sides);
        }

        return $values;
    }

    /**
     * Sucesso ou falha quando não houve crítico. Sem meta, compara a soma
     * dos dados com a média.
     *
     * @return array{0: RollOutcome, 1: string}
     */
    private function regularOutcome(int $total, int $rawSum, int $maximum, ?int $target, bool $rollUnder): array
    {
        if ($target !== null) {
            $success = $rollUnder ? $total <= $target : $total >= $target;

            return match (true) {
                $success && $rollUnder => [RollOutcome::Success, "Sucesso! (≤ {$target})"],
                $success => [RollOutcome::Success, "Sucesso! (≥ {$target})"],
                $rollUnder => [RollOutcome::Failure, "Falha! (> {$target})"],
                default => [RollOutcome::Failure, "Falha! (< {$target})"],
            };
        }

        $average = (int) ceil($maximum / 2);

        if ($rollUnder) {
            return $rawSum <= $average
                ? [RollOutcome::Success, 'Sucesso! (≤ média)']
                : [RollOutcome::Failure, 'Falha! (> média)'];
        }

        return $rawSum >= $average
            ? [RollOutcome::Success, RollOutcome::Success->label()]
            : [RollOutcome::Failure, RollOutcome::Failure->label()];
    }

    private function rollFormulaText(int $sides, int $quantity, int $modifier, AdvantageMode $advantageMode, ?int $target, bool $rollUnder): string
    {
        $text = "{$quantity}d{$sides}";

        if ($advantageMode !== AdvantageMode::Normal) {
            $text .= ' ('.$advantageMode->label().')';
        }

        $text .= self::signedModifier($modifier);

        if ($target !== null) {
            $text .= ' vs '.($rollUnder ? '≤' : '≥').$target;
        }

        return $text;
    }

    private static function signedModifier(int $modifier): string
    {
        return match (true) {
            $modifier > 0 => ' + '.$modifier,
            $modifier < 0 => ' - '.abs($modifier),
            default => '',
        };
    }
}
