@php
    $steps = ['Vantagens/Defeitos', 'Origens', 'Atributos', 'Perícias', 'Poderes', 'Equipamento', 'Revisão'];
@endphp

<x-layouts.app title="Criação de Personagem">
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/creation.css') }}">
    @endpush

    <x-page-header title="Forjar uma Nova Lenda" subtitle="Criação de Personagem" />

    @if ($errors->any())
        <div class="alert alert--error" role="alert">
            <strong>Não foi possível criar o personagem:</strong>
            <ul class="creation-errors">
                @foreach ($errors->all() as $message)
                    <li>{{ $message }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @if ($config['sessions']->isEmpty())
        <x-empty-state>Nenhuma campanha disponível. Peça ao mestre para criar uma campanha antes de forjar seu personagem.</x-empty-state>
    @else
        <form id="creation" class="creation" method="POST" action="{{ route('characters.store') }}" enctype="multipart/form-data" data-creation>
            @csrf
            <input type="hidden" name="payload" data-payload>

            {{-- Passos --}}
            <ol class="stepper" aria-label="Passos da criação">
                @foreach ($steps as $index => $label)
                    <li>
                        <button type="button" class="stepper__step" data-go-step="{{ $index + 1 }}">
                            <span class="stepper__number">{{ $index + 1 }}</span>
                            <span class="stepper__label">{{ $label }}</span>
                        </button>
                    </li>
                @endforeach
            </ol>

            <div class="creation-layout">
                <div class="creation-main">
                    {{-- 1. Vantagens e defeitos --}}
                    <section class="creation-step glass" data-step="1">
                        <header class="creation-step__header">
                            <h2>Vantagens e Defeitos</h2>
                            <p class="muted">Defeitos dão pontos; vantagens gastam. Uma vantagem só pode ser escolhida se houver saldo suficiente.</p>
                        </header>
                        <div class="creation-filters">
                            <input class="field__input" type="search" placeholder="Buscar vantagens e defeitos..." data-filter-search="traits" aria-label="Buscar traços">
                            <select class="select" data-filter-type="traits" aria-label="Tipo">
                                <option value="">Todos</option>
                                <option value="advantage">Vantagens</option>
                                <option value="disadvantage">Defeitos</option>
                            </select>
                            <button type="button" class="button button--secondary" data-suggest="trait"><x-icon name="lightbulb" :size="16" /> Sugerir</button>
                        </div>
                        <div class="pick-list" data-list="traits"></div>
                    </section>

                    {{-- 2. Origens --}}
                    <section class="creation-step glass" data-step="2" hidden>
                        <header class="creation-step__header">
                            <h2>Origens</h2>
                            <p class="muted">Quem é a sua lenda e em qual campanha ela vai viver.</p>
                        </header>

                        <div class="form-grid">
                            <div class="field">
                                <label class="field__label" for="basic-name">Nome da lenda</label>
                                <input class="field__input" id="basic-name" maxlength="255" required data-basic="name" placeholder="Ex.: Alden de Eldoria">
                            </div>
                            <div class="field">
                                <label class="field__label" for="basic-session">Campanha</label>
                                <select class="field__input" id="basic-session" required data-basic="game_session_id">
                                    <option value="">Escolha a campanha...</option>
                                    @foreach ($config['sessions'] as $session)
                                        <option value="{{ $session['id'] }}">{{ $session['name'] }}{{ $session['is_gm'] ? ' (você é o mestre)' : ($session['gm'] ? ' · Mestre: '.$session['gm'] : '') }}</option>
                                    @endforeach
                                </select>
                                <p class="field__hint">Trocar de campanha zera atributos, perícias e poderes (as regras podem mudar).</p>
                            </div>
                            <div class="field">
                                <label class="field__label" for="basic-class">Classe / vocação</label>
                                <input class="field__input" id="basic-class" maxlength="255" data-basic="class" list="class-presets" placeholder="Ex.: Paladino">
                                <datalist id="class-presets">
                                    @foreach (['Paladino', 'Guerreiro', 'Mago', 'Ranger', 'Ladino'] as $preset)
                                        <option value="{{ $preset }}"></option>
                                    @endforeach
                                </datalist>
                            </div>
                            <div class="field">
                                <label class="field__label" for="basic-image">Retrato</label>
                                <input class="field__input" id="basic-image" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif">
                                <p class="field__hint">Opcional. JPG, PNG, WEBP ou GIF, até 4 MB.</p>
                            </div>
                        </div>

                        <fieldset class="field">
                            <legend class="field__label">Cor</legend>
                            <div class="choice-row">
                                @foreach ($config['colors'] as $value => $label)
                                    <label class="choice choice--{{ $value }}">
                                        <input type="radio" name="creation_color" value="{{ $value }}" data-basic="color" @checked($value === 'arcane')>
                                        <span>{{ $label }}</span>
                                    </label>
                                @endforeach
                            </div>
                        </fieldset>

                        <fieldset class="field">
                            <legend class="field__label">Ícone</legend>
                            <div class="choice-row">
                                @foreach ($config['icons'] as $icon)
                                    @php($sprite = ['Dice6' => 'dice'][$icon] ?? strtolower($icon))
                                    <label class="choice choice--icon" title="{{ $icon }}">
                                        <input type="radio" name="creation_icon" value="{{ $icon }}" data-basic="icon" @checked($icon === 'Shield')>
                                        <span><x-icon :name="$sprite" :size="20" /><span class="visually-hidden">{{ $icon }}</span></span>
                                    </label>
                                @endforeach
                            </div>
                        </fieldset>
                    </section>

                    {{-- 3. Atributos --}}
                    <section class="creation-step glass" data-step="3" hidden>
                        <header class="creation-step__header">
                            <h2>Atributos</h2>
                            <p class="muted" data-attributes-hint></p>
                        </header>
                        <div class="attribute-picker" data-list="attributes"></div>
                        <h3 class="creation-subtitle">Prévia de combate</h3>
                        <dl class="derived-preview" data-derived></dl>
                    </section>

                    {{-- 4. Perícias --}}
                    <section class="creation-step glass" data-step="4" hidden>
                        <header class="creation-step__header">
                            <h2>Perícias</h2>
                            <p class="muted">O custo segue a fórmula das regras da campanha (custo × nível ÷ divisor do tipo, arredondado para cima).</p>
                        </header>
                        <div class="picked" data-picked="skills"></div>
                        <div class="creation-filters">
                            <input class="field__input" type="search" placeholder="Buscar perícias..." data-filter-search="skills" aria-label="Buscar perícias">
                            <select class="select" data-filter-type="skills" aria-label="Tipo"><option value="">Todos os tipos</option></select>
                            <button type="button" class="button button--secondary" data-suggest="skill"><x-icon name="lightbulb" :size="16" /> Sugerir</button>
                        </div>
                        <div class="pick-list" data-list="skills"></div>
                    </section>

                    {{-- 5. Poderes --}}
                    <section class="creation-step glass" data-step="5" hidden>
                        <header class="creation-step__header">
                            <h2>Poderes</h2>
                            <p class="muted">Poderes e magias da sua lenda.</p>
                        </header>
                        <div class="picked" data-picked="powers"></div>
                        <div class="creation-filters">
                            <input class="field__input" type="search" placeholder="Buscar poderes..." data-filter-search="powers" aria-label="Buscar poderes">
                            <select class="select" data-filter-type="powers" aria-label="Tipo"><option value="">Todos os tipos</option></select>
                            <button type="button" class="button button--secondary" data-suggest="power"><x-icon name="lightbulb" :size="16" /> Sugerir</button>
                        </div>
                        <div class="pick-list" data-list="powers"></div>
                    </section>

                    {{-- 6. Equipamento --}}
                    <section class="creation-step glass" data-step="6" hidden>
                        <header class="creation-step__header">
                            <h2>Equipamento</h2>
                            <p class="muted">Compre itens iniciais com o dinheiro da campanha ou anote itens próprios.</p>
                        </header>
                        <div class="picked" data-picked="equipment"></div>

                        <h3 class="creation-subtitle">Itens iniciais do catálogo</h3>
                        <div class="pick-list" data-list="catalog"></div>

                        <h3 class="creation-subtitle">Item próprio</h3>
                        <div class="form-grid custom-item" data-custom-item>
                            <input class="field__input" maxlength="255" placeholder="Nome do item" data-custom="name" aria-label="Nome do item">
                            <select class="field__input" data-custom="category" aria-label="Categoria">
                                @foreach ($config['categories'] as $value => $label)
                                    <option value="{{ $value }}" @selected($value === 'misc')>{{ $label }}</option>
                                @endforeach
                            </select>
                            <input class="field__input" maxlength="64" placeholder="Dano (ex.: 1D6)" data-custom="damage" aria-label="Dano">
                            <input class="field__input" type="number" min="0" max="1000" placeholder="Defesa" data-custom="defense" aria-label="Defesa">
                            <input class="field__input custom-item__description" maxlength="2000" placeholder="Descrição" data-custom="description" aria-label="Descrição">
                            <button type="button" class="button button--secondary" data-add-custom><x-icon name="plus" :size="16" /> Adicionar item</button>
                        </div>
                    </section>

                    {{-- 7. Revisão --}}
                    <section class="creation-step glass" data-step="7" hidden>
                        <header class="creation-step__header">
                            <h2>Revisão</h2>
                            <p class="muted">Confira a sua lenda. O servidor recalcula tudo antes de criar a ficha.</p>
                        </header>
                        <div class="review" data-review></div>
                    </section>

                    <div class="creation-nav">
                        <button type="button" class="button button--secondary" data-prev>Voltar</button>
                        <button type="button" class="button" data-next>Continuar</button>
                        <button type="submit" class="button button--gold" data-submit hidden><x-icon name="sparkles" :size="16" /> Forjar Lenda</button>
                    </div>
                </div>

                {{-- Resumo lateral --}}
                <aside class="creation-summary glass" aria-live="polite">
                    <p class="eyebrow">Recursos</p>
                    <dl class="creation-summary__list">
                        <div><dt>Saldo de traços</dt><dd data-summary="traits">0</dd></div>
                        <div><dt>Atributos</dt><dd data-summary="attributes">—</dd></div>
                        <div><dt>Perícias</dt><dd data-summary="skills">—</dd></div>
                        <div><dt>Poderes</dt><dd data-summary="powers">—</dd></div>
                        <div><dt>Dinheiro</dt><dd data-summary="money">—</dd></div>
                    </dl>
                    <p class="creation-summary__message" data-message role="status"></p>
                </aside>
            </div>
        </form>

        {{-- Pontos não gastos --}}
        <x-modal id="unspent" title="Pontos não utilizados">
            <p data-unspent-text></p>
            <div class="modal__actions">
                <button type="button" class="button button--secondary" data-modal-close>Voltar e gastar</button>
                <button type="button" class="button" data-unspent-continue>Continuar mesmo assim</button>
            </div>
        </x-modal>

        {{-- Sugestão para o mestre --}}
        <x-modal id="suggestion" title="Sugerir ao Mestre">
            <form class="form" data-suggestion-form>
                <input type="hidden" name="type" data-suggestion-type>
                <p class="muted" data-suggestion-intro></p>
                <x-form.field name="name" label="Nome" required maxlength="255" />
                <x-form.field name="category" label="Tipo" maxlength="64" hint="Ex.: Luta, Mística, Elemental... (para traços: advantage ou disadvantage)" />
                <x-form.field name="purchase_cost" label="Custo de compra" type="number" value="1" min="0" max="1000" />
                <div data-suggestion-only="skill"><x-form.field name="damage" label="Dano" maxlength="64" /></div>
                <div data-suggestion-only="power"><x-form.field name="cost" label="Custo de uso" maxlength="64" /></div>
                <div data-suggestion-only="trait">
                    <x-form.field name="modifier" label="Modificador" type="number" value="0" min="-100" max="100" />
                    <x-form.field name="modifier_type" label="Alvo (sigla do atributo)" maxlength="32" value="for" />
                </div>
                <div data-suggestion-only="power trait"><x-form.field name="effect" label="Efeito" type="textarea" rows="2" maxlength="5000" /></div>
                <x-form.field name="description" label="Descrição" type="textarea" rows="3" maxlength="5000" />
                <p class="field__error" data-suggestion-error></p>
                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button"><x-icon name="lightbulb" :size="16" /> Enviar sugestão</button>
                </div>
            </form>
        </x-modal>

        <script type="application/json" id="creation-config">@json($config)</script>
        @push('scripts')
            <script type="module" src="{{ asset('js/creation/wizard.js') }}"></script>
        @endpush
    @endif
</x-layouts.app>
