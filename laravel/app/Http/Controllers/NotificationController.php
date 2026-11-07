<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Sino de notificações (NotificationBell.tsx): menções ao usuário no chat.
 * Consultado por polling; abrir o sino marca tudo como lido.
 */
class NotificationController extends Controller
{
    private const LIMIT = 5;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $mentions = static fn (Builder $query) => $query->whereKey($user->id);

        $messages = ChatMessage::query()
            ->whereHas('mentions', $mentions)
            ->with('gameSession:id,name,gm_id')
            ->orderByDesc('id')
            ->limit(self::LIMIT)
            ->get();

        $unread = ChatMessage::query()
            ->whereHas('mentions', $mentions)
            ->when($user->notifications_seen_at, static fn (Builder $query, $seen) => $query->where('created_at', '>', $seen))
            ->count();

        $characters = $user->characters()
            ->whereIn('game_session_id', $messages->pluck('game_session_id')->unique())
            ->orderBy('id')
            ->pluck('id', 'game_session_id');

        return response()->json([
            'unread' => $unread,
            'items' => $messages->map(fn (ChatMessage $message): array => [
                'id' => $message->id,
                'sender_name' => $message->sender_name,
                'text' => Str::limit((string) $message->text, 160),
                'session' => $message->gameSession?->name,
                'time' => $message->created_at?->timezone(config('app.timezone'))->format('d/m H:i'),
                'url' => $this->chatUrl($message, $user, $characters->get($message->game_session_id)),
            ])->all(),
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->user()->forceFill(['notifications_seen_at' => now()])->save();

        return response()->json(['unread' => 0]);
    }

    /**
     * Onde o chat daquela campanha está aberto: painel do mestre ou ficha do personagem.
     */
    private function chatUrl(ChatMessage $message, User $user, ?int $characterId): ?string
    {
        $session = $message->gameSession;

        if ($session === null) {
            return null;
        }

        if ($session->gm_id === $user->id) {
            return route('gm.sessions.show', ['gameSession' => $session, 'chat' => 1]);
        }

        return $characterId !== null ? route('characters.show', ['character' => $characterId, 'chat' => 1]) : null;
    }
}
