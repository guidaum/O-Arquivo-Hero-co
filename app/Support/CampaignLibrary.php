<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\CatalogItem;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * Catálogos de uma campanha com herança viva da base:
 * - a campanha enxerga a base como ela é; o que o mestre altera vira uma
 *   versão da campanha (linha com base_id), e o original não muda;
 * - mudanças na base não chegam direto: ao editar um item da base, as
 *   campanhas que o usavam como estava recebem uma cópia da versão anterior
 *   e uma sugestão ("Atualização da base"); itens novos da base chegam
 *   ocultos, como sugestão ("Novo na base"). O mestre adota ou mantém;
 * - o ID canônico é sempre o da base: fichas, loja, modificadores e alvos de
 *   traços continuam válidos, e a versão da campanha só troca os dados
 *   (overlay()).
 * Campanha nova (sem versões próprias) herda a base inteira.
 */
final class CampaignLibrary
{
    public const INHERITED = 'inherited';

    public const CUSTOMIZED = 'customized';

    public const UPDATE = 'update';

    public const NEW = 'new';

    public const HIDDEN = 'hidden';

    public const CAMPAIGN = 'campaign';

    /** Item excluído da base que a campanha continua usando (cópia própria). */
    public const REMOVED = 'removed';

    /** Rótulos dos estados exibidos ao mestre. */
    public const STATUS_LABELS = [
        self::INHERITED => 'Da base',
        self::CUSTOMIZED => 'Alterado na campanha',
        self::UPDATE => 'Atualização da base',
        self::NEW => 'Novo na base',
        self::HIDDEN => 'Oculto na campanha',
        self::CAMPAIGN => 'Só desta campanha',
        self::REMOVED => 'Removido da base',
    ];

    /**
     * Tipos de catálogo por trecho da URL: Model, rótulo, nome no singular e ícone.
     *
     * @var array<string, array{model: class-string<Model>, label: string, singular: string, icon: string}>
     */
    public const TYPES = [
        'talentos' => ['model' => Talent::class, 'label' => 'Talentos', 'singular' => 'talento', 'icon' => 'activity'],
        'pericias' => ['model' => Skill::class, 'label' => 'Perícias', 'singular' => 'perícia', 'icon' => 'sword'],
        'poderes' => ['model' => Power::class, 'label' => 'Poderes', 'singular' => 'poder', 'icon' => 'zap'],
        'tracos' => ['model' => CharacterTrait::class, 'label' => 'Vantagens & Defeitos', 'singular' => 'vantagem/defeito', 'icon' => 'sparkles'],
        'itens' => ['model' => CatalogItem::class, 'label' => 'Itens', 'singular' => 'item', 'icon' => 'backpack'],
    ];

    /** Rótulos das colunas comparadas (diferenças mostradas nas sugestões). */
    public const FIELD_LABELS = [
        'name' => 'Nome',
        'description' => 'Descrição',
        'category' => 'Categoria',
        'composition' => 'Composição',
        'type' => 'Tipo',
        'damage' => 'Dano',
        'atp_cost' => 'Custo de ATP',
        'purchase_cost' => 'Custo de compra',
        'difficulty_formula' => 'Fórmula de dificuldade',
        'effect' => 'Efeito',
        'cost' => 'Custo de uso',
        'modifier' => 'Modificador',
        'modifier_attribute' => 'Atributo alvo',
        'modifier_talent_id' => 'Talento alvo',
        'rarity' => 'Raridade',
        'defense' => 'Defesa',
        'weight' => 'Peso',
        'value' => 'Valor',
        'stats' => 'Bônus em atributos',
        'bonus_text' => 'Bônus (texto)',
        'image_path' => 'Imagem',
        'is_starting_item' => 'Equipamento inicial',
    ];

    /** @var array<class-string<Model>, Collection<int, array{entry: Model, base: ?Model, version: ?Model, status: string, changes: list<string>}>> */
    private array $rows = [];

    private function __construct(public readonly ?GameSession $session)
    {
    }

    public static function for(?GameSession $session): self
    {
        return new self($session);
    }

    /**
     * @return class-string<Model>|null
     */
    public static function modelOf(string $type): ?string
    {
        return self::TYPES[$type]['model'] ?? null;
    }

