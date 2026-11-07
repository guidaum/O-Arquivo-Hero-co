<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\Character;
use App\Models\GameSession;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Database\Seeder;

class JournalEntrySeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $imported = 0;

        foreach (FirestoreDump::collection('journalEntries') as $document) {
            $data = $document['data'];
            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $entry = $this->upsertByFirestoreId(JournalEntry::class, $document['id'], [
                'user_id' => $this->localId(User::class, $data['ownerId'] ?? null),
                'game_session_id' => $this->localId(GameSession::class, $data['gameSessionId'] ?? null),
                'character_id' => $this->localId(Character::class, $data['characterId'] ?? null),
                'title' => $this->nullableString($data['title'] ?? null) ?? 'Registro sem título',
                'session_date' => $this->date($data['date'] ?? null),
                'duration' => $this->nullableString($data['duration'] ?? null, 64),
                'location' => $this->nullableString($data['location'] ?? null),
                'players_count' => max(0, $this->integer($data['playersCount'] ?? null)),
                'content' => $this->nullableString($data['content'] ?? null, 4_000_000),
                'timeline' => array_values(array_filter((array) ($data['timeline'] ?? []), 'is_array')),
                'npcs' => $this->npcs($data['npcs'] ?? [], $document['id']),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $entry->images()->delete();

            foreach (array_values((array) ($data['gallery'] ?? [])) as $position => $image) {
                $path = $this->storeImage($image, 'journal', $document['id'].'_'.$position);

                if ($path !== null) {
                    $entry->images()->forceCreate(['path' => $path, 'position' => $position]);
                }
            }

            $imported++;
        }

        $this->report('Registros do diário', $imported);
    }

    /**
     * NPCs com imagem em base64: a imagem vai para o disco e o campo vira image_path.
     *
     * @return list<array<string, mixed>>
     */
    private function npcs(mixed $npcs, string $entryId): array
    {
        $result = [];

        foreach (array_values((array) $npcs) as $index => $npc) {
            if (! is_array($npc)) {
                continue;
            }

            $npc['image_path'] = $this->storeImage($npc['image'] ?? null, 'journal/npcs', $entryId.'_'.$index);
            unset($npc['image']);
            $result[] = $npc;
        }

        return $result;
    }
}
