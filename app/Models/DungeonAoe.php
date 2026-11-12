<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BumpsBoardVersion;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Área de efeito (círculo, cone, linha...) desenhada no battlemap.
 */
#[Fillable(['type', 'name', 'color', 'x', 'y', 'target_x', 'target_y', 'radius_feet', 'rotation'])]
class DungeonAoe extends Model
{
    use BumpsBoardVersion;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
            'target_x' => 'float',
            'target_y' => 'float',
            'radius_feet' => 'integer',
            'rotation' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<CampaignMap, $this>
     */
    public function campaignMap(): BelongsTo
    {
        return $this->belongsTo(CampaignMap::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
