<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\GameSession;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Jogadores da campanha: o mestre convida pelo e-mail e remove
 * (handleInvitePlayer e handleRemovePlayer do painel antigo).
 */
class GmPlayerController extends Controller
{
    public function store(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validateWithBag('invitePlayer', [
            'email' => ['required', 'email', 'max:255'],
        ], [], ['email' => 'e-mail']);

        $back = redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'configuracoes']);
        $player = User::query()->where('email', mb_strtolower(trim($data['email'])))->first();

        if ($player === null) {
            return $back->withErrors(['email' => 'Usuário não encontrado com este e-mail.'], 'invitePlayer')->withInput();
        }

        if ($gameSession->isGm($player)) {
            return $back->withErrors(['email' => 'O mestre já faz parte da campanha.'], 'invitePlayer')->withInput();
        }

        if ($gameSession->hasPlayer($player)) {
            return $back->with('status', 'Este jogador já faz parte da campanha.');
        }

        $gameSession->players()->attach($player->id);

        return $back->with('status', $player->name.' foi convidado para a campanha!');
    }

    /**
     * Remove o jogador; os personagens dele continuam na campanha, como no sistema antigo.
     */
    public function destroy(GameSession $gameSession, User $player): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $gameSession->players()->detach($player->id);

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'configuracoes'])
            ->with('status', $player->name.' foi removido da campanha.');
    }
}
