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
    // Basic math evaluation
    // eslint-disable-next-line no-eval
    return Math.floor(eval(result));
  } catch (err) {
    console.error('Error evaluating formula:', formula, err);
    return 0;
  }
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
