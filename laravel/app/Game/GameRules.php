<?php

declare(strict_types=1);

namespace App\Game;

use App\Models\GameSession;
use App\Models\RuleSet;

/**
 * Regras efetivas de cálculo: o conjunto da sessão (ou o global) com os
 * padrões de config/arquivo.php preenchendo o que não foi definido.
 */
final class GameRules
{
    private const FORMULAS = ['pv', 'atp', 'soco', 'chute', 'en', 'dm', 'defesa', 'esquiva'];

    private const IGNORED_POWER_COST_FORMULA = '(COST * LVL) / VAR';

    public function __construct(private readonly ?RuleSet $ruleSet = null)
    {
    }

    public static function forSession(?GameSession $session): self
    {
        return new self(RuleSet::forSession($session));
    }

    public function ruleSet(): ?RuleSet
    {
        return $this->ruleSet;
    }

    /**
     * Fórmula configurada ou a padrão. Nomes: pv, atp, soco, chute, en, dm,
     * defesa, esquiva, skill_cost e power_cost.
     */
    public function formula(string $name): string
    {
        $configured = $this->ruleSet?->getAttribute($name.'_formula');

        if (is_string($configured) && trim($configured) !== '') {
            return $configured;
        }

        return (string) config('arquivo.rules.formulas.'.$name, '');
    }

    /**
     * Fórmula de custo de perícia ou poder. O sistema antigo ignorava a
     * fórmula de poder "(COST * LVL) / VAR" (o padrão das perícias) e usava
     * o padrão dos poderes no lugar; o comportamento foi mantido.
     */
    public function abilityCostFormula(bool $isPower): string
    {
        if (! $isPower) {
            return $this->formula('skill_cost');
        }

        $formula = $this->formula('power_cost');

        return trim($formula) === self::IGNORED_POWER_COST_FORMULA
            ? (string) config('arquivo.rules.formulas.power_cost')
            : $formula;
    }

    public function easyModifier(): float
    {
        return $this->difficulty('diff_easy_mod', 'easy_mod', allowZero: true);
    }

    public function hardDivisor(): float
    {
        return $this->difficulty('diff_hard_div', 'hard_div', allowZero: false);
    }

    public function extremeDivisor(): float
    {
        return $this->difficulty('diff_extreme_div', 'extreme_div', allowZero: false);
    }

    /**
     * Atributos do sistema (id e rótulo).
     *
     * @return list<array{id: string, label: string}>
     */
    public function attributes(): array
    {
        $attributes = [];

        foreach ((array) ($this->ruleSet?->getAttribute('attributes') ?? []) as $attribute) {
            if (is_array($attribute) && is_string($attribute['id'] ?? null) && $attribute['id'] !== '') {
                $attributes[] = [
                    'id' => $attribute['id'],
                    'label' => is_string($attribute['label'] ?? null) ? $attribute['label'] : strtoupper($attribute['id']),
                ];
            }
        }

        return $attributes !== [] ? $attributes : config('arquivo.rules.attributes');
    }

    /**
     * Divisor (VAR) do custo por tipo de perícia, como configurado.
     *
     * @return array<string, string>
     */
    public function skillTypeVars(): array
    {
        return self::stringMap($this->ruleSet?->skill_type_vars);
    }

    /**
     * @return array<string, string>
     */
    public function powerTypeVars(): array
    {
        return self::stringMap($this->ruleSet?->power_type_vars);
    }

    /**
     * Categorias de perícia contadas nas fórmulas (LUTA, MISTICA...).
     *
     * @return list<string>
     */
    public function skillCategories(): array
    {
        $vars = $this->skillTypeVars();

        return array_map('strval', array_keys($vars !== [] ? $vars : config('arquivo.rules.skill_type_vars')));
    }

    /**
     * @return array<string, string>
     */
    public function calculationVars(): array
    {
        return self::stringMap($this->ruleSet?->calculation_vars);
    }

    /**
     * Regras já resolvidas para o JavaScript (pré-visualização na ficha),
     * passadas pela view com @json.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $formulas = [];

        foreach (self::FORMULAS as $name) {
            $formulas[$name] = $this->formula($name);
        }

        $formulas['skill_cost'] = $this->abilityCostFormula(false);
        $formulas['power_cost'] = $this->abilityCostFormula(true);

        return [
            'formulas' => $formulas,
            'difficulty' => [
                'easy_mod' => $this->easyModifier(),
                'hard_div' => $this->hardDivisor(),
                'extreme_div' => $this->extremeDivisor(),
            ],
            'attributes' => $this->attributes(),
            'skill_categories' => $this->skillCategories(),
            'skill_type_vars' => (object) $this->skillTypeVars(),
            'power_type_vars' => (object) $this->powerTypeVars(),
            'calculation_vars' => (object) $this->calculationVars(),
        ];
    }

    private function difficulty(string $column, string $default, bool $allowZero): float
    {
        $value = $this->ruleSet?->getAttribute($column);

        if (is_numeric($value) && ($allowZero || (float) $value > 0)) {
            return (float) $value;
        }

        return (float) config('arquivo.rules.difficulty.'.$default);
    }

    /**
     * @return array<string, string>
     */
    private static function stringMap(mixed $value): array
    {
        $map = [];

        foreach (is_array($value) ? $value : [] as $key => $item) {
            if (is_scalar($item)) {
                $map[(string) $key] = (string) $item;
            }
        }

        return $map;
    }
}
