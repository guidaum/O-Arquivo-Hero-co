import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Backpack, 
  UserPlus, 
  ScrollText, 
  Search, 
  Bell, 
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Shield,
  Sword,
  Map,
  Skull,
  Compass
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, signOut, db, doc, getDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from '../firebase';
import NotificationBell from './NotificationBell';
import DiceRoller from './DiceRoller';
import ProfileModal from './ProfileModal';
import { useTheme } from './ThemeProvider';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { theme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  const user = auth.currentUser;
  const [userRole, setUserRole] = React.useState<'user' | 'gm' | 'admin'>('user');
  const [playedCount, setPlayedCount] = React.useState(0);
  const [masteredCount, setMasteredCount] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<'user' | 'gm'>(() => {
    return (localStorage.getItem('preferredViewMode') as 'user' | 'gm') || 'user';
  });

  // Sync viewMode changes across components
  React.useEffect(() => {
    const handleViewModeChange = (e: any) => {
      const newMode = e.detail || localStorage.getItem('preferredViewMode');
      if (newMode && (newMode === 'user' || newMode === 'gm')) {
        setViewMode(newMode);
      }
    };
    window.addEventListener('viewModeChanged', handleViewModeChange);
    window.addEventListener('storage', handleViewModeChange);
    return () => {
      window.removeEventListener('viewModeChanged', handleViewModeChange);
      window.removeEventListener('storage', handleViewModeChange);
    };
  }, []);

  const handleToggleViewMode = async (mode: 'user' | 'gm') => {
    setViewMode(mode);
    localStorage.setItem('preferredViewMode', mode);
    window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: mode }));
    if (user && userRole !== 'admin') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: mode,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Error syncing role in Firestore:', err);
      }
    }
  };

  // Presence Heartbeat
  React.useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Initial update
    updatePresence();

    // Update every 2 minutes
    const interval = setInterval(updatePresence, 120000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle sidebar state on resize
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (!user) return;

    // Fetch user role in real time
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
      if (userDoc.exists()) {
        setUserRole(userDoc.data().role || 'user');
      }
    }, (error) => {
      console.error('Error fetching user role in Layout:', error);
    });

    // Fetch mastered campaigns count
    const qMastered = query(collection(db, 'gameSessions'), where('gmId', '==', user.uid));
    const unsubscribeMastered = onSnapshot(qMastered, (snapshot) => {
      setMasteredCount(snapshot.size);
    }, (error) => {
      import('../firebase').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'gameSessions');
      });
    });

    // Fetch played campaigns count
    const qPlayed = query(collection(db, 'gameSessions'), where('playerIds', 'array-contains', user.uid));
    const unsubscribePlayed = onSnapshot(qPlayed, (snapshot) => {
      setPlayedCount(snapshot.size);
    }, (error) => {
      import('../firebase').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'gameSessions');
      });
    });

    return () => {
      unsubscribeUser();
      unsubscribeMastered();
      unsubscribePlayed();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Se o usuário tem permissão para mestrar:
  const canBeGM = userRole === 'gm' || userRole === 'admin' || masteredCount > 0;

  // Quando o modo jogador está habilitado, mesmo sendo mestre/admin, ele vê APENAS os menus de jogador!
  const isGM = canBeGM && viewMode === 'gm';

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Minhas Lendas' },
    { to: '/journal', icon: BookOpen, label: 'Diário de Sessão' },
  ];

  // O menu de mapas na barra lateral global SÓ aparece para o Mestre no Modo Mestre (Gerenciador de Mapas)
  // Para o jogador (e quando o mestre habilita o modo jogador), ele vê APENAS os menus de jogador!
  if (isGM) {
    navItems.push(
      { to: '/map-manager', icon: Map, label: 'Gerenciador de Mapas' },
      { to: '/dungeon', icon: Skull, label: 'Dungeons & Tokens' },
      { to: '/map', icon: Compass, label: 'Mapa do Mundo' }
    );
  }

  navItems.push(
    { to: '/inventory', icon: Backpack, label: 'Inventário' },
    { to: '/create', icon: UserPlus, label: 'Criação de Personagem' },
    { to: '/sheet', icon: ScrollText, label: 'Ficha Geral' }
  );

  if (userRole === 'admin' && viewMode === 'gm') {
    navItems.push({ to: '/admin', icon: Shield, label: 'Painel Admin' });
  }

  const userLevel = userRole === 'gm' ? masteredCount : playedCount;

  return (
    <div className="min-h-screen flex flex-col bg-obsidian text-parchment">
      {/* Top App Bar */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3 lg:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-arcane/20 flex items-center justify-center border border-arcane/30">
              <ScrollText size={18} className="text-arcane" />
            </div>
            <h1 className="text-lg lg:text-xl font-serif tracking-tight text-glow-arcane truncate max-w-[120px] sm:max-w-none">
              O Arquivo Heroico
            </h1>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8 hidden lg:block">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input 
              type="text" 
              placeholder="Buscar lendas, itens ou missões..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-arcane/50 transition-colors text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Alternador Modo Mestre / Modo Jogador */}
          {canBeGM && (
            <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => handleToggleViewMode('gm')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'gm'
                    ? "bg-arcane text-obsidian shadow-md shadow-arcane/20"
                    : "text-parchment/40 hover:text-parchment"
                )}
                title="Ativar Modo Mestre (acesso ao Gerenciador de Mapas e ferramentas do Mestre)"
              >
                <Shield size={13} />
                <span className="hidden sm:inline">Mestre</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('user')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'user'
                    ? "bg-ember text-obsidian shadow-md shadow-ember/20"
                    : "text-parchment/40 hover:text-parchment"
                )}
                title="Ativar Modo Jogador (exibe apenas menus de jogador)"
              >
                <Sword size={13} />
                <span className="hidden sm:inline">Jogador</span>
              </button>
            </div>
          )}

          <ThemeToggle className="p-2 sm:p-2.5" />

          <div className="hidden sm:block">
            <NotificationBell />
          </div>
          
          <div className="relative hidden sm:block" ref={settingsRef}>
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={cn(
                "p-2 rounded-full transition-all",
                isSettingsOpen ? "bg-arcane/20 text-arcane" : "hover:bg-white/5 text-parchment/60"
              )}
            >
              <Settings size={20} />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-2 w-64 glass-popup bg-obsidian/85 backdrop-blur-xl border border-white/25 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                >
                  <div className="p-4 border-b border-white/5 bg-white/5">
                    <p className="text-xs font-mono uppercase tracking-widest text-parchment/40">Preferências do Sistema</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(true);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm transition-colors text-left group"
                    >
                      <User size={18} className="text-arcane transition-transform group-hover:scale-110" />
                      <div>
                        <p className="font-medium">Meu Perfil</p>
                        <p className="text-[10px] text-parchment/40">Dados, avatar e biografia</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(true); // Same modal for now, focus on verification
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm transition-colors text-left group"
                    >
                      <Shield size={18} className="text-ember transition-transform group-hover:scale-110" />
                      <div>
                        <p className="font-medium">Verificação de Cadastro</p>
                        <p className="text-[10px] text-parchment/40">Status da sua conta</p>
                      </div>
                    </button>

                    <button 
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm transition-colors text-left group opacity-50 cursor-not-allowed"
                    >
                      <Bell size={18} className="text-parchment/60" />
                      <div>
                        <p className="font-medium">Notificações</p>
                        <p className="text-[10px] text-parchment/40">Em breve...</p>
                      </div>
                    </button>
                  </div>
                  <div className="p-2 bg-white/5 border-t border-white/5">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-ember/10 text-ember text-sm transition-colors text-left group"
                    >
                      <LogOut size={18} className="transition-transform group-hover:scale-110" />
                      <span className="font-medium">Sair da Sessão</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 pl-2 lg:pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-sm font-medium">{user?.displayName || 'Arquivista'}</p>
                <span className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold",
                  userRole === 'admin' ? "bg-gold/20 text-gold border-gold/40" :
                  userRole === 'gm' ? "bg-arcane/20 text-arcane border-arcane/40" :
                  "bg-ember/20 text-ember border-ember/40"
                )}>
                  {userRole === 'admin' ? 'Admin' : userRole === 'gm' ? 'Mestre' : 'Jogador'}
                </span>
              </div>
              <p className="text-xs text-parchment/40 font-mono">Nível {userLevel}</p>
            </div>
            <div className="group relative">
              <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-arcane/40 to-ember/40 border border-white/20 overflow-hidden">
                <img 
                  src={user?.photoURL || "https://picsum.photos/seed/archivist/100/100"} 
                  alt="User Avatar" 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Logout Tooltip/Menu */}
              <button 
                onClick={handleLogout}
                className="absolute top-full right-0 mt-2 glass p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs text-ember hover:bg-ember/10 border border-ember/20 whitespace-nowrap z-50"
              >
                <LogOut size={14} />
                <span>Sair da Sessão</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Mobile Sidebar Backdrop */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-obsidian/60 backdrop-blur-sm z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Side Nav Bar */}
        <aside className={cn(
          "glass border-r-0 fixed lg:sticky top-16 h-[calc(100vh-64px)] z-40 transition-all duration-300",
          isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:w-20"
        )}>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!isSidebarOpen ? item.label : undefined}
                onClick={() => window.innerWidth < 1024 && isSidebarOpen && setIsSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 rounded-xl transition-all group relative overflow-hidden",
                  isActive 
                    ? "bg-arcane/10 text-arcane border border-arcane/20" 
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                )}
              >
                <item.icon size={20} className={cn(
                  "shrink-0 transition-transform group-hover:scale-110",
                  "group-[.active]:text-arcane"
                )} />
                <span className={cn(
                  "font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                  isSidebarOpen ? "opacity-100 w-auto ml-3" : "opacity-0 w-0 ml-0 lg:hidden"
                )}>
                  {item.label}
                </span>
                {/* Active Indicator */}
                <div className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-arcane rounded-r-full transition-transform",
                  "group-[.active]:scale-y-100 scale-y-0"
                )} />
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1 min-w-0 p-4 lg:p-10 overflow-auto pb-24 lg:pb-10 transition-all duration-300",
          "ml-0 lg:ml-0"
        )}>
          <Outlet />
        </main>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-6 left-4 right-4 h-16 glass rounded-2xl border border-white/10 flex items-center justify-around px-2 z-40 shadow-2xl">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                isActive ? "text-arcane" : "text-parchment/40"
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-mono uppercase tracking-tighter">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <NavLink
            to="/sheet"
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
              isActive ? "text-arcane" : "text-parchment/40"
            )}
          >
            <ScrollText size={20} />
            <span className="text-[10px] font-mono uppercase tracking-tighter">Ficha</span>
          </NavLink>
        </nav>
      </div>
      <DiceRoller />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </div>
  );
}
