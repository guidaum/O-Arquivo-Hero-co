<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\CampaignLibraryEntry;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// O pluralizador do Laravel trata "talent" como incontável.
#[Table('talents')]
#[Fillable(['name', 'description', 'category', 'composition'])]
#[Hidden(['firestore_id'])]
class Talent extends Model
{
    use CampaignLibraryEntry;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'composition' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
