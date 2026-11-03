<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Personagens com perícias, poderes, traços, equipamentos e notas.
 */
class CharacterSeeder extends Seeder
{
    use ImportsFirestoreData;

    public function run(): void
    {
        $imported = 0;

        foreach (FirestoreDump::collection('characters') as $document) {
            $data = $document['data'];
            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $character = $this->upsertByFirestoreId(Character::class, $document['id'], [
                // Dono ausente no dump: o personagem é mantido sem dono.
                'user_id' => $this->localId(User::class, $data['ownerId'] ?? null),
                'game_session_id' => $this->localId(GameSession::class, $data['sessionId'] ?? null),
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Personagem sem nome',
                'class' => $this->nullableString($data['class'] ?? null),
                'image_path' => $this->storeImage($data['image'] ?? null, 'characters', $document['id']),
                'color' => $this->nullableString($data['color'] ?? null, 32),
                'icon' => $this->nullableString($data['icon'] ?? null, 64),
                'is_npc' => (bool) ($data['isNPC'] ?? false),
                'can_edit_stats' => (bool) ($data['canEditStats'] ?? false),
                'level' => max(1, $this->integer($data['level'] ?? null, 1)),
                'xp' => max(0, $this->integer($data['xp'] ?? null)),
                'xp_max' => max(0, $this->integer($data['xpMax'] ?? null, 1000)),
                'attribute_points' => $this->integer($data['attributePoints'] ?? null),
                'skill_points' => $this->integer($data['skillPoints'] ?? null),
                'power_points' => $this->integer($data['powerPoints'] ?? null),
                'current_pv' => $this->integer($data['currentPV'] ?? null),
                'temp_pv' => $this->integer($data['tempPV'] ?? null),
                'current_atp' => $this->integer($data['currentATP'] ?? null),
                'protection' => $this->integer($data['protecao'] ?? null),
                'awakening' => $this->integer($data['despertar'] ?? null),
                'sanity' => $this->integer($data['sanidade'] ?? null),
                'money' => $this->integer($data['money'] ?? null),
                'base_stats' => $this->numericMap($data['baseStats'] ?? null),
                'stats' => $this->numericMap($data['stats'] ?? null),
                'stats_mods' => $this->numericMap($data['statsMods'] ?? null),
                'talent_mods' => $this->talentMods($data['talentMods'] ?? null),
                'model_sheet_3d' => $this->modelSheet($data['modelSheet3d'] ?? null, $document['id']),
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
            ]);

            $character->skills()->sync($this->pivotWithOverrides(Skill::class, $data['skills'] ?? [], $data['skillOverrides'] ?? []));
            $character->powers()->sync($this->pivotWithOverrides(Power::class, $data['powers'] ?? [], $data['powerOverrides'] ?? []));
            $character->traits()->sync($this->traitIds($data));

            $this->importItems($character, $data['equipment'] ?? []);
            $this->importNotes($character, $data['quickNotes'] ?? []);

            $imported++;
        }

        $this->report('Personagens', $imported);
    }

    /**
     * @return array<string, int|float>|null
     */
    private function numericMap(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        return array_map(
            static fn (mixed $number): int|float => is_numeric($number) ? $number + 0 : 0,
            array_filter($value, 'is_numeric'),
        );
    }

    /**
     * Troca as chaves (IDs de talento do Firestore) pelos IDs locais.
     *
     * @return array<string, int>|null
     */
    private function talentMods(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $mods = [];

        foreach ($value as $firestoreId => $modifier) {
            $talentId = $this->localId(Talent::class, (string) $firestoreId);

            if ($talentId !== null) {
                $mods[(string) $talentId] = $this->integer($modifier);
            }
        }

        return $mods;
    }

    /**
     * @param  class-string<Skill|Power>  $modelClass
     * @return array<int, array{level: int, type: string|null, description: string|null}>
     */
    private function pivotWithOverrides(string $modelClass, mixed $firestoreIds, mixed $overrides): array
    {
        $overrides = is_array($overrides) ? $overrides : [];
        $pivot = [];

        foreach ((array) $firestoreIds as $firestoreId) {
            $id = $this->localId($modelClass, $firestoreId);

            if ($id === null) {
                continue;
            }

            $override = is_array($overrides[$firestoreId] ?? null) ? $overrides[$firestoreId] : [];
            $pivot[$id] = [
                'level' => max(1, $this->integer($override['level'] ?? null, 1)),
                'type' => $this->nullableString($override['type'] ?? null, 64),
                'description' => $this->nullableString($override['description'] ?? null, 10000),
            ];
        }

        return $pivot;
    }

    /**
     * O Firebase guardava os traços em várias listas (IDs e cópias dos objetos).
     *
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    private function traitIds(array $data): array
    {
        $firestoreIds = (array) ($data['traits'] ?? []);

        foreach (['traitObjects', 'advantages', 'disadvantages'] as $list) {
            foreach ((array) ($data[$list] ?? []) as $trait) {
                if (is_array($trait) && isset($trait['id'])) {
                    $firestoreIds[] = $trait['id'];
                }
            }
        }

        return $this->localIds(CharacterTrait::class, $firestoreIds);
    }

    private function importItems(Character $character, mixed $equipment): void
    {
        $character->items()->delete();

        foreach ((array) $equipment as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $character->items()->forceCreate([
                'catalog_item_id' => $this->localId(CatalogItem::class, $item['id'] ?? null),
                'name' => $this->nullableString($item['name'] ?? null) ?? 'Item',
                'category' => $this->nullableString($item['category'] ?? null, 64),
                'rarity' => $this->nullableString($item['rarity'] ?? null, 32),
                'description' => $this->nullableString($item['description'] ?? null, 10000),
                'damage' => $this->nullableString($item['damage'] ?? null, 64),
                'defense' => $this->integer($item['defense'] ?? null),
                'ammo' => $this->nullableString($item['ammo'] ?? null, 64),
                'quantity' => max(1, $this->integer($item['quantity'] ?? null, 1)),
                'equipped' => (bool) ($item['equipped'] ?? false),
                'stats' => is_array($item['stats'] ?? null) && $item['stats'] !== [] ? $item['stats'] : null,
                'image_path' => $this->storeImage($item['image'] ?? null, 'character-items', $character->id.'_'.$index),
            ]);
        }
    }

    private function importNotes(Character $character, mixed $notes): void
    {
        $character->notes()->delete();

        foreach ((array) $notes as $note) {
            if (! is_array($note)) {
                continue;
            }

            $createdAt = $this->timestamp($note['createdAt'] ?? null) ?? now();

            $character->notes()->forceCreate([
                'title' => $this->nullableString($note['title'] ?? null) ?? 'Nota',
                'category' => $this->nullableString($note['category'] ?? null, 64),
                'content' => $this->nullableString($note['content'] ?? null, 65535),
                'pinned' => (bool) ($note['pinned'] ?? false),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }
    }

    /**
     * Ficha 3D: a imagem de referência em base64 vai para o disco.
     *
     * @return array<string, mixed>|null
     */
    private function modelSheet(mixed $sheet, string $characterId): ?array
    {
        if (! is_array($sheet) || $sheet === []) {
            return null;
        }

        if (isset($sheet['referenceImage'])) {
            $sheet['referenceImage'] = $this->storeImage($sheet['referenceImage'], 'characters/3d', $characterId);
        }

        return $sheet;
    }
}
