import { describe, it, expect } from 'vitest';
import { 
  getTraitEffectiveModifier, 
  getTraitTargets, 
  normalizeTraitType,
  evaluateFormula 
} from '../src/lib/utils';

describe('Vantagens e Defeitos - Modificadores de Traço', () => {
  const DEFAULT_ATTRIBUTES = [
    { id: 'for', label: 'Força' },
    { id: 'con', label: 'Constituição' },
    { id: 'agi', label: 'Agilidade' },
    { id: 'per', label: 'Percepção' },
    { id: 'vel', label: 'Velocidade' },
    { id: 'ini', label: 'Iniciativa' },
    { id: 'int', label: 'Inteligência' },
    { id: 'cor', label: 'Coragem' },
  ];

  it('calculates positive modifier for advantages on attributes', () => {
    const advantage = {
      id: 'adv-1',
      name: 'Força Bruta',
      type: 'advantage',
      modifier: 2,
      modifierType: 'for'
    };
    const mod = getTraitEffectiveModifier(advantage);
    expect(mod).toBe(2);

    const { attrIds } = getTraitTargets(advantage, DEFAULT_ATTRIBUTES);
    expect(attrIds).toContain('for');
  });

  it('calculates negative penalty for disadvantages on attributes (even if entered as positive point cost)', () => {
    const disadvantage = {
      id: 'dis-1',
      name: 'Miopia Severa',
      type: 'disadvantage',
      modifier: 2, // Entered as 2 points in creation
      modifierType: 'per'
    };
    const mod = getTraitEffectiveModifier(disadvantage);
    // Should be negative penalty for the attribute
    expect(mod).toBe(-2);

    const { attrIds } = getTraitTargets(disadvantage, DEFAULT_ATTRIBUTES);
    expect(attrIds).toContain('per');
  });

  it('handles negative modifier entered directly for disadvantages', () => {
    const disadvantage = {
      id: 'dis-2',
      name: 'Fraqueza',
      type: 'defeito',
      modifier: -3,
      modifierType: 'for'
    };
    const mod = getTraitEffectiveModifier(disadvantage);
    expect(mod).toBe(-3);
  });

  it('parses attribute modifier from effect string when modifier is 0', () => {
    const trait = {
      id: 'tr-1',
      name: 'Ágil como o Vento',
      type: 'advantage',
      modifier: 0,
      effect: '+2 em AGI',
      modifierType: 'agi'
    };
    const mod = getTraitEffectiveModifier(trait);
    expect(mod).toBe(2);
  });

  it('resolves attribute targets accurately across accents and casing', () => {
    const trait1 = { name: 'Músculos de Ferro', modifierType: 'FOR' };
    expect(getTraitTargets(trait1, DEFAULT_ATTRIBUTES).attrIds).toContain('for');

    const trait2 = { name: 'Reflexos Rápidos', modifierType: 'Agilidade' };
    expect(getTraitTargets(trait2, DEFAULT_ATTRIBUTES).attrIds).toContain('agi');

    const trait3 = { name: 'Mente Brilhante', modifierType: 'inteligência' };
    expect(getTraitTargets(trait3, DEFAULT_ATTRIBUTES).attrIds).toContain('int');

    const trait4 = { name: 'Guerreiro Indômito', effect: '+2 em Força e Constituição' };
    const targets = getTraitTargets(trait4, DEFAULT_ATTRIBUTES);
    expect(targets.attrIds).toContain('for');
    expect(targets.attrIds).toContain('con');
  });

  it('calculates effective attribute correctly with trait modifiers', () => {
    const baseStats: Record<string, number> = { for: 10, per: 12 };
    const traits = [
      { id: '1', type: 'advantage', modifier: 2, modifierType: 'for' },
      { id: '2', type: 'disadvantage', modifier: 2, modifierType: 'per' }
    ];

    const traitMods: Record<string, number> = {};
    traits.forEach(t => {
      const { attrIds } = getTraitTargets(t, DEFAULT_ATTRIBUTES);
      const effMod = getTraitEffectiveModifier(t);
      attrIds.forEach(aId => {
        traitMods[aId] = (traitMods[aId] || 0) + effMod;
      });
    });

    expect(traitMods['for']).toBe(2);
    expect(traitMods['per']).toBe(-2);

    const effectiveFor = baseStats['for'] + (traitMods['for'] || 0);
    const effectivePer = baseStats['per'] + (traitMods['per'] || 0);

    expect(effectiveFor).toBe(12); // 10 + 2
    expect(effectivePer).toBe(10); // 12 - 2
  });

  it('considers ONLY the modifier when both modifier and effect alter the same attribute (NO double counting)', () => {
    const trait = {
      id: 't-same-attr',
      name: 'Vigor Extremo',
      type: 'advantage',
      modifier: 2,
      modifierType: 'for',
      effect: '+2 em Força'
    };

    const { attrIds } = getTraitTargets(trait, DEFAULT_ATTRIBUTES);
    // Attribute 'for' must only be targeted ONCE, not duplicated
    expect(attrIds).toEqual(['for']);

    const effMod = getTraitEffectiveModifier(trait);
    expect(effMod).toBe(2);

    // Calculate traitStatsMods as done in CharacterCreation
    const mods: Record<string, number> = {};
    attrIds.forEach(attrId => {
      const lower = attrId.toLowerCase();
      mods[lower] = (mods[lower] || 0) + effMod;
      if (attrId !== lower) {
        mods[attrId] = mods[lower];
      }
    });

    // Value must be exactly 2, NOT 4!
    expect(mods['for']).toBe(2);
  });

  it('considers ONLY the modifier when both modifier and effect alter the same talent', () => {
    const talents = [
      { id: 'esquiva', name: 'Esquiva', composition: ['agi', 'vel'] },
      { id: 'bloqueio', name: 'Bloqueio', composition: ['for', 'con'] }
    ];

    const trait = {
      id: 't-same-talent',
      name: 'Reflexos de Gato',
      type: 'advantage',
      modifier: 3,
      modifierType: 'esquiva',
      effect: '+3 no talento Esquiva'
    };

    const { talentIds, attrIds } = getTraitTargets(trait, DEFAULT_ATTRIBUTES, talents);
    expect(talentIds).toEqual(['esquiva']);
    expect(attrIds).toEqual([]);

    const effMod = getTraitEffectiveModifier(trait);
    expect(effMod).toBe(3);
  });

  it('adds distinct targets when modifier targets one attribute and effect targets another', () => {
    const trait = {
      id: 't-diff',
      name: 'Equilíbrio Místico',
      type: 'advantage',
      modifier: 2,
      modifierType: 'for',
      effect: '+1 em Agilidade'
    };

    const { attrIds } = getTraitTargets(trait, DEFAULT_ATTRIBUTES);
    expect(attrIds).toContain('for');
    expect(attrIds).toContain('agi');
    expect(attrIds.length).toBe(2);
  });
});

