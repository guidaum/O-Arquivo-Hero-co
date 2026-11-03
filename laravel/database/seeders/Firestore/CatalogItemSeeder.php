<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\CatalogItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class CatalogItemSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $documents = FirestoreDump::collection('itemCatalog');

        foreach ($documents as $document) {
            $data = $document['data'];
            $stats = $data['stats'] ?? null;
            $createdAt = $this->timestamp($data['createdAt'] ?? null)
                ?? $this->timestamp($data['lastUpdated'] ?? null)
                ?? now();

            $this->upsertByFirestoreId(CatalogItem::class, $document['id'], [
                'created_by' => $this->localId(User::class, $data['createdBy'] ?? null),
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Item sem nome',
                'category' => $this->nullableString($data['category'] ?? null, 64) ?? 'Geral',
                'rarity' => $this->nullableString($data['rarity'] ?? null, 32),
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'damage' => $this->nullableString($data['damage'] ?? null, 64),
                'defense' => $this->integer($data['defense'] ?? null),
                'weight' => $this->number($data['weight'] ?? null),
                'value' => max(0, $this->integer($data['value'] ?? null)),
                // O Firebase guardava stats ora como objeto, ora como texto livre.
                'stats' => is_array($stats) && $stats !== [] ? $stats : null,
                'bonus_text' => is_string($stats) ? $this->nullableString($stats) : null,
                'image_path' => $this->storeImage($data['image'] ?? null, 'items', $document['id']),
                'is_starting_item' => (bool) ($data['isStartingItem'] ?? false),
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['lastUpdated'] ?? null) ?? $createdAt,
            ]);
        }

        // Relações entre itens, depois que todos existem.
        foreach ($documents as $document) {
            $itemId = $this->localId(CatalogItem::class, $document['id']);
            $relatedIds = $this->localIds(CatalogItem::class, $document['data']['relatedWeapons'] ?? []);

            CatalogItem::query()->find($itemId)?->relatedItems()->sync($relatedIds);
        }

        $this->report('Itens do catálogo', count($documents));
    }
}
