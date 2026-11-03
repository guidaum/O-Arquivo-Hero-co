<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\CatalogItem;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Sessões (campanhas), seus jogadores, a loja e as regras próprias.
 */
class GameSessionSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $imported = 0;

        foreach (FirestoreDump::collection('gameSessions') as $document) {
            $data = $document['data'];
            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $session = $this->upsertByFirestoreId(GameSession::class, $document['id'], [
                // Mestre ausente no dump: a campanha é mantida sem mestre.
                'gm_id' => $this->localId(User::class, $data['gmId'] ?? null),
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Campanha sem nome',
                'code' => $this->nullableString($data['code'] ?? null, 32) ?? Str::upper(Str::random(6)),
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'image_path' => $this->storeImage($data['image'] ?? null, 'sessions', $document['id']),
                'gm_notes' => $this->nullableString($data['gmNotes'] ?? null, 65535),
                'active' => (bool) ($data['active'] ?? true),
                'shop_enabled' => (bool) ($data['shopEnabled'] ?? false),
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
            ]);

            $session->players()->sync($this->localIds(User::class, $data['playerIds'] ?? []));
            // IDs da loja que não existem no catálogo (ex.: itens fixos do código antigo) são ignorados.
            $session->shopItems()->sync($this->localIds(CatalogItem::class, $data['shopItemIds'] ?? []));

            if (RuleSetSeeder::hasRules($data)) {
                RuleSet::query()
                    ->firstOrNew(['game_session_id' => $session->id])
                    ->forceFill(RuleSetSeeder::attributesFrom($data))
                    ->save();
            }

            $imported++;
        }

        $this->report('Sessões', $imported);
    }
}
