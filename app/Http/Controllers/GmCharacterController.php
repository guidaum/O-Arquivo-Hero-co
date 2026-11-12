<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\CharacterSheet;
use App\Game\GameRules;
use App\Game\NpcGenerator;
use App\Http\Controllers\Concerns\SpawnsDungeonTokens;
use App\Models\CampaignMap;
use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Support\CampaignLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Personagens da campanha no painel do mestre: gerador de NPCs/monstros,
 * progressão (níveis, pontos e XP), acompanhamento de vida
 * (HealthTrackerWidget), monstro/NPC, exclusão de NPCs e envio para a masmorra.
 * O personagem da URL é sempre buscado dentro da campanha (scopeBindings).
 */
class GmCharacterController extends Controller
{
    use SpawnsDungeonTokens;

    public const HEALTH_ACTIONS = ['damage', 'heal', 'temp', 'clear_temp', 'short_rest', 'long_rest', 'full_heal'];

    public const POINT_TYPES = [
        'attributes' => ['attribute_points', 'atributo'],
        'skills' => ['skill_points', 'perícia'],
        'powers' => ['power_points', 'poder'],
    ];

    public function generate(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validateWithBag('generateNpc', [
            'name' => ['nullable', 'string', 'max:255'],
            'level' => ['required', 'integer', 'min:1', 'max:20'],
            'archetype' => ['required', Rule::in(array_keys(NpcGenerator::ARCHETYPES))],
            'is_monster' => ['boolean'],
            'monster_type' => ['nullable', 'string', 'max:64'],
            'danger_level' => ['nullable', Rule::in(NpcGenerator::DANGER_LEVELS)],
            'monster_size' => ['nullable', 'integer', 'min:1', 'max:4'],
            'trait_count' => ['required', 'integer', 'min:0', 'max:5'],
            'map_id' => ['nullable', 'integer'],
            'hidden' => ['boolean'],
        ], [], [
            'name' => 'nome',
            'level' => 'nível',
            'archetype' => 'arquétipo',
            'monster_type' => 'tipo de monstro',
            'danger_level' => 'nível de perigo',
            'monster_size' => 'tamanho',
            'trait_count' => 'quantidade de traços',
        ]);

        $isMonster = $request->boolean('is_monster');
        $map = isset($data['map_id']) ? $this->dungeonMapOf($gameSession, (int) $data['map_id']) : null;
        $rules = GameRules::forSession($gameSession);
        $generator = new NpcGenerator($rules);
        $library = CampaignLibrary::for($gameSession);

        $npc = $generator->generate(
            [
                'name' => $data['name'] ?? null,
                'level' => (int) $data['level'],
                'archetype' => $data['archetype'],
                'is_monster' => $isMonster,
                'monster_type' => $data['monster_type'] ?? null,
                'danger_level' => $data['danger_level'] ?? 'Moderado',
                'trait_count' => (int) $data['trait_count'],
            ],
            $library->entries(Skill::class)->values(),
            $library->entries(Power::class)->values(),
            $library->entries(CharacterTrait::class)->values(),
        );

        $character = DB::transaction(function () use ($request, $gameSession, $npc, $isMonster, $data, $map): Character {
            $stats = $npc['stats'];
            $character = new Character([
                'name' => $npc['name'],
                'class' => $npc['class'],
                'color' => $isMonster ? '#ef4444' : '#10b981',
                'level' => $npc['level'],
                'xp' => 0,
                'xp_max' => 1000,
                // Como no sistema antigo, o PV do monstro (já reforçado) fica em stats.pv.
                'stats' => $isMonster ? [...$stats, 'pv' => $npc['pv']] : $stats,
                'base_stats' => $stats,
                'stats_mods' => [],
                'talent_mods' => [],
                'attribute_points' => 0,
                'skill_points' => $npc['skill_points'],
                'power_points' => $npc['power_points'],
                'current_atp' => $npc['atp'],
                'money' => $npc['money'],
                'sanity' => CharacterSheet::TRACK_MAX,
            ]);
            $character->user_id = $request->user()->id;
            $character->game_session_id = $gameSession->id;
            $character->is_npc = true;
            $character->is_monster = $isMonster;
            $character->monster_size = $isMonster ? (int) ($data['monster_size'] ?? 1) : 1;
            $character->can_edit_stats = false;
            $character->save();

            $pivot = ['level' => 1, 'type' => null, 'description' => null];
            $character->skills()->attach(array_fill_keys($npc['skills'], $pivot));
            $character->powers()->attach(array_fill_keys($npc['powers'], $pivot));
            $character->traits()->sync($npc['traits']);

            $character->setRelation('gameSession', $gameSession);
            $character->forceFill(['current_pv' => CharacterSheet::maxPv($character)])->save();

            if ($map !== null) {
                $this->spawnCharacter($gameSession, $map, $request, $character, $request->boolean('hidden'));
            }

            return $character;
        });

        $message = ($isMonster ? 'Monstro' : 'NPC').' "'.$character->name.'" gerado'.($map !== null ? ' e colocado em '.$map->name : '').'!';

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'mesa'])
            ->withFragment('personagem-'.$character->id)
            ->with('status', $message);
    }

    /**
     * Subir níveis (com os pontos por nível das regras), dar pontos e XP.
     * O XP não sobe o nível sozinho: a mesa mostra "pronto para subir".
     */
    public function progress(Request $request, GameSession $gameSession, Character $character): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'action' => ['required', Rule::in(['level_up', 'points', 'xp'])],
            'type' => ['required_if:action,points', 'nullable', Rule::in(array_keys(self::POINT_TYPES))],
            'amount' => ['required', 'integer', 'min:-9999', 'max:9999', 'not_in:0'],
        ], [
            'amount.not_in' => 'Informe uma quantidade diferente de zero.',
        ], ['amount' => 'quantidade', 'type' => 'tipo de ponto']);

        $amount = (int) $data['amount'];
        $back = redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'mesa'])->withFragment('personagem-'.$character->id);

        if ($data['action'] === 'level_up' && ($amount < 1 || $amount > 20)) {
            return $back->withErrors(['amount' => 'Suba de 1 a 20 níveis por vez.']);
        }

        $message = DB::transaction(static function () use ($gameSession, $character, $data, $amount): string {
            $character = Character::query()->lockForUpdate()->findOrFail($character->id);

            if ($data['action'] === 'level_up') {
                $perLevel = GameRules::forSession($gameSession)->progression();
                $character->level = (int) $character->level + $amount;
                $character->attribute_points = (int) $character->attribute_points + $perLevel['attr_points_per_level'] * $amount;
                $character->skill_points = (int) $character->skill_points + $perLevel['skill_points_per_level'] * $amount;
                $character->power_points = (int) $character->power_points + $perLevel['power_points_per_level'] * $amount;
                $character->save();

                return $character->name.' subiu para o nível '.$character->level.'!';
            }

            if ($data['action'] === 'xp') {
                $character->xp = max(0, (int) $character->xp + $amount);
                $character->save();

                return $character->name.($amount > 0 ? ' recebeu ' : ' perdeu ').abs($amount).' XP.';
            }

            [$column, $label] = self::POINT_TYPES[$data['type']];
            $character->{$column} = max(0, (int) $character->{$column} + $amount);
            $character->save();

            return $character->name.' agora tem '.$character->{$column}.' pontos de '.$label.'.';
        });

        return $back->with('status', $message);
    }

    /**
     * Dano (absorvido primeiro pelo PV temporário), cura até o máximo,
     * PV temporário, descanso curto (+25% do máximo) e longo (PV cheio).
     */
    public function health(Request $request, GameSession $gameSession, Character $character): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'action' => ['required', Rule::in(self::HEALTH_ACTIONS)],
            'amount' => ['required_if:action,damage,heal,temp', 'nullable', 'integer', 'min:1', 'max:9999'],
        ], [], ['amount' => 'quantidade']);

        $character->setRelation('gameSession', $gameSession);
        $max = CharacterSheet::maxPv($character);

        [$character, $message] = DB::transaction(static function () use ($character, $data, $max): array {
            $character = Character::query()->lockForUpdate()->findOrFail($character->id);
            $current = (int) ($character->current_pv ?? $max);
            $temp = max(0, (int) $character->temp_pv);
            $amount = (int) ($data['amount'] ?? 0);

            switch ($data['action']) {
                case 'damage':
                    if ($current <= 0 && $temp <= 0) {
                        return [$character, $character->name.' já está com 0 PV (inconsciente)!'];
                    }
                    $absorbed = min($temp, $amount);
                    $temp -= $absorbed;
                    $current = max(0, $current - ($amount - $absorbed));
                    $message = $absorbed > 0
                        ? 'PV temporário absorveu '.$absorbed.' de dano'.($amount > $absorbed ? '; '.($amount - $absorbed).' atingiu o PV.' : '.')
                        : $character->name.' tomou '.$amount.' de dano!';
                    break;
                case 'heal':
                case 'short_rest':
                    if ($data['action'] === 'short_rest') {
                        $amount = max(1, (int) round($max * 0.25));
                    }
                    if ($current >= $max) {
                        return [$character, 'Vida já está no máximo ('.$max.' PV)!'];
                    }
                    $healed = min($max, $current + $amount) - $current;
                    $current += $healed;
                    $message = ($data['action'] === 'short_rest' ? 'Descanso curto: ' : '').'+'.$healed.' PV recuperados.';
                    break;
                case 'temp':
                    $temp += $amount;
                    $message = '+'.$amount.' PV temporário concedido!';
                    break;
                case 'clear_temp':
                    $temp = 0;
                    $message = 'PV temporário removido.';
                    break;
                case 'long_rest':
                    $current = $max;
                    $temp = 0;
                    $message = 'Descanso longo: '.$max.' PV restaurados.';
                    break;
                default:
                    $current = $max;
                    $message = 'Recuperação total: '.$max.' PV restaurados.';
            }

            $character->forceFill(['current_pv' => $current, 'temp_pv' => $temp])->save();

            return [$character, $message];
        });

        return response()->json([
            'message' => $message,
            'current_pv' => (int) ($character->current_pv ?? $max),
            'temp_pv' => (int) $character->temp_pv,
            'max_pv' => $max,
        ]);
    }

    /**
     * Alterna um NPC entre monstro hostil e NPC comum.
     */
    public function toggleMonster(GameSession $gameSession, Character $character): RedirectResponse
    {
        Gate::authorize('update', $gameSession);
        abort_unless($character->is_npc, 422, 'Só NPCs podem virar monstros.');

        $character->is_monster = ! $character->is_monster;
        if (trim((string) $character->class) === '') {
            $character->class = $character->is_monster ? 'Monstro' : 'NPC Aliado';
        }
        $character->save();

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'mesa'])
            ->withFragment('personagem-'.$character->id)
            ->with('status', $character->is_monster ? $character->name.' agora é um monstro!' : $character->name.' agora é um NPC comum.');
    }

    /**
     * Exclui um NPC do mestre. Personagens de jogadores ficam com os donos.
     */
    public function destroy(GameSession $gameSession, Character $character): RedirectResponse
    {
        Gate::authorize('update', $gameSession);
        abort_unless($character->is_npc, 403, 'O mestre só exclui NPCs; personagens de jogadores pertencem aos jogadores.');

        $character->deleteWithFiles();

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'mesa'])->with('status', '"'.$character->name.'" foi excluído.');
    }

    /**
     * Coloca o personagem numa masmorra da campanha, visível ou oculto.
     */
    public function spawn(Request $request, GameSession $gameSession, Character $character): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'map_id' => ['required', 'integer'],
            'hidden' => ['boolean'],
        ], [], ['map_id' => 'masmorra']);

        $map = $this->dungeonMapOf($gameSession, (int) $data['map_id']);
        $character->setRelation('gameSession', $gameSession);
        $hidden = $request->boolean('hidden');
        $token = $this->spawnCharacter($gameSession, $map, $request, $character, $hidden);

        return response()->json([
            'message' => $character->name.' posicionado em '.$map->name.($hidden ? ' (oculto aos jogadores).' : ' (visível).'),
            'token_id' => $token->id,
        ], 201);
    }

    private function spawnCharacter(GameSession $session, CampaignMap $map, Request $request, Character $character, bool $hidden): DungeonToken
    {
        [$hp, $maxHp] = DungeonTokenController::vitals($character);
        $ini = (int) ($character->rollStats()['INI'] ?? 0);
        $type = $character->is_monster ? 'monster' : ($character->is_npc ? 'npc' : 'player');
        $existing = DungeonToken::query()
            ->where('game_session_id', $session->id)
            ->where('campaign_map_id', $map->id)
            ->where('character_id', $character->id)
            ->count();

        // Jogadores têm um token por mapa, controlado pelo dono do personagem.
        abort_if($type === 'player' && $existing > 0, 422, $character->name.' já está nesta masmorra.');

        $token = $this->spawnToken($session, $map, $request->user(), [
            'name' => $character->name,
            'type' => $type,
            'color' => $character->color ?: ($type === 'monster' ? '#ef4444' : '#10b981'),
            'hp' => $hp,
            'max_hp' => $maxHp,
            'size' => $character->is_monster ? (int) $character->monster_size : 1,
            'initiative' => random_int(1, 20) + $ini,
            'is_hidden' => $hidden,
            'character_id' => $character->id,
            'avatar_path' => $character->image_path,
        ], $existing);

        if ($type === 'player' && $character->user_id !== null) {
            $token->user_id = $character->user_id;
            $token->save();
        }

        return $token;
    }
}
