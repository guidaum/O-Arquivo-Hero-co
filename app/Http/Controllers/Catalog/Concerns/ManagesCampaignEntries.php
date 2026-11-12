<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog\Concerns;

use App\Models\GameSession;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

/**
 * Edição de um catálogo dentro da campanha (Painel do Mestre > Biblioteca),
 * com o mesmo formulário e a mesma validação do catálogo base:
 * - item da base: salvar cria/atualiza a versão da campanha (a base não muda);
 *   se a versão ficar igual à base, a campanha volta a herdá-la;
 * - item só da campanha: criado e editado direto.
 * Os controllers informam o Model, o formulário e a validação do tipo.
 */
trait ManagesCampaignEntries
{
    /**
     * @return class-string<Model>
     */
    abstract protected function libraryModel(): string;

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    abstract protected function form(Model $entry, array $form, ?int $suggestionId = null): View;

    /**
     * Dados validados do tipo, prontos para fill() (ou o formato próprio do tipo).
     *
     * @return array<string, mixed>
     */
    abstract protected function validatedEntry(Request $request, ?GameSession $session, ?Model $entry): array;

    /**
     * Grava os dados validados no Model (itens também tratam a imagem).
     *
     * @param  array<string, mixed>  $data
     */
    protected function fillEntry(Request $request, Model $entry, array $data): void
    {
        $entry->fill($data);
    }

    /**
     * Depois de salvar (itens sincronizam as armas compatíveis).
     *
     * @param  array<string, mixed>  $data
     */
    protected function afterEntrySaved(Model $entry, array $data, bool $isVersion): void
    {
    }

    public function campaignCreate(GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        return $this->form($this->newEntry(), [
            'action' => route('gm.sessions.library.'.$this->libraryType().'.store', $gameSession),
            'method' => 'POST',
            'cancel' => $this->libraryUrl($gameSession),
            'session' => $gameSession,
            'notice' => 'Este cadastro existe só nesta campanha; o catálogo base não muda. O administrador o recebe como sugestão para a base.',
            'version' => false,
        ]);
    }

    public function campaignStore(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $this->validatedEntry($request, $gameSession, null);

        $entry = DB::transaction(function () use ($request, $gameSession, $data): Model {
            $entry = $this->newEntry();
            $entry->setAttribute('game_session_id', $gameSession->id);

            if (in_array('created_by', $this->ownerColumns(), true)) {
                $entry->setAttribute('created_by', $request->user()->id);
            }

            $this->fillEntry($request, $entry, $data);
            // Toda criação na campanha vira proposta para a base (Painel Admin > Sugestões).
            $entry->setAttribute('proposed_at', now());
            $entry->save();
            $this->afterEntrySaved($entry, $data, false);

            return $entry;
        });

        return redirect()->to($this->libraryUrl($gameSession))
            ->with('status', '"'.$entry->getAttribute('name').'" criado só para esta campanha!');
    }

    public function campaignEdit(GameSession $gameSession, string $entry): View
    {
        Gate::authorize('update', $gameSession);

        $row = $this->campaignRow($gameSession, $entry);
        $isBase = $row['base'] !== null;

        return $this->form($row['entry'], [
            'action' => route('gm.sessions.library.'.$this->libraryType().'.update', [$gameSession, $row['entry']->getKey()]),
            'method' => 'PUT',
            'cancel' => $this->libraryUrl($gameSession),
            'session' => $gameSession,
            'notice' => match (true) {
                $row['status'] === CampaignLibrary::REMOVED => 'Este item foi excluído da base; a campanha continua com a sua cópia.',
                $isBase => 'Você está editando a versão desta campanha. O catálogo base e as outras campanhas não mudam; "Restaurar base" desfaz a alteração. O administrador recebe a alteração como sugestão para a base.',
                default => 'Este cadastro existe só nesta campanha. O administrador o recebe como sugestão para a base.',
            },
            'version' => $isBase,
        ]);
    }

    public function campaignUpdate(Request $request, GameSession $gameSession, string $entry): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $row = $this->campaignRow($gameSession, $entry);
        $base = $row['base'];
        $library = CampaignLibrary::for($gameSession);
        $data = $this->validatedEntry($request, $gameSession, $row['entry']);

        $inherited = DB::transaction(function () use ($request, $row, $base, $library, $data): bool {
            if ($base === null) {
                $this->fillEntry($request, $row['entry'], $data);
                $row['entry']->setAttribute('proposed_at', now());
                $row['entry']->save();
                $this->afterEntrySaved($row['entry'], $data, false);

                return false;
            }

            $version = $library->versionOf($base);
            $this->fillEntry($request, $version, $data);
            $version->setAttribute('base_version', (int) $base->getAttribute('version'));

            // Igual à base e visível: a campanha volta a herdar o item (itens
            // excluídos da base continuam existindo só pela cópia).
            if (! $version->getAttribute('hidden') && $base->getAttribute('archived_at') === null && CampaignLibrary::changes($base, $version) === []) {
                $version->delete();

                return true;
            }

            // A alteração vira proposta para a base (Painel Admin > Sugestões).
            $version->setAttribute('proposed_at', now());
            $version->save();
            $this->afterEntrySaved($version, $data, true);

            return false;
        });

        return redirect()->to($this->libraryUrl($gameSession))->with('status', $inherited
            ? '"'.$row['entry']->getAttribute('name').'" ficou igual à base: a campanha volta a herdá-lo.'
            : '"'.$row['entry']->getAttribute('name').'" salvo nesta campanha.');
    }

    protected function libraryType(): string
    {
        return (string) CampaignLibrary::typeOf($this->newEntry());
    }

    protected function libraryUrl(GameSession $session): string
    {
        return route('gm.sessions.library.index', [$session, 'tipo' => $this->libraryType()]);
    }

    /**
     * Colunas de autoria presentes no tipo (traços não têm).
     *
     * @return list<string>
     */
    protected function ownerColumns(): array
    {
        return ['created_by'];
    }

    private function newEntry(): Model
    {
        $model = $this->libraryModel();

        return new $model;
    }

    /**
     * Linha da biblioteca da campanha pelo ID canônico (base ou item da campanha).
     *
     * @return array{entry: Model, base: ?Model, version: ?Model, status: string, changes: list<string>}
     */
    private function campaignRow(GameSession $session, string $id): array
    {
        $row = CampaignLibrary::for($session)->rows($this->libraryModel())
            ->first(static fn (array $row): bool => (string) $row['entry']->getKey() === $id);

        abort_if($row === null, 404);

        return $row;
    }
}
