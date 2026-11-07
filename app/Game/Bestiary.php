<?php

declare(strict_types=1);

namespace App\Game;

use Random\Randomizer;

/**
 * Bestiário oficial e montagem de encontros (bestiaryData.ts e
 * EncounterGeneratorModal.tsx). Os dados vêm de resources/data/bestiary.json,
 * convertido do arquivo antigo sem alterações.
 */
final class Bestiary
{
    public const ENVIRONMENTS = [
        'dungeon' => 'Masmorra',
        'cavern' => 'Caverna',
        'forest' => 'Floresta',
        'temple' => 'Templo',
        'volcano' => 'Vulcão',
        'urban' => 'Cidade',
    ];

    /** Dificuldade => chave da tabela de XP. */
    public const DIFFICULTIES = ['Fácil' => 'facil', 'Médio' => 'medio', 'Difícil' => 'dificil', 'Mortal' => 'mortal'];

    public const TACTICS = [
        'balanced' => 'Patrulha equilibrada',
        'solo' => 'Criatura solitária',
        'boss_minions' => 'Chefe e lacaios',
        'swarm' => 'Enxame',
    ];

    /** @var array{monsters: list<array<string, mixed>>, xp_thresholds: array<string, array<string, int>>}|null */
    private static ?array $data = null;

    public function __construct(private readonly Randomizer $random = new Randomizer)
    {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function monsters(): array
    {
        return self::data()['monsters'];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $id): ?array
    {
        foreach (self::monsters() as $monster) {
            if ($monster['id'] === $id) {
                return $monster;
            }
        }

        return null;
    }

    /** Multiplicador de XP pela quantidade de criaturas (getMonsterCountMultiplier). */
    public static function countMultiplier(int $count): float
    {
        return match (true) {
            $count <= 1 => 1.0,
            $count === 2 => 1.5,
            $count <= 6 => 2.0,
            $count <= 10 => 2.5,
            $count <= 14 => 3.0,
            default => 4.0,
        };
    }

    /**
     * Orçamento de XP do grupo por dificuldade (calculatePartyXpBudgets).
     * Sem personagens, considera 4 aventureiros de nível 1.
     *
     * @param  list<int>  $levels
     * @return array{facil: int, medio: int, dificil: int, mortal: int, party_size: int, avg_level: int}
     */
    public static function partyBudgets(array $levels): array
    {
        $levels = $levels === [] ? [1, 1, 1, 1] : $levels;
        $budget = ['facil' => 0, 'medio' => 0, 'dificil' => 0, 'mortal' => 0];

        foreach ($levels as $level) {
            $level = max(1, min(20, $level));
            foreach (self::data()['xp_thresholds'][(string) $level] as $key => $value) {
                $budget[$key] += $value;
            }
        }

        return [
            ...$budget,
            'party_size' => count($levels),
            'avg_level' => max(1, (int) round(array_sum(array_map(static fn (int $l): int => max(1, min(20, $l)), $levels)) / count($levels))),
        ];
    }

    /**
     * Monta um encontro como o gerador antigo.
     *
     * @param  list<int>  $levels  níveis do grupo
     * @return array{name: string, difficulty: string, environment: string, tactic: string, target_xp: int, total_xp: int, adjusted_xp: int, monsters: list<array{monster: array<string, mixed>, count: int}>}
     */
    public function encounter(array $levels, string $environment, string $difficulty, string $tactic): array
    {
        $budgets = self::partyBudgets($levels);
        $target = $budgets[self::DIFFICULTIES[$difficulty] ?? 'medio'];

        $pool = array_values(array_filter(self::monsters(), static fn (array $m): bool => in_array($environment, $m['environments'], true)));
        $pool = $pool !== [] ? $pool : self::monsters();
        $maxCr = min(20, max(1, $budgets['avg_level'] + match ($difficulty) {
            'Mortal' => 3,
            'Difícil' => 2,
            default => 1,
        }));
        $eligible = array_values(array_filter($pool, static fn (array $m): bool => $m['crValue'] <= $maxCr));
        $candidates = $eligible !== [] ? $eligible : $pool;

        $groups = [];
        $xp = 0;
        $add = function (array $monster, int $count) use (&$groups, &$xp): void {
            $groups[] = ['monster' => $monster, 'count' => $count];
            $xp += $monster['xp'] * $count;
        };

        if ($tactic === 'solo') {
            $sorted = $candidates;
            usort($sorted, static fn (array $a, array $b): int => abs($a['xp'] - $target) <=> abs($b['xp'] - $target));
            $add($sorted[0], 1);
        } elseif ($tactic === 'boss_minions') {
            $boss = $this->pick(array_filter($candidates, static fn (array $m): bool => $m['xp'] <= $target * 0.7)) ?? $candidates[0];
            $add($boss, 1);
            $remaining = max(50, $target - $xp);
            $minion = $this->pick(array_filter($candidates, static fn (array $m): bool => $m['id'] !== $boss['id'] && $m['xp'] <= $remaining * 0.5));
            if ($minion !== null) {
                $add($minion, max(2, min(5, intdiv($remaining, max(1, $minion['xp'])) ?: 2)));
            }
        } elseif ($tactic === 'swarm') {
            $minion = $this->pick(array_filter($candidates, static fn (array $m): bool => $m['crValue'] <= max(0.25, $budgets['avg_level'] / 3))) ?? $candidates[0];
            $add($minion, max(4, min(10, intdiv($target, max(1, $minion['xp'])) ?: 4)));
        } else {
            $shuffled = $this->random->shuffleArray($candidates);
            $add($shuffled[0], $this->random->getInt(1, 2));
            if (count($shuffled) > 1 && $xp < $target * 0.8) {
                $add($shuffled[1], max(1, min(3, intdiv($target - $xp, max(1, $shuffled[1]['xp'])) ?: 1)));
            }
        }

        $count = array_sum(array_column($groups, 'count'));

        return [
            'name' => 'Encontro '.$difficulty.' em '.(self::ENVIRONMENTS[$environment] ?? $environment),
            'difficulty' => $difficulty,
            'environment' => $environment,
            'tactic' => $tactic,
            'target_xp' => $target,
            'total_xp' => $xp,
            'adjusted_xp' => (int) round($xp * self::countMultiplier($count)),
            'monsters' => $groups,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $list
     * @return array<string, mixed>|null
     */
    private function pick(array $list): ?array
    {
        $list = array_values($list);

        return $list === [] ? null : $list[$this->random->getInt(0, count($list) - 1)];
    }

    /**
     * @return array{monsters: list<array<string, mixed>>, xp_thresholds: array<string, array<string, int>>}
     */
    private static function data(): array
    {
        return self::$data ??= json_decode((string) file_get_contents(resource_path('data/bestiary.json')), true, 512, JSON_THROW_ON_ERROR);
    }
}
