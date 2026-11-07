/**
 * Fórmulas das regras no navegador, para pré-visualização ao vivo.
 *
 * Espelho de app/Game/FormulaEvaluator.php, ExpressionParser.php e
 * CharacterCalculator.php: qualquer mudança nas regras deve ser feita nos
 * dois lados. O servidor é sempre a autoridade.
 *
 * As regras (`rules`) vêm de GameRules::toArray(), passadas pela view com @json.
 */

const MAX_LENGTH = 500;
const MAX_DEPTH = 50;
const VARIABLE_PASSES = 3;
const IDENTIFIER = /(?<![A-Z0-9_.])[A-Z_][A-Z0-9_]*/g;
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|(\*\*|[-+*/%^()]))/y;

export class InvalidFormulaError extends Error {}

function stripAccents(text) {
    return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Forma canônica de um nome de variável: sem acentos e em maiúsculas. */
export function variableName(name) {
    return stripAccents(String(name).trim()).toUpperCase();
}

function formatNumber(value) {
    const number = Number(value);

    if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(number)) {
        return '0';
    }

    const text = Number.isInteger(number) ? String(number) : String(Number(number.toFixed(10)));

    return number < 0 ? `(${text})` : text;
}

/**
 * Calcula uma expressão só com números e operadores (+ - * / % ^ ** e parênteses).
 * Lança InvalidFormulaError em caso de erro.
 */
export function calculate(expression) {
    if (expression.length > MAX_LENGTH) {
        throw new InvalidFormulaError('fórmula longa demais');
    }

    const tokens = [];
    const length = expression.trimEnd().length;
    TOKEN.lastIndex = 0;

    while (TOKEN.lastIndex < length) {
        const match = TOKEN.exec(expression);

        if (match === null) {
            throw new InvalidFormulaError('caractere não permitido');
        }

        tokens.push(match[2] !== undefined ? ['operator', match[2]] : ['number', match[1]]);
    }

    if (tokens.length === 0) {
        throw new InvalidFormulaError('fórmula vazia');
    }

    let position = 0;
    let depth = 0;

    const accept = (...operators) => {
        const token = tokens[position];

        if (token && token[0] === 'operator' && operators.includes(token[1])) {
            position++;
            return token[1];
        }

        return null;
    };

    const nested = (callback) => {
        if (++depth > MAX_DEPTH) {
            throw new InvalidFormulaError('aninhamento excessivo');
        }

        try {
            return callback();
        } finally {
            depth--;
        }
    };

    const primary = () => {
        const token = tokens[position];

        if (!token) {
            throw new InvalidFormulaError('fórmula incompleta');
        }

        if (token[0] === 'number') {
            position++;
            return parseFloat(token[1]);
        }

        if (token[1] === '(') {
            position++;
            const value = nested(expressionRule);

            if (accept(')') === null) {
                throw new InvalidFormulaError('parêntese não fechado');
            }

            return value;
        }

        throw new InvalidFormulaError(`símbolo inesperado "${token[1]}"`);
    };

    const power = () => {
        const base = primary();

        if (accept('^', '**') === null) {
            return base;
        }

        const value = Math.pow(base, nested(unary));

        if (Number.isNaN(value)) {
            throw new InvalidFormulaError('potência inválida');
        }

        return value;
    };

    const unary = () => {
        const operator = accept('+', '-');

        if (operator === null) {
            return power();
        }

        return nested(() => (operator === '-' ? -unary() : unary()));
    };

    const term = () => {
        let value = unary();
        let operator;

        while ((operator = accept('*', '/', '%')) !== null) {
            const right = unary();

            if (operator !== '*' && right === 0) {
                throw new InvalidFormulaError('divisão por zero');
            }

            value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
        }

        return value;
    };

    function expressionRule() {
        let value = term();
        let operator;

        while ((operator = accept('+', '-')) !== null) {
            const right = term();
            value = operator === '+' ? value + right : value - right;
        }

        return value;
    }

    const value = expressionRule();

    if (position < tokens.length) {
        throw new InvalidFormulaError(`símbolo inesperado "${tokens[position][1]}"`);
    }

    if (!Number.isFinite(value)) {
        throw new InvalidFormulaError('resultado fora dos limites');
    }

    return value;
}

/** Troca as variáveis conhecidas pelos valores; as desconhecidas permanecem. */
export function substitute(formula, stats) {
    const values = new Map();

    Object.entries(stats ?? {}).forEach(([name, value]) => values.set(variableName(name), value));

    return variableName(formula).replace(IDENTIFIER, (name) => (values.has(name) ? formatNumber(values.get(name)) : name));
}

