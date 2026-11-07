<x-layouts.app title="Vantagens & Defeitos · Catálogos">
    @include('catalog.partials.header', ['title' => 'Vantagens & Defeitos'])

    <x-search-bar :search="$search" placeholder="Buscar por nome ou efeito...">
        <label class="inline-form">
            <span class="visually-hidden">Tipo</span>
            <select class="select" name="tipo" data-autosubmit>
                <option value="">Vantagens e defeitos</option>
                @foreach (\App\Enums\TraitType::cases() as $option)
                    <option value="{{ $option->value }}" @selected($type === $option)>{{ $option === \App\Enums\TraitType::Advantage ? 'Só vantagens' : 'Só defeitos' }}</option>
                @endforeach
            </select>
        </label>

        <x-slot:actions>
            <a class="button" href="{{ route('catalog.traits.create') }}"><x-icon name="plus" :size="16" /> Nova Vantagem/Defeito</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($traits as $trait)
            @php
                $advantage = $trait->type === \App\Enums\TraitType::Advantage;
                $modifier = $calculator->effectiveModifier($trait);
                $target = $trait->modifierTalent?->name
                    ?? ($trait->modifier_attribute ? $calculator->targetDisplayName($trait->modifier_attribute, $attributes) : null);
            @endphp
            <article @class(['row-card', 'glass', 'row-card--arcane' => $advantage, 'row-card--ember' => ! $advantage])>
                <div class="row-card__main">
                    <span class="row-card__media"><x-icon :name="$advantage ? 'sparkles' : 'alert-triangle'" :size="22" /></span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $trait->name }}
                            <span @class(['badge', 'badge--pill', 'badge--gm' => $advantage, 'badge--player' => ! $advantage])>{{ $advantage ? 'Vantagem' : 'Defeito' }}</span>
                            <span class="badge badge--pill badge--admin">{{ $calculator->cost($trait) }} pts</span>
                        </h3>
                        <p class="row-card__meta">
                            @if ($target)
                                <span>{{ $modifier > 0 ? '+'.$modifier : $modifier }} em {{ $target }}</span>
                            @endif
                            @if ($trait->effect)
                                <span>{{ \Illuminate\Support\Str::limit($trait->effect, 120) }}</span>
                            @endif
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <a class="icon-button icon-button--bordered" href="{{ route('catalog.traits.edit', $trait) }}" title="Editar" aria-label="Editar {{ $trait->name }}"><x-icon name="pencil" :size="18" /></a>
                    <x-catalog.delete-button :action="route('catalog.traits.destroy', $trait)" :name="$trait->name" />
                </div>
            </article>
        @empty
            <x-empty-state>Nenhuma vantagem ou defeito encontrado.</x-empty-state>
        @endforelse
    </div>

    {{ $traits->links() }}

    <x-catalog.delete-modal type="vantagem/defeito" warning="Ele também sai das fichas dos personagens que o possuem." />
</x-layouts.app>
