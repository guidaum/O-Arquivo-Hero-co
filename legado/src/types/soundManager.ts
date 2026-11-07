/**
 * soundManager.ts
 * Types and catalog metadata for GM sound effects, custom audio files (MP3/WAV),
 * library separation by campaign/user, and customizable atmospheric soundscapes.
 */

export type SoundCategory = 'dice' | 'combat' | 'magic' | 'dungeon' | 'system' | 'ambient';
export type SoundAudioType = 'sfx' | 'ambient';
export type SoundSourceType = 'preset' | 'url' | 'upload';

export interface CustomSoundItem {
  id: string;
  name: string;
  category: SoundCategory;
  type: SoundAudioType;
  sourceType: SoundSourceType;
  url: string; // Direct link or Base64 data URL (MP3/WAV)
  size?: number; // File size in bytes
  format?: string; // 'MP3', 'WAV', etc.
  duration?: number;
  sessionId?: string; // Empty or undefined for global/cross-campaign
  sessionName?: string;
  userId: string; // GM user ID who created or uploaded
  userName?: string;
  systemSoundKey?: string; // E.g., 'diceRollSound', 'attackSound', etc.
  createdAt: string;
}

export interface SystemSoundDefinition {
  key: string;
  category: SoundCategory;
  name: string;
  description: string;
  badge: string;
  badgeColor: string;
  accentColor: string;
  defaultUrl: string;
  synthKey: string;
}

