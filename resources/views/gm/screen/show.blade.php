{{--
    Escudo do Mestre: apoio à campanha durante a sessão. Três colunas no
    desktop (grupo e NPCs | mesa de trabalho | chat fixo), empilhadas no
    celular. Vida usa public/js/gm/health.js; anotações, referências, notas
    do mestre, abas e ficha em popup ficam em public/js/gm-screen/.
--}}
@php
    $config = [
        'storageKey' => 'gm-screen:'.$session->id,
        'notes' => [
            'url' => route('sessions.notes.index', $session),
            'categories' => App\Http\Controllers\QuickNoteController::CATEGORIES,
        ],
        'references' => [
            'items' => $references,
            'storeUrl' => route('gm.sessions.references.store', $session),
            'baseUrl' => url('/mestre/sessoes/'.$session->id.'/referencias'),
            'categories' => App\Models\GameSessionReference::CATEGORIES,
        ],
    ];
@endphp

<x-layouts.app :title="'Escudo · '.$session->name">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/gm-session.css')">
        <link rel="stylesheet" href="@asset('css/gm-screen.css')">
    @endpush

    <x-page-header :title="$session->name" subtitle="Escudo do Mestre" :back="route('gm.sessions.show', $session)" back-label="Painel do Mestre" class="gm-screen__header">
        <x-slot:badges>
            <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Escudo do Mestre</span>
            <button type="button" class="badge badge--pill screen-code" data-copy="{{ $session->code }}" title="Copiar o código de convite">
                <x-icon name="key" :size="12" /> {{ $session->code }}
            </button>
        </x-slot:badges>

        <x-slot:actions>
            @can('use-feature', 'journal')
                <a class="button button--secondary button--pill" href="{{ route('journal.index', ['visao' => 'campanha', 'campanha' => $session->id]) }}">
                    <x-icon name="book-open" /> Diário
                </a>
            @endcan
            <a class="button button--secondary button--pill" href="{{ route('gm.sessions.show', [$session, 'aba' => 'bestiario']) }}">
                <x-icon name="skull" /> Bestiário
            </a>
            <a class="button button--secondary button--pill" href="{{ route('gm.sessions.show', [$session, 'aba' => 'encontros']) }}">
                <x-icon name="swords" /> Encontros
            </a>
        </x-slot:actions>
    </x-page-header>

    <div class="gm-screen" data-gm-screen data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
        <div class="gm-screen__column gm-screen__column--party">
            @include('gm.screen.partials.party')
            @include('gm.screen.partials.npcs')
        </div>

        <div class="gm-screen__column gm-screen__column--desk">
            @include('gm.screen.partials.desk')
        </div>

        <aside class="gm-screen__column gm-screen__column--chat" aria-label="Chat da campanha">
            <x-session-chat :session="$session" docked />
        </aside>
    </div>

    {{-- Ficha em popup (a página da ficha embutida, sem o menu do app). --}}
    <x-modal id="gm-screen-sheet" title="Ficha" wide class="sheet-popup">
        <iframe class="sheet-popup__frame" data-sheet-frame title="Ficha do personagem" src="about:blank"></iframe>
        <div class="sheet-popup__actions">
            <a class="button button--link" data-sheet-link href="#" target="_blank" rel="noopener"><x-icon name="link" :size="14" /> Abrir em nova aba</a>
            <button type="button" class="button button--secondary" data-modal-close>Fechar</button>
        </div>
    </x-modal>

    {{-- Adicionar ou editar uma referência visual. --}}
    <x-modal id="gm-screen-reference" title="Referência">
        <form class="screen-reference-form" data-reference-form novalidate>
            <x-form.field name="title" label="Título" maxlength="255" placeholder="Ex.: Fortaleza de Vel'Darak" />
            <label class="field">
                <span class="field__label">Categoria</span>
                <select class="select" name="category" data-reference-category></select>
            </label>

            <fieldset class="screen-reference-form__image" data-reference-image>
                <legend class="field__label">Imagem</legend>
                <label class="field">
                    <span class="field__label">Arquivo (JPG, PNG, WEBP ou GIF, até 10 MB)</span>
                    <input class="field__input" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif">
                </label>
                <label class="field">
                    <span class="field__label">ou o link de uma imagem</span>
                    <input class="field__input" type="url" name="image_url" maxlength="255" placeholder="https://...">
                </label>
            </fieldset>

            <label class="field">
                <span class="field__label">Anotações (só você vê)</span>
                <textarea class="field__input" name="notes" rows="3" maxlength="5000" placeholder="O que esta imagem representa, quando mostrar..."></textarea>
            </label>

            <p class="field__error" data-reference-error role="alert"></p>

            <div class="modal__actions">
                <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar</button>
            </div>
        </form>
    </x-modal>

    <x-action-menu :session="$session" notes="none" :chat="false" />

    @push('scripts')
        <script type="module" src="@asset('js/gm-screen/index.js')"></script>
    @endpush
</x-layouts.app>
