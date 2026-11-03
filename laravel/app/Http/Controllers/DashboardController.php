<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Página inicial do jogador. O painel completo é construído nas próximas fases.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): View
    {
        $user = $request->user();

        return view('dashboard', [
            'user' => $user,
            'gmSessions' => $user->gmSessions()->orderBy('name')->get(),
            'playerSessions' => $user->playerSessions()->orderBy('name')->get(),
            'characters' => $user->characters()->with('gameSession')->orderBy('name')->get(),
        ]);
    }
}
