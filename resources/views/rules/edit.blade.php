@php
    $global = $session === null;
    $action = $global ? route('catalog.rules.update') : route('gm.sessions.rules.update', $session);
    $value = fn (string $column, mixed $default = '') => old($column, $ruleSet->getAttribute($column) ?? $default);
    $numberGroups = [
        'Pontos iniciais' => [
            'max_attribute_points' => 'Pontos de atributo',
            'max_single_attribute_value' => 'Valor máximo por atributo',
            'initial_skill_points' => 'Pontos de perícia',
            'initial_power_points' => 'Pontos de poder',
            'initial_money' => 'Dinheiro inicial (MO)',
        ],
        'Evolução por nível' => [
            'attr_points_per_level' => 'Atributos por nível',
            'skill_points_per_level' => 'Perícias por nível',
            'power_points_per_level' => 'Poderes por nível',
        ],
        'Padrões de NPC' => [
            'npc_default_min_attr' => 'Atributo mínimo',
            'npc_default_max_attr' => 'Atributo máximo',
            'npc_default_attr_points' => 'Pontos de atributo',
            'npc_default_skill_points' => 'Pontos de perícia',
            'npc_default_power_points' => 'Pontos de poder',
        ],
    ];
    $rows = fn (string $name, array $fallback) => old($name, $fallback);
@endphp

