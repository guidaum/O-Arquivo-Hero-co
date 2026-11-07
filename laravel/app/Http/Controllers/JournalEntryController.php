<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\GameSession;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Diário de Sessão (SessionJournal.tsx do sistema antigo): registros com
 * resumo, linha do tempo de eventos, NPCs encontrados e galeria.
 */
class JournalEntryController extends Controller
{
    public const DISK = 'public';

    public const TIMELINE_TYPES = ['Exploração', 'Combate', 'Roleplay', 'Mistério', 'Descanso'];

    public const TIMELINE_STATUSES = ['completed' => 'Concluído', 'current' => 'Em Andamento', 'upcoming' => 'Planejado'];

    public const NPC_STATUSES = ['Amigável', 'Neutro', 'Hostil'];

    /**
     * Visões: "tudo" (meus registros), "campanha" (todos os registros de uma
     * campanha da qual participo) e "personagem" (registros de um personagem meu).
     */
    public function index(Request $request): View
    {
        $user = $request->user();
        $view = (string) $request->query('visao', 'tudo');
        $sessions = $this->sessionsOf($user);
        $characters = $user->characters()->orderBy('name')->get(['id', 'name']);

        $query = JournalEntry::query();
        $session = null;
        $character = null;

        if ($view === 'campanha' && ($session = $sessions->firstWhere('id', (int) $request->query('campanha'))) !== null) {
            $query->where('game_session_id', $session->id);
        } elseif ($view === 'personagem' && ($character = $characters->firstWhere('id', (int) $request->query('personagem'))) !== null) {
            $query->where('character_id', $character->id);
        } else {
            $view = 'tudo';
            $query->where('user_id', $user->id);
        }

        $entries = $query
            ->orderByDesc('session_date')
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'session_date', 'user_id']);

        $selected = $entries->firstWhere('id', (int) $request->query('registro')) ?? $entries->first();
        $entry = $selected
            ? JournalEntry::query()->with(['images', 'character:id,name', 'gameSession:id,name,image_path,gm_id', 'user:id,name'])->find($selected->id)
            : null;

        if ($entry !== null) {
            Gate::authorize('view', $entry);
        }

        return view('journal.index', [
            'view' => $view,
            'entries' => $entries,
            'entry' => $entry,
            'sessions' => $sessions,
            'characters' => $characters,
            'currentSession' => $session,
            'currentCharacter' => $character,
        ]);
    }

    public function create(Request $request): View
    {
        Gate::authorize('create', JournalEntry::class);

        $entry = new JournalEntry([
            'session_date' => now()->toDateString(),
            'game_session_id' => $request->integer('campanha') ?: null,
            'character_id' => $request->integer('personagem') ?: null,
            'timeline' => [],
            'npcs' => [],
        ]);

        return $this->form($request->user(), $entry);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', JournalEntry::class);

        $entry = new JournalEntry;
        $entry->user_id = $request->user()->id;
        $this->save($request, $entry);

        return redirect()->route('journal.index', ['registro' => $entry->id])->with('status', 'Registro "'.$entry->title.'" criado!');
    }

    public function edit(Request $request, JournalEntry $journalEntry): View
    {
        Gate::authorize('update', $journalEntry);

        return $this->form($request->user(), $journalEntry);
    }

    public function update(Request $request, JournalEntry $journalEntry): RedirectResponse
    {
        Gate::authorize('update', $journalEntry);

        $this->save($request, $journalEntry);

        return redirect()->route('journal.index', ['registro' => $journalEntry->id])->with('status', 'Registro atualizado!');
    }

    public function destroy(JournalEntry $journalEntry): RedirectResponse
    {
        Gate::authorize('delete', $journalEntry);

        $paths = [
            ...$journalEntry->images()->pluck('path')->all(),
            ...array_column((array) $journalEntry->npcs, 'image_path'),
        ];

        $journalEntry->delete();
        self::deleteFiles($paths);

        return redirect()->route('journal.index')->with('status', 'Registro "'.$journalEntry->title.'" excluído.');
    }

    /**
     * Apaga arquivos locais (endereços externos importados ficam como estão).
     *
     * @param  array<int, mixed>  $paths
     */
    public static function deleteFiles(array $paths): void
    {
        $local = array_filter($paths, static fn (mixed $path): bool => is_string($path) && $path !== '' && ! Str::startsWith($path, ['http://', 'https://']));

        if ($local !== []) {
            Storage::disk(self::DISK)->delete(array_values($local));
        }
    }

    private function form(User $user, JournalEntry $entry): View
    {
        return view('journal.form', [
            'entry' => $entry,
            'sessions' => $this->sessionsOf($user),
            'characters' => $user->characters()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    private function save(Request $request, JournalEntry $entry): void
    {
        $user = $request->user();
        $existingNpcImages = array_values(array_filter(array_column((array) $entry->npcs, 'image_path')));

        // Linhas vazias das listas editáveis são ignoradas.
        $request->merge([
            'timeline' => array_values(array_filter((array) $request->input('timeline', []), static fn (mixed $row): bool => is_array($row) && trim((string) ($row['event'] ?? '')) !== '')),
        ]);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:199'],
            'session_date' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:255'],
            'duration' => ['nullable', 'string', 'max:64'],
            'players_count' => ['nullable', 'integer', 'min:0', 'max:100'],
            'game_session_id' => ['nullable', 'integer', Rule::in($this->sessionsOf($user)->pluck('id')->all())],
            'character_id' => ['nullable', 'integer', Rule::in($user->characters()->pluck('id')->all())],
            'content' => ['nullable', 'string', 'max:100000'],
            'timeline' => ['array', 'max:100'],
            'timeline.*.time' => ['nullable', 'string', 'max:32'],
            'timeline.*.event' => ['required', 'string', 'max:1000'],
            'timeline.*.type' => ['required', Rule::in(self::TIMELINE_TYPES)],
            'timeline.*.status' => ['required', Rule::in(array_keys(self::TIMELINE_STATUSES))],
            'npcs' => ['array', 'max:50'],
            'npcs.*.name' => ['required', 'string', 'max:255'],
            'npcs.*.role' => ['nullable', 'string', 'max:255'],
            'npcs.*.status' => ['required', Rule::in(self::NPC_STATUSES)],
            'npcs.*.image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:4096'],
            // Só imagens que já pertencem ao registro podem ser mantidas.
            'npcs.*.image_path' => ['nullable', 'string', Rule::in($existingNpcImages)],
            'npcs.*.remove_image' => ['boolean'],
        ], [], [
            'title' => 'título',
            'session_date' => 'data',
            'game_session_id' => 'campanha',
            'character_id' => 'personagem',
            'timeline.*.event' => 'evento',
            'timeline.*.type' => 'tipo do evento',
            'timeline.*.status' => 'situação do evento',
            'npcs.*.name' => 'nome do NPC',
            'npcs.*.status' => 'atitude do NPC',
            'npcs.*.image' => 'imagem do NPC',
        ]);

        $newFiles = [];
        $npcs = [];

        foreach ($data['npcs'] ?? [] as $key => $npc) {
            $path = ($npc['remove_image'] ?? false) ? null : ($npc['image_path'] ?? null);
            $file = $request->file('npcs.'.$key.'.image');

            if ($file !== null) {
                $path = $newFiles[] = $file->store('journal/npcs', self::DISK);
            }

            $npcs[] = [
                'name' => $npc['name'],
                'role' => $npc['role'] ?? '',
                'status' => $npc['status'],
                'image_path' => $path,
            ];
        }

        $timeline = array_map(static fn (array $item): array => [
            'time' => $item['time'] ?? '',
            'event' => $item['event'],
            'type' => $item['type'],
            'status' => $item['status'],
        ], array_values($data['timeline'] ?? []));

        try {
            DB::transaction(static function () use ($entry, $data, $npcs, $timeline): void {
                $entry->fill([
                    ...collect($data)->only(['title', 'session_date', 'location', 'duration', 'content', 'game_session_id', 'character_id'])->all(),
                    'players_count' => (int) ($data['players_count'] ?? 0),
                    'timeline' => $timeline,
                    'npcs' => $npcs,
                ]);
                $entry->save();
            });
        } catch (\Throwable $exception) {
            self::deleteFiles($newFiles);

            throw $exception;
        }

        // Imagens de NPC trocadas ou removidas saem do disco.
        self::deleteFiles(array_diff($existingNpcImages, array_column($npcs, 'image_path')));
    }

    /**
     * Campanhas em que o usuário é mestre ou jogador.
     *
     * @return Collection<int, GameSession>
     */
    private function sessionsOf(User $user): Collection
    {
        return GameSession::query()
            ->where(static function (Builder $query) use ($user): void {
                $query->where('gm_id', $user->id)
                    ->orWhereHas('players', static fn (Builder $players) => $players->whereKey($user->id));
            })
            ->orderBy('name')
            ->get(['id', 'name', 'gm_id']);
    }
}
