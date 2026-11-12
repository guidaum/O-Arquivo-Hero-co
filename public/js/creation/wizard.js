// Assistente de Criação de Personagem (7 passos, como no sistema antigo).
//
// O rascunho vive no navegador e os custos são mostrados ao vivo com os
// espelhos das regras (core/formula.js e core/traits.js). Ao forjar, o
// rascunho inteiro vai num campo "payload" (JSON) e o servidor recalcula
// e valida tudo (App\Game\CharacterDraft). Se algo falhar, a página volta
// com o rascunho em config.old e ele é restaurado aqui.

import { abilityCost, derivedStats, formulaStats } from '../core/formula.js';
import { attributeModifiers, effectiveModifier, isDisadvantage, targetDisplayName, traitBalance, traitCost } from '../core/traits.js';
import { el, icon, replace, scrollIntoBar } from '../core/dom.js';
import { postJson } from '../core/http.js';

const form = document.querySelector('[data-creation]');

if (form) {
    const config = JSON.parse(document.getElementById('creation-config').textContent);
    const TOTAL_STEPS = 7;
    const STACKABLE = ['ammo', 'consumables'];
    const DERIVED_LABELS = { pv: 'PV', atp: 'ATP', soco: 'Soco', chute: 'Chute', en: 'E/N', dm: 'D/M', defesa: 'Defesa', esquiva: 'Esquiva' };

    const state = {
        step: 1,
        traits: new Set(),
        basics: { name: '', class: '', color: 'arcane', icon: 'Shield', game_session_id: '' },
        stats: {},
        skills: new Map(),
        powers: new Map(),
        catalog: [],
        custom: [],
    };
    const filters = { traits: { search: '', type: '' }, skills: { search: '', type: '' }, powers: { search: '', type: '' } };

    const byId = (list, id) => list.find((item) => String(item.id) === String(id));
    const session = () => byId(config.sessions, state.basics.game_session_id) ?? null;
    const rules = () => session()?.rules ?? null;
    const selectedTraits = () => library().traits.filter((trait) => state.traits.has(trait.id));
    const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const money = (value) => `${Number(value).toLocaleString('pt-BR')} MO`;
    // Biblioteca da campanha escolhida (antes da escolha, a da primeira campanha).
    const EMPTY_LIBRARY = { skills: [], powers: [], traits: [], talents: [], catalog: [] };
    const library = () => session()?.library ?? config.sessions[0]?.library ?? EMPTY_LIBRARY;

    // Cálculos (mesmas regras do servidor)

    function attributesWithTraits() {
        const current = rules();
        const values = { ...state.stats };

        if (!current) return values;

        Object.entries(attributeModifiers(selectedTraits(), current.attributes, library().talents)).forEach(([id, modifier]) => {
            values[id] = (values[id] ?? 0) + modifier;
        });

        return values;
    }

    function formulaValues() {
        const current = rules();
        const skillTypes = [...state.skills.keys()].map((id) => byId(library().skills, id)?.type ?? '');

        return current ? formulaStats(attributesWithTraits(), skillTypes, state.powers.size, current) : {};
    }

    function abilityRowCost(kind, row, stats) {
        const ability = byId(library()[kind], row.id);

        return ability ? abilityCost(ability.purchase_cost, row.level, row.type || ability.type, kind === 'powers', stats, rules()) : 0;
    }

    function totals() {
        const current = rules();
        const points = current?.points ?? null;
        const stats = formulaValues();
        const spentAttributes = Object.values(state.stats).reduce((sum, value) => sum + value, 0);
        const spentSkills = current ? [...state.skills.values()].reduce((sum, row) => sum + abilityRowCost('skills', row, stats), 0) : 0;
        const spentPowers = current ? [...state.powers.values()].reduce((sum, row) => sum + abilityRowCost('powers', row, stats), 0) : 0;
        const spentMoney = state.catalog.reduce((sum, id) => sum + Number(byId(library().catalog, id)?.value ?? 0), 0);

        return {
            stats,
            balance: traitBalance(selectedTraits()),
            attributes: points ? points.max_attribute_points - spentAttributes : null,
            skills: points ? points.initial_skill_points - spentSkills : null,
            powers: points ? points.initial_power_points - spentPowers : null,
            money: points ? points.initial_money - spentMoney : null,
        };
    }

    // Mensagens

    const message = form.querySelector('[data-message]');
    let messageTimer;

    function notify(text, tone = 'info') {
        message.textContent = text;
        message.dataset.tone = tone;
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => { message.textContent = ''; }, 6000);
    }

    // 1. Vantagens e defeitos

    function renderTraits() {
        const { search, type } = filters.traits;
        const balance = traitBalance(selectedTraits());
        const list = library().traits.filter((trait) => (!type || (type === 'disadvantage') === isDisadvantage(trait))
            && (!search || normalize(`${trait.name} ${trait.effect} ${trait.description}`).includes(normalize(search))));

        replace(form.querySelector('[data-list="traits"]'), list.length === 0
            ? el('p', { class: 'muted' }, 'Nenhum traço encontrado.')
            : list.map((trait) => {
                const selected = state.traits.has(trait.id);
                const cost = traitCost(trait);
                const advantage = !isDisadvantage(trait);
                const modifier = effectiveModifier(trait);
                const blocked = !selected && advantage && balance < cost;

                return el('button', {
                    type: 'button',
                    class: `pick${selected ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''} pick--${advantage ? 'advantage' : 'disadvantage'}`,
                    'aria-pressed': String(selected),
                    onClick: () => toggleTrait(trait),
                },
                el('span', { class: 'pick__title' }, trait.name),
                el('span', { class: 'pick__meta' },
                    el('span', { class: `badge badge--pill ${advantage ? 'badge--gm' : 'badge--player'}` }, advantage ? 'Vantagem' : 'Defeito'),
                    el('span', { class: 'badge badge--pill badge--admin' }, `${advantage ? '-' : '+'}${cost} pts`),
                    trait.target ? el('span', {}, `${modifier > 0 ? '+' : ''}${modifier} em ${targetDisplayName(trait.target, (rules() ?? config.sessions[0]?.rules)?.attributes ?? [], library().talents)}`) : null),
                trait.effect ? el('span', { class: 'pick__text' }, trait.effect) : null);
            }));
    }

    function toggleTrait(trait) {
        if (state.traits.has(trait.id)) {
            state.traits.delete(trait.id);
        } else {
            const cost = traitCost(trait);
            const balance = traitBalance(selectedTraits());

            // Vantagens só cabem no saldo gerado pelos defeitos.
            if (!isDisadvantage(trait) && balance < cost) {
                notify(`Pontos insuficientes para esta vantagem (custo ${cost}, saldo ${balance}). Escolha defeitos para obter mais pontos.`, 'error');
                return;
            }

            state.traits.add(trait.id);
        }

        render();
    }

    // 2. Origens

    form.querySelectorAll('[data-basic]').forEach((field) => {
        field.addEventListener(field.type === 'radio' ? 'change' : 'input', () => {
            if (field.type === 'radio' && !field.checked) return;

            const key = field.dataset.basic;
            const previousSession = state.basics.game_session_id;
            state.basics[key] = field.value;

            if (key === 'game_session_id' && previousSession !== field.value) {
                changeSession(previousSession !== '');
            }

            renderSummary();
        });
    });

    function changeSession(reset) {
        // Regras podem mudar entre campanhas: atributos, perícias e poderes recomeçam.
        if (reset) {
            state.skills.clear();
            state.powers.clear();
            notify('Campanha trocada: atributos, perícias e poderes foram zerados.');
        }

        // Cada campanha tem a sua biblioteca: traços e itens que não existem nela saem do rascunho.
        const available = (list) => new Set(list.map((item) => String(item.id)));
        const traitIds = available(library().traits);
        const itemIds = available(library().catalog);
        const traitsBefore = state.traits.size;
        const itemsBefore = state.catalog.length;

        state.traits = new Set([...state.traits].filter((id) => traitIds.has(String(id))));
        state.catalog = state.catalog.filter((id) => itemIds.has(String(id)));

        if (state.traits.size < traitsBefore || state.catalog.length < itemsBefore) {
            notify('Alguns traços ou itens não existem nesta campanha e foram retirados.');
        }

        const current = rules();
        state.stats = Object.fromEntries((current?.attributes ?? []).map((attribute) => [attribute.id.toLowerCase(), reset ? 0 : (state.stats[attribute.id.toLowerCase()] ?? 0)]));
        fillTypeFilters();
        render();
    }

    function syncBasicsFields() {
        form.querySelectorAll('[data-basic]').forEach((field) => {
            const value = state.basics[field.dataset.basic] ?? '';

            if (field.type === 'radio') {
                field.checked = field.value === value;
            } else {
                field.value = value;
            }
        });
    }

    // 3. Atributos

    function renderAttributes() {
        const current = rules();
        const container = form.querySelector('[data-list="attributes"]');
        const hint = form.querySelector('[data-attributes-hint]');

        if (!current) {
            hint.textContent = 'Escolha a campanha no passo Origens para ver os atributos.';
            replace(container);
            replace(form.querySelector('[data-derived]'));
            return;
        }

        const { max_attribute_points: maxTotal, max_single_attribute_value: maxSingle } = current.points;
        const withTraits = attributesWithTraits();
        const remaining = totals().attributes;

        hint.textContent = `Distribua ${maxTotal} pontos. Cada atributo vai de 0 a ${maxSingle}. Restam ${remaining}.`;

        replace(container, current.attributes.map((attribute) => {
            const id = attribute.id.toLowerCase();
            const value = state.stats[id] ?? 0;
            const traitMod = (withTraits[id] ?? 0) - value;

            return el('div', { class: 'attribute-row' },
                el('span', { class: 'attribute-row__name' }, attribute.label, el('small', {}, ` ${id.toUpperCase()}`)),
                el('button', { type: 'button', class: 'icon-button icon-button--bordered', 'aria-label': `Diminuir ${attribute.label}`, disabled: value <= 0, onClick: () => changeAttribute(id, -1) }, '−'),
                el('span', { class: 'attribute-row__value' }, String(value)),
                el('button', { type: 'button', class: 'icon-button icon-button--bordered', 'aria-label': `Aumentar ${attribute.label}`, disabled: value >= maxSingle || remaining <= 0, onClick: () => changeAttribute(id, 1) }, '+'),
                el('span', { class: 'attribute-row__trait' }, traitMod !== 0 ? `${traitMod > 0 ? '+' : ''}${traitMod} traços` : ''),
                el('span', { class: 'attribute-row__total' }, String(withTraits[id] ?? value)));
        }));

        const derived = derivedStats(formulaValues(), current);
        replace(form.querySelector('[data-derived]'), Object.entries(DERIVED_LABELS).map(([key, label]) => el('div', {}, el('dt', {}, label), el('dd', {}, String(derived[key])))));
    }

    function changeAttribute(id, delta) {
        const { max_single_attribute_value: maxSingle } = rules().points;
        const next = (state.stats[id] ?? 0) + delta;

        if (next < 0 || next > maxSingle || (delta > 0 && totals().attributes <= 0)) return;

        state.stats[id] = next;
        render();
    }

    // 4 e 5. Perícias e poderes

    function typesFor(kind) {
        const current = rules();
        const fromRules = kind === 'skills' ? Object.keys(current?.skill_type_vars ?? {}) : Object.keys(current?.power_type_vars ?? {});
        const fallback = kind === 'skills' ? (current?.skill_categories ?? []) : [];
        const fromLibrary = library()[kind].map((item) => item.type);

        return [...new Set([...(fromRules.length ? fromRules : fallback), ...fromLibrary])].filter(Boolean).sort();
    }

    function fillTypeFilters() {
        ['skills', 'powers'].forEach((kind) => {
            const select = form.querySelector(`[data-filter-type="${kind}"]`);
            replace(select, el('option', { value: '' }, 'Todos os tipos'), typesFor(kind).map((type) => el('option', { value: type }, type)));
            select.value = filters[kind].type;
        });
    }

    function renderAbilities(kind) {
        const current = rules();
        const picked = state[kind];
        const pickedContainer = form.querySelector(`[data-picked="${kind}"]`);
        const listContainer = form.querySelector(`[data-list="${kind}"]`);
        const isPower = kind === 'powers';

        if (!current) {
            replace(pickedContainer, el('p', { class: 'muted' }, 'Escolha a campanha no passo Origens.'));
            replace(listContainer);
            return;
        }

        const stats = formulaValues();
        const remaining = totals()[kind];
        const types = typesFor(kind);

        replace(pickedContainer, picked.size === 0
            ? el('p', { class: 'muted' }, `Nenhum(a) ${isPower ? 'poder' : 'perícia'} escolhido(a). Restam ${remaining} pontos.`)
            : [...picked.values()].map((row) => {
                const ability = byId(library()[kind], row.id);
                const cost = abilityRowCost(kind, row, stats);
                const nextCost = abilityRowCost(kind, { ...row, level: row.level + 1 }, stats);

                return el('article', { class: 'picked-row' },
                    el('div', { class: 'picked-row__head' },
                        el('strong', {}, ability?.name ?? '—'),
                        el('span', { class: 'badge badge--pill badge--admin' }, `${cost} pts`),
                        el('button', { type: 'button', class: 'icon-button', 'aria-label': `Remover ${ability?.name}`, onClick: () => { picked.delete(row.id); render(); } }, icon('x', 16))),
                    el('div', { class: 'picked-row__controls' },
                        el('label', { class: 'picked-row__level' }, 'Nível ',
                            el('button', { type: 'button', class: 'icon-button icon-button--bordered', disabled: row.level <= 1, 'aria-label': 'Diminuir nível', onClick: () => { row.level -= 1; render(); } }, '−'),
                            el('span', {}, String(row.level)),
                            el('button', {
                                type: 'button',
                                class: 'icon-button icon-button--bordered',
                                'aria-label': 'Aumentar nível',
                                disabled: nextCost - cost > remaining,
                                onClick: () => { row.level += 1; render(); },
                            }, '+')),
                        el('select', {
                            class: 'select',
                            'aria-label': 'Tipo',
                            onChange: (event) => { row.type = event.target.value; render(); },
                        }, [...new Set([ability?.type, ...types])].filter(Boolean).map((type) => el('option', { value: type, selected: (row.type || ability?.type) === type }, type))),
                        el('input', {
                            class: 'field__input',
                            maxlength: 2000,
                            placeholder: 'Descrição própria (opcional)',
                            'aria-label': 'Descrição própria',
                            value: row.description ?? '',
                            onInput: (event) => { row.description = event.target.value; },
                        })));
            }));

        const { search, type } = filters[kind];
        const list = library()[kind].filter((item) => !picked.has(item.id)
            && (!type || item.type === type)
            && (!search || normalize(`${item.name} ${item.description ?? ''} ${item.effect ?? ''}`).includes(normalize(search))));

        replace(listContainer, list.length === 0
            ? el('p', { class: 'muted' }, 'Nada encontrado na biblioteca.')
            : list.map((item) => {
                const cost = abilityRowCost(kind, { id: item.id, level: 1, type: item.type }, stats);
                const blocked = cost > remaining;

                return el('button', {
                    type: 'button',
                    class: `pick${blocked ? ' is-blocked' : ''}`,
                    onClick: () => {
                        if (blocked) {
                            notify(`Pontos insuficientes (custo ${cost}, restam ${remaining}).`, 'error');
                            return;
                        }
                        picked.set(item.id, { id: item.id, level: 1, type: item.type, description: '' });
                        render();
                    },
                },
                el('span', { class: 'pick__title' }, item.name),
                el('span', { class: 'pick__meta' },
                    el('span', { class: 'badge badge--pill' }, item.type),
                    el('span', { class: 'badge badge--pill badge--admin' }, `${cost} pts`),
                    item.difficulty_formula ? el('span', {}, `Dif. ${item.difficulty_formula}`) : null),
                item.effect || item.description ? el('span', { class: 'pick__text' }, item.effect || item.description) : null);
            }));
    }

    // 6. Equipamento

    function renderEquipment() {
        const remaining = totals().money;
        const pickedContainer = form.querySelector('[data-picked="equipment"]');
        const rows = [
            ...state.catalog.map((id, index) => ({ item: byId(library().catalog, id), remove: () => state.catalog.splice(index, 1), own: false })),
            ...state.custom.map((item, index) => ({ item, remove: () => state.custom.splice(index, 1), own: true })),
        ];

        replace(pickedContainer,
            el('p', { class: 'muted' }, remaining === null ? 'Escolha a campanha no passo Origens.' : `Dinheiro restante: ${money(remaining)}.`),
            rows.map(({ item, remove, own }) => el('article', { class: 'picked-row picked-row--compact' },
                el('div', { class: 'picked-row__head' },
                    el('strong', {}, item?.name ?? '—'),
                    el('span', { class: 'badge badge--pill' }, config.categories[item?.category] ?? item?.category ?? ''),
                    own ? el('span', { class: 'badge badge--pill' }, 'Item próprio') : el('span', { class: 'badge badge--pill badge--admin' }, money(item?.value ?? 0)),
                    el('button', { type: 'button', class: 'icon-button', 'aria-label': `Remover ${item?.name}`, onClick: () => { remove(); render(); } }, icon('x', 16))))));

        replace(form.querySelector('[data-list="catalog"]'), library().catalog.length === 0
            ? el('p', { class: 'muted' }, 'O mestre ainda não marcou itens como equipamento inicial.')
            : library().catalog.map((item) => {
                const blocked = remaining === null || Number(item.value) > remaining;

                return el('button', {
                    type: 'button',
                    class: `pick${blocked ? ' is-blocked' : ''}`,
                    onClick: () => {
                        if (blocked) {
                            notify(remaining === null ? 'Escolha a campanha primeiro.' : `O mercador quer ${money(item.value)}, mas você tem ${money(remaining)}.`, 'error');
                            return;
                        }
                        state.catalog.push(item.id);
                        render();
                    },
                },
                el('span', { class: 'pick__title' }, item.name),
                el('span', { class: 'pick__meta' },
                    el('span', { class: 'badge badge--pill' }, config.categories[item.category] ?? item.category),
                    el('span', { class: 'badge badge--pill badge--admin' }, money(item.value)),
                    item.damage ? el('span', {}, `Dano ${item.damage}`) : null,
                    item.defense ? el('span', {}, `Defesa +${item.defense}`) : null,
                    STACKABLE.includes(item.category) ? el('span', {}, 'acumula') : null));
            }));
    }

    form.querySelector('[data-add-custom]')?.addEventListener('click', () => {
        const fields = Object.fromEntries([...form.querySelectorAll('[data-custom]')].map((field) => [field.dataset.custom, field]));
        const name = fields.name.value.trim();

        if (!name) {
            notify('Dê um nome ao item próprio.', 'error');
            fields.name.focus();
            return;
        }

        state.custom.push({
            name,
            category: fields.category.value,
            damage: fields.damage.value.trim(),
            defense: Number(fields.defense.value) || 0,
            description: fields.description.value.trim(),
        });
        ['name', 'damage', 'defense', 'description'].forEach((key) => { fields[key].value = ''; });
        render();
    });

    // 7. Revisão

    function renderReview() {
        const current = rules();
        const values = attributesWithTraits();
        const section = (title, ...content) => el('section', { class: 'review__section' }, el('h3', {}, title), ...content);
        const list = (items, empty) => items.length ? el('ul', {}, items.map((text) => el('li', {}, text))) : el('p', { class: 'muted' }, empty);

        replace(form.querySelector('[data-review]'),
            section('Origens',
                el('p', {}, el('strong', {}, state.basics.name || 'Sem nome'), ` · ${state.basics.class || 'Aventureiro'}`),
                el('p', { class: 'muted' }, session() ? `Campanha: ${session().name}` : 'Campanha não escolhida')),
            section('Vantagens e Defeitos', list(selectedTraits().map((trait) => `${trait.name} (${isDisadvantage(trait) ? 'Defeito' : 'Vantagem'})`), 'Nenhum traço.')),
            section('Atributos', current
                ? el('dl', { class: 'derived-preview' }, current.attributes.map((attribute) => el('div', {}, el('dt', {}, attribute.id.toUpperCase()), el('dd', {}, String(values[attribute.id.toLowerCase()] ?? 0)))))
                : el('p', { class: 'muted' }, '—')),
            section('Perícias', list([...state.skills.values()].map((row) => `${byId(library().skills, row.id)?.name} (nível ${row.level})`), 'Nenhuma perícia.')),
            section('Poderes', list([...state.powers.values()].map((row) => `${byId(library().powers, row.id)?.name} (nível ${row.level})`), 'Nenhum poder.')),
            section('Equipamento', list([...state.catalog.map((id) => byId(library().catalog, id)?.name), ...state.custom.map((item) => item.name)], 'Nenhum item.')));
    }

    // Resumo lateral

    function renderSummary() {
        const t = totals();
        const set = (key, text, negative = false) => {
            const target = form.querySelector(`[data-summary="${key}"]`);
            target.textContent = text;
            target.classList.toggle('is-negative', negative);
        };

        set('traits', `${t.balance} pts`, t.balance < 0);
        set('attributes', t.attributes === null ? '—' : `${t.attributes} restantes`, (t.attributes ?? 0) < 0);
        set('skills', t.skills === null ? '—' : `${t.skills} restantes`, (t.skills ?? 0) < 0);
        set('powers', t.powers === null ? '—' : `${t.powers} restantes`, (t.powers ?? 0) < 0);
        set('money', t.money === null ? '—' : money(t.money), (t.money ?? 0) < 0);
    }

    // Navegação

    const unspentDialog = document.getElementById('unspent');
    let pendingStep = null;

    function unspent(step) {
        const t = totals();

        if (step === 1 && t.balance > 0) return `${t.balance} ponto(s) de traços obtidos por defeitos`;
        if (step === 3 && t.attributes > 0) return `${t.attributes} ponto(s) de atributos`;
        if (step === 4 && t.skills > 0) return `${t.skills} ponto(s) de perícia`;
        if (step === 5 && t.powers > 0) return `${t.powers} ponto(s) de poder`;

        return null;
    }

    function goTo(target, force = false) {
        if (target > state.step && !force) {
            if (state.step <= 2 && target > 2 && (!state.basics.name.trim() || !state.basics.game_session_id)) {
                notify('Preencha o nome e escolha a campanha no passo Origens.', 'error');
                showStep(2);
                return;
            }

            const leftover = unspent(state.step);

            if (leftover) {
                pendingStep = target;
                unspentDialog.querySelector('[data-unspent-text]').textContent = `Você ainda tem ${leftover} sem usar. Deseja continuar mesmo assim?`;
                unspentDialog.showModal();
                return;
            }
        }

        showStep(target);
    }

    unspentDialog?.querySelector('[data-unspent-continue]').addEventListener('click', () => {
        unspentDialog.close();
        if (pendingStep) goTo(pendingStep, true);
    });

    function showStep(step) {
        state.step = Math.max(1, Math.min(TOTAL_STEPS, step));

        form.querySelectorAll('[data-step]').forEach((panel) => {
            panel.hidden = Number(panel.dataset.step) !== state.step;
        });
        form.querySelectorAll('[data-go-step]').forEach((button) => {
            const number = Number(button.dataset.goStep);
            button.classList.toggle('is-current', number === state.step);
            button.classList.toggle('is-done', number < state.step);
            button.setAttribute('aria-current', number === state.step ? 'step' : 'false');
        });

        form.querySelector('[data-prev]').hidden = state.step === 1;
        form.querySelector('[data-next]').hidden = state.step === TOTAL_STEPS;
        form.querySelector('[data-submit]').hidden = state.step !== TOTAL_STEPS;

        render();
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // No celular a barra de passos rola na horizontal: mantém o passo atual à vista.
        const stepper = form.querySelector('.stepper');
        scrollIntoBar(stepper, stepper?.querySelector('.is-current'), 'smooth');
    }

    form.querySelectorAll('[data-go-step]').forEach((button) => button.addEventListener('click', () => goTo(Number(button.dataset.goStep))));
    form.querySelector('[data-prev]').addEventListener('click', () => goTo(state.step - 1));
    form.querySelector('[data-next]').addEventListener('click', () => goTo(state.step + 1));

    // Filtros

    form.querySelectorAll('[data-filter-search]').forEach((input) => input.addEventListener('input', () => {
        filters[input.dataset.filterSearch].search = input.value;
        render();
    }));
    form.querySelectorAll('[data-filter-type]').forEach((select) => select.addEventListener('change', () => {
        filters[select.dataset.filterType].type = select.value;
        render();
    }));

    // Envio

    form.addEventListener('submit', (event) => {
        if (!state.basics.name.trim() || !state.basics.game_session_id) {
            event.preventDefault();
            notify('Preencha o nome e escolha a campanha no passo Origens.', 'error');
            showStep(2);
            return;
        }

        form.querySelector('[data-payload]').value = JSON.stringify({
            basics: { ...state.basics, game_session_id: Number(state.basics.game_session_id) },
            traits: [...state.traits],
            stats: state.stats,
            skills: [...state.skills.values()],
            powers: [...state.powers.values()],
            equipment: { catalog: state.catalog, custom: state.custom },
        });
    });

    // Sugestões ao administrador

    const suggestionDialog = document.getElementById('suggestion');
    const suggestionForm = suggestionDialog?.querySelector('[data-suggestion-form]');
    const SUGGESTION_LABELS = { skill: 'perícia', power: 'poder', trait: 'vantagem ou defeito' };

    form.querySelectorAll('[data-suggest]').forEach((button) => button.addEventListener('click', () => {
        const type = button.dataset.suggest;
        suggestionForm.reset();
        suggestionForm.querySelector('[data-suggestion-type]').value = type;
        suggestionForm.querySelector('[data-suggestion-intro]').textContent = `Não encontrou a ${SUGGESTION_LABELS[type]} que queria? Sugira ao administrador; ele revisa antes de entrar na biblioteca.`;
        suggestionForm.querySelector('[data-suggestion-error]').textContent = '';
        suggestionForm.querySelectorAll('[data-suggestion-only]').forEach((block) => {
            block.hidden = !block.dataset.suggestionOnly.split(' ').includes(type);
        });
        suggestionDialog.showModal();
    }));

    suggestionForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries([...new FormData(suggestionForm).entries()].filter(([, value]) => value !== ''));
        const button = suggestionForm.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            const response = await postJson(config.suggestionUrl, data);
            suggestionDialog.close();
            notify(response.message, 'success');
        } catch (error) {
            suggestionForm.querySelector('[data-suggestion-error]').textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    // Restauração após erro no servidor

    function restore(old) {
        if (!old || typeof old !== 'object') return false;

        Object.assign(state.basics, old.basics ?? {});
        state.basics.game_session_id = old.basics?.game_session_id ? String(old.basics.game_session_id) : '';
        (old.traits ?? []).forEach((id) => state.traits.add(Number(id)));
        state.stats = { ...(old.stats ?? {}) };
        (old.skills ?? []).forEach((row) => state.skills.set(Number(row.id), { ...row, id: Number(row.id) }));
        (old.powers ?? []).forEach((row) => state.powers.set(Number(row.id), { ...row, id: Number(row.id) }));
        state.catalog = (old.equipment?.catalog ?? []).map(Number);
        state.custom = old.equipment?.custom ?? [];

        return true;
    }

    function render() {
        renderTraits();
        renderAttributes();
        renderAbilities('skills');
        renderAbilities('powers');
        renderEquipment();
        renderReview();
        renderSummary();
    }

    const restored = restore(config.old);
    syncBasicsFields();
    fillTypeFilters();

    if (!restored) {
        changeSession(false);
    }

    showStep(restored ? TOTAL_STEPS : 1);
}