/** Variáveis que não existem valem 0. */
export function zeroUnknown(expression) {
    return expression.replace(IDENTIFIER, '0');
}

/** Resultado inteiro (arredondado para baixo) da fórmula; inválida vale 0. */
export function evaluateFormula(formula, stats = {}) {
    if (formula === null || formula === undefined || String(formula).trim() === '') {
        return 0;
    }

    try {
        return Math.floor(calculate(zeroUnknown(substitute(String(formula), stats))));
    } catch (error) {
        if (error instanceof InvalidFormulaError) {
            return 0;
        }

        throw error;
    }
}

/** Acrescenta as variáveis de cálculo das regras, que podem depender umas das outras. */
export function resolveVariables(stats, variables) {
    const resolved = {};

    Object.entries(stats ?? {}).forEach(([name, value]) => {
        const number = Number(value);
        resolved[variableName(name)] = value !== null && value !== '' && Number.isFinite(number) ? number : 0;
    });

    for (let pass = 0; pass < VARIABLE_PASSES; pass++) {
        Object.entries(variables ?? {}).forEach(([name, formula]) => {
            resolved[variableName(name)] = evaluateFormula(formula, resolved);
        });
    }

    return resolved;
}

/**
 * Variáveis das fórmulas: atributos, perícias por categoria (LUTA e LUTAS...),
 * SKILLS, POWERS e variáveis de cálculo.
 *
 * @param {Object<string, number>} attributes valor de cada atributo por ID
 * @param {string[]} skillTypes tipo de cada perícia do personagem
 */
export function formulaStats(attributes, skillTypes, powerCount, rules) {
    const values = {};
    const stats = {};

    Object.entries(attributes ?? {}).forEach(([id, value]) => {
        values[id.toLowerCase()] = value;
    });

    rules.attributes.forEach((attribute) => {
        stats[variableName(attribute.id)] = values[attribute.id.toLowerCase()] ?? 0;
    });

    rules.skill_categories.forEach((category) => {
        const name = variableName(category);
        const count = skillTypes.filter((type) => type === category).length;

        stats[name] = count;
        stats[name.endsWith('S') ? name.slice(0, -1) : `${name}S`] = count;
    });

    stats.SKILLS = skillTypes.length;
    stats.POWERS = powerCount;

    return resolveVariables(stats, rules.calculation_vars);
}

export const DERIVED_STATS = ['pv', 'atp', 'soco', 'chute', 'en', 'dm', 'defesa', 'esquiva'];

/** PV, ATP, soco, chute, EN, DM, defesa e esquiva. */
export function derivedStats(stats, rules) {
    return Object.fromEntries(DERIVED_STATS.map((name) => [name, evaluateFormula(rules.formulas[name], stats)]));
}

/** Custo de uma perícia ou poder no nível informado (mínimo 1, arredonda para cima). */
export function abilityCost(baseCost, level, type, isPower, stats, rules) {
    const cost = Number(baseCost) || 1;
    const lvl = Number(level) || 1;
    const typeVars = (isPower ? rules.power_type_vars : rules.skill_type_vars) ?? {};
    const typeVar = typeVars[type ?? ''] || '1';
    const divisor = Math.max(1, evaluateFormula(typeVar, stats));

    try {
        const expression = substitute(isPower ? rules.formulas.power_cost : rules.formulas.skill_cost, {
            COST: cost,
            LVL: lvl,
            VAR: divisor,
        });

        return Math.max(1, Math.ceil(calculate(expression)));
    } catch (error) {
        if (error instanceof InvalidFormulaError) {
            return Math.max(1, cost * lvl);
        }

        throw error;
    }
}

/**
 * Valor final do atributo. Com modificador próprio, o modificador vindo
 * de traços é desconsiderado.
 */
export function attributeTotal(base, modifier, traitModifier, itemModifier = 0, gmModifier = 0) {
    const trait = modifier !== 0 && traitModifier !== 0 ? 0 : traitModifier;

    return base + modifier + trait + itemModifier + gmModifier;
}

/** Meta do teste rápido conforme a dificuldade (easy, normal, hard, extreme). */
export function testTarget(value, difficulty, rules) {
    const { easy_mod: easyMod, hard_div: hardDiv, extreme_div: extremeDiv } = rules.difficulty;

    switch (difficulty) {
        case 'easy':
            return Math.floor(value + easyMod);
        case 'hard':
            return Math.floor(value / hardDiv);
        case 'extreme':
            return Math.floor(value / extremeDiv);
        default:
            return Math.floor(value);
    }
}
