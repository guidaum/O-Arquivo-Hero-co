<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Item no inventário de um personagem: cópia editável, opcionalmente
 * ligada ao item do catálogo de onde veio.
 */
#[Fillable([
    'catalog_item_id', 'name', 'category', 'rarity', 'description', 'damage',
    'defense', 'weight', 'value', 'ammo', 'quantity', 'equipped', 'stats', 'image_path',
])]
class CharacterItem extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'defense' => 'integer',
            'weight' => 'float',
            'value' => 'integer',
            'quantity' => 'integer',
            'equipped' => 'boolean',
            'position' => 'integer',
            'stats' => 'array',
        ];
    }

    /**
     * Categoria do item. Itens antigos sem categoria são deduzidos como no
     * sistema antigo: com defesa é armadura, com dano é arma, senão diversos.
     */
    public function categoryKey(): string
    {
        if (is_string($this->category) && array_key_exists($this->category, CatalogItem::CATEGORIES) && $this->category !== 'Geral') {
            return $this->category;
        }

        return match (true) {
            $this->defense > 0 => 'armor',
            filled($this->damage) => 'weapons',
            default => 'misc',
        };
    }

    public function rarityKey(): string
    {
        return CatalogItem::normalizeRarity($this->rarity);
    }

    public function rarityLabel(): string
    {
        return CatalogItem::RARITIES[$this->rarityKey()];
    }

    public function isStackable(): bool
    {
        return in_array($this->categoryKey(), CatalogItem::STACKABLE_CATEGORIES, true);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    /**
     * @return BelongsTo<Character, $this>
     */
    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    /**
     * @return BelongsTo<CatalogItem, $this>
     */
    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(CatalogItem::class);
    }
}
