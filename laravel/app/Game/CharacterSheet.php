<?php

declare(strict_types=1);

namespace App\Game;

use App\Enums\TraitType;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\CharacterTrait;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use Illuminate\Support\Collection;

/**
 * Valores calculados da ficha (CharacterSheet.tsx do sistema antigo):
 * atributos com a origem de cada modificador, talentos, atributos de
 * combate, perícias, poderes e traços.
 *
 * Total do atributo = base + modificador + traços + itens equipados + mestre
 * (traços são ignorados quando o atributo já tem modificador próprio).
 * Talento = soma dos atributos da composição + modificador + traços que
 * citam o talento + mestre, com a mesma regra para os traços.
 */
final class CharacterSheet
{
    /** Sanidade e despertar vão de 0 a 7 na ficha. */
    public const TRACK_MAX = 7;

    /**
     * @param  array<string, mixed>  $data
     */
    private function __construct(public readonly array $data)
    {
    }

    /**
     * @param  Collection<int, Talent>  $talents  talentos disponíveis para o personagem
     */
    public static function for(Character $character, GameRules $rules, Collection $talents): self
    {
        $calculator = new CharacterCalculator;
        $traitCalculator = new TraitCalculator;
        $formulas = new FormulaEvaluator;

        $attributeList = $rules->attributes();
        $stats = self::lowerKeys((array) $character->stats);
        $mods = self::lowerKeys((array) $character->stats_mods);
        $gmModifiers = (array) ($character->gm_modifiers ?? []);
        /** @var Collection<int, CharacterTrait> $traits */
        $traits = $character->traits;
        /** @var Collection<int, CharacterItem> $equipped */
        $equipped = $character->items->where('equipped', true);

        // Bônus dos itens equipados por atributo.
        $itemMods = [];
        foreach ($equipped as $item) {
            foreach ((array) $item->stats as $attribute => $bonus) {
                $key = strtolower((string) $attribute);
                $itemMods[$key] = ($itemMods[$key] ?? 0) + (is_numeric($bonus) ? (int) $bonus : 0);
            }
        }

        $traitAttributeMods = $traitCalculator->attributeModifiers($traits, $attributeList, $talents);

        $attributes = [];
        $totals = [];

        foreach ($attributeList as $attribute) {
            $id = strtolower($attribute['id']);
            $base = (int) ($stats[$id] ?? 0);
            $mod = (int) ($mods[$id] ?? 0);
            $rawTrait = (int) ($traitAttributeMods[$id] ?? 0);
            $item = (int) ($itemMods[$id] ?? 0);
            $gm = self::gmSum($gmModifiers, $id);
            $total = $calculator->attributeTotal($base, $mod, $rawTrait, $item, $gm);

            $totals[$id] = $total;
            $attributes[] = [
                'id' => $id,
                'label' => $attribute['label'],
                'base' => $base,
                'mod' => $mod,
                'trait' => $mod !== 0 && $rawTrait !== 0 ? 0 : $rawTrait,
                'trait_disregarded' => $mod !== 0 && $rawTrait !== 0,
                'raw_trait' => $rawTrait,
                'item' => $item,
                'gm' => $gm,
                'gm_entries' => self::gmEntries($gmModifiers, $id),
                'total' => $total,
            ];
        }

        $talentTraitMods = $traitCalculator->talentModifiers($traits, $attributeList, $talents);
        $talentMods = (array) ($character->talent_mods ?? []);

        $talentRows = $talents->map(static function (Talent $talent) use ($totals, $talentMods, $talentTraitMods, $gmModifiers): array {
            $id = (string) $talent->id;
            $composition = array_map(static fn (mixed $attribute): string => strtolower((string) $attribute), (array) $talent->composition);
            $base = array_sum(array_map(static fn (string $attribute): int => $totals[$attribute] ?? 0, $composition));
            $manual = (int) ($talentMods[$id] ?? 0);
            $rawTrait = (int) ($talentTraitMods[$id] ?? 0);
            $trait = $manual !== 0 && $rawTrait !== 0 ? 0 : $rawTrait;
            $gm = self::gmSum($gmModifiers, 'talent:'.$id);

            return [
                'id' => $talent->id,
                'name' => $talent->name,
                'category' => $talent->category,
                'description' => $talent->description,
                'composition' => $composition,
                'base' => $base,
                'mod' => $manual,
                'trait' => $trait,
                'gm' => $gm,
                'gm_entries' => self::gmEntries($gmModifiers, 'talent:'.$id),
                'total' => $base + $manual + $trait + $gm,
            ];
        })->values()->all();

        /** @var Collection<int, Skill> $skills */
        $skills = $character->skills;
        /** @var Collection<int, Power> $powers */
        $powers = $character->powers;

        $skillTypes = $skills->map(static fn (Skill $skill): string => (string) ($skill->pivot->type ?: $skill->type))->all();
        $formulaStats = $calculator->formulaStats($totals, $skillTypes, $powers->count(), $rules);
        $derived = $calculator->derivedStats($formulaStats, $rules);

        $abilityRow = static function (Skill|Power $ability, bool $isPower) use ($calculator, $formulas, $formulaStats, $rules): array {
            $type = (string) ($ability->pivot->type ?: $ability->type);
            $level = max(1, (int) $ability->pivot->level);

            return [
                'id' => $ability->id,
                'name' => $ability->name,
                'type' => $type,
                'level' => $level,
                'description' => $ability->pivot->description ?: $ability->description,
                'effect' => $isPower ? $ability->effect : null,
                'damage' => $isPower ? null : $ability->damage,
                'usage_cost' => $isPower ? $ability->cost : ($ability->atp_cost ? $ability->atp_cost.' ATP' : null),
                'difficulty' => filled($ability->difficulty_formula) ? $formulas->evaluate($ability->difficulty_formula, $formulaStats) : null,
                'difficulty_formula' => $ability->difficulty_formula,
                'cost' => $calculator->abilityCost((int) $ability->purchase_cost, $level, $type, $isPower, $formulaStats, $rules),
            ];
        };

        $traitRows = $traits->map(static fn (CharacterTrait $trait): array => [
            'id' => $trait->id,
            'name' => $trait->name,
            'advantage' => $trait->type !== TraitType::Disadvantage,
            'description' => $trait->description,
            'effect' => $trait->effect,
            'modifier' => $traitCalculator->effectiveModifier($trait),
            'target' => $traitCalculator->targetDisplayName(
                $trait->modifier_attribute ?? ($trait->modifier_talent_id !== null ? (string) $trait->modifier_talent_id : null),
                $attributeList,
                $talents,
            ),
            'cost' => $traitCalculator->cost($trait),
        ])->sortBy([['advantage', 'desc'], ['name', 'asc']])->values()->all();

        $armorBonus = (int) $equipped
            ->filter(static fn (CharacterItem $item): bool => $item->categoryKey() === 'armor' || $item->defense > 0)
            ->sum('defense');

        return new self([
            'attributes' => $attributes,
            'totals' => $totals,
            'talents' => $talentRows,
            'formula_stats' => $formulaStats,
            'derived' => $derived,
            'skills' => $skills->map(static fn (Skill $skill): array => $abilityRow($skill, false))->sortBy('name')->values()->all(),
            'powers' => $powers->map(static fn (Power $power): array => $abilityRow($power, true))->sortBy('name')->values()->all(),
            'traits' => $traitRows,
            'armor_bonus' => $armorBonus,
            'equipped' => $equipped->values(),
        ]);
    }

