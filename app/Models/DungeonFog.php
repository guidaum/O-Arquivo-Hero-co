<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Névoa de guerra de uma masmorra dentro de uma campanha.
 */
/**
 * revealed_cells: índices linha * colunas + coluna da grade do mapa.
 */
#[Fillable(['enabled', 'revealed_cells'])]
class DungeonFog extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'revealed_cells' => 'array',
        ];
    }

    /**
     * Grava a névoa de um mapa na campanha (sessão e mapa ficam fora do $fillable).
     *
     * @param  list<int>  $revealedCells
     */
    public static function saveFor(GameSession $session, CampaignMap $map, bool $enabled, array $revealedCells, ?User $user): self
    {
        $fog = self::query()
            ->where('game_session_id', $session->id)
            ->where('campaign_map_id', $map->id)
            ->first() ?? new self;

        $fog->game_session_id = $session->id;
        $fog->campaign_map_id = $map->id;
        $fog->fill([
            'enabled' => $enabled,
            'revealed_cells' => array_values(array_unique(array_map('intval', $revealedCells))),
        ]);
        $fog->updated_by = $user?->id;
        $fog->save();

        return $fog;
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
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
