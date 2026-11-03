<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sugestão de traço, perícia ou poder feita por um jogador.
 * O status é alterado apenas pela moderação, fora do $fillable.
 */
#[Fillable(['type', 'data'])]
#[Hidden(['firestore_id'])]
class Suggestion extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => SuggestionType::class,
            'status' => SuggestionStatus::class,
            'data' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
