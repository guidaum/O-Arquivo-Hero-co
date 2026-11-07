<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Usuários do Firebase Auth. A senha não é exportada pelo Firebase, então
 * o campo fica nulo até o usuário defini-la no primeiro acesso.
 */
class UserSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $adminEmails = (array) config('arquivo.admin_emails');
        $imported = 0;

        foreach (FirestoreDump::collection('users') as $document) {
            $data = $document['data'];
            $email = strtolower(trim((string) ($data['email'] ?? '')));

            if ($email === '') {
                continue;
            }

            $role = in_array($email, $adminEmails, true)
                ? UserRole::Admin
                : (UserRole::tryFrom((string) ($data['role'] ?? '')) ?? UserRole::User);

            $createdAt = $this->timestamp($data['createdAt'] ?? null)
                ?? $this->timestamp($data['lastActive'] ?? null)
                ?? now();

            $this->upsertByFirestoreId(User::class, $document['id'], [
                'name' => $this->nullableString($data['displayName'] ?? null) ?? strstr($email, '@', true),
                'email' => $email,
                'role' => $role,
                'photo_path' => $this->storeImage($data['photoURL'] ?? null, 'avatars', $document['id']),
                'bio' => $this->nullableString($data['bio'] ?? null, 5000),
                'location' => $this->nullableString($data['location'] ?? null),
                'phone_number' => $this->nullableString($data['phoneNumber'] ?? null, 32),
                'last_active_at' => $this->timestamp($data['lastActive'] ?? null),
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
            ]);

            $imported++;
        }

        $this->report('Usuários', $imported);
    }
}
