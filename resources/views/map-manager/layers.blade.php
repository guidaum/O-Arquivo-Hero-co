{{--
    Inspetor de camadas de um mapa na campanha (modal de camadas do MapManager.tsx):
    camadas visuais, névoa de guerra (pintada célula a célula) e régua.
    Tudo é salvo de uma vez por public/js/map-manager/layers.js.
--}}
<x-layouts.app :title="'Camadas · '.$map->name">
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/map-manager.css') }}">
    @endpush

    <x-page-header :title="$map->name" :subtitle="'Camadas, Névoa & Régua · '.$session->name">
        <x-slot:actions>
            <a class="button button--secondary button--pill" href="{{ $config['backUrl'] }}"><x-icon name="arrow-right" /> Voltar aos mapas</a>
            <button type="button" class="button button--pill" data-layers-save><x-icon name="save" /> Salvar</button>
        </x-slot:actions>
    </x-page-header>

    <div class="layers-editor" data-layers data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
        <div class="layers-editor__canvas glass">
            <div class="layers-stage" data-stage>
                <img class="layers-stage__image" src="{{ $config['imageUrl'] }}" alt="{{ $map->name }}" draggable="false" data-image>
                <div class="layers-stage__grid" data-grid aria-hidden="true"></div>
                <canvas class="layers-stage__fog" data-fog aria-hidden="true"></canvas>
                <svg class="layers-stage__ruler" data-ruler viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
                <span class="layers-stage__readout" data-readout hidden></span>
            </div>
            <p class="layers-editor__hint muted" data-hint></p>
        </div>

        <aside class="layers-editor__panel glass">
            <nav class="tabs tabs--small layers-editor__tabs" aria-label="Ferramentas">
                <button type="button" class="tabs__link" data-tab="layers" aria-current="page"><x-icon name="layers" :size="16" /> Camadas</button>
                <button type="button" class="tabs__link" data-tab="fog"><x-icon name="eye-off" :size="16" /> Névoa</button>
                <button type="button" class="tabs__link" data-tab="ruler"><x-icon name="crosshair" :size="16" /> Régua</button>
            </nav>

            {{-- Camadas --}}
            <section class="layers-editor__section" data-panel="layers">
                <p class="eyebrow">Configurações rápidas</p>
                <div class="chips">
                    <button type="button" class="chip" data-layer-preset="image">Apenas imagem</button>
                    <button type="button" class="chip" data-layer-preset="grid">Apenas grade & tokens</button>
                    <button type="button" class="chip" data-layer-preset="balanced">Equilibrado (padrão)</button>
                </div>

                @foreach ([
                    ['show_background', 'background_opacity', 'Imagem de fundo', 'image'],
                    ['show_grid', 'grid_opacity', 'Grade tática', 'grid'],
                ] as [$toggle, $opacity, $label, $icon])
                    <div class="layer-control">
                        <label class="layer-control__head">
                            <x-icon :name="$icon" :size="16" />
                            <span>{{ $label }}</span>
                            <span class="switch">
                                <input type="checkbox" data-layer="{{ $toggle }}">
                                <span class="switch__track"><span class="switch__thumb"></span></span>
                            </span>
                        </label>
                        <label class="layer-control__range">
                            <span>Opacidade</span>
                            <input type="range" min="0" max="100" step="5" data-layer="{{ $opacity }}">
                            <output data-output="{{ $opacity }}"></output>
                        </label>
                    </div>
                @endforeach

                <div class="layer-control">
                    <label class="layer-control__head">
                        <x-icon name="users" :size="16" />
                        <span>Tokens no battlemap</span>
                        <span class="switch">
                            <input type="checkbox" data-layer="show_tokens">
                            <span class="switch__track"><span class="switch__thumb"></span></span>
                        </span>
                    </label>
                    <p class="muted layer-control__note">Os tokens aparecem no battlemap da masmorra.</p>
                </div>
            </section>

            {{-- Névoa de guerra --}}
            <section class="layers-editor__section" data-panel="fog" hidden>
                <div class="layer-control">
                    <label class="layer-control__head">
                        <x-icon name="eye-off" :size="16" />
                        <span>Névoa de guerra ativa</span>
                        <span class="switch">
                            <input type="checkbox" data-fog-enabled>
                            <span class="switch__track"><span class="switch__thumb"></span></span>
                        </span>
                    </label>
                    <label class="layer-control__range">
                        <span>Opacidade para os jogadores</span>
                        <input type="range" min="10" max="100" step="5" data-layer="fog_opacity">
                        <output data-output="fog_opacity"></output>
                    </label>
                </div>

                <p class="eyebrow">Pincel</p>
                <div class="segmented segmented--full" role="group" aria-label="Modo do pincel">
                    <button type="button" class="segmented__option" data-brush-mode="reveal" aria-pressed="true">Revelar</button>
                    <button type="button" class="segmented__option" data-brush-mode="hide" aria-pressed="false">Ocultar</button>
                </div>
                <div class="segmented segmented--full" role="group" aria-label="Tamanho do pincel">
                    <button type="button" class="segmented__option" data-brush-size="1" aria-pressed="false">1 célula</button>
                    <button type="button" class="segmented__option" data-brush-size="2" aria-pressed="true">3×3</button>
                    <button type="button" class="segmented__option" data-brush-size="3" aria-pressed="false">5×5</button>
                </div>

                <p class="eyebrow">Ações rápidas</p>
                <div class="chips">
                    <button type="button" class="chip" data-fog-action="reveal-all">Revelar tudo</button>
                    <button type="button" class="chip" data-fog-action="hide-all">Ocultar tudo</button>
                    <button type="button" class="chip" data-fog-action="entrance">Revelar só a entrada</button>
                    <button type="button" class="chip" data-fog-action="invert">Inverter</button>
                </div>
                <p class="muted" data-fog-count></p>
            </section>

            {{-- Régua --}}
            <section class="layers-editor__section" data-panel="ruler" hidden>
                <p class="eyebrow">Escala da grade</p>
                <div class="form-grid">
                    <div class="field">
                        <label class="field__label" for="scale-unit">Unidade</label>
                        <select class="field__input" id="scale-unit" data-scale-unit>
                            @foreach (App\Models\GameSessionMap::SCALE_UNITS as $key => [$short, $label])
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="field">
                        <label class="field__label" for="scale-value">Valor por quadrado</label>
                        <input class="field__input" id="scale-value" type="number" min="0.1" max="10000" step="0.1" data-scale-value>
                    </div>
                </div>
                <div class="chips">
                    @foreach ([['ft', 5, '5 pés (D&D)'], ['m', 1.5, '1,5 m'], ['m', 1, '1 m'], ['km', 10, '10 km'], ['leagues', 5, '5 léguas']] as [$unit, $value, $label])
                        <button type="button" class="chip" data-scale-preset="{{ $unit }}:{{ $value }}">{{ $label }}</button>
                    @endforeach
                </div>
                <div class="ruler-readout" data-ruler-readout>Arraste sobre o mapa para medir uma distância.</div>
            </section>
        </aside>
    </div>

    @push('scripts')
        <script type="module" src="{{ asset('js/map-manager/layers.js') }}"></script>
    @endpush
</x-layouts.app>
