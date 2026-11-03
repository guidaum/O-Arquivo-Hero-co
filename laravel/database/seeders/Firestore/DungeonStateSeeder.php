<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\TokenType;
use App\Models\Character;
use App\Models\DungeonAtmosphere;
use App\Models\DungeonFog;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Estado do battlemap: tokens, névoa de guerra e atmosfera.
 *
 * No Firebase o estado era indexado pela chave "session_{sessão}_{mapa}".
 * Registros sem campanha (ex.: "dungeon_catacombs") ou sem mapa ("none")
 * são de testes antigos e são ignorados.
 */
class DungeonStateSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $this->importTokens();
        $this->importFog();
        $this->importAtmospheres();
    }

    /**
     * @return array{0: int, 1: int}|null [sessão, mapa]
     */
    private function resolveScope(mixed $dungeonKey): ?array
    {
        [$sessionKey, $mapKey] = $this->splitDungeonKey($dungeonKey);
        $sessionId = $this->localId(GameSession::class, $sessionKey);
        $mapId = $this->campaignMapId($mapKey);

        return $sessionId !== null && $mapId !== null ? [$sessionId, $mapId] : null;
    }

    private function importTokens(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('dungeonTokens') as $document) {
            $data = $document['data'];
            $scope = $this->resolveScope($data['dungeonId'] ?? null);

            if ($scope === null) {
                $skipped++;

                continue;
            }

            $movedAt = $this->timestamp($data['lastMovedAt'] ?? null) ?? now();

            $this->upsertByFirestoreId(DungeonToken::class, $document['id'], [
                'game_session_id' => $scope[0],
                'campaign_map_id' => $scope[1],
                'user_id' => $this->localId(User::class, $data['userId'] ?? null),
                'character_id' => $this->localId(Character::class, $data['characterId'] ?? null),
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Token',
                'type' => TokenType::tryFrom((string) ($data['type'] ?? '')) ?? TokenType::Player,
                'avatar_path' => $this->storeImage($data['avatar'] ?? null, 'tokens', $document['id']),
                'color' => $this->nullableString($data['color'] ?? null, 32),
                'x' => $this->number($data['x'] ?? null),
                'y' => $this->number($data['y'] ?? null),
                'size' => max(0.25, $this->number($data['size'] ?? null, 1.0)),
                'hp' => $this->integer($data['hp'] ?? null),
                'max_hp' => $this->integer($data['maxHp'] ?? null),
                'initiative' => $this->integer($data['initiative'] ?? null),
                'conditions' => is_array($data['conditions'] ?? null) ? array_values($data['conditions']) : null,
                'is_hidden' => (bool) (($data['isHidden'] ?? false) || ($data['hidden'] ?? false)),
                'last_moved_by' => $this->localId(User::class, $data['lastMovedBy'] ?? null),
                'last_moved_at' => $movedAt,
                'created_at' => $movedAt,
                'updated_at' => $movedAt,
            ]);

            $imported++;
        }

        $this->report('Tokens do battlemap', $imported, $skipped);
    }

    private function importFog(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('dungeonFog') as $document) {
            $data = $document['data'];
            $scope = $this->resolveScope($data['dungeonId'] ?? $document['id']);

            if ($scope === null) {
                $skipped++;

                continue;
            }

            $updatedAt = $this->timestamp($data['updatedAt'] ?? null) ?? now();
            $fog = DungeonFog::query()->firstOrNew([
                'game_session_id' => $scope[0],
                'campaign_map_id' => $scope[1],
            ]);

            $fog->forceFill([
                'enabled' => (bool) ($data['enabled'] ?? true),
                'revealed_cells' => array_values(array_map('intval', array_filter((array) ($data['revealedCells'] ?? []), 'is_numeric'))),
                'updated_by' => $this->localId(User::class, $data['updatedBy'] ?? null),
                'created_at' => $fog->created_at ?? $updatedAt,
                'updated_at' => $updatedAt,
            ])->save();

            $imported++;
        }

        $this->report('Névoa de guerra', $imported, $skipped);
    }

    private function importAtmospheres(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('dungeonAtmosphere') as $document) {
            $data = $document['data'];

            // O ID do documento é a chave do battlemap ou, para o padrão da campanha, o ID da sessão.
            $scope = $this->resolveScope($document['id']);
            $sessionId = $scope[0] ?? $this->localId(GameSession::class, $document['id']);

            if ($sessionId === null) {
                $skipped++;

                continue;
            }

            $updatedAt = $this->timestamp($data['updatedAt'] ?? null) ?? now();
            $atmosphere = DungeonAtmosphere::query()->firstOrNew([
                'game_session_id' => $sessionId,
                'campaign_map_id' => $scope[1] ?? null,
            ]);

            $atmosphere->forceFill([
                'soundscape' => $this->nullableString($data['soundscape'] ?? null, 64),
                'weather' => $this->nullableString($data['weather'] ?? null, 64),
                'volume' => min(100, max(0, $this->integer($data['volume'] ?? null, 50))),
                'custom_ambient_name' => $this->nullableString($data['customAmbientName'] ?? null),
                'custom_ambient_path' => $this->nullableString($data['customAmbientUrl'] ?? null),
                'created_at' => $atmosphere->created_at ?? $updatedAt,
                'updated_at' => $updatedAt,
            ])->save();

            $imported++;
        }

        $this->report('Atmosfera das masmorras', $imported, $skipped);
    }
}
