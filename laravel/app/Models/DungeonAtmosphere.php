<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ambientação sonora e clima. Sem mapa, vale para toda a campanha.
 */
#[Fillable(['soundscape', 'weather', 'volume', 'custom_ambient_name', 'custom_ambient_path'])]
class DungeonAtmosphere extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'volume' => 'integer',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function customAmbientUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->custom_ambient_path));
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
}
