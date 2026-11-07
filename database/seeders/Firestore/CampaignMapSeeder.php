<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Mapas personalizados (worldMaps e dungeonMaps) e a configuração de cada
 * mapa por campanha (mapSettings das sessões).
 */
class CampaignMapSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $worldMaps = FirestoreDump::collection('worldMaps');
        $dungeonMaps = FirestoreDump::collection('dungeonMaps');

        foreach ($worldMaps as $document) {
            $this->importMap($document['id'], $document['data'], MapType::World);
        }

        foreach ($dungeonMaps as $document) {
            $this->importMap($document['id'], $document['data'], MapType::Dungeon);
        }

        $this->report('Mapas personalizados', count($worldMaps) + count($dungeonMaps));
        $this->report('Configurações de mapa por campanha', $this->importSessionSettings());
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function importMap(string $firestoreId, array $data, MapType $type): void
    {
        $entrance = is_array($data['entranceCoord'] ?? null) ? $data['entranceCoord'] : [];
        $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

        $this->upsertByFirestoreId(CampaignMap::class, $firestoreId, [
            'type' => $type,
            'game_session_id' => $this->localId(GameSession::class, $data['sessionId'] ?? null),
            'created_by' => $this->localId(User::class, $data['createdBy'] ?? null),
            'name' => $this->nullableString($data['name'] ?? null) ?? $type->label(),
            'subtitle' => $this->nullableString($data['subtitle'] ?? null),
            'theme' => $this->nullableString($data['theme'] ?? null, 64),
            'image_path' => $this->storeImage($data['imageUrl'] ?? null, 'maps', $firestoreId),
            'grid_cols' => $type === MapType::Dungeon ? $this->integer($data['gridCols'] ?? null, 24) : null,
            'grid_rows' => $type === MapType::Dungeon ? $this->integer($data['gridRows'] ?? null, 14) : null,
            'entrance_x' => isset($entrance['x']) ? $this->number($entrance['x']) : null,
            'entrance_y' => isset($entrance['y']) ? $this->number($entrance['y']) : null,
            'default_scale' => $this->nullableString($data['defaultScale'] ?? null, 64),
            'active' => (bool) ($data['active'] ?? true),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    private function importSessionSettings(): int
    {
        $count = 0;

        foreach (FirestoreDump::collection('gameSessions') as $document) {
            $session = GameSession::query()->find($this->localId(GameSession::class, $document['id']));
            $settings = $document['data']['mapSettings'] ?? null;

            if ($session === null || ! is_array($settings)) {
                continue;
            }

            $pivot = [];

            foreach ($settings as $mapKey => $setting) {
                $mapId = $this->campaignMapId((string) $mapKey);

                if ($mapId === null || ! is_array($setting)) {
                    continue;
                }

                // O pivô GameSessionMap converte layer_settings para JSON.
                $pivot[$mapId] = [
                    'active' => (bool) ($setting['active'] ?? true),
                    'layer_settings' => is_array($setting['layerSettings'] ?? null) ? $setting['layerSettings'] : null,
                ];
            }

            $session->maps()->sync($pivot);
            $count += count($pivot);
        }

        return $count;
    }
}
