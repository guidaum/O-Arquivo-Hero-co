<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CampaignMap;
use App\Models\User;

/**
 * Mapas personalizados (regras de worldMaps/dungeonMaps no firestore.rules):
 * quem criou ou o mestre da campanha dona do mapa. Os mapas padrão
 * (preset_key) são fixos. Administradores: Gate::before no AppServiceProvider.
 */
class CampaignMapPolicy
{
    public function update(User $user, CampaignMap $map): bool
    {
        if ($map->isPreset()) {
            return false;
        }

        return $map->created_by === $user->id || $map->gameSession?->gm_id === $user->id;
    }

    public function delete(User $user, CampaignMap $map): bool
    {
        return $this->update($user, $map);
    }
}