    public static function typeOf(Model $entry): ?string
    {
        foreach (self::TYPES as $type => $definition) {
            if ($entry instanceof $definition['model']) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Itens visíveis na campanha (com os dados da versão da campanha),
     * indexados pelo ID canônico e ordenados pelo nome.
     *
     * @template T of Model
     *
     * @param  class-string<T>  $model
     * @return Collection<int, T>
     */
    public function entries(string $model): Collection
    {
        return $this->rows($model)
            ->reject(static fn (array $row): bool => in_array($row['status'], [self::HIDDEN, self::NEW], true))
            ->mapWithKeys(static fn (array $row): array => [$row['entry']->getKey() => $row['entry']]);
    }

    /**
     * @param  class-string<Model>  $model
     */
    public function allows(string $model, int $id): bool
    {
        return $this->entries($model)->has($id);
    }

    /**
     * Todas as linhas para o mestre: item efetivo, linha da base, versão da
     * campanha, estado e colunas diferentes da base.
     *
     * @param  class-string<Model>  $model
     * @return Collection<int, array{entry: Model, base: ?Model, version: ?Model, status: string, changes: list<string>}>
     */
    public function rows(string $model): Collection
    {
        return $this->rows[$model] ??= $this->loadRows($model);
    }

    /**
     * Paginação das listas da biblioteca (já carregadas em memória), com os
     * filtros da query string preservados nos links.
     *
     * @template T
     *
     * @param  Collection<int, T>  $items
     * @return LengthAwarePaginator<int, T>
     */
    public static function paginate(Collection $items, Request $request, int $perPage = 20): LengthAwarePaginator
    {
        $page = max(1, $request->integer('page', 1));

        return (new LengthAwarePaginator(
            $items->forPage($page, $perPage)->values(),
            $items->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'pageName' => 'page'],
        ))->withQueryString();
    }

    /**
     * Quantas sugestões da base esperam o mestre, por tipo.
     *
     * @return array<string, int>
     */
    public function pendingCounts(): array
    {
        $counts = [];

        foreach (self::TYPES as $type => $definition) {
            $counts[$type] = $this->rows($definition['model'])
                ->whereIn('status', [self::UPDATE, self::NEW])
                ->count();
        }

        return $counts;
    }

    /**
     * Troca, nos Models informados (ex.: perícias da ficha), os dados da
     * base pelos da versão da campanha. O ID e o pivot continuam os mesmos.
     *
     * @param  iterable<Model>  ...$collections
     */
    public function overlay(iterable ...$collections): void
    {
        if ($this->session === null) {
            return;
        }

        foreach ($collections as $collection) {
            $byModel = [];

            foreach ($collection as $entry) {
                if ($entry->getAttribute('game_session_id') === null) {
                    $byModel[$entry::class][$entry->getKey()][] = $entry;
                }
            }

            foreach ($byModel as $model => $entries) {
                $versions = $model::query()
                    ->where('game_session_id', $this->session->id)
                    ->whereIn('base_id', array_keys($entries))
                    ->get()
                    ->keyBy('base_id');

                foreach ($entries as $id => $models) {
                    if ($versions->has($id)) {
                        foreach ($models as $entry) {
                            self::copyData($versions->get($id), $entry);
                        }
                    }
                }
            }
        }
    }

    /**
     * Item novo na base: as campanhas existentes o recebem oculto, como
     * sugestão. Campanhas criadas depois já o herdam.
     */
    public static function baseCreated(Model $base, ?int $exceptSessionId = null): void
    {
        if ($base->getAttribute('game_session_id') !== null) {
            return;
        }

        foreach (GameSession::query()->when($exceptSessionId !== null, static fn ($query) => $query->whereKeyNot($exceptSessionId))->pluck('id') as $sessionId) {
            self::createVersion($base, (int) $sessionId, self::dataOf($base), hidden: true, baseVersion: null);
        }
    }

    /**
     * Exclusão na base: o item sai do catálogo base e das campanhas criadas
     * depois, mas as campanhas existentes ficam com a sua cópia (fichas,
     * loja e alterações continuam). Itens novos ainda não adotados somem.
     */
    public static function baseArchived(Model $base): void
    {
        if ($base->getAttribute('game_session_id') !== null || $base->getAttribute('archived_at') !== null) {
            return;
        }

        $base::query()->where('base_id', $base->getKey())->where('hidden', true)->whereNull('base_version')->delete();

        $withVersion = $base::query()->where('base_id', $base->getKey())->pluck('game_session_id');

        foreach (GameSession::query()->whereNotIn('id', $withVersion)->pluck('id') as $sessionId) {
            self::createVersion($base, (int) $sessionId, self::dataOf($base), hidden: false, baseVersion: (int) $base->getAttribute('version'));
        }

        $base->setAttribute('archived_at', now());
        $base->save();
    }

    /**
     * Criações e alterações das campanhas aguardando o admin, de todos os
     * tipos, mais recentes primeiro. Versões ocultas, iguais à base ou de
     * itens excluídos da base não contam.
     *
     * @return Collection<int, array{type: string, entry: Model, base: ?Model, session: ?GameSession, changes: list<string>}>
     */
    public static function proposals(): Collection
    {
        $proposals = collect();

        foreach (self::TYPES as $type => $definition) {
            $rows = $definition['model']::query()
                ->whereNotNull('game_session_id')
                ->whereNotNull('proposed_at')
                ->with(['gameSession:id,name', 'baseEntry'])
                ->get();

            foreach ($rows as $row) {
                $base = $row->getAttribute('base_id') !== null ? $row->getRelation('baseEntry') : null;

                if ($base !== null && ($row->getAttribute('hidden') || $base->getAttribute('archived_at') !== null)) {
                    continue;
                }

                $changes = $base !== null ? self::changes($base, $row) : [];

                if ($base !== null && $changes === []) {
                    continue;
                }

                $proposals->push(['type' => $type, 'entry' => $row, 'base' => $base, 'session' => $row->getRelation('gameSession'), 'changes' => $changes]);
            }
        }

        return $proposals->sortByDesc(static fn (array $proposal): int => (int) $proposal['entry']->getAttribute('proposed_at')?->getTimestamp())->values();
    }

    /**
     * O admin leva uma proposta da campanha para a base:
     * - alteração: a base recebe os dados da campanha (as outras campanhas
     *   recebem como sugestão) e a campanha volta a herdar o item;
     * - criação: o item passa a ser da base com o mesmo ID (as fichas da
     *   campanha continuam iguais) e chega às outras campanhas como sugestão.
     *
     * @return string|null mensagem de erro, quando não é possível
     */
    public static function promote(Model $row): ?string
    {
        $base = $row->getAttribute('base_id') !== null ? $row->baseEntry : null;

        if ($base !== null) {
            $base->setRawAttributes([...$base->getAttributes(), ...self::dataOf($row)]);
            self::baseUpdating($base);
            $base->save();
            $row->delete();

            return null;
        }

        $talentId = $row->getAttribute('modifier_talent_id');

        if ($talentId !== null && $row instanceof CharacterTrait && Talent::query()->whereKey($talentId)->whereNotNull('game_session_id')->exists()) {
            return 'O alvo deste traço é um talento só da campanha. Leve o talento para a base primeiro.';
        }

        $sessionId = (int) $row->getAttribute('game_session_id');
        $row->setAttribute('game_session_id', null);
        $row->setAttribute('proposed_at', null);
        $row->setAttribute('version', 1);
        $row->save();
        self::baseCreated($row, exceptSessionId: $sessionId);

        return null;
    }

    /**
     * Chamar antes de salvar uma edição da base: campanhas que usavam o item
     * como estava ficam com a versão anterior e uma sugestão de atualização.
     */
    public static function baseUpdating(Model $base): void
    {
        $fields = $base->libraryFields();

        if ($base->getAttribute('game_session_id') !== null || ! $base->exists || ! $base->isDirty($fields)) {
            return;
        }

        $previous = Arr::only($base->getRawOriginal(), $fields);
        $version = (int) ($base->getRawOriginal('version') ?? 1);
        $withVersion = $base::query()->where('base_id', $base->getKey())->pluck('game_session_id');

        foreach (GameSession::query()->whereNotIn('id', $withVersion)->pluck('id') as $sessionId) {
            self::createVersion($base, (int) $sessionId, $previous, hidden: false, baseVersion: $version);
        }

        $base->setAttribute('version', $version + 1);
    }

    /**
     * Versão da campanha de um item da base (criada com os dados atuais
     * quando ainda não existe).
     */
    public function versionOf(Model $base, bool $create = true): ?Model
    {
        $version = $base::query()
            ->where('game_session_id', $this->session?->id)
            ->where('base_id', $base->getKey())
            ->first();

        if ($version === null && $create && $this->session !== null) {
            $version = self::createVersion($base, $this->session->id, self::dataOf($base), hidden: false, baseVersion: (int) $base->getAttribute('version'));
        }

        return $version;
    }

    /**
     * Adota a base: a campanha volta a herdar o item como ele está agora.
     */
    public function adopt(Model $base): void
    {
        $this->versionOf($base, create: false)?->delete();
    }

    /**
     * Mantém a versão da campanha e dispensa a sugestão atual.
     */
    public function keep(Model $base): void
    {
        $version = $this->versionOf($base, create: false);

        if ($version !== null) {
            $version->setAttribute('base_version', (int) $base->getAttribute('version'));
            $version->save();
        }
    }

    /**
     * Oculta ou mostra um item da base na campanha. Ao mostrar um item que
     * não tem mais diferenças da base, a campanha volta a herdá-lo.
     */
    public function setHidden(Model $base, bool $hidden): void
    {
        $version = $this->versionOf($base);

        if ($version === null) {
            return;
        }

        $version->setAttribute('hidden', $hidden);
        $version->setAttribute('base_version', (int) $base->getAttribute('version'));

        // Igual à base volta a ser herdado (menos itens excluídos da base, que só existem pela cópia).
        if (! $hidden && $base->getAttribute('archived_at') === null && self::changes($base, $version) === []) {
            $version->delete();

            return;
        }

        $version->save();
    }

    /**
     * Colunas em que a versão da campanha difere da base.
     *
     * @return list<string>
     */
    public static function changes(Model $base, Model $version): array
    {
        $changes = [];

        foreach ($base->libraryFields() as $field) {
            if (self::normalize($base->getAttribute($field)) !== self::normalize($version->getAttribute($field))) {
                $changes[] = $field;
            }
        }

        return $changes;
    }

    /**
     * @param  class-string<Model>  $model
     * @return Collection<int, array{entry: Model, base: ?Model, version: ?Model, status: string, changes: list<string>}>
     */
    private function loadRows(string $model): Collection
    {
        // Inclui os excluídos da base: a campanha que tem cópia continua com eles.
        $bases = $model::query()->whereNull('game_session_id')->get();

        if ($this->session === null) {
            return $bases
                ->reject(static fn (Model $base): bool => $base->getAttribute('archived_at') !== null)
                ->map(static fn (Model $base): array => ['entry' => $base, 'base' => $base, 'version' => null, 'status' => self::INHERITED, 'changes' => []])
                ->sortBy(static fn (array $row): string => mb_strtolower((string) $row['entry']->getAttribute('name')))
                ->values();
        }

        $own = $model::query()->where('game_session_id', $this->session->id)->get();
        $versions = $own->whereNotNull('base_id')->keyBy('base_id');
        $rows = collect();

        foreach ($bases as $base) {
            $version = $versions->get($base->getKey());
            $archived = $base->getAttribute('archived_at') !== null;

            // Excluído da base: só fica na campanha que já tinha a sua cópia.
            if ($archived && ($version === null || ($version->getAttribute('hidden') && $version->getAttribute('base_version') === null))) {
                continue;
            }

            if ($version === null) {
                $rows->push(['entry' => $base, 'base' => $base, 'version' => null, 'status' => self::INHERITED, 'changes' => []]);

                continue;
            }

            $entry = clone $base;
            self::copyData($version, $entry);
            $baseVersion = $version->getAttribute('base_version');

            $status = match (true) {
                $version->getAttribute('hidden') && $baseVersion === null => self::NEW,
                $version->getAttribute('hidden') => self::HIDDEN,
                $archived => self::REMOVED,
                (int) $baseVersion < (int) $base->getAttribute('version') => self::UPDATE,
                default => self::CUSTOMIZED,
            };

            $rows->push(['entry' => $entry, 'base' => $base, 'version' => $version, 'status' => $status, 'changes' => self::changes($base, $version)]);
        }

        foreach ($own->whereNull('base_id') as $entry) {
            $rows->push(['entry' => $entry, 'base' => null, 'version' => null, 'status' => self::CAMPAIGN, 'changes' => []]);
        }

        return $rows
            ->sortBy(static fn (array $row): string => mb_strtolower((string) $row['entry']->getAttribute('name')))
            ->values();
    }

    /**
     * Copia as colunas de dados (valores crus do banco) sem marcar o Model
     * como alterado: um save() acidental não grava nada na base.
     */
    private static function copyData(Model $from, Model $to): void
    {
        $to->setRawAttributes([...$to->getAttributes(), ...self::dataOf($from)], true);
    }

    /**
     * @return array<string, mixed>
     */
    private static function dataOf(Model $entry): array
    {
        return Arr::only($entry->getAttributes(), $entry->libraryFields());
    }

    /**
     * @param  array<string, mixed>  $data  valores crus das colunas de dados
     */
    private static function createVersion(Model $base, int $sessionId, array $data, bool $hidden, ?int $baseVersion): Model
    {
        $version = $base->newInstance();
        $version->setRawAttributes([
            ...$data,
            'game_session_id' => $sessionId,
            'base_id' => $base->getKey(),
            'hidden' => $hidden,
            'version' => 1,
            'base_version' => $baseVersion,
        ]);
        $version->save();

        return $version;
    }

    private static function normalize(mixed $value): string
    {
        if ($value instanceof \BackedEnum) {
            $value = $value->value;
        }

        if (is_string($value) && is_numeric($value)) {
            $value = $value + 0;
        }

        if (is_float($value) && floor($value) === $value) {
            $value = (int) $value;
        }

        if (is_bool($value)) {
            $value = (int) $value;
        }

        if ($value === '') {
            $value = null;
        }

        return (string) json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
