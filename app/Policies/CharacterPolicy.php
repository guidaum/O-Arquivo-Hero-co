<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Character;
use App\Models\User;

/**
 * Administradores são liberados em AppServiceProvider (Gate::before).
 */
class CharacterPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Dono, mestre da campanha ou jogadores da mesma campanha.
     */
    public function view(User $user, Character $character): bool
    {
        if ($this->isOwner($user, $character)) {
            return true;
        }

        $session = $character->gameSession;

        return $session !== null && ($session->isGm($user) || $session->hasPlayer($user));
    }

    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Dono ou mestre da campanha. Atributos têm regra própria (editStats).
     */
    public function update(User $user, Character $character): bool
    {
        return $this->isOwner($user, $character) || $this->isSessionGm($user, $character);
    }

    /**
     * Alterar atributos e modificadores: o mestre sempre; o dono apenas
     * quando o mestre liberou (can_edit_stats).
     */
    public function editStats(User $user, Character $character): bool
    {
        return $this->isSessionGm($user, $character)
            || ($this->isOwner($user, $character) && $character->can_edit_stats);
    }

    /**
     * Liberar ou bloquear a edição de atributos do jogador.
     */
    public function unlockStats(User $user, Character $character): bool
    {
        return $this->isSessionGm($user, $character);
    }

    public function delete(User $user, Character $character): bool
    {
        return $this->isOwner($user, $character);
    }

    private function isOwner(User $user, Character $character): bool
    {
        return $character->user_id === $user->id;
    }

    private function isSessionGm(User $user, Character $character): bool
    {
        return $character->gameSession?->isGm($user) ?? false;
    }
}
