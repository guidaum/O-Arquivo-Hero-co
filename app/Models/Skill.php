<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\CampaignLibraryEntry;
use IlluminateDatabaseloquentAttributesillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'type', 'description', 'damage', 'atp_cost', 'purchase_cost', 'difficulty_formula'])]
#[Hidden(['firestore_id'])]
class Skill extends Model
{
    use CampaignLibraryEntry;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'atp_cost' => 'integer',
            'purchase_cost' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsToMany<Character, $this>
     */
    public function characters(): BelongsToMany
    {
        return $this->belongsToMany(Character::class)->withPivot(['level', 'type', 'description']);
    }
}
