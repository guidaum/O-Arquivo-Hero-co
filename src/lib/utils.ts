import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const evaluateFormula = (formula: string, stats: Record<string, number>) => {
  if (!formula) return 0;
  try {
    let result = formula.toUpperCase();
    Object.entries(stats).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key.toUpperCase()}\\b`, 'g');
      result = result.replace(regex, value.toString());
    });
    // Replace any remaining words (attributes not found in stats) with 0
    result = result.replace(/[A-Z]+/g, '0');
    // Basic math evaluation
    // eslint-disable-next-line no-eval
    return Math.floor(eval(result));
  } catch (err) {
    console.error('Error evaluating formula:', formula, err);
    return 0;
  }
};

export const resolveStatsWithVars = (stats: Record<string, number>, calculationVars?: Record<string, string>) => {
  const resolved = { ...stats };
  if (calculationVars) {
    for (let i = 0; i < 3; i++) {
      Object.entries(calculationVars).forEach(([name, formula]) => {
        resolved[name.toUpperCase()] = evaluateFormula(formula, resolved);
      });
    }
  }
  return resolved;
};

export const rollDiceFormula = (formula: string, stats: Record<string, number>) => {
  if (!formula) return { total: 0, rolls: [], detail: '' };
  
  try {
    let detail = formula.toUpperCase();
    
    // 1. Replace attributes first
    Object.entries(stats).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key.toUpperCase()}\\b`, 'g');
      detail = detail.replace(regex, value.toString());
    });

    // Replace ^ with ** for power operation
    let processedFormula = detail.replace(/\^/g, '**');

    // 2. Find and roll dice (e.g., 1D6, D20)
    const diceRegex = /(\d*)D(\d+)/g;
    const allRolls: { die: string, values: number[] }[] = [];
    
    processedFormula = processedFormula.replace(diceRegex, (match, qty, die) => {
      const q = parseInt(qty || '1');
      const d = parseInt(die);
      // Ensure q and d are valid numbers to avoid infinity/NaN
      if (isNaN(q) || isNaN(d) || q > 100) return '0';
      const rolls = Array.from({ length: q }, () => Math.floor(Math.random() * d) + 1);
      allRolls.push({ die: match, values: rolls });
      return `(${rolls.reduce((a, b) => a + b, 0)})`;
    });

    // 2.5 Replace any remaining words (attributes not found in stats) with 0
    processedFormula = processedFormula.replace(/[A-Z]+/g, '0');

    // 3. Evaluate the final math expression
    // eslint-disable-next-line no-eval
    const total = Math.floor(eval(processedFormula));
    
    return {
      total,
      rolls: allRolls,
      detail: processedFormula
    };
  } catch (err) {
    console.error('Error rolling dice formula:', formula, err);
    return { total: 0, rolls: [], detail: 'Erro' };
  }
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const playAudio = (url: string, volume: number = 0.5) => {
  try {
    if (!url) return null;
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {});
    return audio;
  } catch (e) {
    return null;
  }
};

