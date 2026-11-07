<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MapPin;
use App\Models\User;

/**
 * Marcadores do Mapa do Mundo (regras de mapPins no firestore.rules):
 * quem criou ou o mestre da campanha altera e exclui.
 * Administradores são liberados em AppServiceProvider (Gate::before).
 */
class MapPinPolicy
{
    public function update(User $user, MapPin $pin): bool
    {
        return $pin->created_by === $user->id || $pin->gameSession?->gm_id === $user->id;
    }

    public function delete(User $user, MapPin $pin): bool
    {
        return $this->update($user, $pin);
    }
}
