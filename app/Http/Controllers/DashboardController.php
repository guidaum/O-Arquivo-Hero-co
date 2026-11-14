<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\CharacterSheet;
use App\Game\GameRules;
use App\Models\Character;
use App\Models\Talent;
use App\Support\CampaignLibrary;
use App\Support\Navigation;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Página inicial ("Minhas Lendas" / "Painel do Mestre"), conforme o modo de visão.
 */
class DashboardController extends Controller
{
    /** Atributos exibidos nos cartões de personagem. */
    private const CARD_ATTRIBUTES = 3;

    public function __invoke(Request $request): View
    {
        $user = $request->user();
        $navigation = Navigation::for($request);
        $gmView = $navigation->isGmView();

        $sessions = $gmView
            ? $user->gmSessions()->withCount(['players', 'journalEntries'])->latest()->get()
            : $user->playerSessions()->with('gm:id,name')->withCount(['players', 'journalEntries'])->latest()->get();

        // Relações que a ficha usa para os totais (traços, itens equipados, versão da campanha).
        $characters = $user->characters()
            ->with(['gameSession:id,name', 'gameSession.ruleSet', 'skills', 'powers', 'traits', 'items'])
            ->latest()
            ->get();

        return view('dashboard', [
            'user' => $user,
            'navigation' => $navigation,
            'gmView' => $gmView,
            'sessions' => $sessions,
            'characters' => $characters,
            // Cartão da campanha do jogador abre a ficha do personagem dele nela (SessionManager.tsx).
            'characterBySession' => $characters->whereNotNull('game_session_id')->sortBy('id')->keyBy('game_session_id'),
            'cardStats' => $this->cardStats($characters),
        ]);
    }

    /**
     * Primeiros atributos de cada personagem com o total da ficha (base, mod,
     * traços, itens equipados e ajustes do mestre), pelas regras da campanha.
     *
     * @param  Collection<int, Character>  $characters
     * @return array<int, list<array{id: string, total: int}>>
     */
    private function cardStats(Collection $characters): array
    {
        $bySession = [];
        $stats = [];

        foreach ($characters as $character) {
            $key = $character->game_session_id ?? 0;
            $bySession[$key] ??= [
                GameRules::forSession($character->gameSession),
                CampaignLibrary::for($character->gameSession)->entries(Talent::class)->values(),
            ];
            [$rules, $talents] = $bySession[$key];

            $attributes = CharacterSheet::for($character, $rules, $talents)->data['attributes'];

            $stats[$character->id] = array_map(
                static fn (array $attribute): array => ['id' => $attribute['id'], 'total' => (int) $attribute['total']],
                array_slice($attributes, 0, self::CARD_ATTRIBUTES),
            );
        }

        return $stats;
    }
}
