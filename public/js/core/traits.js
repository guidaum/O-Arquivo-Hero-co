/**
 * Regras das vantagens e desvantagens no navegador (pré-visualização).
 *
 * Espelho de app/Game/TraitCalculator.php: qualquer mudança deve ser feita
 * nos dois lados. O servidor é sempre a autoridade.
 *
 * Um traço é um objeto { type, name, description, effect, modifier, target },
 * em que target é o ID do atributo ou do talento afetado pelo modificador.
 * Os atributos vêm de GameRules::toArray().attributes e os talentos são
 * objetos { id, name }.
 */

const WORD_SEPARATORS = /[\s,.;:+\-()[\]{}/*\\|]+/;
const DISADVANTAGE_MARKERS = ['disadvantage', 'defeito', 'desvantagem'];

/** Texto sem acentos, sem espaços nas pontas e em minúsculas. */
export function normalize(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();
}

function words(normalized) {
    return normalized.replace(/\be\b/g, ' ').split(WORD_SEPARATORS).filter((word) => word !== '');
}

function isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
}

function isNumeric(value) {
    return value !== null
        && value !== undefined
        && typeof value !== 'boolean'
        && String(value).trim() !== ''
        && Number.isFinite(Number(value));
}

function talentList(talents) {
    return (talents ?? []).map((talent) => ({ id: String(talent.id), name: String(talent.name ?? '') }));
}

function lookup(attributes, talents) {
    const result = { attributes: {}, talents: {}, talentWords: {} };

    attributes.forEach((attribute) => {
        const id = attribute.id.toLowerCase();
        result.attributes[normalize(attribute.id)] = id;

        if (attribute.label) {
            result.attributes[normalize(attribute.label)] = id;
        }
    });

    talents.forEach((talent) => {
        const id = talent.id.toLowerCase();
        result.talents[normalize(talent.id)] = id;

        // IDs numéricos se confundiriam com os valores do efeito ("+3 em ...").
        if (!/^\d+$/.test(talent.id)) {
            result.talentWords[normalize(talent.id)] = id;
        }

        if (talent.name !== '') {
            result.talents[normalize(talent.name)] = id;
            result.talentWords[normalize(talent.name)] = id;
        }
    });

    return result;
}

/**
 * Valores com sinal do efeito ("+2 FOR, -1 AGI" → [2, -1]), ignorando
 * dados (1d6) e durações/contagens (1 vez, 2 turnos, nível 1).
 */
export function effectValues(effect) {
    if (effect === null || effect === undefined || effect === '' || typeof effect === 'boolean') {
        return [];
    }

    if (typeof effect === 'number') {
        return Number.isNaN(effect) ? [] : [Math.trunc(effect)];
    }

    if (Array.isArray(effect)) {
        return effect.flatMap((item) => effectValues(item));
    }

    if (typeof effect === 'object') {
        if (isNumber(effect.value)) return [Math.trunc(effect.value)];
        if (isNumber(effect.modifier)) return [Math.trunc(effect.modifier)];
        return effect.effect ? effectValues(effect.effect) : [];
    }

    const text = String(effect)
        .replace(/\b[0-9]*d[0-9]+\b/gi, ' ')
        .replace(/([0-9]+)\s*(?:vez|vezes|turno|turnos|dia|dias|hora|horas|rodada|rodadas|nível|nivel|lvl)\b/giu, ' ')
        .replace(/\b(?:menos|reduz(?:e)?|penalidade(?: de)?|subtrai)\s*([0-9]+)/giu, '-$1')
        .replace(/\b(?:mais|aumenta|bônus(?: de)?|adiciona)\s*([0-9]+)/giu, '+$1');

    return (text.match(/[+-]?\s*[0-9]+/g) ?? []).map((value) => parseInt(value.replace(/\s+/g, ''), 10));
}

export function isDisadvantage(trait) {
    const type = String(trait?.type ?? '').toLowerCase();

    return DISADVANTAGE_MARKERS.some((marker) => type.includes(marker));
}

/**
 * Custo do traço: metade da soma dos efeitos (para cima na vantagem, para
 * baixo na desvantagem) + modificador, ambos em valor absoluto.
 */
export function traitCostDetails(trait) {
    const isAdvantage = !isDisadvantage(trait);
    const values = effectValues(trait?.effect || trait?.effects);
    const rawEffectSum = values.reduce((sum, value) => sum + value, 0);
    const positiveEffectSum = Math.abs(rawEffectSum);
    const modifier = isNumeric(trait?.modifier) ? Math.trunc(Math.abs(Number(trait.modifier))) : 0;
    const halfEffect = isAdvantage ? Math.ceil(positiveEffectSum / 2) : Math.floor(positiveEffectSum / 2);

    return {
        isAdvantage,
        modifier,
        effectValues: values,
        rawEffectSum,
        positiveEffectSum,
        halfEffect,
        total: halfEffect + modifier,
    };
}

export function traitCost(trait) {
    return traitCostDetails(trait).total;
}

/** Pontos que sobram para vantagens: custo das desvantagens menos o das vantagens. */
export function traitBalance(traits) {
    return (traits ?? []).reduce((balance, trait) => {
        const type = String(trait.type ?? '').toLowerCase();

        if (['disadvantage', 'defeito', 'desvantagem'].includes(type)) {
            return balance + traitCost(trait);
        }

        if (['advantage', 'vantagem'].includes(type)) {
            return balance - traitCost(trait);
        }

        return balance;
    }, 0);
}

