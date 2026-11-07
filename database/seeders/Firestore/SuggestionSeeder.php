<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Models\Suggestion;
use App\Models\User;
use Illuminate\Database\Seeder;

class SuggestionSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('suggestions') as $document) {
            $data = $document['data'];
            $type = SuggestionType::tryFrom((string) ($data['type'] ?? ''));

            if ($type === null || ! is_array($data['data'] ?? null)) {
                $skipped++;

                continue;
            }

            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $this->upsertByFirestoreId(Suggestion::class, $document['id'], [
                'user_id' => $this->localId(User::class, $data['suggestedBy'] ?? null),
                'type' => $type,
                'status' => SuggestionStatus::tryFrom((string) ($data['status'] ?? '')) ?? SuggestionStatus::Pending,
                'data' => $data['data'],
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $imported++;
        }

        $this->report('Sugestões', $imported, $skipped);
    }
}
