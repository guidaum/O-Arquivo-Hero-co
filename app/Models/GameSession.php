<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MapType;
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
            'chat_cleared_at' => 'datetime',
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
     * Mapas da campanha de um tipo (resolveCampaignMaps do sistema antigo):
     * os personalizados da campanha primeiro, depois os padrão. Cada mapa
     * recebe "active_in_session" (ativação do mestre na campanha, ou a do
     * próprio mapa quando não há configuração) e "layer_settings".
     *
     * @return \Illuminate\Support\Collection<int, CampaignMap>
     */
    public function mapsOfType(MapType $type): \Illuminate\Support\Collection
    {
        $settings = $this->maps()->where('type', $type)->get()->keyBy('id');

        return CampaignMap::query()
            ->availableTo($this)
            ->ofType($type)
            ->orderByRaw('preset_key is null desc')
            ->orderBy('id')
            ->get()
            ->each(static function (CampaignMap $map) use ($settings): void {
                $pivot = $settings->get($map->id)?->pivot;
                $map->setAttribute('active_in_session', $pivot !== null ? (bool) $pivot->active : $map->active);
                $map->setAttribute('session_layer_settings', $pivot?->layer_settings);
            });
    }

    /**
     * Liga ou desliga um mapa nesta campanha (mapSettings.{id}.active no sistema antigo).
     */
    public function setMapActive(CampaignMap $map, bool $active): void
    {
        if ($this->maps()->whereKey($map->id)->exists()) {
            $this->maps()->updateExistingPivot($map->id, ['active' => $active]);
        } else {
            $this->maps()->attach($map->id, ['active' => $active]);
        }
    }

    /**
     * Quem pode ser mencionado no chat (SessionChat.tsx): o mestre (também
     * como "@GM" e "@Mestre"), os jogadores e os personagens da campanha,
     * cada um apontando para o usuário dono. A "handle" é o nome sem espaços.
     *
     * @return list<array{user_id: int, name: string, handle: string, gm: bool}>
     */
    public function chatParticipants(): array
    {
        $entries = [];
        $add = static function (int $userId, string $name, bool $gm) use (&$entries): void {
            $handle = self::mentionHandle($name);

            if ($handle !== '' && ! isset($entries[$handle])) {
                $entries[$handle] = ['user_id' => $userId, 'name' => $name, 'handle' => $handle, 'gm' => $gm];
            }
        };

        $gm = $this->gm()->first(['id', 'name']);

        if ($gm !== null) {
            $add($gm->id, 'GM', true);
            $add($gm->id, 'Mestre', true);
            $add($gm->id, $gm->name, true);
        }

        foreach ($this->characters()->whereNotNull('user_id')->orderBy('name')->get(['id', 'name', 'user_id']) as $character) {
            $add($character->user_id, $character->name, $character->user_id === $this->gm_id);
        }

        foreach ($this->players()->orderBy('name')->get(['users.id', 'users.name']) as $player) {
            $add($player->id, $player->name, false);
        }

        return array_values($entries);
    }

    /**
     * Usuários citados com @nome no texto (sem repetição).
     *
     * @return list<int>
     */
    public function mentionedUserIds(string $text): array
    {
        if (! preg_match_all('/@([\p{L}\p{N}_]+)/u', $text, $matches)) {
            return [];
        }

        $byHandle = collect($this->chatParticipants())->keyBy('handle');

        return collect($matches[1])
            ->map(static fn (string $mention): ?int => $byHandle->get(self::mentionHandle($mention))['user_id'] ?? null)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public static function mentionHandle(string $name): string
    {
        return mb_strtolower((string) preg_replace('/\s+/u', '', $name));
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
     * Anotações rápidas do mestre.
     *
     * @return HasMany<GameSessionNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(GameSessionNote::class);
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
