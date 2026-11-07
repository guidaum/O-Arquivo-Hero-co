<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\GameSession;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Painel do Mestre de uma campanha: código de convite, jogadores, personagens
 * e chat da sessão. Bestiário, encontros, áudio e acompanhamento de vida
 * entram na fase 9.
 */
class GmSessionController extends Controller
{
    public function __invoke(GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        $gameSession->load([
            'players' => static fn ($query) => $query->orderBy('name'),
            'characters' => static fn ($query) => $query->orderBy('name')->select(['id', 'name', 'class', 'level', 'user_id', 'game_session_id', 'image_path', 'color', 'icon']),
        ])->loadCount(['players', 'journalEntries']);

        return view('gm.sessions.show', [
            'session' => $gameSession,
            'charactersByUser' => $gameSession->characters->groupBy('user_id'),
        ]);
    }
}
