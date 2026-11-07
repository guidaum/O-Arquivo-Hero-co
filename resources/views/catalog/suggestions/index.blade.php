<x-layouts.app title="Sugestões · Catálogos">
    @include('catalog.partials.header', ['title' => 'Sugestões de Jogadores'])

    <nav class="tabs tabs--small" aria-label="Situação das sugestões">
        @foreach (\App\Enums\SuggestionStatus::cases() as $option)
            <a class="tabs__link" href="{{ route('catalog.suggestions.index', ['status' => $option->value]) }}" @if ($status === $option) aria-current="page" @endif>
                {{ $option === \App\Enums\SuggestionStatus::Pending ? 'Pendentes' : ($option === \App\Enums\SuggestionStatus::Approved ? 'Aprovadas' : 'Recusadas') }}
            </a>
        @endforeach
    </nav>

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
                    @if ($suggestion->status === \App\Enums\SuggestionStatus::Pending)
                        <a class="button" href="{{ route('catalog.suggestions.review', $suggestion) }}"><x-icon name="check" :size="16" /> Revisar e Aprovar</a>
                        <form method="POST" action="{{ route('catalog.suggestions.reject', $suggestion) }}">
                            @csrf
                            @method('PUT')
                            <button type="submit" class="button button--secondary"><x-icon name="x" :size="16" /> Recusar</button>
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
</x-layouts.app>
