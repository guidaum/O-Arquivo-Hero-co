<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\GameRules;
use App\Support\Navigation;
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

        $characters = $user->characters()->latest()->get();

        return view('dashboard', [
            'user' => $user,
            'navigation' => $navigation,
            'gmView' => $gmView,
            'sessions' => $sessions,
            'characters' => $characters,
            // Cartão da campanha do jogador abre a ficha do personagem dele nela (SessionManager.tsx).
            'characterBySession' => $characters->whereNotNull('game_session_id')->sortBy('id')->keyBy('game_session_id'),
            'cardAttributes' => array_slice((new GameRules)->attributes(), 0, self::CARD_ATTRIBUTES),
        ]);
    }
}
