<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Models\CatalogItem;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Models\Suggestion;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Biblioteca da campanha no Painel do Mestre: talentos, perícias, poderes,
 * traços e itens herdados da base, com as alterações da campanha e as
 * sugestões de mudança da base (adotar ou manter). Criar e editar usam os
 * controllers de catálogo (Catalog\Concerns\ManagesCampaignEntries).
 */
class CampaignLibraryController extends Controller
{
    /** Filtros da lista: chave da query string => [rótulo, estados]. */
    public const FILTERS = [
        'todos' => ['Todos', null],
        'sugestoes' => ['Sugestões da base', [CampaignLibrary::UPDATE, CampaignLibrary::NEW]],
        'alterados' => ['Alterados', [CampaignLibrary::CUSTOMIZED]],
        'campanha' => ['Só da campanha', [CampaignLibrary::CAMPAIGN]],
        'ocultos' => ['Ocultos', [CampaignLibrary::HIDDEN]],
    ];

    public function index(Request $request, GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        $type = array_key_exists((string) $request->query('tipo'), CampaignLibrary::TYPES) ? (string) $request->query('tipo') : 'talentos';
        $filter = array_key_exists((string) $request->query('situacao'), self::FILTERS) ? (string) $request->query('situacao') : 'todos';
        $search = trim((string) $request->query('busca'));
        $library = CampaignLibrary::for($gameSession);
        $statuses = self::FILTERS[$filter][1];

        $rows = $library->rows(CampaignLibrary::TYPES[$type]['model'])
            ->when($statuses !== null, static fn ($rows) => $rows->whereIn('status', $statuses))
            ->when($search !== '', static fn ($rows) => $rows->filter(
                static fn (array $row): bool => str_contains(mb_strtolower((string) $row['entry']->getAttribute('name')), mb_strtolower($search)),
            ))
            ->values();

        $ruleSet = $gameSession->ruleSet;

        return view('gm.sessions.library.index', [
            'session' => $gameSession,
            'type' => $type,
            'definition' => CampaignLibrary::TYPES[$type],
            'filter' => $filter,
            'search' => $search,
            'rows' => CampaignLibrary::paginate($rows, $request),
            'pendingCounts' => $library->pendingCounts(),
            'rulesPending' => $ruleSet !== null ? count($ruleSet->pendingBaseChanges(RuleSet::query()->global()->first())) : 0,
            // Itens do inventário que os jogadores sugeriram para a loja da campanha.
            'playerSuggestions' => $type === 'itens'
                ? Suggestion::query()
                    ->with(['user:id,name', 'characterItem.character:id,name'])
                    ->where('type', SuggestionType::Item)
                    ->where('game_session_id', $gameSession->id)
                    ->where('status', SuggestionStatus::Pending)
                    ->oldest()
                    ->get()
                : collect(),
        ]);
    }

    /**
     * Recusa a sugestão de item de um jogador: o item continua só no inventário dele.
     */
    public function rejectPlayerSuggestion(GameSession $gameSession, Suggestion $suggestion): RedirectResponse
    {
        abort_unless($suggestion->game_session_id === $gameSession->id && $suggestion->type === SuggestionType::Item, 404);
        Gate::authorize('review', $suggestion);

        if ($suggestion->status !== SuggestionStatus::Pending) {
            return $this->back($gameSession, 'itens', 'Esta sugestão já foi revisada.');
        }

        $suggestion->status = SuggestionStatus::Rejected;
        $suggestion->save();

        return $this->back($gameSession, 'itens', 'Sugestão de "'.$suggestion->name().'" recusada; o item continua só no inventário do jogador.');
    }

    /**
     * Adota a base: a campanha volta a herdar o item como ele está agora
     * (atualização aceita ou item novo incluído).
     */
    public function adopt(GameSession $gameSession, string $type, string $entry): RedirectResponse
    {
        [$base, $name] = $this->baseEntry($gameSession, $type, $entry);

        if ($rejected = $this->rejectArchived($base)) {
            return $rejected;
        }

        DB::transaction(fn () => $this->discardVersion($gameSession, $base));

        return $this->back($gameSession, $type, '"'.$name.'" agora segue a base da campanha.');
    }

    /**
     * Mantém a versão da campanha e dispensa a sugestão atual.
     */
    public function keep(GameSession $gameSession, string $type, string $entry): RedirectResponse
    {
        [$base, $name] = $this->baseEntry($gameSession, $type, $entry);

        CampaignLibrary::for($gameSession)->keep($base);

        return $this->back($gameSession, $type, 'Sugestão dispensada: "'.$name.'" continua como está na campanha.');
    }

