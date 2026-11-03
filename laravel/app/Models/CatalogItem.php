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

#[Fillable([
    'name', 'category', 'rarity', 'description', 'damage', 'defense',
    'weight', 'value', 'stats', 'bonus_text', 'image_path', 'is_starting_item',
])]
#[Hidden(['firestore_id'])]
class CatalogItem extends Model
{
    use HasPublicFiles;

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
