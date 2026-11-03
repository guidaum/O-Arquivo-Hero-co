<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TokenType;
use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'character_id', 'name', 'type', 'avatar_path', 'color', 'x', 'y', 'size',
    'hp', 'max_hp', 'initiative', 'conditions', 'is_hidden',
])]
#[Hidden(['firestore_id'])]
class DungeonToken extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => TokenType::class,
            'x' => 'float',
            'y' => 'float',
            'size' => 'float',
            'hp' => 'integer',
            'max_hp' => 'integer',
            'initiative' => 'integer',
            'conditions' => 'array',
            'is_hidden' => 'boolean',
            'last_moved_at' => 'datetime',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->avatar_path));
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<CampaignMap, $this>
     */
    public function campaignMap(): BelongsTo
    {
        return $this->belongsTo(CampaignMap::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Character, $this>
     */
    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function lastMovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_moved_by');
    }
}
