<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\CampaignLibraryEntry;
use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'name', 'category', 'rarity', 'description', 'damage', 'defense',
    'weight', 'value', 'stats', 'bonus_text', 'image_path', 'is_starting_item',
])]
#[Hidden(['firestore_id'])]
class CatalogItem extends Model
{
    use CampaignLibraryEntry;
    use HasPublicFiles;

    /** Categorias do sistema antigo (valor gravado => rótulo). */
    public const CATEGORIES = [
        'weapons' => 'Armas',
        'armor' => 'Armaduras',
        'ammo' => 'Munição',
        'consumables' => 'Consumíveis',
        'misc' => 'Diversos',
        'Geral' => 'Geral',
    ];

    /** Raridades do sistema antigo (valor gravado => rótulo). */
    public const RARITIES = [
        'Common' => 'Comum',
        'Uncommon' => 'Incomum',
        'Rare' => 'Raro',
        'Epic' => 'Épico',
        'Legendary' => 'Lendário',
    ];

    /** Categorias que se acumulam em pilha (quantidade) no inventário. */
    public const STACKABLE_CATEGORIES = ['ammo', 'consumables'];

    /**
     * Raridade gravada em inglês (catálogo) ou em português (inventário
     * antigo) convertida para a chave de RARITIES.
     */
    public static function normalizeRarity(?string $rarity): string
    {
        if ($rarity === null || $rarity === '') {
            return 'Common';
        }

        if (array_key_exists($rarity, self::RARITIES)) {
            return $rarity;
        }

        $key = array_search(mb_strtolower($rarity), array_map('mb_strtolower', self::RARITIES), true);

        return is_string($key) ? $key : 'Common';
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? (string) $this->category;
    }

    public function rarityLabel(): string
    {
        return self::RARITIES[$this->rarity] ?? (string) ($this->rarity ?: 'Comum');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'defense' => 'integer',
            'weight' => 'decimal:2',
            'value' => 'integer',
            'stats' => 'array',
            'is_starting_item' => 'boolean',
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
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Itens relacionados (ex.: armas que usam esta munição).
     *
     * @return BelongsToMany<CatalogItem, $this>
     */
    public function relatedItems(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'catalog_item_relations', 'catalog_item_id', 'related_item_id');
    }
}