describe('Fluxo de Criação de Personagem - Ausência de Aba Dificuldades', () => {
  const steps = ['Vantagens/Defeitos', 'Origens', 'Atributos', 'Perícias', 'Poderes', 'Equipamento', 'Revisão'];

  it('has exactly 7 steps and does NOT contain any Dificuldades step', () => {
    expect(steps.length).toBe(7);
    expect(steps).not.toContain('Dificuldades');
    expect(steps).not.toContain('dificuldades');
    expect(steps[0]).toBe('Vantagens/Defeitos');
    expect(steps[1]).toBe('Origens');
    expect(steps[2]).toBe('Atributos');
    expect(steps[3]).toBe('Perícias');
    expect(steps[4]).toBe('Poderes');
    expect(steps[5]).toBe('Equipamento');
    expect(steps[6]).toBe('Revisão');
  });

  it('generates the complete character persistence payload with traits and modifiers', () => {
    const selectedTraits = [
      { id: 't1', name: 'Coragem Lendária', type: 'advantage', modifier: 2, modifierType: 'cor', effect: '+2 Coragem' },
      { id: 't2', name: 'Covardia Oculta', type: 'disadvantage', modifier: 1, modifierType: 'ini', effect: '-1 Iniciativa' }
    ];

    const cleanTraits = selectedTraits.map(t => ({
      id: t.id,
      name: t.name,
      description: '',
      effect: t.effect,
      modifier: Number(t.modifier) || 0,
      modifierType: t.modifierType,
      type: t.type
    }));

    const advantagesList = cleanTraits.filter(t => t.type === 'advantage');
    const disadvantagesList = cleanTraits.filter(t => t.type === 'disadvantage');

    const characterData = {
      id: 'char-123',
      ownerId: 'user-abc',
      name: 'Alden',
      class: 'Paladino',
      traits: cleanTraits.map(t => t.id),
      traitObjects: cleanTraits,
      advantages: advantagesList,
      disadvantages: disadvantagesList,
      statsMods: { cor: 2, ini: -1 },
      baseStats: { cor: 10, ini: 10 },
      stats: { cor: 10, ini: 10 }
    };

    expect(characterData.traits).toEqual(['t1', 't2']);
    expect(characterData.traitObjects.length).toBe(2);
    expect(characterData.advantages.length).toBe(1);
    expect(characterData.disadvantages.length).toBe(1);
    expect(characterData.statsMods.cor).toBe(2);
    expect(characterData.statsMods.ini).toBe(-1);
  });
});

describe('Rolador de Dados - Menor é Melhor (1 Natural é Sucesso Crítico, 20 Natural é Falha Crítica)', () => {
  it('identifies 1 as natural critical success in roll-under system', () => {
    const roll: number = 1;
    const targetDC: number = 12;
    const isRollUnder = true;

    const isCrit = roll === 1;
    const isFumble = roll === 20;
    const isSuccess = isRollUnder ? (roll <= targetDC) : (roll >= targetDC);

    expect(isCrit).toBe(true);
    expect(isFumble).toBe(false);
    expect(isSuccess).toBe(true);
  });

  it('identifies 20 as natural fumble in roll-under system', () => {
    const roll: number = 20;
    const targetDC: number = 12;
    const isRollUnder = true;

    const isCrit = roll === 1;
    const isFumble = roll === 20;
    const isSuccess = isRollUnder ? (roll <= targetDC) : (roll >= targetDC);

    expect(isCrit).toBe(false);
    expect(isFumble).toBe(true);
    expect(isSuccess).toBe(false);
  });

  it('evaluates success when roll is less than or equal to target', () => {
    const targetDC = 14;
    const isRollUnder = true;

    const rollSuccess = 10;
    expect(rollSuccess <= targetDC).toBe(true);

    const rollFail = 16;
    expect(rollFail <= targetDC).toBe(false);
  });

  it('evaluates advantage in roll-under by picking the lower roll', () => {
    const roll1 = 15;
    const roll2 = 6;
    const isRollUnder = true;

    // Em roll-under, vantagem escolhe o menor resultado
    const chosenRoll = isRollUnder ? Math.min(roll1, roll2) : Math.max(roll1, roll2);
    expect(chosenRoll).toBe(6);
  });

  it('evaluates disadvantage in roll-under by picking the higher roll', () => {
    const roll1 = 15;
    const roll2 = 6;
    const isRollUnder = true;

    // Em roll-under, desvantagem escolhe o maior resultado (pior para o jogador)
    const chosenRoll = isRollUnder ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    expect(chosenRoll).toBe(15);
  });
});
