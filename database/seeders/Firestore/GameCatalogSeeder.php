<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\TraitType;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Talentos, perícias, poderes e traços (vantagens/desvantagens).
 */
class GameCatalogSeeder extends Seeder
{
    use ImportsFirestoreData;

    /** Chaves dos atributos do sistema. */
    private const ATTRIBUTE_KEYS = ['for', 'int', 'cor', 'con', 'per', 'ini', 'agi', 'vel'];

    public function run(): void
    {
        $this->importTalents();
        $this->importSkills();
        $this->importPowers();
        $this->importTraits();
    }

    /**
     * Campos de dono comuns a talentos, perícias e poderes.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function ownership(array $data): array
    {
        $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

        return [
            'game_session_id' => $this->localId(GameSession::class, $data['sessionId'] ?? null),
            'created_by' => $this->localId(User::class, $data['gmId'] ?? null),
            'created_at' => $createdAt,
            'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
        ];
    }

    private function importTalents(): void
    {
        $documents = FirestoreDump::collection('talents');

        foreach ($documents as $document) {
            $data = $document['data'];
            $composition = array_values(array_filter(
                (array) ($data['composition'] ?? []),
                static fn (mixed $key): bool => in_array($key, self::ATTRIBUTE_KEYS, true),
            ));

            $this->upsertByFirestoreId(Talent::class, $document['id'], [
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Talento sem nome',
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'category' => $this->nullableString($data['category'] ?? null, 64),
                'composition' => $composition,
                ...$this->ownership($data),
            ]);
        }

        $this->report('Talentos', count($documents));
    }

    private function importSkills(): void
    {
        $documents = FirestoreDump::collection('skills');

        foreach ($documents as $document) {
            $data = $document['data'];

            $this->upsertByFirestoreId(Skill::class, $document['id'], [
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Perícia sem nome',
                'type' => $this->nullableString($data['type'] ?? null, 64) ?? 'Geral',
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'damage' => $this->nullableString($data['damage'] ?? null, 64),
                'atp_cost' => $this->integer($data['atpCost'] ?? null),
                'purchase_cost' => $this->integer($data['purchaseCost'] ?? null),
                'difficulty_formula' => $this->nullableString($data['difficultyFormula'] ?? null),
                ...$this->ownership($data),
            ]);
        }

        $this->report('Perícias', count($documents));
    }

    private function importPowers(): void
    {
        $documents = FirestoreDump::collection('powers');

        foreach ($documents as $document) {
            $data = $document['data'];

            $this->upsertByFirestoreId(Power::class, $document['id'], [
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Poder sem nome',
                'type' => $this->nullableString($data['type'] ?? null, 64) ?? 'Geral',
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'effect' => $this->nullableString($data['effect'] ?? null, 10000),
                'cost' => $this->nullableString($data['cost'] ?? null, 64),
                'purchase_cost' => $this->integer($data['purchaseCost'] ?? null),
                'difficulty_formula' => $this->nullableString($data['difficultyFormula'] ?? null),
                ...$this->ownership($data),
            ]);
        }

        $this->report('Poderes', count($documents));
    }

    private function importTraits(): void
    {
        $documents = FirestoreDump::collection('traits');

        foreach ($documents as $document) {
            $data = $document['data'];
            $target = (string) ($data['modifierType'] ?? '');
            $isAttribute = in_array($target, self::ATTRIBUTE_KEYS, true);
            $createdAt = $this->timestamp($data['createdAt'] ?? null) ?? now();

            $this->upsertByFirestoreId(CharacterTrait::class, $document['id'], [
                'name' => $this->nullableString($data['name'] ?? null) ?? 'Traço sem nome',
                'type' => TraitType::tryFrom((string) ($data['type'] ?? '')) ?? TraitType::Advantage,
                'description' => $this->nullableString($data['description'] ?? null, 10000),
                'effect' => $this->nullableString($data['effect'] ?? null, 10000),
                'modifier' => $this->integer($data['modifier'] ?? null),
                // No Firebase, modifierType guardava uma chave de atributo ou o ID de um talento.
                'modifier_attribute' => $isAttribute ? $target : null,
                'modifier_talent_id' => $isAttribute ? null : $this->localId(Talent::class, $target),
                'purchase_cost' => isset($data['purchaseCost']) ? $this->integer($data['purchaseCost']) : null,
                'created_at' => $createdAt,
                'updated_at' => $this->timestamp($data['updatedAt'] ?? null) ?? $createdAt,
            ]);
        }

        $this->report('Traços', count($documents));
    }
}
