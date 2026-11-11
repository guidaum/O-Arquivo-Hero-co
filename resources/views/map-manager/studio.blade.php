{{--
    Estúdio de Esboços (MapSketchStudio.tsx). O esboço é desenhado com cores
    que significam terreno/piso; o cartógrafo do navegador o ilustra e a IA
    gratuita (AI Horde) pode refinar. Scripts: public/js/sketch-studio/.
--}}
<x-layouts.app title="Estúdio de Esboços">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/sketch-studio.css')">
    @endpush

    <x-page-header title="Estúdio de Esboços" :subtitle="'Forja de mapas · '.$session->name" :back="route('map-manager.index', ['campanha' => $session->id])" back-label="Voltar aos mapas" />

    <div class="studio" data-studio data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
        <section class="studio__board glass">
            <div class="studio__toolbar" role="toolbar" aria-label="Ferramentas de desenho">
                <div class="studio__tools">
                    @foreach ([
                        ['brush', 'pencil', 'Pincel'],
                        ['line', 'activity', 'Linha'],
                        ['rect', 'grid', 'Retângulo (salas)'],
                        ['polygon', 'pentagon', 'Polígono (clique nos vértices; feche no ponto inicial)'],
                        ['bucket', 'flask', 'Balde (preenche a área)'],
                        ['eraser', 'eraser', 'Borracha (também remove símbolos)'],
                    ] as [$tool, $icon, $label])
                        <button type="button" class="icon-button icon-button--bordered" data-tool="{{ $tool }}" aria-pressed="{{ $tool === 'brush' ? 'true' : 'false' }}" title="{{ $label }}">
                            <x-icon :name="$icon" :size="18" />
                        </button>
                    @endforeach
                </div>
                <div class="studio__tools" role="group" aria-label="Espessura" data-scales></div>
                <div class="studio__tools">
                    <button type="button" class="icon-button icon-button--bordered" data-undo title="Desfazer (Ctrl + Z)"><x-icon name="undo" :size="18" /></button>
                    <button type="button" class="icon-button icon-button--bordered" data-redo title="Refazer (Ctrl + Y)"><x-icon name="redo" :size="18" /></button>
                    <button type="button" class="icon-button icon-button--bordered icon-button--danger" data-clear title="Recomeçar o esboço"><x-icon name="trash" :size="18" /></button>
                </div>
            </div>

            <div class="studio__canvas-wrap" data-canvas-wrap>
                <canvas class="studio__layer" data-layer="area" width="1280" height="720"></canvas>
                <canvas class="studio__layer" data-layer="stamps" width="1280" height="720"></canvas>
                <canvas class="studio__layer studio__layer--input" data-layer="preview" width="1280" height="720" aria-label="Área de desenho do esboço"></canvas>
                <img class="studio__result" data-result-view alt="Mapa gerado" hidden>
            </div>

            <div class="studio__view-toggle" role="group" aria-label="Visualizar">
                <button type="button" class="chip is-active" data-view="sketch">Esboço</button>
                <button type="button" class="chip" data-view="result" disabled>Resultado</button>
            </div>

            <p class="eyebrow studio__palette-title">Elementos do esboço</p>
            <div class="studio__palette" data-palette></div>
            <p class="muted studio__hint" data-hint></p>
        </section>

        <aside class="studio__panel">
            <section class="glass studio__card">
                <h2>Mapa</h2>
                <div class="segmented segmented--full" role="group" aria-label="Tipo">
                    <button type="button" class="segmented__option" data-type="world" aria-pressed="true"><x-icon name="compass" :size="16" /> Mundo</button>
                    <button type="button" class="segmented__option" data-type="dungeon" aria-pressed="false"><x-icon name="skull" :size="16" /> Masmorra</button>
                </div>
                <div class="field">
                    <label class="field__label" for="studio-theme">Estilo</label>
                    <select class="field__input" id="studio-theme" data-theme></select>
                </div>
                <div class="field">
                    <label class="field__label" for="studio-name">Nome</label>
                    <input class="field__input" id="studio-name" maxlength="255" value="Novo Mundo de Aventuras" data-name>
                </div>
                <div class="field">
                    <label class="field__label" for="studio-subtitle">Subtítulo</label>
                    <input class="field__input" id="studio-subtitle" maxlength="255" placeholder="Opcional" data-subtitle>
                </div>
                <div class="field">
                    <label class="field__label" for="studio-size">Tamanho do esboço</label>
                    <select class="field__input" id="studio-size" data-dimension></select>
                </div>
                <div class="form-grid studio__grid-fields" data-dungeon-only hidden>
                    <div class="field">
                        <label class="field__label" for="studio-cols">Colunas</label>
                        <input class="field__input" id="studio-cols" type="number" min="4" max="80" value="24" data-grid-cols>
                    </div>
                    <div class="field">
                        <label class="field__label" for="studio-rows">Linhas</label>
                        <input class="field__input" id="studio-rows" type="number" min="4" max="80" value="14" data-grid-rows>
                    </div>
                    <label class="checkbox studio__grid-show">
                        <input type="checkbox" data-grid-show checked>
                        <span>Desenhar a grade tática no mapa</span>
                    </label>
                </div>
                <div class="field" data-world-only>
                    <label class="field__label" for="studio-scale">Escala exibida</label>
                    <input class="field__input" id="studio-scale" maxlength="64" value="1 cm = 25 léguas" data-scale>
                </div>
            </section>

            <section class="glass studio__card">
                <h2>Gerar</h2>
                <button type="button" class="button button--block" data-illustrate>
                    <x-icon name="sparkles" /> Ilustrar mapa
                </button>
                <p class="muted studio__note">Instantâneo e gratuito: o cartógrafo do Arquivo desenha costas, relevo, florestas, paredes e pisos a partir do seu esboço.</p>

                @if ($config['aiEnabled'])
                    <details class="studio__ai" data-ai>
                        <summary><x-icon name="brain" :size="16" /> Refinar com IA gratuita (AI Horde)</summary>
                        <label class="layer-control__range studio__range">
                            <span>Fidelidade ao esboço</span>
                            <input type="range" min="0" max="100" step="5" value="60" data-fidelity>
                            <output data-fidelity-output>60%</output>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" data-follow-lines>
                            <span>Seguir as linhas com ControlNet (forma mais fiel, estilo mais livre)</span>
                        </label>
                        <div class="field">
                            <label class="field__label" for="studio-variations">Variações</label>
                            <select class="field__input" id="studio-variations" data-variations>
                                <option value="1">1</option>
                                <option value="2" selected>2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                            </select>
                        </div>
                        <div class="field">
                            <label class="field__label" for="studio-prompt">Detalhes extras (em inglês funciona melhor)</label>
                            <input class="field__input" id="studio-prompt" maxlength="300" placeholder="Ex.: volcanic island, ancient elven ruins" data-prompt>
                        </div>
                        <button type="button" class="button button--gold button--block" data-ai-render><x-icon name="brain" /> Refinar com IA</button>
                        <p class="muted studio__note">
                            A IA recebe o mapa ilustrado e o redesenha com mais arte.
                            @if ($config['aiAnonymous'])
                                Fila anônima: pode levar alguns minutos.
                            @endif
                        </p>
                        <p class="studio__progress" data-ai-progress role="status" hidden></p>
                    </details>
                @endif
            </section>

            <section class="glass studio__card" data-results-card hidden>
                <h2>Resultados</h2>
                <div class="studio__results" data-results></div>
                <div class="studio__actions">
                    <button type="button" class="button button--secondary" data-download><x-icon name="arrow-right" /> Baixar</button>
                    <button type="button" class="button" data-save><x-icon name="save" /> Salvar na campanha</button>
                </div>
                <p class="field__error" data-error role="alert"></p>
            </section>
        </aside>
    </div>

    @push('scripts')
        <script type="module" src="@asset('js/sketch-studio/index.js')"></script>
    @endpush
</x-layouts.app>
