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

/**
 * Extracts all signed or numerical values from a trait's effect description or structure.
 * Respects positive and negative values (e.g., "+2 FOR, -1 AGI" -> [2, -1]).
 * Ignores dice rolls (like 1d6, 2d20) and durations/counts (like 1 vez, 2 turnos).
 */
export const extractTraitEffectValues = (effectInput: any): number[] => {
  if (effectInput === undefined || effectInput === null || effectInput === '') {
    return [];
  }
  if (typeof effectInput === 'number') {
    return isNaN(effectInput) ? [] : [effectInput];
  }
  if (Array.isArray(effectInput)) {
    return effectInput.flatMap(item => extractTraitEffectValues(item));
  }
  if (typeof effectInput === 'object') {
    if (typeof effectInput.value === 'number') return [effectInput.value];
    if (typeof effectInput.modifier === 'number') return [effectInput.modifier];
    if (effectInput.effect) return extractTraitEffectValues(effectInput.effect);
    return [];
  }

  let text = String(effectInput);

  // 1. Remove dice notations (e.g. 1d6, 2d20, d100)
  text = text.replace(/\b\d*d\d+\b/gi, ' ');

  // 2. Remove count/duration words to avoid parsing "1 vez", "2 rodadas", "nível 1" as stat effect values
  text = text.replace(/(\d+)\s*(?:vez|vezes|turno|turnos|dia|dias|hora|horas|rodada|rodadas|nível|nivel|lvl)\b/gi, ' ');

  // 3. Normalize verbal reductions/penalties to negative signs and bonuses to positive
  text = text.replace(/\b(?:menos|reduz(?:e)?|penalidade(?: de)?|subtrai)\s*(\d+)/gi, '-$1');
  text = text.replace(/\b(?:mais|aumenta|bônus(?: de)?|adiciona)\s*(\d+)/gi, '+$1');

  // 4. Match explicitly signed numbers (e.g., +2, -1, + 3, - 4) or numbers with signs
  const values: number[] = [];
  const regex = /([+-]?\s*\d+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[1].replace(/\s+/g, '');
    const num = parseInt(rawMatch, 10);
    if (!isNaN(num)) {
      values.push(num);
    }
  }

  return values;
};

export interface TraitCostBreakdown {
  isAdvantage: boolean;
  modVal: number;
  effectValues: number[];
  rawEffectSum: number;
  positiveEffectSum: number;
  halfEffect: number;
  totalCost: number;
}

/**
 * Calculates the cost value of advantages and defects (disadvantages) in character creation:
 * - Vantagem: soma dos efeitos dividido por 2 arredondado para cima (Math.ceil), somado com o valor integral do modificador.
 * - Desvantagem: soma dos efeitos dividido por 2 arredondado para baixo (Math.floor), somado com o valor integral do modificador.
 * - Atenção: nos efeitos existem valores negativos e positivos, isso é levado em consideração no cálculo dos efeitos;
 *   quando for somado ao valor do modificador, tanto o modificador quanto o resultado da somatória dos efeitos são considerados positivos.
 */
export const calculateTraitCostDetails = (trait: any): TraitCostBreakdown => {
  if (!trait) {
    return {
      isAdvantage: true,
      modVal: 0,
      effectValues: [],
      rawEffectSum: 0,
      positiveEffectSum: 0,
      halfEffect: 0,
      totalCost: 0
    };
  }

  const typeStr = String(trait.type || '').toLowerCase();
  const isDisadvantage = typeStr.includes('disadvantage') || typeStr.includes('defeito') || typeStr.includes('desvantagem');
  const isAdvantage = !isDisadvantage;

  // Extract all effect values with their respective positive and negative signs
  const effectValues = extractTraitEffectValues(trait.effect || trait.effects);

  // Sum of effects taking negative and positive values into account
  const rawEffectSum = effectValues.reduce((acc, v) => acc + v, 0);

  // Both modifier and the result of effect summation are considered positive
  const positiveEffectSum = Math.abs(rawEffectSum);

  const rawMod = Number(trait.modifier);
  const modVal = !isNaN(rawMod) ? Math.abs(rawMod) : 0;

  // Divide by 2: ceil for advantage, floor for disadvantage
  const halfEffect = isAdvantage
    ? Math.ceil(positiveEffectSum / 2)
    : Math.floor(positiveEffectSum / 2);

  const totalCost = halfEffect + modVal;

  return {
    isAdvantage,
    modVal,
    effectValues,
    rawEffectSum,
    positiveEffectSum,
    halfEffect,
    totalCost
  };
};

export const calculateTraitCost = (trait: any): number => {
  return calculateTraitCostDetails(trait).totalCost;
};

