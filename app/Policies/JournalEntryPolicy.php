<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\JournalEntry;
use App\Models\User;

/**
 * Administradores são liberados em AppServiceProvider (Gate::before).
 */
class JournalEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, JournalEntry $entry): bool
    {
        if ($entry->user_id === $user->id) {
            return true;
        }

        $session = $entry->gameSession;

        return $session !== null && ($session->isGm($user) || $session->hasPlayer($user));
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, JournalEntry $entry): bool
    {
        return $entry->user_id === $user->id;
    }

    public function delete(User $user, JournalEntry $entry): bool
    {
        return $entry->user_id === $user->id;
    }
}
