/**
 * Types and interfaces for the Menu Feature Manager by User Profile
 */

export type UserRole = 'admin' | 'gm' | 'user';

export type FeatureKey =
  | 'legends'
  | 'journal'
  | 'mapManager'
  | 'dungeon'
  | 'worldMap'
  | 'inventory'
  | 'characterCreation'
  | 'characterSheet'
  | 'adminPanel';

export interface MenuItemDefinition {
  key: FeatureKey;
  label: string;
  path: string;
  description: string;
  category: 'core' | 'gm' | 'session' | 'creative';
  adminOnly?: boolean;
}

export const MENU_FEATURE_DEFINITIONS: MenuItemDefinition[] = [
  {
    key: 'legends',
    label: 'Minhas Lendas',
    path: '/',
    description: 'Dashboard principal de personagens e campanhas.',
    category: 'core'
  },
  {
    key: 'journal',
    label: 'Diário de Sessão',
    path: '/journal',
    description: 'Anotações, histórico e logs das sessões de jogo.',
    category: 'session'
  },
  {
    key: 'mapManager',
    label: 'Gerenciador de Mapas',
    path: '/map-manager',
    description: 'Upload e gerenciamento de mapas táticos da campanha.',
    category: 'gm'
  },
  {
    key: 'dungeon',
    label: 'Dungeons & Tokens',
    path: '/dungeon',
    description: 'Grid tático com névoa de guerra e posicionamento de tokens.',
    category: 'session'
  },
  {
    key: 'worldMap',
    label: 'Mapa do Mundo',
    path: '/map',
    description: 'Visualização cartográfica do universo da campanha.',
    category: 'session'
  },
  {
    key: 'inventory',
    label: 'Inventário & Itens',
    path: '/inventory',
    description: 'Gestão de equipamentos, itens mágicos e tesouros.',
    category: 'core'
  },
  {
    key: 'characterCreation',
    label: 'Criação de Personagem',
    path: '/create',
    description: 'Passo a passo guiado para forjar novos heróis.',
    category: 'core'
  },
  {
    key: 'characterSheet',
    label: 'Ficha Geral',
    path: '/sheet',
    description: 'Visualização e rolagem de atributos, talentos e perícias.',
    category: 'core'
  },
  {
    key: 'adminPanel',
    label: 'Painel Admin',
    path: '/admin',
    description: 'Gerenciamento global de usuários, campanhas e recursos do sistema.',
    category: 'core',
    adminOnly: true
  }
];

export type RoleFeaturePermissions = Record<UserRole, Record<FeatureKey, boolean>>;

export const DEFAULT_ROLE_PERMISSIONS: RoleFeaturePermissions = {
  admin: {
    legends: true,
    journal: true,
    mapManager: true,
    dungeon: true,
    worldMap: true,
    inventory: true,
    characterCreation: true,
    characterSheet: true,
    adminPanel: true,
  },
  gm: {
    legends: true,
    journal: true,
    mapManager: true,
    dungeon: true,
    worldMap: true,
    inventory: true,
    characterCreation: true,
    characterSheet: true,
    adminPanel: false,
  },
  user: {
    legends: true,
    journal: true,
    mapManager: false, // Por padrão jogador não gerencia mapas
    dungeon: true,
    worldMap: true,
    inventory: true,
    characterCreation: true,
    characterSheet: true,
    adminPanel: false,
  }
};
