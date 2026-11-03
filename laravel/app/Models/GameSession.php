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
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['name', 'code', 'description', 'image_path', 'gm_notes', 'active', 'shop_enabled'])]
#[Hidden(['firestore_id'])]
class GameSession extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'shop_enabled' => 'boolean',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    public function isGm(User $user): bool
    {
        return $this->gm_id === $user->id;
    }

    public function hasPlayer(User $user): bool
    {
        return $this->players()->whereKey($user->id)->exists();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function gm(): BelongsTo
    {
        return $this->belongsTo(User::class, 'gm_id');
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function players(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /**
     * @return BelongsToMany<CatalogItem, $this>
     */
    public function shopItems(): BelongsToMany
    {
        return $this->belongsToMany(CatalogItem::class, 'game_session_shop_items');
    }

    /**
     * @return HasOne<RuleSet, $this>
     */
    public function ruleSet(): HasOne
    {
        return $this->hasOne(RuleSet::class);
    }

    /**
     * @return HasMany<Character, $this>
     */
    public function characters(): HasMany
    {
        return $this->hasMany(Character::class);
    }

    /**
     * @return HasMany<ChatMessage, $this>
     */
    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    /**
     * @return HasMany<JournalEntry, $this>
     */
    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class);
    }

    /**
     * Mapas personalizados criados para esta campanha.
     *
     * @return HasMany<CampaignMap, $this>
     */
    public function customMaps(): HasMany
    {
        return $this->hasMany(CampaignMap::class);
    }

    /**
     * Configuração (ativo, camadas) de cada mapa nesta campanha.
     *
     * @return BelongsToMany<CampaignMap, $this, GameSessionMap>
     */
    public function maps(): BelongsToMany
    {
        return $this->belongsToMany(CampaignMap::class, 'game_session_maps')
            ->using(GameSessionMap::class)
            ->withPivot(['active', 'layer_settings'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<Talent, $this>
     */
    public function talents(): HasMany
    {
        return $this->hasMany(Talent::class);
    }

    /**
     * @return HasMany<Skill, $this>
     */
    public function skills(): HasMany
    {
        return $this->hasMany(Skill::class);
    }

    /**
     * @return HasMany<Power, $this>
     */
    public function powers(): HasMany
    {
        return $this->hasMany(Power::class);
    }
}
