<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Support\BoardVersion;
use Illuminate\Database\Eloquent\Model;

/**
 * Models do tabuleiro (game_session_id + campaign_map_id): toda gravação ou
 * exclusão pelo Eloquent troca a versão do tabuleiro (App\Support\BoardVersion).
 * Exclusões e alterações em massa (query()->delete()/update()) não disparam
 * eventos: chame BoardVersion::bump() junto delas.
 */
trait BumpsBoardVersion
{
    protected static function bootBumpsBoardVersion(): void
    {
        $bump = static function (Model $model): void {
            BoardVersion::bump($model->getAttribute('game_session_id'), $model->getAttribute('campaign_map_id'));
        };

        static::saved($bump);
        static::deleted($bump);
    }
}
