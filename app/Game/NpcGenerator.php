<?php

declare(strict_types=1);

namespace App\Game;

use Illuminate\Support\Collection;
use Random\Randomizer;

/**
 * Gerador de NPCs e monstros do painel do mestre (handleGenerateNPC):
 * atributos distribuídos com pesos pelo arquétipo, perícias/poderes
 * comprados até acabar os pontos, traços sorteados e PV/ATP pelas fórmulas.
 * Monstros perigosos ganham mais pontos de atributo e mais PV.
 */
final class NpcGenerator
{
    public const ARCHETYPES = [
        'random' => 'Aleatório',
        'combat' => 'Combatente',
        'scholar' => 'Erudito',
        'common' => 'Comum',
        'brute' => 'Brutamontes (monstro)',
        'stalker' => 'Espreitador (monstro)',
        'boss' => 'Chefe (monstro)',
    ];

    public const DANGER_LEVELS = ['Fraco', 'Moderado', 'Perigoso', 'Letal', 'Chefe'];

    private const PRIORITIES = [
        'combat' => ['for', 'con', 'agi', 'ini', 'vel'],
        'brute' => ['for', 'con', 'cor'],
        'stalker' => ['agi', 'per', 'vel', 'ini'],
        'boss' => ['for', 'con', 'int', 'cor', 'ini'],
        'scholar' => ['int', 'per', 'cor', 'ini'],
    ];

    private const FIRST_NAMES = ['Alaric', 'Bryn', 'Caelum', 'Dara', 'Elowen', 'Faelan', 'Gideon', 'Hestia', 'Ivor', 'Juno', 'Kael', 'Lyra', 'Maelis', 'Nyx', 'Orion', 'Phaedra', 'Quill', 'Rhea', 'Soren', 'Thalia', 'Uriel', 'Vesper', 'Wren', 'Xander', 'Yara', 'Zane'];

    private const LAST_NAMES = ['Shadowstep', 'Ironheart', 'Stormborn', 'Lightbringer', 'Nightshade', 'Silverleaf', 'Goldbeard', 'Oakmantle', 'Ravenwing', 'Stonegrinder', 'Frostwalker', 'Flamecaller', 'Windrider', 'Earthshaker', 'Deepdelver', 'Starwatcher'];

    private const MONSTER_PREFIXES = ['Gárgula', 'Espectro', 'Lorde', 'Besta', 'Basilisco', 'Quimera', 'Golem', 'Verme', 'Necromante', 'Carniçal', 'Horror', 'Espreitador', 'Abominação', 'Demônio', 'Titã', 'Troll', 'Guardião', 'Vampiro', 'Serpente', 'Devorador'];

    private const MONSTER_SUFFIXES = ['das Sombras', 'de Obsidiana', 'Carmesim', 'Rúnico', 'Profano', 'do Vazio', 'Abissal', 'Putrefato', 'Vulcânico', 'Espectral', 'Sangrento', 'Ancestral', 'Lúgubre', 'de Ébano', 'das Catacumbas', 'da Cripta', 'de Sangue', 'Venífero'];

    public function __construct(
        private readonly GameRules $rules,
        private readonly Randomizer $random = new Randomizer,
    ) {
    }

