<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\SuggestionStatus;
use App\Models\Suggestion;
use App\Models\User;

/**
 * Administradores são liberados em AppServiceProvider (Gate::before).
 */
class SuggestionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Suggestion $suggestion): bool
    {
        return $suggestion->user_id === $user->id || $user->isGm();
    }

    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Aprovar, recusar ou ajustar os dados da sugestão: o administrador
     * (liberado pelo Gate::before), pois a sugestão aprovada entra na base;
     * sugestões de item da campanha também pelo mestre dela (entram na loja da campanha).
     */
    public function review(User $user, Suggestion $suggestion): bool
    {
        return $suggestion->game_session_id !== null
            && $suggestion->gameSession !== null
            && $user->can('update', $suggestion->gameSession);
    }

    /**
     * O autor pode desistir enquanto a sugestão está pendente.
     */
    public function delete(User $user, Suggestion $suggestion): bool
    {
        return $suggestion->user_id === $user->id && $suggestion->status === SuggestionStatus::Pending;
    }
}
