<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class GameSessionMap extends Pivot
{
    protected $table = 'game_session_maps';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'layer_settings' => 'array',
        ];
    }
}