<x-layouts.app :title="$global ? 'Configurações Base · Catálogos' : 'Regras · '.$session->name">
    @if ($global)
        @include('catalog.partials.header', ['title' => 'Configurações Base', 'subtitle' => 'Regras herdadas pelas campanhas; mudanças chegam a elas como sugestão'])
    @else
        @include('gm.sessions.library.header', ['session' => $session, 'current' => 'regras', 'pendingCounts' => $pendingCounts, 'rulesPending' => count($pendingBase)])

        @if (! $ruleSet->exists)
            <p class="alert library-notice"><x-icon name="shield" :size="16" /> Esta campanha usa as Configurações Base como estão. Ao salvar uma mudança, ela passa a ter regras próprias; a base não muda.</p>
        @else
            <div class="library-status glass">
                <p>
                    <strong>Regras próprias da campanha.</strong>
                    @if ($differences === [])
                        Iguais às Configurações Base atuais.
                    @else
                        Diferentes da base em {{ count($differences) }} regra(s).
                    @endif
                </p>
                <button type="button" class="button button--secondary button--small" data-modal-open="restore-rules"><x-icon name="rotate-ccw" :size="16" /> Restaurar base</button>
            </div>
        @endif

        {{-- Mudanças da base que ainda não foram avaliadas: adotar as marcadas, dispensar as demais. --}}
        @if ($pendingBase !== [])
            @php
                $show = static fn (mixed $value): string => match (true) {
                    is_array($value) => collect($value)->map(fn ($item, $key) => is_array($item) ? implode(' · ', $item) : (is_string($key) ? $key.': '.$item : $item))->implode(', ') ?: '—',
                    $value === null || $value === '' => '—',
                    default => \Illuminate\Support\Str::limit((string) $value, 80),
                };
            @endphp

            <form class="library-suggestions library-suggestions--rules glass" method="POST" action="{{ route('gm.sessions.rules.adopt', $session) }}">
                @csrf
                @method('PUT')

                <div>
                    <h2 class="library-suggestions__title"><x-icon name="sparkles" :size="20" /> A base mudou em {{ count($pendingBase) }} regra(s)</h2>
                    <p class="muted">Marque o que a campanha deve adotar. O que ficar desmarcado continua como está na campanha.</p>
                </div>

                <div class="library-diff library-diff--choices">
                    @foreach ($pendingBase as $column => $change)
                        <label class="checkbox library-diff__choice">
                            <input type="checkbox" name="adopt[]" value="{{ $column }}" checked>
                            <span>
                                <strong>{{ \App\Models\RuleSet::FIELD_LABELS[$column] ?? $column }}</strong>
                                <span><span class="library-diff__old">{{ $show($change['campaign']) }}</span> <x-icon name="arrow-right" :size="14" /> <span class="library-diff__new">{{ $show($change['base']) }}</span></span>
                            </span>
                        </label>
                    @endforeach
                </div>

                <div class="library-suggestions__actions">
                    <button type="submit" class="button button--gold button--small"><x-icon name="check" :size="16" /> Adotar marcadas</button>
                </div>
            </form>
        @endif

        @if ($ruleSet->exists)
            <x-modal id="restore-rules" title="Restaurar as regras da base?" danger>
                <p class="muted">A campanha descarta as regras próprias e volta a usar as Configurações Base como estão. Fichas existentes passam a ser calculadas com as regras da base.</p>

                <form class="modal__actions" method="POST" action="{{ route('gm.sessions.rules.restore', $session) }}">
                    @csrf
                    @method('DELETE')
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button button--danger"><x-icon name="rotate-ccw" :size="16" /> Restaurar</button>
                </form>
            </x-modal>
        @endif
    @endif

    @if ($errors->any())
        <div class="alert alert--error" role="alert">
            Verifique os campos destacados. {{ $errors->count() > 1 ? 'Há '.$errors->count().' problemas.' : $errors->first() }}
        </div>
    @endif

    <form class="rules-form" method="POST" action="{{ $action }}">
        @csrf
        @method('PUT')

        @foreach ($numberGroups as $group => $fields)
            <section class="catalog-form glass">
                <h2 class="catalog-form__title">{{ $group }}</h2>
                <div class="form-grid form-grid--compact">
                    @foreach ($fields as $column => $label)
                        <x-form.field :name="$column" :label="$label" type="number" :value="$value($column, 0)" required />
                    @endforeach
                </div>
            </section>
        @endforeach

        <section class="catalog-form glass">
            <h2 class="catalog-form__title">Dificuldade dos testes</h2>
            <p class="muted">Teste rápido "menor é melhor": fácil soma um bônus ao valor; difícil e extremo dividem o valor. Vazio usa o padrão (2, 2 e 5).</p>
            <div class="form-grid form-grid--compact">
                <x-form.field name="diff_easy_mod" label="Bônus do fácil" type="number" step="0.01" :value="$value('diff_easy_mod')" placeholder="2" />
                <x-form.field name="diff_hard_div" label="Divisor do difícil" type="number" step="0.01" :value="$value('diff_hard_div')" placeholder="2" />
                <x-form.field name="diff_extreme_div" label="Divisor do extremo" type="number" step="0.01" :value="$value('diff_extreme_div')" placeholder="5" />
            </div>
        </section>

        <section class="catalog-form glass">
            <h2 class="catalog-form__title">Fórmulas</h2>
            <p class="muted">
                Use números, parênteses, + - * / ^ e variáveis: atributos (FOR, AGI...), perícias por categoria (LUTA, LUTAS...),
                SKILLS, POWERS e as variáveis de cálculo abaixo. Nos custos: COST, LVL e VAR. Vazio usa o padrão mostrado.
            </p>
            <div class="form-grid">
                @foreach ($formulas as $name => $label)
                    <x-form.field :name="$name.'_formula'" :label="$label" :value="$value($name.'_formula')" :placeholder="config('arquivo.rules.formulas.'.$name)" maxlength="255" class="field__input field__input--mono" />
                @endforeach
            </div>
        </section>

        <div class="rules-columns">
            <section class="catalog-form glass">
                <h2 class="catalog-form__title">Atributos</h2>
                <p class="muted">A sigla é usada nas fórmulas (em maiúsculas) e nas fichas.</p>

                <div class="repeater" data-repeater>
                    <div class="repeater__rows" data-repeater-rows>
                        @foreach ($rows('attributes', $attributes) as $index => $row)
                            <div class="repeater__row" data-repeater-row>
                                <input class="field__input field__input--mono rules-short" name="attributes[{{ $index }}][id]" value="{{ $row['id'] ?? '' }}" maxlength="16" placeholder="for" aria-label="Sigla">
                                <input class="field__input" name="attributes[{{ $index }}][label]" value="{{ $row['label'] ?? '' }}" maxlength="64" placeholder="Força" aria-label="Nome">
                                <button type="button" class="icon-button" data-repeater-remove aria-label="Remover atributo"><x-icon name="x" :size="16" /></button>
                            </div>
                        @endforeach
                    </div>
                    <template data-repeater-template>
                        <div class="repeater__row" data-repeater-row>
                            <input class="field__input field__input--mono rules-short" name="attributes[__INDEX__][id]" maxlength="16" placeholder="sigla" aria-label="Sigla">
                            <input class="field__input" name="attributes[__INDEX__][label]" maxlength="64" placeholder="Nome" aria-label="Nome">
                            <button type="button" class="icon-button" data-repeater-remove aria-label="Remover atributo"><x-icon name="x" :size="16" /></button>
                        </div>
                    </template>
                    <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Atributo</button>
                </div>
                <x-rules.errors prefix="attributes" />
            </section>

            <section class="catalog-form glass">
                <h2 class="catalog-form__title">Categorias de talento</h2>

                <div class="repeater" data-repeater>
                    <div class="repeater__rows" data-repeater-rows>
                        @foreach ($rows('talent_categories', $talentCategories) as $category)
                            <div class="repeater__row" data-repeater-row>
                                <input class="field__input" name="talent_categories[]" value="{{ $category }}" maxlength="64" aria-label="Categoria">
                                <button type="button" class="icon-button" data-repeater-remove aria-label="Remover categoria"><x-icon name="x" :size="16" /></button>
                            </div>
                        @endforeach
                    </div>
                    <template data-repeater-template>
                        <div class="repeater__row" data-repeater-row>
                            <input class="field__input" name="talent_categories[]" maxlength="64" placeholder="Ex.: Combate" aria-label="Categoria">
                            <button type="button" class="icon-button" data-repeater-remove aria-label="Remover categoria"><x-icon name="x" :size="16" /></button>
                        </div>
                    </template>
                    <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Categoria</button>
                </div>
                <x-rules.errors prefix="talent_categories" />
            </section>

            @foreach ([
                'skill_types' => ['Tipos de perícia', $skillTypes, 'Divisor (VAR) do custo: número, atributo ou fórmula. Renomear um tipo atualiza as perícias e as fórmulas (LUTA/LUTAS).'],
                'power_types' => ['Tipos de poder', $powerTypes, 'Divisor (VAR) do custo de poder. Renomear um tipo atualiza os poderes e as fórmulas.'],
            ] as $list => [$title, $current, $help])
                <section class="catalog-form glass">
                    <h2 class="catalog-form__title">{{ $title }}</h2>
                    <p class="muted">{{ $help }}</p>

                    <div class="repeater" data-repeater>
                        <div class="repeater__rows" data-repeater-rows>
                            @foreach ($rows($list, array_map(fn (array $row) => ['name' => $row['name'], 'var' => $row['value'], 'original' => $row['name']], $current)) as $index => $row)
                                <div class="repeater__row" data-repeater-row>
                                    <input type="hidden" name="{{ $list }}[{{ $index }}][original]" value="{{ $row['original'] ?? '' }}">
                                    <input class="field__input" name="{{ $list }}[{{ $index }}][name]" value="{{ $row['name'] ?? '' }}" maxlength="64" placeholder="Nome do tipo" aria-label="Nome do tipo">
                                    <input class="field__input field__input--mono rules-short" name="{{ $list }}[{{ $index }}][var]" value="{{ $row['var'] ?? '' }}" maxlength="255" placeholder="1" aria-label="Divisor (VAR)">
                                    <button type="button" class="icon-button" data-repeater-remove aria-label="Remover tipo"><x-icon name="x" :size="16" /></button>
                                </div>
                            @endforeach
                        </div>
                        <template data-repeater-template>
                            <div class="repeater__row" data-repeater-row>
                                <input class="field__input" name="{{ $list }}[__INDEX__][name]" maxlength="64" placeholder="Nome do tipo" aria-label="Nome do tipo">
                                <input class="field__input field__input--mono rules-short" name="{{ $list }}[__INDEX__][var]" maxlength="255" placeholder="1" aria-label="Divisor (VAR)">
                                <button type="button" class="icon-button" data-repeater-remove aria-label="Remover tipo"><x-icon name="x" :size="16" /></button>
                            </div>
                        </template>
                        <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Tipo</button>
                    </div>
                    <x-rules.errors :prefix="$list" />
                </section>
            @endforeach

            <section class="catalog-form glass">
                <h2 class="catalog-form__title">Variáveis de cálculo</h2>
                <p class="muted">Variáveis próprias para usar nas fórmulas. Uma pode usar a outra (ex.: BONUS = LUTA + FOR).</p>

                <div class="repeater" data-repeater>
                    <div class="repeater__rows" data-repeater-rows>
                        @foreach ($rows('calculation_vars', array_map(fn (array $row) => ['name' => $row['name'], 'formula' => $row['value']], $calculationVars)) as $index => $row)
                            <div class="repeater__row" data-repeater-row>
                                <input class="field__input field__input--mono rules-short" name="calculation_vars[{{ $index }}][name]" value="{{ $row['name'] ?? '' }}" maxlength="32" placeholder="BONUS" aria-label="Nome da variável">
                                <input class="field__input field__input--mono" name="calculation_vars[{{ $index }}][formula]" value="{{ $row['formula'] ?? '' }}" maxlength="255" placeholder="LUTA + FOR" aria-label="Fórmula">
                                <button type="button" class="icon-button" data-repeater-remove aria-label="Remover variável"><x-icon name="x" :size="16" /></button>
                            </div>
                        @endforeach
                    </div>
                    <template data-repeater-template>
                        <div class="repeater__row" data-repeater-row>
                            <input class="field__input field__input--mono rules-short" name="calculation_vars[__INDEX__][name]" maxlength="32" placeholder="NOME" aria-label="Nome da variável">
                            <input class="field__input field__input--mono" name="calculation_vars[__INDEX__][formula]" maxlength="255" placeholder="Fórmula" aria-label="Fórmula">
                            <button type="button" class="icon-button" data-repeater-remove aria-label="Remover variável"><x-icon name="x" :size="16" /></button>
                        </div>
                    </template>
                    <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Variável</button>
                </div>
                <x-rules.errors prefix="calculation_vars" />
            </section>
        </div>

        @if ($global)
            <section class="catalog-form glass">
                <h2 class="catalog-form__title">Cadastro</h2>
                <label class="checkbox">
                    <input type="hidden" name="enable_email_password_auth" value="0">
                    <input type="checkbox" name="enable_email_password_auth" value="1" @checked(old('enable_email_password_auth', $ruleSet->enable_email_password_auth ?? true))>
                    Permitir que novos jogadores criem conta com e-mail e senha
                </label>
                <p class="field__hint">Enquanto o login com Google estiver desligado, o cadastro fica sempre aberto.</p>
            </section>
        @endif

        <div class="form-actions form-actions--sticky glass">
            <span class="muted">{{ $global ? 'Campanhas que usam a base recebem as mudanças como sugestão.' : 'Estas regras valem só para esta campanha; a base não muda.' }}</span>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar Regras</button>
        </div>
    </form>

    @push('scripts')
        <script type="module" src="@asset('js/core/repeater.js')"></script>
    @endpush
</x-layouts.app>
