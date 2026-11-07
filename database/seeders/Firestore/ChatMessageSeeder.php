<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Database\Seeder;

class ChatMessageSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $imported = 0;
        $skipped = 0;

        foreach (FirestoreDump::collection('chatMessages') as $document) {
            $data = $document['data'];
            $sessionId = $this->localId(GameSession::class, $data['sessionId'] ?? null);

            if ($sessionId === null) {
                $skipped++;

                continue;
            }

            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $message = $this->upsertByFirestoreId(ChatMessage::class, $document['id'], [
                'game_session_id' => $sessionId,
                // Remetente ausente no dump: a mensagem é mantida com o nome exibido.
                'user_id' => $this->localId(User::class, $data['senderId'] ?? null),
                'sender_name' => $this->nullableString($data['senderName'] ?? null) ?? 'Desconhecido',
                'type' => $this->nullableString($data['type'] ?? null, 16) ?? 'text',
                'text' => $this->nullableString($data['text'] ?? null, 65535),
                'image_path' => $this->storeImage($data['image'] ?? null, 'chat', $document['id']),
                'roll_data' => is_array($data['rollData'] ?? null) ? $data['rollData'] : null,
                'should_notify' => (bool) ($data['shouldNotify'] ?? false),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $message->mentions()->sync($this->localIds(User::class, $data['mentionedUserIds'] ?? []));
            $imported++;
        }

        $this->report('Mensagens do chat', $imported, $skipped);
    }
}