/**
 * Modificador aplicado aos alvos, com o sinal cadastrado (vantagem ou
 * desvantagem). Sem modificador, usa o primeiro número com sinal do efeito.
 */
export function effectiveModifier(trait) {
    if (!trait) return 0;

    if (isNumeric(trait.modifier)) {
        return Math.trunc(Number(trait.modifier));
    }

    if (trait.effect !== null && trait.effect !== undefined && typeof trait.effect !== 'object') {
        const match = String(trait.effect).match(/[+-]?\s*[0-9]+/);

        if (match) {
            return parseInt(match[0].replace(/\s+/g, ''), 10);
        }
    }

    return 0;
}

/** Atributos e talentos afetados pelo traço: { attributeIds, talentIds }. */
export function traitTargets(trait, attributes, talents = []) {
    const list = talentList(talents);
    const maps = lookup(attributes, list);
    const attributeIds = new Set();
    const talentIds = new Set();

    const collect = (text, wholeText, useTalentIds) => {
        const normalized = normalize(text);

        if (normalized === '') return;

        if (wholeText) {
            if (maps.attributes[normalized]) attributeIds.add(maps.attributes[normalized]);

            const talentMap = useTalentIds ? maps.talents : maps.talentWords;

            if (talentMap[normalized]) talentIds.add(talentMap[normalized]);
        }

        if (normalized.includes('todos os atributos') || normalized.includes('todos atributos')) {
            attributes.forEach((attribute) => attributeIds.add(attribute.id.toLowerCase()));
        }

        words(normalized).forEach((word) => {
            if (maps.attributes[word]) attributeIds.add(maps.attributes[word]);
            if (maps.talentWords[word]) talentIds.add(maps.talentWords[word]);
        });
    };

    collect(trait?.target ?? '', true, true);

    if (trait?.effect !== null && trait?.effect !== undefined && typeof trait.effect !== 'object') {
        collect(String(trait.effect), false, false);
    }

    if (attributeIds.size === 0 && talentIds.size === 0) {
        collect(trait?.name ?? '', true, false);
        collect(trait?.description ?? '', true, false);
    }

    return { attributeIds: [...attributeIds], talentIds: [...talentIds] };
}

/** Indica se o alvo do modificador e o efeito se referem ao mesmo atributo ou talento. */
export function isModifierSameAsEffect(trait, attributes, talents = []) {
    const target = normalize(trait?.target ?? '');
    const effect = trait?.effect !== null && trait?.effect !== undefined && typeof trait.effect !== 'object'
        ? normalize(trait.effect)
        : '';

    if (target === '' || effect === '') return false;
    if (target === effect) return true;

    const maps = lookup(attributes, talentList(talents));

    const find = (text, wholeMap, wordMap) => {
        const found = new Set();

        if (wholeMap[text]) found.add(wholeMap[text]);

        words(text).forEach((word) => {
            if (wordMap[word]) found.add(wordMap[word]);
        });

        return found;
    };

    const intersects = (a, b) => [...a].some((item) => b.has(item));

    return intersects(find(target, maps.attributes, maps.attributes), find(effect, maps.attributes, maps.attributes))
        || intersects(find(target, maps.talents, maps.talentWords), find(effect, maps.talentWords, maps.talentWords));
}

/** Nome legível do alvo do modificador ("for" → "Força"). */
export function targetDisplayName(target, attributes, talents = []) {
    if (!target) return 'Geral';

    const normalized = normalize(target);
    const list = talentList(talents);
    const attributeName = (attribute) => attribute.label || attribute.id.toUpperCase();
    const talentName = (talent) => talent.name || talent.id;

    for (const attribute of attributes) {
        if (normalize(attribute.id) === normalized || normalize(attribute.label) === normalized) {
            return attributeName(attribute);
        }
    }

    for (const talent of list) {
        if (normalize(talent.id) === normalized || normalize(talent.name) === normalized) {
            return talentName(talent);
        }
    }

    for (const attribute of attributes) {
        const id = normalize(attribute.id);
        const label = normalize(attribute.label);

        if ((label !== '' && normalized.includes(label)) || (id !== '' && normalized.includes(id))) {
            return attributeName(attribute);
        }
    }

    for (const talent of list) {
        const name = normalize(talent.name);

        if (name !== '' && (normalized.includes(name) || name.includes(normalized))) {
            return talentName(talent);
        }
    }

    return target.charAt(0).toUpperCase() + target.slice(1);
}

/** Soma dos modificadores dos traços por atributo (chave em minúsculas). */
export function attributeModifiers(traits, attributes, talents = []) {
    const modifiers = {};

    (traits ?? []).forEach((trait) => {
        const modifier = effectiveModifier(trait);

        traitTargets(trait, attributes, talents).attributeIds.forEach((id) => {
            modifiers[id] = (modifiers[id] ?? 0) + modifier;
        });
    });

    return modifiers;
}

/** Soma dos modificadores dos traços que citam o talento diretamente (chave = ID). */
export function talentModifiers(traits, attributes, talents = []) {
    const modifiers = {};

    talentList(talents).forEach((talent) => {
        modifiers[talent.id.toLowerCase()] = 0;
    });

    (traits ?? []).forEach((trait) => {
        const modifier = effectiveModifier(trait);

        traitTargets(trait, attributes, talents).talentIds.forEach((id) => {
            if (id in modifiers) {
                modifiers[id] += modifier;
            }
        });
    });

    return modifiers;
}
