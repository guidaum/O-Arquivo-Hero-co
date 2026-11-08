@php
    $filters = array_filter([
        'visao' => $view !== 'tudo' ? $view : null,
        'campanha' => $currentSession?->id,
        'personagem' => $currentCharacter?->id,
    ]);
    $canEdit = $entry && auth()->user()->can('update', $entry);
    $cover = $entry?->images->first()?->url ?? $entry?->gameSession?->image_url;
    $statusTone = ['completed' => 'done', 'current' => 'current', 'upcoming' => 'planned'];
@endphp

<x-layouts.app title="Diário de Sessão">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/journal.css')">
    @endpush

    <header class="journal-header">
        <div class="journal-header__start">
            <h1 class="journal-header__title text-glow-arcane">Diário de Sessão</h1>

            @if ($entries->isNotEmpty())
                <form method="GET" action="{{ route('journal.index') }}">
                    @foreach ($filters as $name => $value)
                        <input type="hidden" name="{{ $name }}" value="{{ $value }}">
                    @endforeach
                    <label class="visually-hidden" for="journal-entry">Registro</label>
                    <select class="select journal-header__select" id="journal-entry" name="registro" data-autosubmit>
                        @foreach ($entries as $option)
                            <option value="{{ $option->id }}" @selected($entry?->id === $option->id)>
                                {{ $option->title }} ({{ $option->session_date?->format('d/m/Y') ?? 'sem data' }})
                            </option>
                        @endforeach
                    </select>
                    <noscript><button type="submit" class="button button--secondary">Abrir</button></noscript>
                </form>
            @endif
        </div>

        <div class="journal-header__actions">
            @can('use-feature', 'worldMap')
                <a class="button button--secondary" href="{{ route('world-map.index') }}"><x-icon name="compass" :size="16" /> Mapa do Mundo</a>
            @endcan
            <a class="button" href="{{ route('journal.create', array_filter(['campanha' => $currentSession?->id, 'personagem' => $currentCharacter?->id])) }}">
                <x-icon name="plus" :size="16" /> Novo Registro
            </a>
        </div>
    </header>

    <div class="journal-filters glass">
        <span class="eyebrow"><x-icon name="filter" :size="14" /> Visualizar</span>

        <a @class(['journal-filters__option', 'is-active' => $view === 'tudo']) href="{{ route('journal.index') }}">
            <x-icon name="scroll-text" :size="14" /> Meus registros
        </a>

        @if ($sessions->isNotEmpty())
            <form @class(['journal-filters__option', 'is-active' => $view === 'campanha']) method="GET" action="{{ route('journal.index') }}">
                <input type="hidden" name="visao" value="campanha">
                <x-icon name="history" :size="14" />
                <label class="visually-hidden" for="filter-session">Campanha</label>
                <select class="select" id="filter-session" name="campanha" data-autosubmit>
                    <option value="">Campanha...</option>
                    @foreach ($sessions as $option)
                        <option value="{{ $option->id }}" @selected($currentSession?->id === $option->id)>{{ $option->name }}</option>
                    @endforeach
                </select>
            </form>
        @endif

        @if ($characters->isNotEmpty())
            <form @class(['journal-filters__option', 'is-active' => $view === 'personagem']) method="GET" action="{{ route('journal.index') }}">
                <input type="hidden" name="visao" value="personagem">
                <x-icon name="shield" :size="14" />
                <label class="visually-hidden" for="filter-character">Personagem</label>
                <select class="select" id="filter-character" name="personagem" data-autosubmit>
                    <option value="">Personagem...</option>
                    @foreach ($characters as $option)
                        <option value="{{ $option->id }}" @selected($currentCharacter?->id === $option->id)>{{ $option->name }}</option>
                    @endforeach
                </select>
            </form>
        @endif
    </div>

    @if ($entry)
        <section class="journal-hero">
            @if ($cover)
                <img class="journal-hero__image" src="{{ $cover }}" alt="" referrerpolicy="no-referrer">
            @endif

            <div class="journal-hero__content">
                <div class="journal-hero__top">
                    <div>
                        <div class="journal-hero__badges">
                            <span class="badge badge--pill badge--gm">Registro</span>
                            @if ($entry->character)
                                <span class="badge badge--pill badge--admin"><x-icon name="shield" :size="10" /> {{ $entry->character->name }}</span>
                            @endif
                            @if ($entry->gameSession)
                                <span class="badge badge--pill">{{ $entry->gameSession->name }}</span>
                            @endif
                            @if ($entry->session_date)
                                <span class="journal-hero__date"><x-icon name="calendar" :size="14" /> {{ $entry->session_date->format('d/m/Y') }}</span>
                            @endif
                        </div>
                        <h2 class="journal-hero__title text-glow-arcane">{{ $entry->title }}</h2>
                        @if ($entry->user_id !== auth()->id())
                            <p class="eyebrow">Escrito por {{ $entry->user?->name ?? 'autor removido' }}</p>
                        @endif
                    </div>

                    @if ($canEdit)
                        <div class="journal-hero__actions">
                            <a class="icon-button icon-button--bordered" href="{{ route('journal.edit', $entry) }}" title="Editar registro" aria-label="Editar registro"><x-icon name="pencil" :size="20" /></a>
                            <button
                                type="button"
                                class="icon-button icon-button--danger"
                                title="Excluir registro"
                                aria-label="Excluir registro"
                                data-modal-open="confirm-delete"
                                data-modal-action="{{ route('journal.destroy', $entry) }}"
                                data-modal-text-name="{{ $entry->title }}"
                            ><x-icon name="trash" :size="20" /></button>
                        </div>
                    @endif
                </div>

                <div class="journal-hero__meta">
                    <span><x-icon name="map" :size="16" /> {{ $entry->location ?: 'Local desconhecido' }}</span>
                    <span><x-icon name="clock" :size="16" /> {{ $entry->duration ?: '—' }}</span>
                    <span><x-icon name="users" :size="16" /> {{ $entry->players_count }} {{ $entry->players_count === 1 ? 'Jogador' : 'Jogadores' }}</span>
                </div>
            </div>
        </section>

        <div class="journal-grid">
            <div class="journal-grid__main">
                <section class="journal-card glass">
                    <h3 class="section__title"><x-icon name="scroll" :size="24" /> Resumo da Sessão</h3>
                    <div class="journal-summary">
                        @forelse (preg_split('/\R/', (string) $entry->content, -1, PREG_SPLIT_NO_EMPTY) as $paragraph)
                            <p>{{ $paragraph }}</p>
                        @empty
                            <p class="muted">Nenhum resumo escrito para este registro...</p>
                        @endforelse
                    </div>
                </section>

                <section class="journal-card glass">
                    <h3 class="section__title section--ember"><x-icon name="clock" :size="24" /> Linha do Tempo de Eventos</h3>

                    @if (empty($entry->timeline))
                        <p class="muted">Nenhum evento registrado.</p>
                    @else
                        <ol class="timeline">
                            @foreach ($entry->timeline as $item)
                                <li class="timeline__item timeline__item--{{ $statusTone[$item['status'] ?? 'completed'] ?? 'done' }}">
                                    <div class="timeline__head">
                                        @if (! empty($item['time']))
                                            <span class="timeline__time">{{ $item['time'] }}</span>
                                        @endif
                                        <span class="badge badge--pill timeline-type timeline-type--{{ \Illuminate\Support\Str::slug($item['type'] ?? 'exploracao') }}">{{ $item['type'] ?? 'Exploração' }}</span>
                                        <span class="timeline__status">{{ \App\Http\Controllers\JournalEntryController::TIMELINE_STATUSES[$item['status'] ?? 'completed'] ?? 'Concluído' }}</span>
                                    </div>
                                    <p class="timeline__event">{{ $item['event'] ?? '' }}</p>
                                </li>
                            @endforeach
                        </ol>
                    @endif
                </section>
            </div>

            <aside class="journal-grid__side">
                <section class="journal-card glass">
                    <h3 class="section__title"><x-icon name="users" :size="24" /> NPCs Encontrados</h3>

                    @forelse ((array) $entry->npcs as $npc)
                        @php($npcImage = $entry->npcImageUrl($npc))
                        <article class="npc">
                            <span class="npc__image">
                                @if ($npcImage)
                                    <img src="{{ $npcImage }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                                @else
                                    <x-icon name="user" :size="22" />
                                @endif
                            </span>
                            <div>
                                <h4 class="npc__name">{{ $npc['name'] ?? 'NPC' }}</h4>
                                @if (! empty($npc['role'])) <p class="npc__role">{{ $npc['role'] }}</p> @endif
                            </div>
                            <span class="badge badge--pill npc-status npc-status--{{ \Illuminate\Support\Str::slug($npc['status'] ?? 'neutro') }}">{{ $npc['status'] ?? 'Neutro' }}</span>
                        </article>
                    @empty
                        <p class="muted">Nenhum NPC registrado.</p>
                    @endforelse
                </section>

                <section class="journal-card glass">
                    <h3 class="section__title"><x-icon name="image" :size="24" /> Galeria</h3>

                    @if ($entry->images->isEmpty())
                        <p class="muted">Nenhuma imagem na galeria.</p>
                    @else
                        <div class="gallery">
                            @foreach ($entry->images as $image)
                                <div class="gallery__item">
                                    <button type="button" class="gallery__open" data-modal-open="lightbox" data-modal-image="{{ $image->url }}" aria-label="Ampliar imagem {{ $loop->iteration }}">
                                        <img src="{{ $image->url }}" alt="Imagem {{ $loop->iteration }} da galeria" loading="lazy" referrerpolicy="no-referrer">
                                    </button>
                                    @if ($canEdit)
                                        <form method="POST" action="{{ route('journal.images.destroy', [$entry, $image]) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="gallery__remove" title="Remover imagem" aria-label="Remover imagem {{ $loop->iteration }}"><x-icon name="x" :size="14" /></button>
                                        </form>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @endif

                    @if ($canEdit)
                        <form class="gallery-upload" method="POST" action="{{ route('journal.images.store', $entry) }}" enctype="multipart/form-data">
                            @csrf
                            <label class="field__label" for="gallery-images">Adicionar imagens</label>
                            <input class="field__input" id="gallery-images" type="file" name="images[]" accept="image/jpeg,image/png,image/webp,image/gif" multiple required>
                            @error('images') <p class="field__error">{{ $message }}</p> @enderror
                            @error('images.*') <p class="field__error">{{ $message }}</p> @enderror
                            <button type="submit" class="button button--secondary"><x-icon name="plus" :size="16" /> Enviar</button>
                        </form>
                    @endif
                </section>
            </aside>
        </div>

        <x-modal id="lightbox" title="Imagem da galeria" wide>
            <img class="lightbox__image" src="" alt="Imagem ampliada" data-modal-image referrerpolicy="no-referrer">
        </x-modal>

        <x-catalog.delete-modal type="registro" warning="As imagens da galeria e dos NPCs também serão apagadas." />
    @else
        <div class="row-list">
            <x-empty-state>
                Nenhum registro encontrado. <a href="{{ route('journal.create') }}">Escreva o primeiro registro do seu diário.</a>
            </x-empty-state>
        </div>
    @endif
</x-layouts.app>
