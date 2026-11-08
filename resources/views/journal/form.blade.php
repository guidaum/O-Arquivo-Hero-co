@php
    $controller = \App\Http\Controllers\JournalEntryController::class;
    $editing = $entry->exists;
    $timeline = old('timeline', $entry->timeline ?? []);
    $npcs = old('npcs', $entry->npcs ?? []);
    $sessionOptions = ['' => 'Nenhuma campanha'] + $sessions->pluck('name', 'id')->all();
    $characterOptions = ['' => 'Nenhum personagem (geral da sessão)'] + $characters->pluck('name', 'id')->all();
    $typeOptions = array_combine($controller::TIMELINE_TYPES, $controller::TIMELINE_TYPES);
    $npcStatusOptions = array_combine($controller::NPC_STATUSES, $controller::NPC_STATUSES);
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Novo').' Registro · Diário'">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/catalog.css')">
        <link rel="stylesheet" href="@asset('css/journal.css')">
    @endpush

    <x-page-header :title="$editing ? 'Editar Registro' : 'Novo Registro'" subtitle="Diário de Sessão">
        <x-slot:actions>
            <a class="button button--secondary button--pill" href="{{ $editing ? route('journal.index', ['registro' => $entry->id]) : route('journal.index') }}">Voltar ao Diário</a>
        </x-slot:actions>
    </x-page-header>

    @if ($errors->any())
        <div class="alert alert--error" role="alert">Verifique os campos destacados. {{ $errors->first() }}</div>
    @endif

    <form method="POST" enctype="multipart/form-data" action="{{ $editing ? route('journal.update', $entry) : route('journal.store') }}">
        @csrf
        @if ($editing) @method('PUT') @endif

        <section class="catalog-form glass">
            <h2 class="catalog-form__title">Sobre a sessão</h2>

            <div class="form-grid">
                <x-form.field name="title" label="Título" :value="$entry->title" required maxlength="199" placeholder="Ex.: O Portão de Ferro" />
                <x-form.field name="session_date" label="Data" type="date" :value="$entry->session_date?->format('Y-m-d')" required />
                <x-form.field name="location" label="Local" :value="$entry->location" maxlength="255" placeholder="Ex.: Montanhas do Pico das Sombras" />
                <x-form.field name="duration" label="Duração" :value="$entry->duration" maxlength="64" placeholder="Ex.: 4 horas" />
                <x-form.field name="players_count" label="Jogadores presentes" type="number" :value="$entry->players_count ?? 0" min="0" max="100" />
                <x-form.field name="game_session_id" label="Campanha" type="select" :value="$entry->game_session_id" :options="$sessionOptions" hint="Os participantes da campanha também podem ler este registro." />
                <x-form.field name="character_id" label="Personagem" type="select" :value="$entry->character_id" :options="$characterOptions" />
            </div>

            <x-form.field name="content" label="Resumo da sessão" type="textarea" :value="$entry->content" rows="8" maxlength="100000" placeholder="Escreva o que aconteceu nesta sessão..." />
        </section>

        <section class="catalog-form glass">
            <h2 class="catalog-form__title">Linha do tempo de eventos</h2>

            <div class="repeater" data-repeater>
                <div class="repeater__rows" data-repeater-rows>
                    @foreach ($timeline as $index => $item)
                        @include('journal.partials.timeline-row', ['index' => $index, 'item' => $item])
                    @endforeach
                </div>
                <template data-repeater-template>
                    @include('journal.partials.timeline-row', ['index' => '__INDEX__', 'item' => []])
                </template>
                <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Evento</button>
            </div>
            <x-rules.errors prefix="timeline" />
        </section>

        <section class="catalog-form glass">
            <h2 class="catalog-form__title">NPCs encontrados</h2>

            <div class="repeater" data-repeater>
                <div class="repeater__rows" data-repeater-rows>
                    @foreach ($npcs as $index => $npc)
                        @include('journal.partials.npc-row', ['index' => $index, 'npc' => $npc])
                    @endforeach
                </div>
                <template data-repeater-template>
                    @include('journal.partials.npc-row', ['index' => '__INDEX__', 'npc' => []])
                </template>
                <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> NPC</button>
            </div>
            <x-rules.errors prefix="npcs" />
        </section>

        <div class="form-actions form-actions--sticky glass">
            <span class="muted">{{ $editing ? 'As imagens da galeria são gerenciadas na página do registro.' : 'Depois de criar, você pode adicionar imagens à galeria.' }}</span>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $editing ? 'Salvar Registro' : 'Criar Registro' }}</button>
        </div>
    </form>

    @push('scripts')
        <script type="module" src="@asset('js/core/repeater.js')"></script>
    @endpush
</x-layouts.app>
