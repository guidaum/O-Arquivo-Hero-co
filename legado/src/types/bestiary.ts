export interface MonsterAction {
  name: string;
  description: string;
  attackBonus?: number;
  damage?: string;
  damageType?: string;
  reach?: string;
  isRanged?: boolean;
}

export interface MonsterTrait {
  name: string;
  description: string;
}

export type CreatureType = 
  | 'Morto-vivo'
  | 'Monstruosidade'
  | 'Dragão'
  | 'Humanoide'
  | 'Fera'
  | 'Aberração'
  | 'Elemental'
  | 'Demônio'
  | 'Gigante'
  | 'Construto';

export type CreatureSize = 'Pequeno' | 'Médio' | 'Grande' | 'Enorme' | 'Imenso';

export type EnvironmentType = 'dungeon' | 'cavern' | 'forest' | 'temple' | 'volcano' | 'urban';

export interface Monster {
  id: string;
  name: string;
  cr: string; // "1/8", "1/4", "1/2", "1", "2", "3", "5", "8", "10", "15", "20"
  crValue: number; // numeric value for sorting and calculation
  xp: number;
  size: CreatureSize;
  gridSize: number; // 1 = 1x1, 2 = 2x2, 3 = 3x3
  type: CreatureType;
  alignment: string;
  ac: number;
  hp: number;
  maxHp: number;
  hitDice: string;
  speed: string;
  stats: {
    for: number;
    con: number;
    agi: number;
    int: number;
    per: number;
    cor: number;
  };
  initiativeBonus: number;
  savingThrows?: string;
  skills?: string;
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses: string;
  languages: string;
  traits: MonsterTrait[];
  actions: MonsterAction[];
  bonusActions?: MonsterAction[];
  reactions?: MonsterAction[];
  avatar?: string;
  color: string;
  environments: EnvironmentType[];
  description?: string;
  isCustom?: boolean;
  createdBy?: string;
}

export interface GeneratedEncounter {
  id: string;
  name: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil' | 'Mortal';
  environment: EnvironmentType;
  totalXp: number;
  adjustedXp: number;
  targetXpBudget: number;
  monsters: Array<{
    monster: Monster;
    count: number;
  }>;
}

export interface CombatState {
  inCombat: boolean;
  round: number;
  activeTokenId: string | null;
  turnOrder: string[]; // array of token ids in sorted initiative
  lastUpdated: string;
}