    public function visibility(Request $request, GameSession $gameSession, string $type, string $entry): RedirectResponse
    {
        [$base, $name] = $this->baseEntry($gameSession, $type, $entry);
        $hidden = $request->boolean('hidden');

        DB::transaction(static fn () => CampaignLibrary::for($gameSession)->setHidden($base, $hidden));

        return $this->back($gameSession, $type, $hidden
            ? '"'.$name.'" ficou oculto nesta campanha (fichas que já o têm não mudam).'
            : '"'.$name.'" voltou a aparecer nesta campanha.');
    }

    /**
     * Item da base: restaura a base (desfaz a versão da campanha).
     * Item só da campanha: exclui.
     */
    public function destroy(GameSession $gameSession, string $type, string $entry): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $model = CampaignLibrary::modelOf($type) ?? abort(404);
        $row = $model::query()->findOrFail($entry);

        if ($row->getAttribute('game_session_id') === null) {
            [$base, $name] = $this->baseEntry($gameSession, $type, $entry);

            if ($rejected = $this->rejectArchived($base)) {
                return $rejected;
            }

            DB::transaction(fn () => $this->discardVersion($gameSession, $base));

            return $this->back($gameSession, $type, '"'.$name.'" restaurado: a campanha volta a usar a versão da base.');
        }

        abort_unless((int) $row->getAttribute('game_session_id') === $gameSession->id && $row->getAttribute('base_id') === null, 404);

        $path = $row instanceof CatalogItem ? $row->image_path : null;
        $row->delete();
        self::deleteImageIfUnused($path);

        return $this->back($gameSession, $type, '"'.$row->getAttribute('name').'" excluído da campanha.');
    }

    /**
     * Todas as sugestões de um tipo de uma vez: adotar ou manter.
     */
    public function bulk(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate([
            'tipo' => ['required', Rule::in(array_keys(CampaignLibrary::TYPES))],
            'acao' => ['required', Rule::in(['adotar', 'manter'])],
        ]);

        $library = CampaignLibrary::for($gameSession);
        $rows = $library->rows(CampaignLibrary::TYPES[$data['tipo']]['model'])
            ->whereIn('status', [CampaignLibrary::UPDATE, CampaignLibrary::NEW]);

        DB::transaction(function () use ($rows, $library, $gameSession, $data): void {
            foreach ($rows as $row) {
                $data['acao'] === 'adotar' ? $this->discardVersion($gameSession, $row['base']) : $library->keep($row['base']);
            }
        });

        return $this->back($gameSession, $data['tipo'], $data['acao'] === 'adotar'
            ? $rows->count().' sugestão(ões) da base adotada(s).'
            : $rows->count().' sugestão(ões) da base dispensada(s).');
    }

    /**
     * @return array{0: Model, 1: string} linha da base e nome exibido na campanha
     */
    private function baseEntry(GameSession $session, string $type, string $entry): array
    {
        Gate::authorize('update', $session);

        $model = CampaignLibrary::modelOf($type) ?? abort(404);
        // Inclui itens excluídos da base que a campanha ainda tem (cópia própria).
        $base = $model::query()->whereNull('game_session_id')->findOrFail($entry);
        $row = CampaignLibrary::for($session)->rows($model)->first(static fn (array $row): bool => $row['base']?->is($base) ?? false);

        abort_if($row === null, 404);

        return [$base, (string) $row['entry']->getAttribute('name')];
    }

    /**
     * Item excluído da base só existe pela cópia da campanha: não há base
     * para adotar ou restaurar (o mestre pode ocultá-lo).
     */
    private function rejectArchived(Model $base): ?RedirectResponse
    {
        return $base->getAttribute('archived_at') !== null
            ? back()->withErrors(['library' => 'Este item foi excluído da base: a campanha continua com a sua cópia. Para tirá-lo da biblioteca, oculte-o.'])
            : null;
    }

    /**
     * Remove a versão da campanha (e a imagem própria dela, se não for usada).
     */
    private function discardVersion(GameSession $session, Model $base): void
    {
        $version = CampaignLibrary::for($session)->versionOf($base, create: false);
        $path = $version instanceof CatalogItem ? $version->image_path : null;

        CampaignLibrary::for($session)->adopt($base);
        DB::afterCommit(static fn () => self::deleteImageIfUnused($path));
    }

    private static function deleteImageIfUnused(?string $path): void
    {
        if ($path === null || $path === '' || str_starts_with($path, 'http')) {
            return;
        }

        if (! CatalogItem::query()->where('image_path', $path)->exists()) {
            Storage::disk('public')->delete($path);
        }
    }

    private function back(GameSession $session, string $type, string $status): RedirectResponse
    {
        return redirect()->back(fallback: route('gm.sessions.library.index', [$session, 'tipo' => $type]))->with('status', $status);
    }
}
