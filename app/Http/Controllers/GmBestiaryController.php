<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\Bestiary;
use App\Http\Controllers\Concerns\SpawnsDungeonTokens;
use App\Models\GameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Bestiário oficial e gerador de encontros (BestiaryModal e
 * EncounterGeneratorModal): o mestre monta o encontro pelo orçamento de XP
 * do grupo e coloca as criaturas numa masmorra da campanha.
 */
class GmBestiaryController extends Controller
{
    use SpawnsDungeonTokens;

    /** Limite de criaturas por envio. */
    private const MAX_CREATURES = 30;

    /**
     * Sorteia um encontro para o grupo (níveis dos personagens de jogadores).
     */
    public function encounter(Request $request, GameSession $gameSession, Bestiary $bestiary): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'ambiente' => ['required', Rule::in(array_keys(Bestiary::ENVIRONMENTS))],
            'dificuldade' => ['required', Rule::in(array_keys(Bestiary::DIFFICULTIES))],
            'tatica' => ['required', Rule::in(array_keys(Bestiary::TACTICS))],
        ], [], ['ambiente' => 'ambiente', 'dificuldade' => 'dificuldade', 'tatica' => 'tática']);

        $levels = $gameSession->characters()->where('is_npc', false)->pluck('level')->map(static fn ($level): int => (int) $level)->all();
        $encounter = $bestiary->encounter($levels, $data['ambiente'], $data['dificuldade'], $data['tatica']);

        return response()->json([
            ...$encounter,
            'budgets' => Bestiary::partyBudgets($levels),
            'monsters' => array_map(static fn (array $group): array => [
                'id' => $group['monster']['id'],
                'name' => $group['monster']['name'],
                'cr' => $group['monster']['cr'],
                'xp' => $group['monster']['xp'],
                'hp' => $group['monster']['hp'],
                'type' => $group['monster']['type'],
                'count' => $group['count'],
            ], $encounter['monsters']),
        ]);
    }

    /**
     * Coloca criaturas do bestiário numa masmorra: [{id, count}], visíveis ou ocultas.
     */
    public function spawn(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'map_id' => ['required', 'integer'],
            'hidden' => ['boolean'],
            'monsters' => ['required', 'array', 'min:1', 'max:10'],
            'monsters.*.id' => ['required', 'string', Rule::in(array_column(Bestiary::monsters(), 'id'))],
            'monsters.*.count' => ['required', 'integer', 'min:1', 'max:'.self::MAX_CREATURES],
        ], [], [
            'map_id' => 'masmorra',
            'monsters' => 'criaturas',
            'monsters.*.id' => 'criatura',
            'monsters.*.count' => 'quantidade',
        ]);

        $total = array_sum(array_column($data['monsters'], 'count'));
        if ($total > self::MAX_CREATURES) {
            return response()->json(['message' => 'Coloque no máximo '.self::MAX_CREATURES.' criaturas por vez.'], 422);
        }

        $map = $this->dungeonMapOf($gameSession, (int) $data['map_id']);
        $hidden = $request->boolean('hidden');
        $user = $request->user();

        $spawned = DB::transaction(function () use ($data, $gameSession, $map, $user, $hidden): int {
            $index = 0;

            foreach ($data['monsters'] as $group) {
                $monster = Bestiary::find($group['id']);
                $count = (int) $group['count'];

                for ($i = 1; $i <= $count; $i++) {
                    $this->spawnToken($gameSession, $map, $user, [
                        'name' => $monster['name'].($count > 1 ? ' #'.$i : ''),
                        'type' => 'monster',
                        'color' => self::colorFor((string) $monster['type'], (string) ($monster['color'] ?? '')),
                        'hp' => (int) $monster['hp'],
                        'max_hp' => (int) $monster['maxHp'],
                        'size' => (int) ($monster['gridSize'] ?? 1),
                        'initiative' => random_int(1, 20) + (int) ($monster['initiativeBonus'] ?? 0),
                        'is_hidden' => $hidden,
                    ], $index++);
                }
            }

            return $index;
        });

        return response()->json([
            'message' => $spawned.' '.($spawned === 1 ? 'criatura colocada' : 'criaturas colocadas').' em '.$map->name.($hidden ? ' (ocultas aos jogadores).' : '.'),
            'count' => $spawned,
            'dungeon_url' => route('dungeon.index', ['campanha' => $gameSession->id, 'mapa' => $map->id]),
        ], 201);
    }

    /** Cor do token como na masmorra antiga: dragões e aberrações em carmesim, mortos-vivos em roxo. */
    private static function colorFor(string $type, string $fallback): string
    {
        return match ($type) {
            'Dragão', 'Aberração' => '#dc2626',
            'Morto-vivo' => '#a855f7',
            default => preg_match('/^#[0-9a-fA-F]{6}$/', $fallback) === 1 ? $fallback : '#ef4444',
        };
    }
}
