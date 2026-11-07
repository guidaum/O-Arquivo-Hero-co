<?php

declare(strict_types=1);

namespace App\Game;

use App\Models\CatalogItem;
use App\Models\CharacterTrait;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use Illuminate\Support\Collection;

/**
 * Regras da criação de personagem (CharacterCreation.tsx do sistema antigo),
 * conferidas no servidor a partir do rascunho completo. O navegador mostra
 * os mesmos valores com core/formula.js e core/traits.js, mas o que vale é
 * o cálculo daqui.
 *
 * - Vantagens só cabem no saldo gerado pelos defeitos (saldo final >= 0);
 * - atributos: cada um entre 0 e o máximo, soma até o total da campanha;
 * - perícias e poderes: soma dos custos pelas fórmulas (COST, LVL, VAR) até os pontos iniciais;
 * - equipamento inicial do catálogo: soma dos valores até o dinheiro inicial.
 */
final class CharacterDraft
{
    /** @var array<string, string> */
    private array $errors = [];

    /** @var array<string, int> */
    private array $remaining = [];

    /**
     * @param  array<string, int>  $stats  sigla do atributo => valor
     * @param  Collection<int, CharacterTrait>  $traits
     * @param  list<array{skill: Skill, level: int, type: string}>  $skills
     * @param  list<array{power: Power, level: int, type: string}>  $powers
     * @param  list<CatalogItem>  $purchases
     * @param  Collection<int, Talent>  $talents
     */
    public function __construct(
        private readonly GameRules $rules,
        private readonly array $stats,
        private readonly Collection $traits,
        private readonly array $skills,
        private readonly array $powers,
        private readonly array $purchases,
        private readonly Collection $talents,
    ) {
        $this->check();
    }

    public function passes(): bool
    {
        return $this->errors === [];
    }

    /**
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Pontos e dinheiro que sobram para a ficha.
     *
     * @return array<string, int>
     */
    public function remaining(): array
    {
        return $this->remaining;
    }

    private function check(): void
    {
        $points = $this->rules->points();
        $traitCalculator = new TraitCalculator;
        $calculator = new CharacterCalculator;

        // 1. Vantagens e defeitos.
        $balance = $traitCalculator->balance($this->traits);

        if ($balance < 0) {
            $this->errors['traits'] = 'As vantagens escolhidas custam '.abs($balance).' ponto(s) a mais do que os defeitos fornecem.';
        }

        // 2. Atributos.
        $total = 0;

        foreach ($this->rules->attributes() as $attribute) {
            $value = $this->stats[strtolower($attribute['id'])] ?? 0;
            $total += $value;

            if ($value < 0 || $value > $points['max_single_attribute_value']) {
                $this->errors['stats'] = $attribute['label'].' deve ficar entre 0 e '.$points['max_single_attribute_value'].'.';
            }
        }

        if ($total > $points['max_attribute_points']) {
            $this->errors['stats'] = 'Os atributos somam '.$total.', mas o máximo da campanha é '.$points['max_attribute_points'].'.';
        }

        // Variáveis das fórmulas: atributos com os traços e contagem de perícias pelo tipo original.
        $attributes = $this->stats;
        foreach ($traitCalculator->attributeModifiers($this->traits, $this->rules->attributes(), $this->talents) as $attribute => $modifier) {
            $attributes[$attribute] = ($attributes[$attribute] ?? 0) + $modifier;
        }

        $formulaStats = $calculator->formulaStats(
            $attributes,
            array_map(static fn (array $row): string => (string) $row['skill']->type, $this->skills),
            count($this->powers),
            $this->rules,
        );

        // 3. Perícias e poderes.
        $skillCost = array_sum(array_map(
            fn (array $row): int => $calculator->abilityCost((int) $row['skill']->purchase_cost, $row['level'], $row['type'], false, $formulaStats, $this->rules),
            $this->skills,
        ));
        $powerCost = array_sum(array_map(
            fn (array $row): int => $calculator->abilityCost((int) $row['power']->purchase_cost, $row['level'], $row['type'], true, $formulaStats, $this->rules),
            $this->powers,
        ));

        if ($skillCost > $points['initial_skill_points']) {
            $this->errors['skills'] = 'As perícias custam '.$skillCost.' pontos, mas há apenas '.$points['initial_skill_points'].'.';
        }

        if ($powerCost > $points['initial_power_points']) {
            $this->errors['powers'] = 'Os poderes custam '.$powerCost.' pontos, mas há apenas '.$points['initial_power_points'].'.';
        }

        // 4. Equipamento inicial.
        $spent = array_sum(array_map(static fn (CatalogItem $item): int => (int) $item->value, $this->purchases));

        if ($spent > $points['initial_money']) {
            $this->errors['equipment'] = 'O equipamento custa '.$spent.' MO, mas o dinheiro inicial é '.$points['initial_money'].' MO.';
        }

        $this->remaining = [
            'attribute_points' => max(0, $points['max_attribute_points'] - $total),
            'skill_points' => max(0, $points['initial_skill_points'] - $skillCost),
            'power_points' => max(0, $points['initial_power_points'] - $powerCost),
            'money' => max(0, $points['initial_money'] - $spent),
        ];
    }
}
