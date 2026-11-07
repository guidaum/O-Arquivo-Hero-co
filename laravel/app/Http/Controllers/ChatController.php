<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\DiceRoller;
use App\Models\Character;
use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Chat da Sessão (SessionChat.tsx). O navegador consulta as mensagens por
 * polling (public/js/core/realtime.js) informando a última que já tem.
 */
class ChatController extends Controller
{
    /**
     * Mensagens depois de ?depois=<id> (ou as últimas 100 na primeira leitura).
     */
    public function index(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('view', $gameSession);

        $user = $request->user();
        $after = max(0, $request->integer('depois'));
        $query = $gameSession->chatMessages()
            ->withExists(['mentions as mentions_me' => static fn (Builder $query) => $query->whereKey($user->id)]);

        $messages = $after > 0
            ? $query->where('id', '>', $after)->orderBy('id')->limit(ChatMessage::HISTORY_LIMIT)->get()
            : $query->orderByDesc('id')->limit(ChatMessage::HISTORY_LIMIT)->get()->reverse()->values();

        return response()->json([
            'messages' => $messages->map(static fn (ChatMessage $message): array => $message->toChatArray($user))->all(),
            'cursor' => $messages->last()?->id ?? $after,
            'cleared_at' => $gameSession->chat_cleared_at?->toIso8601String(),
        ]);
    }

    public function store(Request $request, GameSession $gameSession, DiceRoller $roller): JsonResponse
    {
        Gate::authorize('view', $gameSession);

        $user = $request->user();
        $data = $request->validate([
            'text' => ['nullable', 'string', 'max:2000'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:4096'],
            'image_url' => ['nullable', 'url:http,https', 'max:2048'],
            'character_id' => ['nullable', 'integer'],
        ], [], [
            'text' => 'mensagem',
            'image' => 'imagem',
            'image_url' => 'link da imagem',
        ]);

        $text = trim((string) ($data['text'] ?? ''));
        $hasImage = $request->hasFile('image') || filled($data['image_url'] ?? null);

        if ($text === '' && ! $hasImage) {
            throw ValidationException::withMessages(['text' => 'Escreva uma mensagem ou anexe uma imagem.']);
        }

        $character = $this->speaker($gameSession, $user, isset($data['character_id']) ? (int) $data['character_id'] : null);
        $senderName = $character?->name ?? $user->name;

        // "/r 2d6+FOR": rolagem com os atributos do personagem.
        if (preg_match('/^\/r\s+(.+)$/su', $text, $match)) {
            $formula = trim($match[1]);
            $roll = $roller->rollFormula($formula, $character?->rollStats() ?? []);

            $message = ChatMessage::post($gameSession, $user, $senderName, [
                'type' => ChatMessage::TYPE_ROLL,
                'text' => 'Rolou: '.$formula,
                'roll_data' => [
                    'total' => $roll->total,
                    'formula' => $formula,
                    'details' => $roll->detail,
                    'rolls' => $roll->rolls,
                ],
            ]);

            return $this->created($message, $user);
        }

        $mentions = array_values(array_diff($gameSession->mentionedUserIds($text), [$user->id]));

        $message = DB::transaction(function () use ($request, $gameSession, $user, $senderName, $text, $data, $mentions): ChatMessage {
            $message = ChatMessage::post($gameSession, $user, $senderName, [
                'text' => $text,
                'image_path' => $request->hasFile('image')
                    ? $request->file('image')->store('chat', 'public')
                    : ($data['image_url'] ?? null),
                'should_notify' => $mentions !== [],
            ]);
            $message->mentions()->attach($mentions);

            return $message;
        });

        return $this->created($message, $user);
    }

    /**
     * Limpar o chat (só o mestre). Quem está com o chat aberto percebe pela data em cleared_at.
     */
    public function clear(GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $files = [];

        DB::transaction(function () use ($gameSession, &$files): void {
            $files = $gameSession->chatMessages()
                ->whereNotNull('image_path')
                ->get(['id', 'image_path'])
                ->filter(static fn (ChatMessage $message): bool => $message->hasStoredImage())
                ->pluck('image_path')
                ->all();

            $gameSession->chatMessages()->delete();
            $gameSession->forceFill(['chat_cleared_at' => now()])->save();
        });

        if ($files !== []) {
            Storage::disk('public')->delete($files);
        }

        return response()->json([
            'message' => 'O chat foi limpo.',
            'cleared_at' => $gameSession->chat_cleared_at?->toIso8601String(),
        ]);
    }

    /**
     * Personagem em nome de quem o usuário fala: um personagem dele nesta campanha.
     */
    private function speaker(GameSession $session, User $user, ?int $characterId): ?Character
    {
        if ($characterId === null) {
            return null;
        }

        return Character::query()
            ->whereKey($characterId)
            ->where('user_id', $user->id)
            ->where('game_session_id', $session->id)
            ->first(['id', 'name', 'stats', 'stats_mods']);
    }

    private function created(ChatMessage $message, User $user): JsonResponse
    {
        return response()->json(['message' => $message->toChatArray($user)], 201);
    }
}
