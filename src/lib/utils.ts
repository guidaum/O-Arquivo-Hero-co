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

    // 2. Find and roll dice (e.g., 1D6, D20)
    const diceRegex = /(\d*)D(\d+)/g;
    const allRolls: { die: string, values: number[] }[] = [];
    
    let processedFormula = detail.replace(diceRegex, (match, qty, die) => {
      const q = parseInt(qty || '1');
      const d = parseInt(die);
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
