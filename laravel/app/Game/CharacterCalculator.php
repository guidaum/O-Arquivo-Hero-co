<?php

declare(strict_types=1);

namespace App\Game;

/**
 * Cálculos da criação e da ficha de personagem que dependem das regras
 * configuráveis: variáveis das fórmulas, atributos derivados (PV, ATP,
 * defesa...) e custo de perícias e poderes.
 */
final class CharacterCalculator
{
    /** Atributos derivados exibidos na ficha, na ordem do sistema antigo. */
    public const DERIVED_STATS = ['pv', 'atp', 'soco', 'chute', 'en', 'dm', 'defesa', 'esquiva'];

    public function __construct(private readonly FormulaEvaluator $formulas = new FormulaEvaluator)
    {
    }

    /**
     * Variáveis disponíveis nas fórmulas: atributos (FOR, AGI...), quantidade
     * de perícias por categoria (LUTA e LUTAS, MISTICA e MISTICAS...), SKILLS,
     * POWERS e as variáveis de cálculo das regras.
     *
     * @param  array<string, int|float>  $attributes  valor de cada atributo por ID
     * @param  list<string>  $skillTypes  tipo de cada perícia do personagem
     * @return array<string, int|float>
     */
    public function formulaStats(array $attributes, array $skillTypes, int $powerCount, GameRules $rules): array
    {
        $values = array_change_key_case($attributes, CASE_LOWER);
        $stats = [];

        foreach ($rules->attributes() as $attribute) {
            $stats[FormulaEvaluator::variableName($attribute['id'])] = $values[strtolower($attribute['id'])] ?? 0;
        }

        foreach ($rules->skillCategories() as $category) {
            $name = FormulaEvaluator::variableName($category);
            $count = count(array_filter($skillTypes, static fn (string $type): bool => $type === $category));

            $stats[$name] = $count;
            $stats[str_ends_with($name, 'S') ? substr($name, 0, -1) : $name.'S'] = $count;
        }

        $stats['SKILLS'] = count($skillTypes);
        $stats['POWERS'] = $powerCount;

        return $this->formulas->resolveVariables($stats, $rules->calculationVars());
    }

    /**
     * PV, ATP, soco, chute, EN, DM, defesa e esquiva.
     *
     * @param  array<string, int|float>  $stats  resultado de formulaStats()
     * @return array<string, int>
     */
    public function derivedStats(array $stats, GameRules $rules): array
    {
        $derived = [];

        foreach (self::DERIVED_STATS as $name) {
            $derived[$name] = $this->formulas->evaluate($rules->formula($name), $stats);
        }

        return $derived;
    }

    /**
     * Custo em pontos de uma perícia ou poder no nível informado. A fórmula
     * usa COST (custo base), LVL (nível) e VAR (divisor do tipo, que pode ser
     * um número, um atributo ou outra fórmula). Valores quebrados arredondam
     * para cima e o custo mínimo é 1.
     *
     * @param  array<string, int|float>  $stats  resultado de formulaStats()
     */
    public function abilityCost(int $baseCost, int $level, ?string $type, bool $isPower, array $stats, GameRules $rules): int
    {
        $baseCost = $baseCost !== 0 ? $baseCost : 1;
        $level = $level !== 0 ? $level : 1;

        $typeVars = $isPower ? $rules->powerTypeVars() : $rules->skillTypeVars();
        $typeVar = $typeVars[$type ?? ''] ?? '';
        $divisor = max(1, $this->formulas->evaluate($typeVar !== '' ? $typeVar : '1', $stats));

        try {
            $expression = $this->formulas->substitute($rules->abilityCostFormula($isPower), [
                'COST' => $baseCost,
                'LVL' => $level,
                'VAR' => $divisor,
            ]);

            return max(1, FormulaEvaluator::toInteger(ceil($this->formulas->calculate($expression))));
        } catch (InvalidFormulaException) {
            return max(1, $baseCost * $level);
        }
    }

    /**
     * Valor final do atributo na ficha. Quando o atributo já tem um
     * modificador próprio, o modificador vindo de traços é desconsiderado
     * (o traço e o modificador vêm da mesma vantagem/desvantagem).
     */
    public function attributeTotal(int $base, int $modifier, int $traitModifier, int $itemModifier = 0, int $gmModifier = 0): int
    {
        $traitModifier = $modifier !== 0 && $traitModifier !== 0 ? 0 : $traitModifier;

        return $base + $modifier + $traitModifier + $itemModifier + $gmModifier;
    }
}