// Returns the true effective modifier number, respecting the sign explicitly attributed to modifier or in effect,
// regardless of whether the trait is an advantage or disadvantage.
export const getTraitEffectiveModifier = (trait: any): number => {
  if (!trait) return 0;

  // 1. If trait.modifier is defined, respect its exact sign and numerical value
  if (trait.modifier !== undefined && trait.modifier !== null && trait.modifier !== '') {
    const raw = Number(trait.modifier);
    if (!isNaN(raw)) {
      return raw;
    }
  }

  // 2. If trait.modifier was not provided or not a number, extract signed integer from trait.effect
  if (trait.effect) {
    const match = String(trait.effect).match(/([+-]?\s*\d+)/);
    if (match) {
      const parsed = parseInt(match[1].replace(/\s+/g, ''), 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
};

// Returns the modifier specifically for a given target attribute or talent.
// If the effect specifies distinct modifiers per target (e.g. "+2 FOR, -1 AGI" or "+1 em Força, -2 em Agilidade"),
// it returns that specific signed value. Otherwise, it returns getTraitEffectiveModifier(trait).
export const getTraitModifierForTarget = (
  trait: any,
  targetId: string,
  attributesList: Array<{ id: string; label?: string }> = [],
  talentsList: Array<{ id: string; name?: string }> = []
): number => {
  if (!trait || !targetId) return 0;
  const targetNorm = normalizeTraitType(targetId);

  // Check if effect specifies target-specific signed modifier
  if (trait.effect) {
    const effStr = String(trait.effect);

    // Pattern 1: [+-]?\d+\s*(?:em|no|na|de|para)?\s*([A-Za-zÀ-ÿ]+)
    const regex1 = /([+-]?\s*\d+)\s*(?:em|no|na|de|para)?\s*([A-Za-zÀ-ÿ]+)/gi;
    let match;
    while ((match = regex1.exec(effStr)) !== null) {
      const valStr = match[1].replace(/\s+/g, '');
      const word = normalizeTraitType(match[2]);
      if (word === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
      // Check if word matches label or id
      const matchedAttr = attributesList.find(a => normalizeTraitType(a.id) === word || normalizeTraitType(a.label || '') === word);
      if (matchedAttr && normalizeTraitType(matchedAttr.id) === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
      const matchedTalent = talentsList.find(t => normalizeTraitType(t.id) === word || normalizeTraitType(t.name || '') === word);
      if (matchedTalent && normalizeTraitType(matchedTalent.id) === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }

    // Pattern 2: ([A-Za-zÀ-ÿ]+)\s*([+-]\s*\d+)
    const regex2 = /([A-Za-zÀ-ÿ]+)\s*([+-]\s*\d+)/gi;
    while ((match = regex2.exec(effStr)) !== null) {
      const word = normalizeTraitType(match[1]);
      const valStr = match[2].replace(/\s+/g, '');
      if (word === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
      const matchedAttr = attributesList.find(a => normalizeTraitType(a.id) === word || normalizeTraitType(a.label || '') === word);
      if (matchedAttr && normalizeTraitType(matchedAttr.id) === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
      const matchedTalent = talentsList.find(t => normalizeTraitType(t.id) === word || normalizeTraitType(t.name || '') === word);
      if (matchedTalent && normalizeTraitType(matchedTalent.id) === targetNorm) {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  return getTraitEffectiveModifier(trait);
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
    const words = text.replace(/\be\b/g, ' ').split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
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
    const words = text.replace(/\be\b/g, ' ').split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
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
// A trait can affect multiple attributes or talents simultaneously.
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

    if (norm.includes('todos os atributos') || norm.includes('todos atributos')) {
      allAttrs.forEach(a => attrIds.add(a.id.toLowerCase()));
    }

    const words = norm.replace(/\be\b/g, ' ').split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
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

  // If the effect modifies an attribute/talent, add them to targets
  if (trait.effect) {
    const norm = normalizeTraitType(trait.effect);
    if (norm.includes('todos os atributos') || norm.includes('todos atributos')) {
      allAttrs.forEach(a => attrIds.add(a.id.toLowerCase()));
    }

    const words = norm.replace(/\be\b/g, ' ').split(/[\s,.;:+\-()\[\]{}/*\\|]+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW) {
        if (attrMap[cleanW]) {
          attrIds.add(attrMap[cleanW]);
        }
        if (talentMap[cleanW]) {
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

/**
 * Compresses an image File or Blob using HTML5 Canvas to safely stay under Firestore's 1MB limit.
 * Resizes down to maxWidth x maxHeight and compresses to JPEG/WebP.
 */
export async function compressImageFile(
  file: File | Blob,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Failed to read file'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl); // fallback to original dataUrl if decoding fails
      img.onload = () => {
        let { naturalWidth: width, naturalHeight: height } = img;
        if (!width || !height) {
          resolve(dataUrl);
          return;
        }
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp') && webpData.length < 900000) {
            resolve(webpData);
            return;
          }
        } catch (_) {}

        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a Data URL string using HTML5 Canvas if it exceeds safe Firestore thresholds.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.82
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  // If already small enough (under 450KB string), avoid recompressing
  if (dataUrl.length < 450000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (!width || !height) {
        resolve(dataUrl);
        return;
      }
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}
