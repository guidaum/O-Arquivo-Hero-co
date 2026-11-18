<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\GameSessionReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Referências visuais do Escudo do Mestre (fetch/JSON): imagens enviadas
 * como arquivo ou link, organizadas por categoria, que o mestre consulta
 * durante a sessão e pode mostrar aos jogadores pelo chat da campanha.
 * Tudo exige GameSessionPolicy::update (mestre da campanha).
 */
class GmReferenceController extends Controller
{
    public function store(Request $request, GameSession $gameSession): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            ...$this->rules(),
            'image' => ['nullable', 'required_without:image_url', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240'],
            'image_url' => ['nullable', 'required_without:image', 'url:http,https', 'max:255'],
        ], [
            'image.required_without' => 'Envie uma imagem ou cole o link de uma.',
            'image_url.required_without' => 'Envie uma imagem ou cole o link de uma.',
        ], $this->attributeNames());

        $reference = new GameSessionReference([
            'title' => $this->title($data),
            'category' => $data['category'] ?? 'scene',
            'notes' => $data['notes'] ?? null,
            'pinned' => false,
        ]);
        $reference->game_session_id = $gameSession->id;
        $reference->image_path = $request->hasFile('image')
            ? $request->file('image')->store(GameSessionReference::DIRECTORY, 'public')
            : $data['image_url'];
        $reference->save();

        return response()->json([
            'reference' => $reference->toScreenArray(),
            'message' => 'Referência adicionada.',
        ], 201);
    }

    public function update(Request $request, GameSession $gameSession, GameSessionReference $reference): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        if ($request->keys() === ['pinned']) {
            $reference->update($request->validate(['pinned' => ['required', 'boolean']]));

            return response()->json([
                'reference' => $reference->toScreenArray(),
                'message' => $reference->pinned ? 'Referência fixada no topo.' : 'Referência desafixada.',
            ]);
        }

        $data = $request->validate($this->rules(), [], $this->attributeNames());

        $reference->update([
            'title' => $this->title($data),
            'category' => $data['category'] ?? $reference->category,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json([
            'reference' => $reference->toScreenArray(),
            'message' => 'Referência atualizada.',
        ]);
    }

    public function destroy(GameSession $gameSession, GameSessionReference $reference): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $reference->deleteFile();
        $reference->delete();

        return response()->json(['message' => 'Referência excluída.']);
    }

    /**
     * Mostra a imagem aos jogadores: vira uma mensagem do mestre no chat da
     * campanha. A mensagem guarda a URL completa (nunca o caminho do
     * arquivo), para que limpar o chat não apague o arquivo da referência.
     * As anotações da referência são privadas e não vão para o chat.
     */
    public function share(Request $request, GameSession $gameSession, GameSessionReference $reference): JsonResponse
    {
        Gate::authorize('update', $gameSession);

        $url = url((string) $reference->image_url);

        if (mb_strlen($url) > 255) {
            throw ValidationException::withMessages(['image' => 'O link desta imagem é longo demais para o chat.']);
        }

        ChatMessage::post($gameSession, $request->user(), $request->user()->name, [
            'text' => $reference->title,
            'image_path' => $url,
        ]);

        return response()->json(['message' => 'Imagem mostrada no chat da campanha.']);
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(array_keys(GameSessionReference::CATEGORIES))],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function attributeNames(): array
    {
        return [
            'title' => 'título',
            'category' => 'categoria',
            'notes' => 'anotações',
            'image' => 'imagem',
            'image_url' => 'link da imagem',
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function title(array $data): string
    {
        return trim((string) ($data['title'] ?? '')) ?: 'Referência sem título';
    }
}
