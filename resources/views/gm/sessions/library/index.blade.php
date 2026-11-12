{{--
    Biblioteca da campanha (CampaignLibraryController): itens herdados da
    base, alterados na campanha, ocultos, só da campanha e as sugestões da
    base (atualizações e itens novos) para adotar ou manter.
--}}
@use('App\Support\CampaignLibrary')

@php
    $singular = $definition['singular'];
    $pending = $pendingCounts[$type] ?? 0;
    $statusClass = [
        CampaignLibrary::INHERITED => '',
        CampaignLibrary::CUSTOMIZED => 'badge--gm',
        CampaignLibrary::UPDATE => 'badge--admin',
        CampaignLibrary::NEW => 'badge--admin',
        CampaignLibrary::HIDDEN => '',
        CampaignLibrary::CAMPAIGN => 'badge--player',
        CampaignLibrary::REMOVED => '',
    ];

    // Resumo de cada tipo na linha.
    $summary = static function ($entry) use ($type): array {
        return array_values(array_filter(match ($type) {
            'talentos' => [
                $entry->category,
                implode(' + ', array_map('strtoupper', (array) $entry->composition)),
            ],
            'pericias' => [$entry->type, 'Custo '.$entry->purchase_cost.' pts', 'ATP '.$entry->atp_cost, $entry->damage ? 'Dano '.$entry->damage : null],
            'poderes' => [$entry->type, 'Custo '.$entry->purchase_cost.' pts', $entry->cost ? 'Uso '.$entry->cost : null],
            'tracos' => [$entry->type?->label(), ($entry->modifier > 0 ? '+' : '').$entry->modifier],
            'itens' => [$entry->categoryLabel(), $entry->rarityLabel(), $entry->value.' MO', $entry->damage ? 'Dano '.$entry->damage : null],
            default => [],
        }));
    };

    // Valor legível de uma coluna (diferenças entre a campanha e a base).
    $show = static function (mixed $value): string {
        if ($value instanceof \BackedEnum) {
            $value = method_exists($value, 'label') ? $value->label() : $value->value;
        }

        return match (true) {
            is_bool($value) => $value ? 'Sim' : 'Não',
            is_array($value) => $value === [] ? '—' : collect($value)->map(fn ($item, $key) => is_string($key) ? $key.': '.$item : $item)->implode(', '),
            $value === null || $value === '' => '—',
            default => \Illuminate\Support\Str::limit((string) $value, 60),
        };
    };
@endphp