export const SYSTEM_SOUND_DEFINITIONS: SystemSoundDefinition[] = [
  // --- 1. Dados & Desfechos ---
  {
    key: 'diceRollSound',
    category: 'dice',
    name: 'Rolagem de Dados',
    description: 'Chocalhar de dados rolando sobre a mesa.',
    badge: 'Dados',
    badgeColor: 'text-arcane border-arcane/30 bg-arcane/10',
    accentColor: 'text-arcane',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3',
    synthKey: 'synth:roll'
  },
  {
    key: 'successSound',
    category: 'dice',
    name: 'Sucesso Normal',
    description: 'Acorde harmônico celestial indicando teste superado.',
    badge: 'Sucesso',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    accentColor: 'text-emerald-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3',
    synthKey: 'synth:success'
  },
  {
    key: 'failureSound',
    category: 'dice',
    name: 'Falha Normal',
    description: 'Badalada melancólica indicando falha no teste.',
    badge: 'Falha',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    accentColor: 'text-amber-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    synthKey: 'synth:failure'
  },
  {
    key: 'criticalSound',
    category: 'dice',
    name: 'Acerto Crítico (20 Nat)',
    description: 'Fanfarra gloriosa com clarão dourado de acerto supremo.',
    badge: 'Crítico Épico',
    badgeColor: 'text-gold border-gold/40 bg-gold/15',
    accentColor: 'text-gold',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
    synthKey: 'synth:critical'
  },
  {
    key: 'fumbleSound',
    category: 'dice',
    name: 'Desastre / Falha Crítica (1 Nat)',
    description: 'Gongo tenebroso anunciando erro catastrófico.',
    badge: 'Desastre',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    accentColor: 'text-rose-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3',
    synthKey: 'synth:fumble'
  },

  // --- 2. Combate & Ações Físicas ---
  {
    key: 'attackSound',
    category: 'combat',
    name: 'Golpe de Lâmina / Ataque',
    description: 'Corte ágil de espada e impacto metálico no oponente.',
    badge: 'Ataque',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    accentColor: 'text-rose-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2168/2168-preview.mp3',
    synthKey: 'synth:attack'
  },
  {
    key: 'shieldSound',
    category: 'combat',
    name: 'Bloqueio / Escudo',
    description: 'Lâmina ricocheteando pesadamente em metal ou escudo de ferro.',
    badge: 'Defesa',
    badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    accentColor: 'text-blue-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2171/2171-preview.mp3',
    synthKey: 'synth:shield'
  },
  {
    key: 'arrowSound',
    category: 'combat',
    name: 'Disparo de Arco & Flecha',
    description: 'Zunido veloz da flecha cortando o ar e cravando no alvo.',
    badge: 'Projétil',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    accentColor: 'text-emerald-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2174/2174-preview.mp3',
    synthKey: 'synth:arrow'
  },
  {
    key: 'damageSound',
    category: 'combat',
    name: 'Impacto Pesado de Dano',
    description: 'Impacto contundente de osso quebrando ou ferimento grave.',
    badge: 'Impacto',
    badgeColor: 'text-red-500 border-red-500/40 bg-red-500/15',
    accentColor: 'text-red-500',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2165/2165-preview.mp3',
    synthKey: 'synth:damage'
  },

  // --- 3. Magias & Poderes Arcanos ---
  {
    key: 'spellSound',
    category: 'magic',
    name: 'Conjuração de Magia',
    description: 'Onda rúnica mística de mana e energia elemental explodindo.',
    badge: 'Arcano',
    badgeColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    accentColor: 'text-purple-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
    synthKey: 'synth:spell'
  },
  {
    key: 'healSound',
    category: 'magic',
    name: 'Cura Divina / Poção de Vida',
    description: 'Brilho restaurador cintilante regenerando os pontos de vida.',
    badge: 'Restauração',
    badgeColor: 'text-teal-300 border-teal-500/30 bg-teal-500/10',
    accentColor: 'text-teal-300',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    synthKey: 'synth:heal'
  },

  // --- 4. Exploração & Masmorra ---
  {
    key: 'footstepsSound',
    category: 'dungeon',
    name: 'Passos na Masmorra',
    description: 'Passos firmes de botas ecoando pelas pedras úmidas.',
    badge: 'Exploração',
    badgeColor: 'text-stone-300 border-stone-500/30 bg-stone-500/10',
    accentColor: 'text-stone-300',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2144/2144-preview.mp3',
    synthKey: 'synth:footsteps'
  },
  {
    key: 'trapSound',
    category: 'dungeon',
    name: 'Armadilha Disparada',
    description: 'Estalo de mecanismo arcaico acionando armadilha mortal.',
    badge: 'Perigo',
    badgeColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    accentColor: 'text-orange-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
    synthKey: 'synth:trap'
  },
  {
    key: 'chestSound',
    category: 'dungeon',
    name: 'Abertura de Baú & Tesouro',
    description: 'Madeira rangendo e tilintar de moedas de ouro ancestrais.',
    badge: 'Tesouro',
    badgeColor: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    accentColor: 'text-yellow-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
    synthKey: 'synth:chest'
  },
  {
    key: 'doorSound',
    category: 'dungeon',
    name: 'Porta Pesada Rangendo',
    description: 'Porta maciça de ferro ou pedra abrindo lentamente nas profundezas.',
    badge: 'Passagem',
    badgeColor: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    accentColor: 'text-amber-300',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
    synthKey: 'synth:door'
  },

  // --- 5. Sinais & Sistema ---
  {
    key: 'pingSound',
    category: 'system',
    name: 'Sinalizador / Ping no Mapa',
    description: 'Pulso sonoro de sonar tático para chamar a atenção no mapa.',
    badge: 'Alerta',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    accentColor: 'text-cyan-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
    synthKey: 'synth:ping'
  },
  {
    key: 'monsterRoarSound',
    category: 'system',
    name: 'Rugido de Monstro / Criatura',
    description: 'Bramido aterrorizante ecoando de uma fera das trevas.',
    badge: 'Ameaça',
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-500/15',
    accentColor: 'text-purple-400',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2551/2551-preview.mp3',
    synthKey: 'synth:roar'
  },
  {
    key: 'levelUpSound',
    category: 'system',
    name: 'Subida de Nível (Level Up)',
    description: 'Fanfarra triunfante de poder e conquista para o herói.',
    badge: 'Evolução',
    badgeColor: 'text-gold border-gold/40 bg-gold/15',
    accentColor: 'text-gold',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/1432/1432-preview.mp3',
    synthKey: 'synth:levelup'
  },
  {
    key: 'combatStartSound',
    category: 'system',
    name: 'Início de Combate / Tensão',
    description: 'Tambores de guerra e brado convocando as armas.',
    badge: 'Batalha',
    badgeColor: 'text-rose-500 border-rose-500/40 bg-rose-500/15',
    accentColor: 'text-rose-500',
    defaultUrl: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
    synthKey: 'synth:combat_start'
  }
];

export const CATEGORY_LABELS: Record<SoundCategory, { label: string; description: string }> = {
  dice: { label: 'Dados & Desfechos', description: 'Rolagens, acertos, falhas e críticos' },
  combat: { label: 'Combate & Ações', description: 'Lâminas, escudos, flechas e impactos' },
  magic: { label: 'Magias & Feitiços', description: 'Conjurações arcanas e curas divinas' },
  dungeon: { label: 'Masmorra & Exploração', description: 'Passos, baús, portas e armadilhas' },
  system: { label: 'Sinais & Sistema', description: 'Pings de mapa, rugidos e level up' },
  ambient: { label: 'Ambiências & Trilhas', description: 'Clima sonoro contínuo e loops de fundo' }
};