export const normalizeTraitType = (str: string): string => {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// Returns the true effective modifier number (+ for advantages, - for disadvantages)
export const getTraitEffectiveModifier = (trait: any): number => {
  if (!trait) return 0;

  let rawMod = Number(trait.modifier);
  if (isNaN(rawMod) || rawMod === 0) {
    if (trait.effect) {
      const match = String(trait.effect).match(/([+-]?\s*\d+)/);
      if (match) {
        rawMod = parseInt(match[1].replace(/\s+/g, ''), 10);
      }
    }
  }
  if (isNaN(rawMod)) rawMod = 0;

  const typeLower = String(trait.type || '').toLowerCase();
  const isDisadvantage = typeLower === 'disadvantage' || typeLower === 'defeito' || typeLower === 'desvantagem';
  const isAdvantage = typeLower === 'advantage' || typeLower === 'vantagem';

  if (isDisadvantage) {
    // Disadvantages penalize attributes. If entered as positive (e.g. 2 pts cost), negate it to -2 on attribute
    // unless the effect explicitly indicates a positive bonus (+2)
    if (trait.effect && /[+]\s*\d+/.test(trait.effect)) {
      return rawMod;
    }
    return -Math.abs(rawMod);
  }

  if (isAdvantage) {
    // Advantages boost attributes. If entered as negative, make it positive unless effect explicitly has a minus
    if (rawMod < 0 && (!trait.effect || !/[-]\s*\d+/.test(trait.effect))) {
      return Math.abs(rawMod);
    }
    return rawMod;
  }

  return rawMod;
};

// Check if a trait's modifierType and effect refer to the same attribute or talent type.
// If both refer to the same type (e.g. modifierType is 'int' and effect is 'INT' or 'Inteligência'),
// the effect should be disregarded in calculation!
// If they are of different types (e.g. modifierType is 'for' and effect is 'AGI'), the values should be considered.
export const isTraitModifierSameAsEffect = (
  trait: any,
  attributesList: Array<{ id: string; label?: string }> = [],
  talentsList: Array<{ id: string; name?: string }> = []
): boolean => {
  if (!trait) return false;
  const modTypeRaw = normalizeTraitType(trait.modifierType || trait.targetAttr || trait.attribute || trait.target || '');
  const effectRaw = normalizeTraitType(trait.effect || '');
  if (!modTypeRaw || !effectRaw) return false;

  const DEFAULT_ATTRS = [
    { id: 'for', label: 'Força' },
    { id: 'con', label: 'Constituição' },
    { id: 'agi', label: 'Agilidade' },
    { id: 'per', label: 'Percepção' },
    { id: 'vel', label: 'Velocidade' },
    { id: 'ini', label: 'Iniciativa' },
    { id: 'int', label: 'Inteligência' },
    { id: 'cor', label: 'Coragem' },
  ];

  const allAttrs = attributesList && attributesList.length > 0 ? attributesList : DEFAULT_ATTRS;
  const attrMap: Record<string, string> = {};
  allAttrs.forEach(a => {
    const idNorm = normalizeTraitType(a.id);
    const canonicalId = a.id.toLowerCase();
    attrMap[idNorm] = canonicalId;
    if (a.label) {
      attrMap[normalizeTraitType(a.label)] = canonicalId;
    }
  });

  const talentMap: Record<string, string> = {};
  if (talentsList) {
    talentsList.forEach(t => {
      const idNorm = normalizeTraitType(t.id);
      const canonicalId = t.id.toLowerCase();
      talentMap[idNorm] = canonicalId;
      if (t.name) {
        talentMap[normalizeTraitType(t.name)] = canonicalId;
      }
    });
  }

  // Direct match
  if (modTypeRaw === effectRaw) return true;

  const extractAllAttrs = (text: string): Set<string> => {
    const found = new Set<string>();
    if (!text) return found;
    if (attrMap[text]) found.add(attrMap[text]);
    const words = text.split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW && attrMap[cleanW]) {
        found.add(attrMap[cleanW]);
      }
    }
    return found;
  };

  const extractAllTalents = (text: string): Set<string> => {
    const found = new Set<string>();
    if (!text) return found;
    if (talentMap[text]) found.add(talentMap[text]);
    const words = text.split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW && talentMap[cleanW]) {
        found.add(talentMap[cleanW]);
      }
    }
    return found;
  };

  const modAttrs = extractAllAttrs(modTypeRaw);
  const effectAttrs = extractAllAttrs(effectRaw);
  for (const a of modAttrs) {
    if (effectAttrs.has(a)) return true;
  }

  const modTalents = extractAllTalents(modTypeRaw);
  const effectTalents = extractAllTalents(effectRaw);
  for (const t of modTalents) {
    if (effectTalents.has(t)) return true;
  }

  return false;
};

