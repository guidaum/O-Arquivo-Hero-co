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
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, signOut } from '../firebase';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const user = auth.currentUser;

  // Handle sidebar state on resize
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Minhas Lendas' },
    { to: '/journal', icon: BookOpen, label: 'Diário de Sessão' },
    { to: '/inventory', icon: Backpack, label: 'Inventário' },
    { to: '/create', icon: UserPlus, label: 'Criação de Personagem' },
    { to: '/sheet', icon: ScrollText, label: 'Ficha Geral' },
  ];

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
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors relative hidden sm:block">
            <Bell size={20} className="text-parchment/60" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-ember rounded-full border-2 border-obsidian"></span>
          </button>
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors hidden sm:block">
            <Settings size={20} className="text-parchment/60" />
          </button>
          <div className="flex items-center gap-3 pl-2 lg:pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.displayName || 'Arquivista'}</p>
              <p className="text-xs text-parchment/40 font-mono">Nível 12</p>
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
          isSidebarOpen 
            ? "w-64 translate-x-0" 
            : "-translate-x-full lg:translate-x-0 lg:w-20"
        )}>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative overflow-hidden",
                  isActive 
                    ? "bg-arcane/10 text-arcane border border-arcane/20" 
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-transform group-hover:scale-110",
                  "group-[.active]:text-arcane"
                )} />
                <span className={cn(
                  "font-medium transition-opacity",
                  !isSidebarOpen && "lg:opacity-0"
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
        <main className="flex-1 min-w-0 p-4 lg:p-10 overflow-auto pb-24 lg:pb-10">
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
    </div>
  );
}
