@php
    $labels = collect($attributes)->mapWithKeys(fn (array $attribute) => [strtolower($attribute['id']) => $attribute['label']]);
@endphp

<x-layouts.app title="Talentos · Catálogos">
    @include('catalog.partials.header', ['title' => 'Biblioteca de Talentos'])

    <x-search-bar :search="$search" placeholder="Buscar talentos...">
        @if ($categories !== [])
            <label class="inline-form">
                <span class="visually-hidden">Categoria</span>
                <select class="select" name="categoria" data-autosubmit>
                    <option value="">Todas as categorias</option>
                    @foreach ($categories as $option)
                        <option value="{{ $option }}" @selected($category === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </label>
        @endif

        <x-slot:actions>
            <a class="button" href="{{ route('catalog.talents.create') }}"><x-icon name="plus" :size="16" /> Novo Talento</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($talents as $talent)
            <article class="row-card glass row-card--arcane">
                <div class="row-card__main">
                    <span class="row-card__media"><x-icon name="activity" :size="22" /></span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $talent->name }}
                            @if ($talent->category)
                                <span class="badge badge--pill badge--gm">{{ $talent->category }}</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span class="chips">
                                @foreach ((array) $talent->composition as $attributeId)
                                    <span class="chip" title="{{ $labels[strtolower($attributeId)] ?? $attributeId }}">{{ strtoupper($attributeId) }}</span>
                                @endforeach
                            </span>
                            @if ($talent->description)
                                <span>{{ \Illuminate\Support\Str::limit($talent->description, 120) }}</span>
                            @endif
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <a class="icon-button icon-button--bordered" href="{{ route('catalog.talents.edit', $talent) }}" title="Editar" aria-label="Editar {{ $talent->name }}"><x-icon name="pencil" :size="18" /></a>
                    <x-catalog.delete-button :action="route('catalog.talents.destroy', $talent)" :name="$talent->name" />
                </div>
            </article>
        @empty
            <x-empty-state>Nenhum talento encontrado.</x-empty-state>
        @endforelse
    </div>

    {{ $talents->links() }}

    <x-catalog.delete-modal type="talento" warning="Sai do catálogo base e das campanhas criadas depois; as campanhas existentes e as fichas continuam com ele." />
</x-layouts.app>