// Gets the list of attribute and talent IDs that this trait legitimately affects.
// If modifierType and effect refer to the same attribute/talent (isTraitModifierSameAsEffect is true),
// the effect is disregarded in calculations and origins: ONLY the modifier is considered.
// If effect refers to a different attribute/talent (e.g. modifier in FOR and effect in AGI), both are considered.
export const getTraitTargets = (
  trait: any,
  attributesList: Array<{ id: string; label?: string }> = [],
  talentsList: Array<{ id: string; name?: string }> = []
): { attrIds: string[]; talentIds: string[] } => {
  if (!trait) {
    return { attrIds: [], talentIds: [] };
  }

  const DEFAULT_ATTRS = [
    { id: 'for', label: 'Força' },
    { id: 'con', label: 'Constituição' },
    { id: 'agi', label: 'Agilidade' },
    { id: 'per', label: 'Percepção' },
    { id: 'vel', label: 'Velocidade' },
    { id: 'ini', label: 'Iniciativa' },
    { id: 'int', label: 'Inteligência' },
    { id: 'cor', label: 'Coragem' },
  ];

  const allAttrs = attributesList && attributesList.length > 0 ? attributesList : DEFAULT_ATTRS;
  const attrMap: Record<string, string> = {};
  allAttrs.forEach(a => {
    const idNorm = normalizeTraitType(a.id);
    const canonicalId = a.id.toLowerCase();
    attrMap[idNorm] = canonicalId;
    if (a.label) {
      attrMap[normalizeTraitType(a.label)] = canonicalId;
    }
  });

  const talentMap: Record<string, string> = {};
  if (talentsList) {
    talentsList.forEach(t => {
      const idNorm = normalizeTraitType(t.id);
      const canonicalId = t.id.toLowerCase();
      talentMap[idNorm] = canonicalId;
      if (t.name) {
        talentMap[normalizeTraitType(t.name)] = canonicalId;
      }
    });
  }

  const attrIds = new Set<string>();
  const talentIds = new Set<string>();

  const checkAndAdd = (rawStr: string) => {
    if (!rawStr) return;
    const norm = normalizeTraitType(rawStr);
    if (attrMap[norm]) attrIds.add(attrMap[norm]);
    if (talentMap[norm]) talentIds.add(talentMap[norm]);

    const words = norm.split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW && attrMap[cleanW]) attrIds.add(attrMap[cleanW]);
      if (cleanW && talentMap[cleanW]) talentIds.add(talentMap[cleanW]);
    }
  };

  // The modifier target is always considered first
  checkAndAdd(trait.modifierType);
  checkAndAdd(trait.targetAttr);
  checkAndAdd(trait.attribute);
  checkAndAdd(trait.target);

  // If the effect modifies an attribute/talent that is ALREADY targeted by the modifier,
  // do NOT duplicate it. The value considered will be only the modifier.
  // If the effect targets a DIFFERENT attribute/talent, add only the distinct target.
  if (trait.effect) {
    const norm = normalizeTraitType(trait.effect);
    const words = norm.split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW) {
        if (attrMap[cleanW] && !attrIds.has(attrMap[cleanW])) {
          attrIds.add(attrMap[cleanW]);
        }
        if (talentMap[cleanW] && !talentIds.has(talentMap[cleanW])) {
          talentIds.add(talentMap[cleanW]);
        }
      }
    }
  }

  // Fallback: If no target was found in modifierType or effect, check trait name and description
  if (attrIds.size === 0 && talentIds.size === 0) {
    if (trait.name) checkAndAdd(trait.name);
    if (trait.description) checkAndAdd(trait.description);
  }

  return {
    attrIds: Array.from(attrIds),
    talentIds: Array.from(talentIds)
  };
};

// Returns the full readable display name of an attribute or talent from its alias / modifierType
export const getTraitTargetDisplayName = (
  rawTarget: string,
  attributesList: Array<{ id: string; label?: string }> = [],
  talentsList: Array<{ id: string; name?: string }> = []
): string => {
  if (!rawTarget) return 'Geral';
  const norm = normalizeTraitType(rawTarget);

  const DEFAULT_ATTRS = [
    { id: 'for', label: 'Força' },
    { id: 'con', label: 'Constituição' },
    { id: 'agi', label: 'Agilidade' },
    { id: 'per', label: 'Percepção' },
    { id: 'vel', label: 'Velocidade' },
    { id: 'ini', label: 'Iniciativa' },
    { id: 'int', label: 'Inteligência' },
    { id: 'cor', label: 'Coragem' },
  ];

  const allAttrs = attributesList && attributesList.length > 0 ? attributesList : DEFAULT_ATTRS;

  // 1. Direct match on attribute ID or label
  for (const a of allAttrs) {
    if (normalizeTraitType(a.id) === norm || normalizeTraitType(a.label || '') === norm) {
      return a.label || a.id.toUpperCase();
    }
  }

  // 2. Direct match on talent ID or name
  if (talentsList) {
    for (const t of talentsList) {
      if (normalizeTraitType(t.id) === norm || normalizeTraitType(t.name || '') === norm) {
        return t.name || t.id;
      }
    }
  }

  // 3. Substring / token match in attributes
  for (const a of allAttrs) {
    const aIdNorm = normalizeTraitType(a.id);
    const aLabelNorm = normalizeTraitType(a.label || '');
    if (norm === aIdNorm || (aLabelNorm && norm.includes(aLabelNorm)) || (aIdNorm && norm.includes(aIdNorm))) {
      return a.label || a.id.toUpperCase();
    }
  }

  // 4. Substring / token match in talents
  if (talentsList) {
    for (const t of talentsList) {
      const tIdNorm = normalizeTraitType(t.id);
      const tNameNorm = normalizeTraitType(t.name || '');
      if (norm === tIdNorm || (tNameNorm && (norm.includes(tNameNorm) || tNameNorm.includes(norm)))) {
        return t.name || t.id;
      }
    }
  }

  return rawTarget.charAt(0).toUpperCase() + rawTarget.slice(1);
};