    /**
     * @param  array{name?: string|null, level: int, archetype: string, is_monster: bool, monster_type?: string|null, danger_level?: string|null, trait_count: int}  $options
     * @param  Collection<int, \App\Models\Skill>  $skills  biblioteca disponível
     * @param  Collection<int, \App\Models\Power>  $powers
     * @param  Collection<int, \App\Models\CharacterTrait>  $traits
     * @return array{name: string, class: string, level: int, stats: array<string, int>, skills: list<int>, powers: list<int>, traits: list<int>, skill_points: int, power_points: int, pv: int, atp: int, money: int}
     */
    public function generate(array $options, Collection $skills, Collection $powers, Collection $traits): array
    {
        $isMonster = $options['is_monster'];
        $level = max(1, $options['level']);
        $danger = $options['danger_level'] ?? 'Moderado';
        $archetype = $options['archetype'] === 'random'
            ? $this->pick($isMonster ? ['combat', 'brute', 'stalker', 'boss'] : ['combat', 'scholar', 'common'])
            : $options['archetype'];

        $defaults = $this->rules->npcDefaults();
        $perLevel = $this->rules->progression();
        $attributes = array_map(static fn (array $attribute): string => strtolower($attribute['id']), $this->rules->attributes());

        // 1. Atributos: começam no mínimo e recebem o restante do orçamento com pesos.
        $min = $defaults['npc_default_min_attr'];
        $max = max($min, $defaults['npc_default_max_attr']);
        $pool = $defaults['npc_default_attr_points'] + $perLevel['attr_points_per_level'] * ($level - 1);

        if ($isMonster) {
            $pool = (int) round($pool * match ($danger) {
                'Letal' => 1.25,
                'Chefe' => 1.5,
                default => 1.0,
            });
        }

        $pool = min($pool, $max * count($attributes));
        $remaining = max(0, $pool - $min * count($attributes));
        $stats = array_fill_keys($attributes, $min);
        $priorities = self::PRIORITIES[$archetype] ?? $attributes;
        $weights = [];

        foreach ($attributes as $attribute) {
            $weight = $this->random->getInt(1, 10);
            $weights[$attribute] = in_array($attribute, $priorities, true) ? $weight * ($this->fraction() * 3 + 2) : $weight;
        }

        for ($i = 0; $remaining > 0 && $i < 5000; $i++) {
            $available = array_values(array_filter($attributes, static fn (string $attribute): bool => $stats[$attribute] < $max));
            if ($available === []) {
                break;
            }

            $roll = $this->fraction() * array_sum(array_map(static fn (string $attribute): float => $weights[$attribute], $available));
            $chosen = $available[0];
            foreach ($available as $attribute) {
                $roll -= $weights[$attribute];
                if ($roll <= 0) {
                    $chosen = $attribute;
                    break;
                }
            }

            $chunk = max(1, intdiv($max, 10));
            $add = min($remaining, $max - $stats[$chosen], $this->random->getInt(1, $chunk));
            $stats[$chosen] += $add;
            $remaining -= $add;
        }

        // 2. Perícias e poderes comprados pelo custo até acabar os pontos.
        $skillPoints = $defaults['npc_default_skill_points'] + $perLevel['skill_points_per_level'] * ($level - 1);
        $chosenSkills = [];
        foreach ($this->random->shuffleArray($skills->all()) as $skill) {
            if ($skillPoints >= (int) $skill->purchase_cost) {
                $chosenSkills[] = $skill;
                $skillPoints -= (int) $skill->purchase_cost;
            }
        }

        $powerPoints = $defaults['npc_default_power_points'] + $perLevel['power_points_per_level'] * ($level - 1);
        $chosenPowers = [];
        foreach ($this->random->shuffleArray($powers->all()) as $power) {
            if ($powerPoints >= (int) $power->purchase_cost) {
                $chosenPowers[] = $power->id;
                $powerPoints -= (int) $power->purchase_cost;
            }
        }

        $chosenTraits = array_map(
            static fn ($trait): int => $trait->id,
            array_slice($this->random->shuffleArray($traits->all()), 0, max(0, $options['trait_count'])),
        );

        // 3. PV e ATP pelas fórmulas da campanha; monstros perigosos ganham mais PV.
        $formulaStats = (new CharacterCalculator)->formulaStats(
            $stats,
            array_map(static fn ($skill): string => (string) $skill->type, $chosenSkills),
            count($chosenPowers),
            $this->rules,
        );
        $evaluator = new FormulaEvaluator;
        $pv = $evaluator->evaluate($this->rules->formula('pv'), $formulaStats);
        $atp = $evaluator->evaluate($this->rules->formula('atp'), $formulaStats);

        if ($isMonster) {
            $pv = (int) round($pv * match ($danger) {
                'Perigoso' => 1.3,
                'Letal' => 1.6,
                'Chefe' => 2.2,
                default => 1.0,
            });
        }

        $name = trim((string) ($options['name'] ?? ''));

        return [
            'name' => $name !== '' ? $name : ($isMonster
                ? $this->pick(self::MONSTER_PREFIXES).' '.$this->pick(self::MONSTER_SUFFIXES)
                : $this->pick(self::FIRST_NAMES).' '.$this->pick(self::LAST_NAMES)),
            'class' => $isMonster
                ? ($options['monster_type'] ?: 'Monstro').' ('.$danger.')'
                : ucfirst($archetype),
            'level' => $level,
            'stats' => $stats,
            'skills' => array_map(static fn ($skill): int => $skill->id, $chosenSkills),
            'powers' => $chosenPowers,
            'traits' => $chosenTraits,
            'skill_points' => $skillPoints,
            'power_points' => $powerPoints,
            'pv' => max(1, $pv),
            'atp' => max(0, $atp),
            'money' => $isMonster ? 0 : $this->random->getInt(0, 99),
        ];
    }

    /**
     * @param  list<string>  $options
     */
    private function pick(array $options): string
    {
        return $options[$this->random->getInt(0, count($options) - 1)];
    }

    /** Número entre 0 e 1 (como Math.random()) a partir do mesmo sorteador. */
    private function fraction(): float
    {
        return $this->random->getInt(0, 1_000_000) / 1_000_000;
    }
}