    /**
     * Valor usado num teste rápido: "attr:for", "talent:12", "skill:3",
     * "power:5" ou "combat:en|dm|defesa|esquiva". Null se o alvo não existe
     * na ficha (ou não tem fórmula de dificuldade).
     *
     * @return array{label: string, value: int, sides: int}|null
     */
    public function testTarget(string $target): ?array
    {
        [$kind, $id] = array_pad(explode(':', $target, 2), 2, '');

        return match ($kind) {
            // Na ficha antiga, atributos são testados com d10; o resto com d20.
            'attr' => ($row = collect($this->data['attributes'])->firstWhere('id', $id))
                ? ['label' => $row['label'], 'value' => $row['total'], 'sides' => 10]
                : null,
            'talent' => ($row = collect($this->data['talents'])->firstWhere('id', (int) $id))
                ? ['label' => $row['name'], 'value' => $row['total'], 'sides' => 20]
                : null,
            'skill', 'power' => ($row = collect($this->data[$kind === 'skill' ? 'skills' : 'powers'])->firstWhere('id', (int) $id)) && $row['difficulty'] !== null
                ? ['label' => $row['name'], 'value' => $row['difficulty'], 'sides' => 20]
                : null,
            'combat' => array_key_exists($id, self::COMBAT_TESTS)
                ? ['label' => self::COMBAT_TESTS[$id], 'value' => $this->data['derived'][$id], 'sides' => 20]
                : null,
            default => null,
        };
    }

    /** Atributos de combate que podem ser testados (sigla => rótulo). */
    public const COMBAT_TESTS = [
        'en' => 'E/N (Esq. Nat.)',
        'dm' => 'D/M',
        'defesa' => 'Defesa',
        'esquiva' => 'Esquiva',
    ];

    /**
     * @param  array<string, mixed>  $gmModifiers
     */
    private static function gmSum(array $gmModifiers, string $key): int
    {
        return (int) array_sum(array_map(
            static fn (mixed $entry): int => is_array($entry) && is_numeric($entry['value'] ?? null) ? (int) $entry['value'] : 0,
            (array) ($gmModifiers[$key] ?? []),
        ));
    }

    /**
     * @param  array<string, mixed>  $gmModifiers
     * @return list<array<string, mixed>>
     */
    private static function gmEntries(array $gmModifiers, string $key): array
    {
        return array_values(array_filter((array) ($gmModifiers[$key] ?? []), 'is_array'));
    }

    /**
     * @param  array<mixed>  $values
     * @return array<string, mixed>
     */
    private static function lowerKeys(array $values): array
    {
        $lower = [];

        foreach ($values as $key => $value) {
            $lower[strtolower((string) $key)] = $value;
        }

        return $lower;
    }
}
