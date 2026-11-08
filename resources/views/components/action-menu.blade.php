@props(['session' => null, 'character' => null, 'notes' => 'character'])

{{--
    Menu de Ações (ActionMenu.tsx): botão flutuante que abre o Rolador de
    Dados, o Chat da Sessão e as Anotações Rápidas. Só uma ferramenta fica
    aberta por vez (eventos tool:toggle / tool:state em public/js/tools/).
    $notes escolhe o escopo inicial das anotações: "character" ou "campaign".
--}}
@php
    $user = auth()->user();
    $showChat = $session !== null && $user->can('view', $session);
    $speaker = $character !== null && $character->user_id === $user->id ? $character : null;
    $ruleSet = App\Game\GameRules::forSession($session)->ruleSet();

    $noteScopes = [];
    if ($character !== null && $user->can('update', $character)) {
        $noteScopes['character'] = ['label' => 'Personagem', 'name' => $character->name, 'url' => route('characters.notes.index', $character)];
    }
    if ($session !== null && $user->can('update', $session)) {
        $noteScopes['campaign'] = ['label' => 'Campanha', 'name' => $session->name, 'url' => route('sessions.notes.index', $session)];
    }
    if (isset($noteScopes[$notes])) {
        $noteScopes = [$notes => $noteScopes[$notes]] + $noteScopes;
    }

    $soundUrls = App\Support\Sounds::urls($ruleSet);
    $diceConfig = [
        'rollUrl' => route('dice.roll'),
        'sessionId' => $showChat ? $session->id : null,
        'characterId' => $speaker?->id,
        'sounds' => [
            'diceRoll' => $soundUrls['dice_roll'],
            'success' => $soundUrls['success'],
            'failure' => $soundUrls['failure'],
            'critical' => $soundUrls['critical'],
            'fumble' => $soundUrls['fumble'],
        ],
    ];

    // Ambientação: todo participante da campanha ouve; o mestre controla.
    $showAmbience = $showChat;
    $ambienceGm = $showAmbience && $user->can('update', $session);
    $ambienceConfig = $showAmbience ? [
        'stateUrl' => route('ambience.state', $session),
        'updateUrl' => $ambienceGm ? route('ambience.update', $session) : null,
        'effectUrl' => $ambienceGm ? route('ambience.effect', $session) : null,
        'isGm' => $ambienceGm,
        'sounds' => $soundUrls,
        'effects' => App\Support\Sounds::effectList(),
        'soundscapes' => collect(App\Support\Sounds::SOUNDSCAPES)->map(static fn (array $scape, string $key): array => ['key' => $key, 'label' => $scape[0], 'description' => $scape[1]])->values()->all(),
        'tracks' => $ambienceGm
            ? App\Models\CustomSound::query()->availableTo($user, $session)->orderBy('name')->get(['id', 'name', 'category'])
                ->map(static fn (App\Models\CustomSound $sound): array => ['id' => $sound->id, 'name' => $sound->name, 'ambient' => $sound->category === 'ambient'])->all()
            : [],
    ] : null;
    $dice = [
        4 => 'Dano leve / Adaga',
        6 => 'Ataque / Dano básico',
        8 => 'Espada / Magias',
        10 => 'Armas pesadas / Truques',
        12 => 'Machado grande',
        20 => 'Ataques & Testes',
        100 => 'Percentual / Tabelas',
    ];
@endphp

@once
    @push('styles')
        <link rel="stylesheet" href="@asset('css/tools.css')">
    @endpush
    @push('scripts')
        <script type="module" src="@asset('js/tools/action-menu.js')"></script>
        <script type="module" src="@asset('js/tools/dice-roller.js')"></script>
        @if ($noteScopes !== [])
            <script type="module" src="@asset('js/tools/quick-notes.js')"></script>
        @endif
        @if ($showAmbience)
            <script type="module" src="@asset('js/tools/ambience.js')"></script>
        @endif
    @endpush
@endonce

