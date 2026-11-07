<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ChatMessage;
use App\Models\User;

/**
 * Ler e enviar mensagens depende de participar da campanha
 * (GameSessionPolicy::view). Administradores são liberados em
 * AppServiceProvider (Gate::before).
 */
class ChatMessagePolicy
{
    public function update(User $user, ChatMessage $message): bool
    {
        return $this->isSenderOrSessionGm($user, $message);
    }

    public function delete(User $user, ChatMessage $message): bool
    {
        return $this->isSenderOrSessionGm($user, $message);
    }

    private function isSenderOrSessionGm(User $user, ChatMessage $message): bool
    {
        return $message->user_id === $user->id || ($message->gameSession?->isGm($user) ?? false);
    }
}
