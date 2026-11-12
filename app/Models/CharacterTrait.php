<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TraitType;
use App\Models\Concerns\CampaignLibraryEntry;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Vantagem ou desvantagem. Chamado CharacterTrait porque "Trait" é
 * palavra reservada no PHP.
 */
#[Table('traits')]
#[Fillable(['name', 'type', 'description', 'effect', 'modifier', 'modifier_attribute', 'modifier_talent_id', 'purchase_cost'])]
#[Hidden(['firestore_id'])]
class CharacterTrait extends Model
{
    use CampaignLibraryEntry;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => TraitType::class,
            'modifier' => 'integer',
            'purchase_cost' => 'integer',
        ];
    }

    /**
     * Talento afetado pelo modificador, quando o alvo não é um atributo.
     *
     * @return BelongsTo<Talent, $this>
     */
    public function modifierTalent(): BelongsTo
    {
        return $this->belongsTo(Talent::class, 'modifier_talent_id');
    }

    /**
     * @return BelongsToMany<Character, $this>
     */
    public function characters(): BelongsToMany
    {
        return $this->belongsToMany(Character::class, 'character_trait', 'trait_id', 'character_id');
    }
}
