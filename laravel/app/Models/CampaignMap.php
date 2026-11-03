<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MapType;
use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mapa do mundo ou masmorra. Mapas padrão (preset_key) servem a todas as
 * campanhas; mapas personalizados pertencem a uma sessão.
 */
#[Fillable([
    'type', 'name', 'subtitle', 'theme', 'image_path', 'grid_cols', 'grid_rows',
    'entrance_x', 'entrance_y', 'default_scale', 'active',
])]
#[Hidden(['firestore_id'])]
class CampaignMap extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => MapType::class,
            'grid_cols' => 'integer',
            'grid_rows' => 'integer',
            'entrance_x' => 'float',
            'entrance_y' => 'float',
            'active' => 'boolean',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    public function isPreset(): bool
    {
        return $this->preset_key !== null;
    }

    /**
     * Mapas disponíveis para uma campanha: os padrão e os criados nela.
     *
     * @param  Builder<CampaignMap>  $query
     */
    public function scopeAvailableTo(Builder $query, GameSession $session): void
    {
        $query->where(function (Builder $query) use ($session): void {
            $query->whereNotNull('preset_key')
                ->orWhere('game_session_id', $session->id);
        });
    }

    /**
     * @param  Builder<CampaignMap>  $query
     */
    public function scopeOfType(Builder $query, MapType $type): void
    {
        $query->where('type', $type);
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsToMany<GameSession, $this, GameSessionMap>
     */
    public function sessions(): BelongsToMany
    {
        return $this->belongsToMany(GameSession::class, 'game_session_maps')
            ->using(GameSessionMap::class)
            ->withPivot(['active', 'layer_settings'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<MapPin, $this>
     */
    public function pins(): HasMany
    {
        return $this->hasMany(MapPin::class);
    }

    /**
     * @return HasMany<MapDrawing, $this>
     */
    public function drawings(): HasMany
    {
        return $this->hasMany(MapDrawing::class);
    }

    /**
     * @return HasMany<DungeonToken, $this>
     */
    public function tokens(): HasMany
    {
        return $this->hasMany(DungeonToken::class);
    }
}
