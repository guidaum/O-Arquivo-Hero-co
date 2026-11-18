<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Game\CharacterCalculator;
use App\Game\CharacterSheet;
use App\Game\GameRules;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\GameSessionReference;
use App\Models\Talent;
use App\Support\CampaignLibrary;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Escudo do Mestre: uma tela de apoio durante a sessão com o grupo (vida e
 * números de combate), NPCs e monstros, anotações, notas do mestre,
 * referências visuais, mapas, chat e a referência rápida das regras.
 * As ações reaproveitam as rotas do Painel do Mestre, do chat e das notas.
 */
class GmScreenController extends Controller
{
    /** Números de combate exibidos no cartão de cada personagem de jogador. */
    private const COMBAT_STATS = ['defesa' => 'Defesa', 'esquiva' => 'Esquiva', 'en' => 'E/N', 'dm' => 'D/M'];

    public function show(GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        $rules = GameRules::forSession($gameSession);
        $talents = CampaignLibrary::for($gameSession)->entries(Talent::class)->values();
        $attributes = $rules->attributes();

        $characters = $gameSession->characters()
            ->with(['user:id,name', 'skills', 'powers', 'traits', 'items'])
            ->orderBy('name')
            ->get();

        $characters->each(static function (Character $character) use ($gameSession, $rules, $talents, $attributes): void {
            $character->setRelation('gameSession', $gameSession);
            $character->setAttribute('max_pv', CharacterSheet::maxPv($character));

            if ($character->is_npc) {
                return;
            }

            $sheet = CharacterSheet::for($character, $rules, $talents)->data;
            $character->setAttribute('screen_combat', array_map(
                static fn (string $key): int => (int) round((float) ($sheet['derived'][$key] ?? 0)),
                array_combine(array_keys(self::COMBAT_STATS), array_keys(self::COMBAT_STATS)),
            ));
            $character->setAttribute('screen_atp_max', (int) round((float) ($sheet['derived']['atp'] ?? 0)));
            $character->setAttribute('screen_attributes', array_map(
                static fn (array $attribute): array => [
                    'id' => strtoupper($attribute['id']),
                    'label' => $attribute['label'],
                    'total' => (int) ($sheet['totals'][$attribute['id']] ?? 0),
                ],
                $attributes,
            ));
        });

        $formulas = [];
        foreach (CharacterCalculator::DERIVED_STATS as $name) {
            $formulas[$name] = $rules->formula($name);
        }

        return view('gm.screen.show', [
            'session' => $gameSession,
            'party' => $characters->reject(static fn (Character $character): bool => (bool) $character->is_npc)->values(),
            'npcs' => $characters->filter(static fn (Character $character): bool => (bool) $character->is_npc)->values(),
            'combatStats' => self::COMBAT_STATS,
            'worldMaps' => $gameSession->mapsOfType(MapType::World),
            'dungeonMaps' => $gameSession->mapsOfType(MapType::Dungeon),
            'references' => $gameSession->references()->orderByDesc('pinned')->orderByDesc('id')->get()
                ->map(static fn (GameSessionReference $reference): array => $reference->toScreenArray())->all(),
            'rules' => [
                'formulas' => $formulas,
                'easy' => $rules->easyModifier(),
                'hard' => $rules->hardDivisor(),
                'extreme' => $rules->extremeDivisor(),
                'progression' => $rules->progression(),
                'attributes' => $attributes,
            ],
        ]);
    }
}
