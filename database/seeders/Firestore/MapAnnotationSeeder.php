<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\GameSession;
use App\Models\MapDrawing;
use App\Models\MapPin;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Pins do mapa do mundo e desenhos (mapDrawings e dungeonDrawings).
 * Pings não são importados: são sinalizações temporárias.
 */
class MapAnnotationSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $this->importPins();
        $this->importDrawings();
    }

    private function importPins(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('mapPins') as $document) {
            $data = $document['data'];
            $sessionId = $this->localId(GameSession::class, $data['sessionId'] ?? null);
            $mapId = $this->campaignMapId($data['mapId'] ?? null);

            if ($sessionId === null || $mapId === null) {
                $skipped++;

                continue;
            }

            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $this->upsertByFirestoreId(MapPin::class, $document['id'], [
                'game_session_id' => $sessionId,
                'campaign_map_id' => $mapId,
                'created_by' => $this->localId(User::class, $data['createdBy'] ?? null),
                'title' => $this->nullableString($data['title'] ?? null) ?? 'Local',
                'category' => $this->nullableString($data['category'] ?? null, 32),
                'custom_icon' => $this->nullableString($data['customIcon'] ?? null, 64),
                'danger_level' => $this->nullableString($data['dangerLevel'] ?? null, 32),
                'status' => $this->nullableString($data['status'] ?? null, 32),
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'secrets' => $this->nullableString($data['secrets'] ?? null, 10000),
                'image_path' => $this->storeImage($data['image'] ?? null, 'pins', $document['id']),
                'tags' => is_array($data['tags'] ?? null) ? array_values($data['tags']) : null,
                'is_secret' => (bool) ($data['isSecret'] ?? false),
                'discovered_by_name' => $this->nullableString($data['discoveredBy'] ?? null),
                'discovered_on' => $this->date($data['discoveredDate'] ?? null),
                'x' => $this->number($data['x'] ?? null),
                'y' => $this->number($data['y'] ?? null),
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
            ]);

            $imported++;
        }

        $this->report('Pins do mapa', $imported, $skipped);
    }

    private function importDrawings(): void
    {
        $imported = 0;
        $skipped = 0;
        $documents = [
            ...FirestoreDump::collection('mapDrawings'),
            ...FirestoreDump::collection('dungeonDrawings'),
        ];

        foreach ($documents as $document) {
            $data = $document['data'];

            // Nas masmorras, mapId vem no formato "session_{sessão}_{mapa}".
            [$sessionKey, $mapKey] = $this->splitDungeonKey($data['mapId'] ?? null);
            $sessionId = $this->localId(GameSession::class, $sessionKey ?? ($data['sessionId'] ?? null));
            $mapId = $this->campaignMapId($mapKey ?? ($data['mapId'] ?? null));
            $points = array_values(array_filter((array) ($data['points'] ?? []), 'is_array'));

            if ($sessionId === null || $mapId === null || $points === []) {
                $skipped++;

                continue;
            }

            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $this->upsertByFirestoreId(MapDrawing::class, $document['id'], [
                'game_session_id' => $sessionId,
                'campaign_map_id' => $mapId,
                'user_id' => $this->localId(User::class, $data['authorId'] ?? null),
                'points' => $points,
                'color' => $this->nullableString($data['color'] ?? null, 32) ?? '#000000',
                'fill_color' => $this->nullableString($data['fillColor'] ?? null, 32),
                'size' => max(1, $this->integer($data['size'] ?? null, 3)),
                'is_closed' => (bool) ($data['isClosed'] ?? false),
                'is_polygon' => (bool) ($data['isPolygon'] ?? false),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $imported++;
        }

        $this->report('Desenhos nos mapas', $imported, $skipped);
    }
}
