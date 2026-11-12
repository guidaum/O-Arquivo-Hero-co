<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BumpsBoardVersion;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['points', 'color', 'fill_color', 'size', 'is_closed', 'is_polygon'])]
#[Hidden(['firestore_id'])]
class MapDrawing extends Model
{
    use BumpsBoardVersion;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'points' => 'array',
            'size' => 'integer',
            'is_closed' => 'boolean',
            'is_polygon' => 'boolean',
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
