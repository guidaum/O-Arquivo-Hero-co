{{--
    Sugestões para as Configurações Base (Admin\SuggestionController):
    criações e alterações feitas pelos mestres nas campanhas e sugestões
    enviadas pelos jogadores na criação de personagem.
--}}
@use('App\Support\CampaignLibrary')
@use('App\Enums\SuggestionStatus')

@php
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

<x-layouts.app title="Sugestões · Painel Admin">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/catalog.css')">
    @endpush

    @include('admin.partials.header')

    <nav class="tabs tabs--small" aria-label="Origem das sugestões">
        @foreach (App\Http\Controllers\Admin\SuggestionController::ORIGINS as $key => $label)
            <a class="tabs__link" href="{{ route('admin.suggestions.index', ['origem' => $key]) }}" @if ($origin === $key) aria-current="page" @endif>
                <x-icon :name="$key === 'campanhas' ? 'scroll-text' : 'users'" :size="16" /> {{ $label }}
                @if ($counts[$key] > 0) <span class="tabs__count">{{ $counts[$key] }}</span> @endif
            </a>
        @endforeach
    </nav>

    @if ($origin === 'campanhas')
        <p class="library-intro muted">
            O que os mestres criaram ou alteraram nas campanhas. Levar para a base atualiza as Configurações Base
            e as outras campanhas recebem a mudança como sugestão; ignorar mantém a mudança só na campanha.
        </p>

        @error('proposal')
            <div class="alert alert--error" role="alert">{{ $message }}</div>
        @enderror

        <div class="row-list">
            @forelse ($proposals as $proposal)
                @php
                    $entry = $proposal['entry'];
                    $definition = CampaignLibrary::TYPES[$proposal['type']];
                    $isNew = $proposal['base'] === null;
                @endphp

                <article class="row-card glass library-row library-row--pending">
                    <div class="row-card__main">
                        <span class="row-card__media"><x-icon :name="$definition['icon']" :size="22" /></span>
                        <div>
                            <h3 class="row-card__title">
                                {{ $entry->name }}
                                <span class="badge badge--pill badge--gm">{{ $definition['label'] }}</span>
                                <span class="badge badge--pill {{ $isNew ? 'badge--player' : 'badge--admin' }}">{{ $isNew ? 'Criado na campanha' : 'Alterado na campanha' }}</span>
                            </h3>
                            <p class="row-card__meta">
                                <span><x-icon name="scroll-text" :size="14" /> {{ $proposal['session']?->name ?? 'Campanha removida' }}</span>
                                <span><x-icon name="calendar" :size="14" /> {{ $entry->proposed_at?->format('d/m/Y H:i') }}</span>
                            </p>

                            @if ($isNew)
                                @if ($entry->description || $entry->effect)
                                    <p class="suggestion-text">{{ \Illuminate\Support\Str::limit((string) ($entry->effect ?: $entry->description), 280) }}</p>
                                @endif
                            @else
                                <dl class="library-diff">
                                    @foreach ($proposal['changes'] as $field)
                                        <div>
                                            <dt>{{ CampaignLibrary::FIELD_LABELS[$field] ?? $field }}</dt>
                                            <dd><span class="library-diff__old">{{ $show($proposal['base']->getAttribute($field)) }}</span> <x-icon name="arrow-right" :size="14" /> <span class="library-diff__new">{{ $show($entry->getAttribute($field)) }}</span></dd>
                                        </div>
                                    @endforeach
                                </dl>
                            @endif
                        </div>
                    </div>

                    <div class="row-card__actions">
                        <form method="POST" action="{{ route('admin.suggestions.dismiss', [$proposal['type'], $entry]) }}">
                            @csrf @method('PUT')
                            <button type="submit" class="button button--secondary button--small"><x-icon name="x" :size="16" /> Ignorar</button>
                        </form>
                        <form method="POST" action="{{ route('admin.suggestions.promote', [$proposal['type'], $entry]) }}">
                            @csrf @method('PUT')
                            <button type="submit" class="button button--gold button--small"><x-icon name="check" :size="16" /> Levar para a base</button>
                        </form>
                    </div>
                </article>
            @empty
                <x-empty-state icon="library" hint="Quando um mestre criar ou alterar algo na biblioteca da campanha, aparece aqui.">
                    Nenhuma sugestão das campanhas.
                </x-empty-state>
            @endforelse
        </div>

        {{ $proposals->links() }}
    @else
        <nav class="tabs tabs--small" aria-label="Situação das sugestões">
            @foreach (SuggestionStatus::cases() as $option)
                <a class="tabs__link" href="{{ route('admin.suggestions.index', ['origem' => 'jogadores', 'status' => $option->value]) }}" @if ($status === $option) aria-current="page" @endif>
                    {{ $option === SuggestionStatus::Pending ? 'Pendentes' : ($option === SuggestionStatus::Approved ? 'Aprovadas' : 'Recusadas') }}
                </a>
            @endforeach
        </nav>

        @error('suggestion')
            <div class="alert alert--error" role="alert">{{ $message }}</div>
        @enderror

        <div class="row-list">
            @forelse ($suggestions as $suggestion)
                @php($data = $suggestion->formData())
                <article class="row-card glass">
                    <div class="row-card__main">
                        <span class="row-card__media"><x-icon name="lightbulb" :size="22" /></span>
                        <div>
                            <h3 class="row-card__title">
                                {{ $suggestion->name() }}
                                <span class="badge badge--pill badge--gm">{{ $suggestion->type->label() }}</span>
                                @isset($data['type'])
                                    <span class="badge badge--pill">{{ $data['type'] }}</span>
                                @endisset
                            </h3>
                            <p class="row-card__meta">
                                <span><x-icon name="user" :size="14" /> {{ $suggestion->user?->name ?? 'Jogador removido' }}</span>
                                <span><x-icon name="calendar" :size="14" /> {{ $suggestion->created_at?->format('d/m/Y') }}</span>
                                @isset($data['purchase_cost']) <span>Custo {{ $data['purchase_cost'] }} pts</span> @endisset
                                @isset($data['modifier']) <span>Modificador {{ $data['modifier'] }}</span> @endisset
                            </p>
                            @if (! empty($data['effect']) || ! empty($data['description']))
                                <p class="suggestion-text">{{ \Illuminate\Support\Str::limit((string) ($data['effect'] ?? $data['description']), 280) }}</p>
                            @endif
                        </div>
                    </div>

                    <div class="row-card__actions">
                        @if ($suggestion->status === SuggestionStatus::Pending)
                            <a class="button button--small" href="{{ route('catalog.suggestions.review', $suggestion) }}"><x-icon name="check" :size="16" /> Revisar e Aprovar</a>
                            <form method="POST" action="{{ route('catalog.suggestions.reject', $suggestion) }}">
                                @csrf
                                @method('PUT')
                                <button type="submit" class="button button--secondary button--small"><x-icon name="x" :size="16" /> Recusar</button>
                            </form>
                        @endif
                        <x-catalog.delete-button :action="route('catalog.suggestions.destroy', $suggestion)" :name="$suggestion->name()" />
                    </div>
                </article>
            @empty
                <x-empty-state>Nenhuma sugestão {{ mb_strtolower($status->label()) }}.</x-empty-state>
            @endforelse
        </div>

        {{ $suggestions->links() }}

        <x-catalog.delete-modal type="sugestão" />
    @endif
</x-layouts.app>
