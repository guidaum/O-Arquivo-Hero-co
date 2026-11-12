<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Models\GameSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Entrada de catálogo com herança por campanha (App\Support\CampaignLibrary):
 * linha da base (sem campanha), versão da campanha (campanha + base_id) ou
 * item só da campanha (campanha sem base_id). Os dados comparados e
 * herdados são as colunas preenchíveis do Model.
 */
trait CampaignLibraryEntry
{
    public function initializeCampaignLibraryEntry(): void
    {
        $this->mergeCasts([
            'hidden' => 'boolean',
            'version' => 'integer',
            'base_version' => 'integer',
            'archived_at' => 'datetime',
            'proposed_at' => 'datetime',
        ]);
    }

    /**
     * Linhas ativas da base (o catálogo global, sem os itens excluídos).
     *
     * @param  Builder<static>  $query
     */
    public function scopeBase(Builder $query): void
    {
        $query->whereNull($this->qualifyColumn('game_session_id'))->whereNull($this->qualifyColumn('archived_at'));
    }

    /**
     * Item ativo da base (excluídos da base continuam só nas campanhas antigas).
     */
    public function isBase(): bool
    {
        return $this->game_session_id === null && $this->archived_at === null;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function isCampaignOnly(): bool
    {
        return $this->game_session_id !== null && $this->base_id === null;
    }

    /**
     * Colunas de dados herdadas da base pela campanha.
     *
     * @return list<string>
     */
    public function libraryFields(): array
    {
        return $this->getFillable();
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<static, $this>
     */
    public function baseEntry(): BelongsTo
    {
        return $this->belongsTo(static::class, 'base_id');
    }

    /**
     * Versões das campanhas para esta linha da base.
     *
     * @return HasMany<static, $this>
     */
    public function campaignVersions(): HasMany
    {
        return $this->hasMany(static::class, 'base_id');
    }
}
