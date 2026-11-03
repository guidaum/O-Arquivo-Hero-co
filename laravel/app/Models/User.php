<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Models\Concerns\HasPublicFiles;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'photo_path', 'bio', 'location', 'phone_number'])]
#[Hidden(['password', 'remember_token', 'firestore_id'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPublicFiles, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_active_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /**
     * Mestres e administradores têm acesso às ferramentas de mestre.
     */
    public function isGm(): bool
    {
        return $this->role === UserRole::Gm || $this->isAdmin();
    }

    /**
     * Usuário importado do Firebase que ainda não definiu senha.
     */
    public function needsPasswordSetup(): bool
    {
        return $this->password === null;
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function photoUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->photo_path));
    }

    /**
     * @return HasMany<GameSession, $this>
     */
    public function gmSessions(): HasMany
    {
        return $this->hasMany(GameSession::class, 'gm_id');
    }

    /**
     * @return BelongsToMany<GameSession, $this>
     */
    public function playerSessions(): BelongsToMany
    {
        return $this->belongsToMany(GameSession::class)->withTimestamps();
    }

    /**
     * @return HasMany<Character, $this>
     */
    public function characters(): HasMany
    {
        return $this->hasMany(Character::class);
    }

    /**
     * @return HasMany<JournalEntry, $this>
     */
    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class);
    }

    /**
     * @return HasMany<Suggestion, $this>
     */
    public function suggestions(): HasMany
    {
        return $this->hasMany(Suggestion::class);
    }
}
