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

    /** Grade padrão quando o mapa não define a sua (24×14, como no sistema antigo). */
    public const DEFAULT_GRID = [24, 14];

    /** Atalhos de grade do formulário de masmorras. */
    public const GRID_PRESETS = [
        '16:9 Padrão (24×14)' => [24, 14],
        'Quadrado 1:1 (24×24)' => [24, 24],
        'Vertical 9:16 (14×24)' => [14, 24],
        'Panorâmico 21:9 (32×12)' => [32, 12],
        'Grande (36×20)' => [36, 20],
        'Épico (48×28)' => [48, 28],
    ];

    public function isPreset(): bool
    {
        return $this->preset_key !== null;
    }

    public function gridCols(): int
    {
        return $this->grid_cols ?: self::DEFAULT_GRID[0];
    }

    public function gridRows(): int
    {
        return $this->grid_rows ?: self::DEFAULT_GRID[1];
    }

    /**
     * Miniatura: jogadores veem a imagem genérica (sem revelar o mapa), o mestre vê a real.
     */
    public function thumbnailUrl(bool $isGm): string
    {
        $generic = asset($this->type === MapType::World ? 'images/maps/generic-world-thumb.jpg' : 'images/maps/generic-dungeon-thumb.jpg');

        return $isGm ? ($this->image_url ?? $generic) : $generic;
    }

    /**
     * Névoa de guerra do mapa na campanha: a da tabela dungeon_fogs ou,
     * para dados antigos, a guardada nas camadas (fogEnabled/revealedCells).
     *
     * @param  array<string, mixed>|null  $legacyLayers
     * @return array{enabled: bool, revealed_cells: list<int>}
     */
    public function fogIn(GameSession $session, ?array $legacyLayers = null): array
    {
        $fog = $this->fogs()->where('game_session_id', $session->id)->first();
        $total = $this->gridCols() * $this->gridRows();
        $clean = static fn (mixed $cells): array => array_values(array_unique(array_filter(
            array_map('intval', is_array($cells) ? $cells : []),
            static fn (int $cell): bool => $cell >= 0 && $cell < $total,
        )));

        if ($fog !== null) {
            return ['enabled' => $fog->enabled, 'revealed_cells' => $clean($fog->revealed_cells)];
        }

        return [
            'enabled' => (bool) ($legacyLayers['fogEnabled'] ?? $legacyLayers['fog_enabled'] ?? false),
            'revealed_cells' => $clean($legacyLayers['revealedCells'] ?? $legacyLayers['revealed_cells'] ?? []),
        ];
    }

    /**
     * @return HasMany<DungeonFog, $this>
     */
    public function fogs(): HasMany
    {
        return $this->hasMany(DungeonFog::class);
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
