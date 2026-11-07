<x-layouts.app title="Perícias · Catálogos">
    @include('catalog.partials.header', ['title' => 'Biblioteca de Perícias'])

    <x-search-bar :search="$search" placeholder="Buscar perícias...">
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
            <a class="button" href="{{ route('catalog.skills.create') }}"><x-icon name="plus" :size="16" /> Nova Perícia</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($skills as $skill)
            <article class="row-card glass row-card--ember">
                <div class="row-card__main">
                    <span class="row-card__media"><x-icon name="sword" :size="22" /></span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $skill->name }}
                            <span class="badge badge--pill">{{ $skill->type }}</span>
                            @if ($skill->gameSession)
                                <span class="badge badge--pill badge--gm" title="Perícia exclusiva desta campanha">{{ $skill->gameSession->name }}</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span>Custo {{ $skill->purchase_cost }} pts</span>
                            <span>ATP {{ $skill->atp_cost }}</span>
                            @if ($skill->damage) <span>Dano {{ $skill->damage }}</span> @endif
                            @if ($skill->difficulty_formula) <span>Dif. {{ $skill->difficulty_formula }}</span> @endif
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <a class="icon-button icon-button--bordered" href="{{ route('catalog.skills.edit', $skill) }}" title="Editar" aria-label="Editar {{ $skill->name }}"><x-icon name="pencil" :size="18" /></a>
                    <x-catalog.delete-button :action="route('catalog.skills.destroy', $skill)" :name="$skill->name" />
                </div>
            </article>
        @empty
            <x-empty-state>Nenhuma perícia encontrada.</x-empty-state>
        @endforelse
    </div>

    {{ $skills->links() }}

    <x-catalog.delete-modal type="perícia" warning="Ela também sai das fichas dos personagens que a possuem." />
</x-layouts.app>
