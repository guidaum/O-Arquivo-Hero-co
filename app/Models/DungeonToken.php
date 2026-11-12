<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TokenType;
use App\Models\Concerns\BumpsBoardVersion;
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
    use BumpsBoardVersion;
    use HasPublicFiles;

    /** Condições (TOKEN_CONDITIONS do sistema antigo): nome, símbolo e cor. */
    public const CONDITIONS = [
        'poisoned' => ['Envenenado', '☠', '#10b981'],
        'stunned' => ['Atordoado', '⚡', '#eab308'],
        'bleeding' => ['Sangrando', '🩸', '#ef4444'],
        'burning' => ['Em Chamas', '🔥', '#f97316'],
        'prone' => ['Caído', '🛌', '#8b5cf6'],
        'blinded' => ['Cego', '👁️', '#64748b'],
        'frightened' => ['Aterrorizado', '😱', '#d946ef'],
        'invisible' => ['Invisível', '👻', '#38bdf8'],
        'blessed' => ['Abençoado', '✨', '#06b6d4'],
        'weakened' => ['Enfraquecido', '🛡️', '#a8a29e'],
    ];

    /** Relações que toBoardArray() usa (retrato da ficha, foto do dono, quem moveu). */
    public const BOARD_RELATIONS = ['lastMovedBy:id,name', 'character:id,user_id,game_session_id,image_path', 'user:id,photo_path'];

    /** Cores dos tokens de jogador, em ordem de entrada. */
    public const PLAYER_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#f97316', '#14b8a6'];

    /** Criaturas rápidas do mestre (MONSTER_PRESETS). O bestiário completo vem com o painel do mestre. */
    public const PRESETS = [
        'goblin' => ['Goblin Espreitador', 'monster', 8, '#ef4444', 1],
        'skeleton' => ['Esqueleto Guerreiro', 'monster', 14, '#a855f7', 1],
        'cultist' => ['Cultista do Caos', 'monster', 18, '#f97316', 1],
        'orc' => ['Orc Brutamontes', 'monster', 28, '#eab308', 1],
        'dragon' => ['Dragão Carmesim', 'monster', 85, '#dc2626', 2],
        'chest' => ['Baú de Relíquias', 'npc', 10, '#38bdf8', 1],
        'guide' => ['Guia / NPC Aliado', 'npc', 22, '#10b981', 1],
    ];

    /**
     * Dados para o navegador.
     *
     * @return array<string, mixed>
     */
    public function toBoardArray(User $viewer, bool $isGm): array
    {
        $mine = $this->user_id !== null && $this->user_id === $viewer->id;
        $type = $this->typeKey();
        $character = $this->relationLoaded('character') ? $this->character : null;

        // Ficha no popup: o mestre abre a de qualquer personagem da campanha;
        // jogadores, só as fichas de personagens de jogador (não as de NPCs/monstros).
        $sheetUrl = $character !== null
            && $character->game_session_id === $this->game_session_id
            && ($isGm || $type === TokenType::Player->value || $character->user_id === $viewer->id)
                ? route('characters.show', $character->id)
                : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $type,
            'color' => $this->color ?: '#38bdf8',
            'avatar_url' => $this->portraitUrl(),
            'sheet_url' => $sheetUrl,
            'x' => $this->x,
            'y' => $this->y,
            'size' => $this->size ?: 1,
            'hp' => $this->hp,
            'max_hp' => $this->max_hp,
            'initiative' => $this->initiative,
            'conditions' => array_values(array_intersect((array) $this->conditions, array_keys(self::CONDITIONS))),
            'is_hidden' => $this->is_hidden,
            'character_id' => $this->character_id,
            'mine' => $mine,
            'can_control' => $isGm || $mine,
            'moved_by' => $this->lastMovedBy?->name,
        ];
    }

    public function typeKey(): string
    {
        return $this->type instanceof \BackedEnum ? $this->type->value : (string) $this->type;
    }

    /** Token de jogador controlado por este usuário (o próprio personagem). */
    public function isPlayerTokenOf(User $user): bool
    {
        return $this->typeKey() === TokenType::Player->value && $this->user_id !== null && $this->user_id === $user->id;
    }

    /**
     * Imagem do token: o retrato atual da ficha (o token guardava só o da
     * entrada no mapa), depois a imagem própria do token e, para jogadores,
     * a foto do perfil do dono.
     */
    public function portraitUrl(): ?string
    {
        $character = $this->relationLoaded('character') ? $this->character : null;
        $owner = $this->relationLoaded('user') ? $this->user : null;

        return $character?->image_url
            ?? $this->avatar_url
            ?? ($this->typeKey() === TokenType::Player->value ? $owner?->photo_url : null);
    }

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
