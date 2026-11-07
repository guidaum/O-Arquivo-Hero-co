<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['label', 'category', 'description', 'color', 'x', 'y'])]
class DungeonMarker extends Model
{
    /** Categorias (DUNGEON_MARKER_CATEGORIES): rótulo, ícone do sprite e cor. */
    public const CATEGORIES = [
        'danger' => ['Perigo / Atenção', 'flame', '#ef4444'],
        'trap' => ['Armadilha', 'alert-triangle', '#a855f7'],
        'treasure' => ['Tesouro / Baú', 'gem', '#f59e0b'],
        'door' => ['Porta / Passagem', 'landmark', '#10b981'],
        'poi' => ['Ponto de Interesse', 'sparkles', '#38bdf8'],
        'target' => ['Alvo / Foco', 'crosshair', '#f43f5e'],
        'note' => ['Anotação Tática', 'book-open', '#eab308'],
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
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
