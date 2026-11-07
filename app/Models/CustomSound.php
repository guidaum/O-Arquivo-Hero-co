<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'category', 'type', 'source_type', 'path', 'size', 'format', 'duration', 'system_sound_key'])]
#[Hidden(['firestore_id'])]
class CustomSound extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'duration' => 'float',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->path));
    }

    /**
     * Biblioteca visível ao mestre numa campanha: os sons da campanha e os
     * sons pessoais dele (sem campanha), que valem em todas as que mestra.
     *
     * @param  Builder<CustomSound>  $query
     */
    public function scopeAvailableTo(Builder $query, User $user, GameSession $session): void
    {
        $query->where(static function (Builder $query) use ($user, $session): void {
            $query->where('game_session_id', $session->id)
                ->orWhere(static fn (Builder $query) => $query->whereNull('game_session_id')->where('user_id', $user->id));
        });
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
