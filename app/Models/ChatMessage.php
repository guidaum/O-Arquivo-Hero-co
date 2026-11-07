<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Remetente e sessão são definidos pelo controller, nunca pela requisição.
 */
#[Fillable(['type', 'text', 'image_path', 'roll_data', 'should_notify'])]
#[Hidden(['firestore_id'])]
class ChatMessage extends Model
{
    use HasPublicFiles;

    public const TYPE_TEXT = 'text';

    public const TYPE_ROLL = 'roll';

    /** Avisos automáticos (ex.: arma sem munição). */
    public const TYPE_SYSTEM = 'system';

    /** Mensagens entregues na primeira leitura do chat (como no sistema antigo). */
    public const HISTORY_LIMIT = 100;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'roll_data' => 'array',
            'should_notify' => 'boolean',
        ];
    }

    /**
     * Grava uma mensagem na sessão em nome do usuário (ou de um personagem dele).
     *
     * @param  array<string, mixed>  $attributes  type, text, image_path, roll_data
     */
    public static function post(GameSession $session, ?User $user, string $senderName, array $attributes): self
    {
        $message = new self([
            'type' => self::TYPE_TEXT,
            'should_notify' => false,
            ...$attributes,
        ]);
        $message->game_session_id = $session->id;
        $message->user_id = $user?->id;
        $message->sender_name = mb_substr($senderName, 0, 255);
        $message->save();

        return $message;
    }

    /**
     * Mensagem de rolagem no formato do sistema antigo ("Rolou Força [Normal]: 7").
     *
     * @param  list<array{die: string, values: list<int>}>  $rolls
     */
    public static function postRoll(GameSession $session, User $user, string $senderName, string $label, int $total, string $formula, array $rolls, ?bool $success = null): self
    {
        return self::post($session, $user, $senderName, [
            'type' => self::TYPE_ROLL,
            'text' => 'Rolou '.$label.': '.$total,
            'roll_data' => array_filter([
                'total' => $total,
                'formula' => $formula,
                'details' => self::describeRolls($rolls),
                'rolls' => $rolls,
                'success' => $success,
            ], static fn (mixed $value): bool => $value !== null),
        ]);
    }

    /**
     * "1D20: [7] | 2D6: [3, 5]".
     *
     * @param  list<array{die: string, values: list<int>}>  $rolls
     */
    public static function describeRolls(array $rolls): string
    {
        return collect($rolls)
            ->map(static fn (array $die): string => $die['die'].': ['.implode(', ', $die['values']).']')
            ->implode(' | ');
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    /**
     * Imagem enviada para o disco público (não uma URL externa).
     */
    public function hasStoredImage(): bool
    {
        return $this->image_path !== null && $this->image_path !== '' && ! str_starts_with($this->image_path, 'http');
    }

    /**
     * Dados enviados ao navegador. $mentions_me vem de withExists na consulta.
     *
     * @return array<string, mixed>
     */
    public function toChatArray(User $viewer): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'text' => (string) $this->text,
            'image_url' => $this->image_url,
            'sender_name' => $this->sender_name,
            'mine' => $this->user_id !== null && $this->user_id === $viewer->id,
            'mentions_me' => (bool) ($this->mentions_me ?? false),
            'roll' => $this->rollForDisplay(),
            'created_at' => $this->created_at?->toIso8601String(),
            'time' => $this->created_at?->timezone(config('app.timezone'))->format('H:i'),
        ];
    }

    /**
     * Rolagens novas guardam "success"; as importadas do Firebase guardam "outcome".
     *
     * @return array<string, mixed>|null
     */
    private function rollForDisplay(): ?array
    {
        $data = $this->roll_data;

        if (! is_array($data) || $data === []) {
            return null;
        }

        $success = $data['success'] ?? match ($data['outcome'] ?? null) {
            'success', 'critical' => true,
            'failure', 'fumble' => false,
            default => null,
        };

        return [
            'total' => is_numeric($data['total'] ?? null) ? (int) $data['total'] : null,
            'formula' => (string) ($data['formula'] ?? ''),
            'details' => is_string($data['details'] ?? null) ? $data['details'] : '',
            'success' => is_bool($success) ? $success : null,
        ];
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

    /**
     * @return BelongsToMany<User, $this>
     */
    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'chat_message_mentions');
    }
}
