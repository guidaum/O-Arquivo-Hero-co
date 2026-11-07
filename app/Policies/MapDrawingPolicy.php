<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MapDrawing;
use App\Models\User;

/**
 * Desenhos sobre os mapas (MapDrawingOverlay.tsx): o autor ou o mestre
 * da campanha apagam. Administradores são liberados em AppServiceProvider.
 */
class MapDrawingPolicy
{
    public function delete(User $user, MapDrawing $drawing): bool
    {
        return $drawing->user_id === $user->id || $drawing->gameSession?->gm_id === $user->id;
    }
}