<div @class(['action-menu', 'action-menu--four' => $showAmbience]) data-action-menu>
    <p class="action-menu__toast" data-action-toast role="status" hidden></p>

    {{-- Rolador de Dados --}}
    <section class="tool-panel dice" data-dice data-config="{{ json_encode($diceConfig, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}" hidden aria-label="Rolador de Dados">
        <header class="tool-panel__header">
            <span class="icon-tile"><x-icon name="die-20" :size="18" /></span>
            <div class="tool-panel__title">
                <h2>Rolador de Dados</h2>
                <p class="eyebrow">{{ $showChat ? 'Resultados vão para o chat' : 'Rolagem livre' }}</p>
            </div>
            <nav class="tabs tabs--small dice-tabs" aria-label="Rolador ou histórico">
                <button type="button" class="tabs__link" aria-current="page" data-dice-tab="roller">Rolador</button>
                <button type="button" class="tabs__link" data-dice-tab="history">Histórico</button>
            </nav>
            <button type="button" class="icon-button" data-dice-sound aria-pressed="true" title="Som ativado (clique para silenciar)">
                <x-icon name="volume" :size="18" />
            </button>
            <button type="button" class="icon-button" data-tool-close="dice" title="Fechar o rolador"><x-icon name="x" :size="18" /></button>
        </header>

        <div class="tool-panel__body" data-dice-view="roller">
            <div class="dice-picker" role="radiogroup" aria-label="Tipo de dado">
                @foreach ($dice as $sides => $description)
                    <button type="button" class="dice-picker__die dice-picker__die--d{{ $sides }}" role="radio" aria-checked="{{ $sides === 20 ? 'true' : 'false' }}" data-die="{{ $sides }}" title="D{{ $sides }}: {{ $description }} (clique para rolar)">
                        <x-icon :name="'die-'.$sides" :size="26" />
                        <span>d{{ $sides }}</span>
                    </button>
                @endforeach
            </div>

            <div class="dice-controls">
                <label class="dice-stepper">
                    <span class="eyebrow">Quantidade</span>
                    <span class="dice-stepper__row">
                        <button type="button" class="icon-button icon-button--bordered" data-step="quantity" data-delta="-1" aria-label="Menos dados">−</button>
                        <input class="field__input" type="number" min="1" max="{{ App\Http\Controllers\DiceRollController::MAX_QUANTITY }}" value="1" data-dice-quantity aria-label="Quantidade de dados">
                        <button type="button" class="icon-button icon-button--bordered" data-step="quantity" data-delta="1" aria-label="Mais dados">+</button>
                    </span>
                </label>
                <label class="dice-stepper">
                    <span class="eyebrow">Modificador</span>
                    <span class="dice-stepper__row">
                        <button type="button" class="icon-button icon-button--bordered" data-step="modifier" data-delta="-1" aria-label="Diminuir modificador">−</button>
                        <input class="field__input" type="number" min="-100" max="100" value="0" data-dice-modifier aria-label="Modificador">
                        <button type="button" class="icon-button icon-button--bordered" data-step="modifier" data-delta="1" aria-label="Aumentar modificador">+</button>
                    </span>
                </label>
            </div>

            <div class="segmented segmented--full" role="group" aria-label="Vantagem">
                <button type="button" class="segmented__option" aria-pressed="false" data-dice-mode="disadvantage">Desvantagem</button>
                <button type="button" class="segmented__option" aria-pressed="true" data-dice-mode="normal">Normal</button>
                <button type="button" class="segmented__option" aria-pressed="false" data-dice-mode="advantage">Vantagem</button>
            </div>

            <div class="dice-target">
                <label class="dice-target__switch">
                    <span class="switch">
                        <input type="checkbox" data-dice-target-toggle>
                        <span class="switch__track"><span class="switch__thumb"></span></span>
                    </span>
                    <x-icon name="target" :size="14" /> Meta
                </label>
                <input class="field__input" type="number" min="-100" max="1000" value="15" data-dice-target placeholder="Ex.: 15" aria-label="Meta" disabled>
                <button type="button" class="chip dice-target__mode" data-dice-under aria-pressed="true" title="Menor é melhor: passa quem rolar até a meta">Menor é melhor (≤)</button>
            </div>

            <button type="button" class="button button--block dice-roll-button" data-dice-roll>
                <x-icon name="dice" /> Rolar <span data-dice-formula>1d20</span>
            </button>
            <p class="tool-panel__error" data-dice-error role="alert"></p>

            {{-- Animação: o dado gira enquanto o servidor rola. --}}
            <div class="dice-stage" data-dice-stage hidden aria-live="polite">
                <svg class="dice-stage__die" viewBox="0 0 100 100" aria-hidden="true" data-dice-shape>
                    <polygon points="50,6 92,28 92,72 50,94 8,72 8,28" data-dice-polygon />
                    <text x="50" y="58" text-anchor="middle" data-dice-face>20</text>
                </svg>
                <div class="dice-stage__result" data-dice-result></div>
                <div class="dice-stage__actions">
                    <button type="button" class="button button--secondary" data-dice-stage-close>Fechar</button>
                    <button type="button" class="button" data-dice-reroll><x-icon name="rotate-ccw" :size="16" /> Rolar de novo</button>
                </div>
            </div>
        </div>

        <div class="tool-panel__body" data-dice-view="history" hidden>
            <dl class="dice-stats" data-dice-stats></dl>
            <div class="dice-history__toolbar">
                <select class="select" data-dice-filter aria-label="Filtrar por dado">
                    <option value="all">Todos os dados</option>
                    @foreach (array_keys($dice) as $sides)
                        <option value="{{ $sides }}">d{{ $sides }}</option>
                    @endforeach
                </select>
                <button type="button" class="button button--secondary" data-dice-clear><x-icon name="trash" :size="16" /> <span data-dice-clear-label>Limpar</span></button>
                <button type="button" class="button button--secondary" data-dice-undo hidden><x-icon name="rotate-ccw" :size="16" /> Desfazer</button>
            </div>
            <ol class="dice-history" data-dice-history></ol>
        </div>
    </section>

    {{-- Anotações Rápidas --}}
    @if ($noteScopes !== [])
        <section class="tool-panel notes" data-notes data-config="{{ json_encode(['scopes' => $noteScopes, 'categories' => App\Http\Controllers\QuickNoteController::CATEGORIES], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}" hidden aria-label="Anotações Rápidas">
            <header class="tool-panel__header">
                <span class="icon-tile icon-tile--gold"><x-icon name="feather" :size="18" /></span>
                <div class="tool-panel__title">
                    <h2>Anotações Rápidas</h2>
                    <p class="eyebrow" data-notes-target></p>
                </div>
                <button type="button" class="icon-button" data-tool-close="notes" title="Fechar as anotações"><x-icon name="x" :size="18" /></button>
            </header>

            <div class="tool-panel__body">
                @if (count($noteScopes) > 1)
                    <div class="segmented segmented--full" role="group" aria-label="Anotações de">
                        @foreach ($noteScopes as $key => $scope)
                            <button type="button" class="segmented__option" aria-pressed="false" data-notes-scope="{{ $key }}">{{ $scope['label'] }}</button>
                        @endforeach
                    </div>
                @endif

                <div class="notes-toolbar">
                    <input class="field__input" type="search" placeholder="Buscar anotações..." data-notes-search aria-label="Buscar anotações">
                    <button type="button" class="button" data-notes-new><x-icon name="plus" :size="16" /> Nova</button>
                </div>
                <div class="chips notes-categories" data-notes-tabs role="tablist" aria-label="Categorias"></div>

                <form class="notes-editor" data-notes-form hidden>
                    <input class="field__input" name="title" maxlength="255" placeholder="Título" aria-label="Título">
                    <textarea class="field__input" name="content" rows="4" maxlength="5000" placeholder="Escreva aqui..." aria-label="Texto"></textarea>
                    <div class="chips" data-notes-category role="radiogroup" aria-label="Categoria"></div>
                    <p class="tool-panel__error" data-notes-error role="alert"></p>
                    <div class="notes-editor__actions">
                        <button type="button" class="button button--secondary" data-notes-cancel>Cancelar</button>
                        <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar</button>
                    </div>
                </form>

                <ul class="notes-list" data-notes-list aria-live="polite"></ul>

                <footer class="notes-footer">
                    <button type="button" class="button button--link" data-notes-copy-all><x-icon name="copy" :size="14" /> Copiar todas</button>
                    <button type="button" class="button button--link button--danger" data-notes-clear><x-icon name="trash" :size="14" /> <span data-notes-clear-label>Apagar todas</span></button>
                </footer>
            </div>
        </section>
    @endif

    {{-- Ambientação e efeitos da mesa --}}
    @if ($showAmbience)
        <section class="tool-panel ambience" data-ambience data-config="{{ json_encode($ambienceConfig, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}" hidden aria-label="Ambientação">
            <header class="tool-panel__header">
                <span class="icon-tile icon-tile--ember"><x-icon name="volume" :size="18" /></span>
                <div class="tool-panel__title">
                    <h2>Ambientação</h2>
                    <p class="eyebrow" data-ambience-now>Silêncio</p>
                </div>
                <button type="button" class="icon-button" data-tool-close="ambience" title="Fechar a ambientação"><x-icon name="x" :size="18" /></button>
            </header>

            <div class="tool-panel__body">
                <div class="ambience-listen">
                    <label class="dice-target__switch">
                        <span class="switch">
                            <input type="checkbox" data-ambience-listen>
                            <span class="switch__track"><span class="switch__thumb"></span></span>
                        </span>
                        Ouvir a trilha da mesa
                    </label>
                    <label class="dice-target__switch">
                        <span class="switch">
                            <input type="checkbox" data-ambience-effects>
                            <span class="switch__track"><span class="switch__thumb"></span></span>
                        </span>
                        Efeitos do mestre
                    </label>
                    <label class="ambience-volume">
                        <x-icon name="volume-off" :size="16" />
                        <input type="range" min="0" max="100" value="60" data-ambience-volume aria-label="Volume da ambientação">
                        <x-icon name="volume" :size="16" />
                    </label>
                </div>

                @if ($ambienceGm)
                    <p class="eyebrow">Trilha da campanha</p>
                    <div class="ambience-scapes" data-ambience-scapes role="group" aria-label="Ambientações"></div>
                    <div class="ambience-track">
                        <select class="select" data-ambience-track aria-label="Trilha da biblioteca">
                            <option value="">Trilha da biblioteca...</option>
                        </select>
                        <a class="button button--link" href="{{ route('gm.sessions.show', [$session, 'aba' => 'sons']) }}">Biblioteca</a>
                    </div>

                    <div class="ambience-board__header">
                        <p class="eyebrow">Efeitos sonoros</p>
                        <label class="dice-target__switch">
                            <span class="switch">
                                <input type="checkbox" checked data-ambience-broadcast>
                                <span class="switch__track"><span class="switch__thumb"></span></span>
                            </span>
                            Para a mesa
                        </label>
                    </div>
                    <div class="ambience-board" data-ambience-board></div>
                @else
                    <p class="muted ambience-hint">O mestre escolhe a trilha e os efeitos. Os navegadores só tocam som depois de um clique: ligue "Ouvir a trilha da mesa" para acompanhar.</p>
                @endif
                <p class="tool-panel__error" data-ambience-error role="alert"></p>
            </div>
        </section>
    @endif

    @if ($showChat)
        <x-session-chat :session="$session" :character="$speaker" :launcher="false" />
    @endif

    {{-- Botão central e opções em leque --}}
    <div class="action-menu__fab" data-action-fab>
        <div class="action-menu__options" data-action-options hidden>
            @if ($noteScopes !== [])
                <button type="button" class="action-menu__option action-menu__option--notes" data-tool-open="notes" title="Anotações Rápidas">
                    <x-icon name="feather" :size="20" /><span class="action-menu__label">Anotações Rápidas</span>
                </button>
            @endif
            <button type="button" class="action-menu__option action-menu__option--chat" data-tool-open="chat" @unless ($showChat) data-tool-unavailable="Vincule seu personagem a uma campanha para abrir o Chat da Sessão!" @endunless title="Chat da Sessão">
                <x-icon name="message-square" :size="20" /><span class="action-menu__label">Chat da Sessão</span>
                <span class="action-menu__badge" data-tool-badge="chat" hidden></span>
            </button>
            @if ($showAmbience)
                <button type="button" class="action-menu__option action-menu__option--ambience" data-tool-open="ambience" title="Ambientação">
                    <x-icon name="volume" :size="20" /><span class="action-menu__label">Ambientação</span>
                </button>
            @endif
            <button type="button" class="action-menu__option action-menu__option--dice" data-tool-open="dice" title="Rolador de Dados">
                <x-icon name="die-20" :size="20" /><span class="action-menu__label">Rolador de Dados</span>
            </button>
        </div>

        <button type="button" class="action-menu__toggle" data-action-toggle aria-expanded="false" title="Ações rápidas: dados, chat e anotações">
            <span class="action-menu__toggle-icon"><x-icon name="dice" :size="24" /></span>
            <span class="action-menu__toggle-close"><x-icon name="x" :size="22" /></span>
            <span class="visually-hidden">Ações rápidas</span>
            <span class="action-menu__badge" data-tool-badge="chat" hidden></span>
        </button>
    </div>
</div>
