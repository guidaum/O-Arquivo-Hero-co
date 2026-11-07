<?php

declare(strict_types=1);

namespace Tests\Unit\Game;

use App\Game\Bestiary;
use App\Game\FormulaEvaluator;
use App\Game\GameRules;
use App\Game\NpcGenerator;
use App\Models\Power;
use App\Models\RuleSet;
use App\Models\Skill;
use Random\Engine\Mt19937;
use Random\Randomizer;
use Tests\TestCase;

/**
 * Fase 9b: gerador de NPCs/monstros e montagem de encontros.
 */
class NpcGeneratorTest extends TestCase
{
    private function generator(int $seed = 7, array $rules = []): NpcGenerator
    {
        $ruleSet = new RuleSet;
        $ruleSet->forceFill($rules);

        return new NpcGenerator(new GameRules($ruleSet), new Randomizer(new Mt19937($seed)));
    }

    private function skill(int $id, int $cost): Skill
    {
        $skill = new Skill;
        $skill->forceFill(['id' => $id, 'name' => 'Perícia '.$id, 'type' => 'LUTA', 'purchase_cost' => $cost]);

        return $skill;
    }

    private function power(int $id, int $cost): Power
    {
        $power = new Power;
        $power->forceFill(['id' => $id, 'name' => 'Poder '.$id, 'type' => 'MAGIA', 'purchase_cost' => $cost]);

        return $power;
    }

    private function npcOptions(array $overrides = []): array
    {
        return [
            'name' => null,
            'level' => 1,
            'archetype' => 'combat',
            'is_monster' => false,
            'monster_type' => null,
            'danger_level' => 'Moderado',
            'trait_count' => 0,
            ...$overrides,
        ];
    }

    public function test_attributes_spend_the_whole_pool_within_limits(): void
    {
        foreach ([1, 2, 3, 4, 5] as $seed) {
            $npc = $this->generator($seed)->generate($this->npcOptions(), collect(), collect(), collect());

            // Padrões: 8 atributos, mínimo 2, máximo 10, 28 pontos no total.
            $this->assertSame(28, (int) array_sum($npc['stats']));
            $this->assertCount(8, $npc['stats']);
            foreach ($npc['stats'] as $value) {
                $this->assertTrue($value >= 2 && $value <= 10, 'Atributo fora dos limites: '.$value);
            }
        }
    }

    public function test_levels_add_points_and_lethal_monsters_get_bigger_pools(): void
    {
        $npc = $this->generator()->generate($this->npcOptions(['level' => 3]), collect(), collect(), collect());
        // 28 + 10 por nível acima do primeiro.
        $this->assertSame(48, (int) array_sum($npc['stats']));
        $this->assertSame(10 + 5 * 2, $npc['skill_points']);
        $this->assertSame(15 + 2 * 2, $npc['power_points']);

        $boss = $this->generator()->generate($this->npcOptions(['is_monster' => true, 'danger_level' => 'Chefe']), collect(), collect(), collect());
        $this->assertSame(42, (int) array_sum($boss['stats']));
        $this->assertSame(0, $boss['money']);
        $this->assertStringContainsString('(Chefe)', $boss['class']);
    }

    public function test_pv_comes_from_formula_and_danger_multiplies_it(): void
    {
        $common = $this->generator(11)->generate($this->npcOptions(), collect(), collect(), collect());
        $expected = (new FormulaEvaluator)->evaluate('((FOR / 2) + CON) * 10', ['FOR' => $common['stats']['for'], 'CON' => $common['stats']['con']]);
        $this->assertSame($expected, $common['pv']);

        $normal = $this->generator(11)->generate($this->npcOptions(['is_monster' => true, 'danger_level' => 'Moderado']), collect(), collect(), collect());
        $lethal = $this->generator(11)->generate($this->npcOptions(['is_monster' => true, 'danger_level' => 'Perigoso']), collect(), collect(), collect());
        $this->assertSame($normal['stats'], $lethal['stats']);
        $this->assertSame((int) round($normal['pv'] * 1.3), $lethal['pv']);
    }

    public function test_skills_and_powers_are_bought_within_points(): void
    {
        $skills = collect([$this->skill(1, 4), $this->skill(2, 4), $this->skill(3, 4), $this->skill(4, 4)]);
        $powers = collect([$this->power(1, 15), $this->power(2, 15)]);

        $npc = $this->generator()->generate($this->npcOptions(), $skills, $powers, collect());

        $this->assertCount(2, $npc['skills']);
        $this->assertSame(2, $npc['skill_points']);
        $this->assertCount(1, $npc['powers']);
        $this->assertSame(0, $npc['power_points']);
    }

    public function test_name_is_kept_or_generated(): void
    {
        $this->assertSame('Velho Bartolomeu', $this->generator()->generate($this->npcOptions(['name' => ' Velho Bartolomeu ']), collect(), collect(), collect())['name']);
        $this->assertNotSame('', $this->generator()->generate($this->npcOptions(), collect(), collect(), collect())['name']);
    }

    public function test_party_budgets_and_count_multiplier(): void
    {
        $default = Bestiary::partyBudgets([]);
        $this->assertSame(4, $default['party_size']);
        $this->assertSame(1, $default['avg_level']);
        $this->assertTrue($default['facil'] < $default['medio'] && $default['medio'] < $default['dificil'] && $default['dificil'] < $default['mortal']);

        $this->assertSame(1.0, Bestiary::countMultiplier(1));
        $this->assertSame(1.5, Bestiary::countMultiplier(2));
        $this->assertSame(2.0, Bestiary::countMultiplier(6));
        $this->assertSame(4.0, Bestiary::countMultiplier(20));
    }

    public function test_encounter_uses_environment_and_reports_xp(): void
    {
        $bestiary = new Bestiary(new Randomizer(new Mt19937(3)));

        foreach (array_keys(Bestiary::TACTICS) as $tactic) {
            $encounter = $bestiary->encounter([3, 3, 4], 'dungeon', 'Médio', $tactic);

            $this->assertNotSame([], $encounter['monsters']);
            $xp = 0;
            $count = 0;
            foreach ($encounter['monsters'] as $group) {
                $this->assertContains('dungeon', $group['monster']['environments']);
                $xp += $group['monster']['xp'] * $group['count'];
                $count += $group['count'];
            }
            $this->assertSame($xp, $encounter['total_xp']);
            $this->assertSame((int) round($xp * Bestiary::countMultiplier($count)), $encounter['adjusted_xp']);
        }

        $this->assertSame(1, $bestiary->encounter([1], 'forest', 'Fácil', 'solo')['monsters'][0]['count']);
    }
}
