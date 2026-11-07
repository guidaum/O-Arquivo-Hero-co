<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\CharacterNote;
use App\Models\GameSession;
use App\Models\GameSessionNote;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Anotações Rápidas (QuickNotes.tsx), usadas via fetch pelo menu de ações.
 * Do personagem: dono ou mestre da campanha (CharacterPolicy::update).
 * Da campanha: só o mestre (GameSessionPolicy::update).
 */
class QuickNoteController extends Controller
{
    public const CATEGORIES = [
        'general' => 'Geral',
        'npc' => 'NPC',
        'hook' => 'Gancho',
        'loot' => 'Loot/Item',
        'location' => 'Local',
    ];

    // Personagem

    public function characterIndex(Character $character): JsonResponse
    {
        Gate::authorize('update', $character);

        return $this->list($character->notes());
    }

    public function characterStore(Request $request, Character $character): JsonResponse
    {
        Gate::authorize('update', $character);

        return $this->create($request, $character->notes(), 'Ideia do Personagem');
    }

    public function characterUpdate(Request $request, Character $character, CharacterNote $note): JsonResponse
    {
        Gate::authorize('update', $character);

        return $this->change($request, $note);
    }

    public function characterDestroy(Character $character, CharacterNote $note): JsonResponse
    {
        Gate::authorize('update', $character);

        return $this->remove($note);
    }

    public function characterClear(Character $character): JsonResponse
    {
        Gate::authorize('update', $character);

        return $this->clearAll($character->notes());
    }

    // Campanha

    public function sessionIndex(GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        return $this->list($gameSession->notes());
    }

    public function sessionStore(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        return $this->create($request, $gameSession->notes(), 'Nota da Campanha');
    }

    public function sessionUpdate(Request $request, GameSession $gameSession, GameSessionNote $note): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        return $this->change($request, $note);
    }

    public function sessionDestroy(GameSession $gameSession, GameSessionNote $note): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        return $this->remove($note);
    }

    public function sessionClear(GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        return $this->clearAll($gameSession->notes());
    }

    // Comum

    /**
     * @param  HasMany<CharacterNote|GameSessionNote, Model>  $notes
     */
    private function list(HasMany $notes): JsonResponse
    {
        return response()->json([
            'notes' => $notes->orderByDesc('pinned')->orderByDesc('id')->get()->map($this->present(...))->all(),
        ]);
    }

    /**
     * @param  HasMany<CharacterNote|GameSessionNote, Model>  $notes
     */
    private function create(Request $request, HasMany $notes, string $defaultTitle): JsonResponse
    {
        $data = $this->validated($request);
        $note = $notes->create([
            ...$data,
            'title' => $data['title'] ?? $defaultTitle,
            'category' => $data['category'] ?? 'general',
            'pinned' => false,
        ]);

        return response()->json(['note' => $this->present($note)], 201);
    }

    private function change(Request $request, CharacterNote|GameSessionNote $note): JsonResponse
    {
        if ($request->has('pinned') && $request->keys() === ['pinned']) {
            $note->update($request->validate(['pinned' => ['required', 'boolean']]));
        } else {
            $data = $this->validated($request);
            $note->update([...$data, 'title' => $data['title'] ?? 'Ideia sem título']);
        }

        return response()->json(['note' => $this->present($note)]);
    }

    private function remove(CharacterNote|GameSessionNote $note): JsonResponse
    {
        $note->delete();

        return response()->json(['message' => 'Anotação excluída.']);
    }

    /**
     * @param  HasMany<CharacterNote|GameSessionNote, Model>  $notes
     */
    private function clearAll(HasMany $notes): JsonResponse
    {
        $notes->delete();

        return response()->json(['message' => 'Todas as anotações foram apagadas.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string', 'max:5000'],
            'category' => ['nullable', Rule::in(array_keys(self::CATEGORIES))],
        ], [], ['title' => 'título', 'content' => 'texto', 'category' => 'categoria']);

        $data['title'] = trim((string) ($data['title'] ?? '')) ?: null;
        $data['content'] = trim((string) ($data['content'] ?? ''));

        if ($data['title'] === null && $data['content'] === '') {
            abort(response()->json([
                'message' => 'Escreva um título ou um texto para a anotação.',
                'errors' => ['content' => ['Escreva um título ou um texto para a anotação.']],
            ], 422));
        }

        return array_filter($data, static fn (mixed $value): bool => $value !== null);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(CharacterNote|GameSessionNote $note): array
    {
        $category = array_key_exists((string) $note->category, self::CATEGORIES) ? $note->category : 'general';

        return [
            'id' => $note->id,
            'title' => $note->title,
            'content' => (string) $note->content,
            'category' => $category,
            'pinned' => $note->pinned,
            'created_at' => $note->created_at?->timezone(config('app.timezone'))->format('d/m H:i'),
        ];
    }
}
