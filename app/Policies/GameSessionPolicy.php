<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\GameSession;
use App\Models\User;

/**
 * Administradores são liberados em AppServiceProvider (Gate::before).
 */
class GameSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Ver a campanha e participar dela (chat, mapas, battlemap).
     */
    public function view(User $user, GameSession $session): bool
    {
        return $session->isGm($user) || $session->hasPlayer($user);
    }

    public function create(User $user): bool
    {
        return $user->isGm();
    }

    /**
     * Entrar na campanha informando o código.
     */
    public function join(User $user, GameSession $session): bool
    {
        return $session->active && ! $session->isGm($user);
    }

    /**
     * Editar a campanha e usar as ferramentas de mestre dela.
     */
    public function update(User $user, GameSession $session): bool
    {
        return $session->isGm($user);
    }

    public function delete(User $user, GameSession $session): bool
    {
        return $session->isGm($user);
    }
}