<x-layouts.app :title="$definition['label'].' · '.$session->name">
    @include('gm.sessions.library.header', ['session' => $session, 'current' => $type])

    @if ($pending > 0)
        <section class="library-suggestions glass" aria-labelledby="library-suggestions-title">
            <div>
                <h2 class="library-suggestions__title" id="library-suggestions-title">
                    <x-icon name="sparkles" :size="20" /> {{ $pending }} sugestão(ões) da base
                </h2>
                <p class="muted">A base mudou ou ganhou itens novos. Adote para usar a versão da base, ou mantenha a da campanha.</p>
            </div>

            <div class="library-suggestions__actions">
                @if ($filter !== 'sugestoes')
                    <a class="button button--secondary button--small" href="{{ route('gm.sessions.library.index', [$session, 'tipo' => $type, 'situacao' => 'sugestoes']) }}">Ver sugestões</a>
                @endif
                <form method="POST" action="{{ route('gm.sessions.library.bulk', $session) }}">
                    @csrf
                    <input type="hidden" name="tipo" value="{{ $type }}">
                    <button type="submit" name="acao" value="manter" class="button button--secondary button--small">Manter todas</button>
                    <button type="submit" name="acao" value="adotar" class="button button--gold button--small"><x-icon name="check" :size="16" /> Adotar todas</button>
                </form>
            </div>
        </section>
    @endif

    <x-search-bar :search="$search" :placeholder="'Buscar '.mb_strtolower($definition['label']).'...'">
        <input type="hidden" name="tipo" value="{{ $type }}">
        <label class="inline-form">
            <span class="visually-hidden">Situação</span>
            <select class="select" name="situacao" data-autosubmit>
                @foreach (App\Http\Controllers\CampaignLibraryController::FILTERS as $key => [$label])
                    <option value="{{ $key }}" @selected($filter === $key)>{{ $label }}</option>
                @endforeach
            </select>
        </label>

        <x-slot:actions>
            <a class="button" href="{{ route('gm.sessions.library.'.$type.'.create', $session) }}"><x-icon name="plus" :size="16" /> Criar na campanha</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($rows as $row)
            @php
                $entry = $row['entry'];
                $status = $row['status'];
                $id = $entry->getKey();
                $hasVersionChanges = $row['changes'] !== [];
            @endphp

            <article @class(['row-card glass library-row', 'library-row--muted' => in_array($status, [CampaignLibrary::HIDDEN, CampaignLibrary::NEW], true), 'library-row--pending' => in_array($status, [CampaignLibrary::UPDATE, CampaignLibrary::NEW], true)])>
                <div class="row-card__main">
                    <span class="row-card__media"><x-icon :name="$definition['icon']" :size="22" /></span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $entry->name }}
                            <span class="badge badge--pill {{ $statusClass[$status] }}">{{ CampaignLibrary::STATUS_LABELS[$status] }}</span>
                        </h3>
                        <p class="row-card__meta">
                            @foreach ($summary($entry) as $part)
                                <span>{{ $part }}</span>
                            @endforeach
                        </p>

                        {{-- Atualização da base: o que mudou, com o valor da campanha e o novo da base. --}}
                        @if ($status === CampaignLibrary::UPDATE && $hasVersionChanges)
                            <dl class="library-diff">
                                @foreach ($row['changes'] as $field)
                                    <div>
                                        <dt>{{ CampaignLibrary::FIELD_LABELS[$field] ?? $field }}</dt>
                                        <dd><span class="library-diff__old">{{ $show($row['version']->getAttribute($field)) }}</span> <x-icon name="arrow-right" :size="14" /> <span class="library-diff__new">{{ $show($row['base']->getAttribute($field)) }}</span></dd>
                                    </div>
                                @endforeach
                            </dl>
                        @elseif ($status === CampaignLibrary::REMOVED)
                            <p class="library-changed">Excluído do catálogo base: esta campanha continua com a sua cópia. Campanhas novas não o recebem.</p>
                        @elseif ($status === CampaignLibrary::CUSTOMIZED && $hasVersionChanges)
                            <p class="library-changed">Diferente da base em: {{ collect($row['changes'])->map(fn ($field) => CampaignLibrary::FIELD_LABELS[$field] ?? $field)->implode(', ') }}</p>
                        @endif
                    </div>
                </div>

                <div class="row-card__actions">
                    @if (in_array($status, [CampaignLibrary::UPDATE, CampaignLibrary::NEW], true))
                        <form method="POST" action="{{ route('gm.sessions.library.keep', [$session, $type, $id]) }}">
                            @csrf @method('PUT')
                            <button type="submit" class="button button--secondary button--small">{{ $status === CampaignLibrary::NEW ? 'Não incluir' : 'Manter da campanha' }}</button>
                        </form>
                        <form method="POST" action="{{ route('gm.sessions.library.adopt', [$session, $type, $id]) }}">
                            @csrf @method('PUT')
                            <button type="submit" class="button button--gold button--small"><x-icon name="check" :size="16" /> {{ $status === CampaignLibrary::NEW ? 'Incluir' : 'Adotar base' }}</button>
                        </form>
                    @endif

                    @if ($status !== CampaignLibrary::NEW)
                        <a class="icon-button icon-button--bordered" href="{{ route('gm.sessions.library.'.$type.'.edit', [$session, $id]) }}" title="Editar nesta campanha" aria-label="Editar {{ $entry->name }} nesta campanha"><x-icon name="pencil" :size="18" /></a>
                    @endif

                    @if ($row['base'] !== null && $status !== CampaignLibrary::NEW)
                        <form method="POST" action="{{ route('gm.sessions.library.visibility', [$session, $type, $id]) }}">
                            @csrf @method('PUT')
                            <input type="hidden" name="hidden" value="{{ $status === CampaignLibrary::HIDDEN ? 0 : 1 }}">
                            <button type="submit" class="icon-button icon-button--bordered" title="{{ $status === CampaignLibrary::HIDDEN ? 'Mostrar nesta campanha' : 'Ocultar nesta campanha' }}" aria-label="{{ $status === CampaignLibrary::HIDDEN ? 'Mostrar' : 'Ocultar' }} {{ $entry->name }}">
                                <x-icon :name="$status === CampaignLibrary::HIDDEN ? 'eye' : 'eye-off'" :size="18" />
                            </button>
                        </form>
                    @endif

                    @if (in_array($status, [CampaignLibrary::CUSTOMIZED, CampaignLibrary::HIDDEN], true) && $hasVersionChanges && $row['base']->archived_at === null)
                        <form method="POST" action="{{ route('gm.sessions.library.destroy', [$session, $type, $id]) }}">
                            @csrf @method('DELETE')
                            <button type="submit" class="icon-button icon-button--bordered" title="Restaurar a versão da base" aria-label="Restaurar {{ $entry->name }} para a versão da base"><x-icon name="rotate-ccw" :size="18" /></button>
                        </form>
                    @endif

                    @if ($status === CampaignLibrary::CAMPAIGN)
                        <x-catalog.delete-button :action="route('gm.sessions.library.destroy', [$session, $type, $id])" :name="$entry->name" />
                    @endif
                </div>
            </article>
        @empty
            <x-empty-state icon="library" :hint="$filter === 'todos' ? 'Crie um cadastro só desta campanha ou peça ao administrador para adicioná-lo à base.' : 'Nenhum item nesta situação.'">
                Nada por aqui.
            </x-empty-state>
        @endforelse
    </div>

    {{ $rows->links() }}

    <x-catalog.delete-modal :type="$singular" warning="Ele sai da biblioteca desta campanha e das fichas que o possuem." />
</x-layouts.app>
