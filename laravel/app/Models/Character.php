<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Campos de controle (user_id, game_session_id, can_edit_stats, is_npc)
 * ficam fora do $fillable e são definidos explicitamente pelo controller.
 */
#[Fillable([
    'name', 'class', 'image_path', 'color', 'icon',
    'level', 'xp', 'xp_max', 'attribute_points', 'skill_points', 'power_points',
    'current_pv', 'temp_pv', 'current_atp', 'protection', 'awakening', 'sanity', 'money',
    'base_stats', 'stats', 'stats_mods', 'talent_mods', 'model_sheet_3d',
])]
#[Hidden(['firestore_id'])]
class Character extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_npc' => 'boolean',
            'can_edit_stats' => 'boolean',
            'level' => 'integer',
            'xp' => 'integer',
            'xp_max' => 'integer',
            'money' => 'integer',
            'base_stats' => 'array',
            'stats' => 'array',
            'stats_mods' => 'array',
            'talent_mods' => 'array',
            'model_sheet_3d' => 'array',
            'gm_modifiers' => 'array',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    /**
     * Variáveis das rolagens livres (dano de itens, "/r" no chat): valor
     * base + modificador de cada atributo, em maiúsculas, como no sistema antigo.
     *
     * @return array<string, int|float>
     */
    public function rollStats(): array
    {
        $stats = [];
        $mods = (array) ($this->stats_mods ?? []);

        foreach ((array) ($this->stats ?? []) as $attribute => $value) {
            $stats[strtoupper((string) $attribute)] = (is_numeric($value) ? $value + 0 : 0) + (is_numeric($mods[$attribute] ?? null) ? $mods[$attribute] + 0 : 0);
        }

        return $stats;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsToMany<Skill, $this>
     */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class)->withPivot(['level', 'type', 'description']);
    }

    /**
     * @return BelongsToMany<Power, $this>
     */
    public function powers(): BelongsToMany
    {
        return $this->belongsToMany(Power::class)->withPivot(['level', 'type', 'description']);
    }

    /**
     * @return BelongsToMany<CharacterTrait, $this>
     */
    public function traits(): BelongsToMany
    {
        return $this->belongsToMany(CharacterTrait::class, 'character_trait', 'character_id', 'trait_id');
    }

    /**
     * @return HasMany<CharacterItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(CharacterItem::class);
    }

    /**
     * @return HasMany<CharacterNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(CharacterNote::class);
    }
}
