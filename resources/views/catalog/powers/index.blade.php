<x-layouts.app title="Poderes · Catálogos">
    @include('catalog.partials.header', ['title' => 'Biblioteca de Poderes'])

    <x-search-bar :search="$search" placeholder="Buscar poderes por nome ou efeito...">
        <label class="inline-form">
            <span class="visually-hidden">Tipo</span>
            <select class="select" name="tipo" data-autosubmit>
                <option value="">Todos os tipos</option>
                @foreach ($types as $option)
                    <option value="{{ $option }}" @selected($type === $option)>{{ $option }}</option>
                @endforeach
            </select>
        </label>

        <x-slot:actions>
            <a class="button" href="{{ route('catalog.powers.create') }}"><x-icon name="plus" :size="16" /> Novo Poder</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($powers as $power)
            <article class="row-card glass row-card--arcane">
                <div class="row-card__main">
                    <span class="row-card__media"><x-icon name="zap" :size="22" /></span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $power->name }}
                            <span class="badge badge--pill badge--gm">{{ $power->type }}</span>
                            @if ($power->gameSession)
                                <span class="badge badge--pill" title="Poder exclusivo desta campanha">{{ $power->gameSession->name }}</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span>Custo {{ $power->purchase_cost }} pts</span>
                            @if ($power->cost) <span>Uso: {{ $power->cost }}</span> @endif
                            @if ($power->difficulty_formula) <span>Dif. {{ $power->difficulty_formula }}</span> @endif
                            @if ($power->effect) <span>{{ \Illuminate\Support\Str::limit($power->effect, 120) }}</span> @endif
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <a class="icon-button icon-button--bordered" href="{{ route('catalog.powers.edit', $power) }}" title="Editar" aria-label="Editar {{ $power->name }}"><x-icon name="pencil" :size="18" /></a>
                    <x-catalog.delete-button :action="route('catalog.powers.destroy', $power)" :name="$power->name" />
                </div>
            </article>
        @empty
            <x-empty-state>Nenhum poder encontrado.</x-empty-state>
        @endforelse
    </div>

    {{ $powers->links() }}

    <x-catalog.delete-modal type="poder" warning="Ele também sai das fichas dos personagens que o possuem." />
</x-layouts.app>
