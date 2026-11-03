import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dices, 
  MessageSquare, 
  Feather, 
  X, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import DiceRoller, { D20Icon } from './DiceRoller';
import SessionChat from './SessionChat';
import QuickNotes from './QuickNotes';
import { auth, db, doc, onSnapshot } from '../firebase';
import { cn } from '../lib/utils';

export interface ActionMenuContextData {
  sessionId?: string;
  senderOverride?: {
    name: string;
    photo: string;
  };
  isGM?: boolean;
  notesTargetType?: 'character' | 'campaign' | 'general';
  notesTargetId?: string;
  notesTargetName?: string;
  characterContext?: {
    id: string;
    name: string;
  };
}

export interface ActionMenuProps extends ActionMenuContextData {
  className?: string;
}

export default function ActionMenu(props: ActionMenuProps = {}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = auth.currentUser;

  // Strict route check: only render on Character Sheet (/sheet) or Dungeon Map (/dungeon)
  const isAllowedRoute = 
    location.pathname.startsWith('/sheet') || 
    location.pathname.startsWith('/dungeon');

  // Dynamic context from props, URL or custom event
  const [contextData, setContextData] = React.useState<ActionMenuContextData>({
    sessionId: props.sessionId || searchParams.get('session') || localStorage.getItem('last_active_session_id') || undefined,
    senderOverride: props.senderOverride,
    isGM: props.isGM,
    notesTargetType: props.notesTargetType,
    notesTargetId: props.notesTargetId,
    notesTargetName: props.notesTargetName,
    characterContext: props.characterContext
  });

  // Listen to context update events from active screens
  React.useEffect(() => {
    const handleContextUpdate = (e: any) => {
      if (e.detail) {
        setContextData(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };

    window.addEventListener('action_menu_context_update', handleContextUpdate);
    return () => window.removeEventListener('action_menu_context_update', handleContextUpdate);
  }, []);

  // Update when props change
  React.useEffect(() => {
    if (props.sessionId || props.notesTargetId || props.characterContext) {
      setContextData(prev => ({
        ...prev,
        sessionId: props.sessionId || prev.sessionId,
        senderOverride: props.senderOverride || prev.senderOverride,
        isGM: props.isGM !== undefined ? props.isGM : prev.isGM,
        notesTargetType: props.notesTargetType || prev.notesTargetType,
        notesTargetId: props.notesTargetId || prev.notesTargetId,
        notesTargetName: props.notesTargetName || prev.notesTargetName,
        characterContext: props.characterContext || prev.characterContext
      }));
    }
  }, [props.sessionId, props.senderOverride, props.isGM, props.notesTargetType, props.notesTargetId, props.notesTargetName, props.characterContext]);

  // Menu Expansion & Tool Panels State
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isDiceOpen, setIsDiceOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isNotesOpen, setIsNotesOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close radial menu on click outside or Escape
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else if (isDiceOpen) {
          setIsDiceOpen(false);
        } else if (isChatOpen) {
          setIsChatOpen(false);
        } else if (isNotesOpen) {
          setIsNotesOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isDiceOpen, isChatOpen, isNotesOpen]);

  // Listen for external requests to toggle notes (e.g. from header buttons)
  React.useEffect(() => {
    const handleToggleNotes = () => {
      setIsNotesOpen(prev => !prev);
    };
    window.addEventListener('heroic_toggle_quick_notes', handleToggleNotes);
    return () => window.removeEventListener('heroic_toggle_quick_notes', handleToggleNotes);
  }, []);

  if (!isAllowedRoute) {
    return null;
  }

  // Action handlers
  const handleToggleDice = () => {
    const nextState = !isDiceOpen;
    setIsDiceOpen(nextState);
    if (nextState) {
      setIsChatOpen(false);
      setIsNotesOpen(false);
    }
    setIsMenuOpen(false); // smoothly close radial menu upon selection
  };

  const handleToggleChat = () => {
    const currentSession = contextData.sessionId || searchParams.get('session') || localStorage.getItem('last_active_session_id');
    if (!currentSession) {
      setToastMessage('Vincule seu personagem a uma campanha para abrir o Chat da Sessão!');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    const nextState = !isChatOpen;
    setIsChatOpen(nextState);
    if (nextState) {
      setIsDiceOpen(false);
      setIsNotesOpen(false);
    }
    setIsMenuOpen(false);
  };

  const handleToggleNotes = () => {
    const nextState = !isNotesOpen;
    setIsNotesOpen(nextState);
    if (nextState) {
      setIsDiceOpen(false);
      setIsChatOpen(false);
    }
    setIsMenuOpen(false);
  };

  const effectiveSessionId = contextData.sessionId || searchParams.get('session') || localStorage.getItem('last_active_session_id') || '';
  const isAnyToolOpen = isDiceOpen || isChatOpen || isNotesOpen;

  // Determine effective notes target
  const isDungeonRoute = location.pathname.startsWith('/dungeon');
  const effectiveNotesTargetType = contextData.notesTargetType || (isDungeonRoute ? 'campaign' : 'character');
  const effectiveNotesTargetId = contextData.notesTargetId || effectiveSessionId || 'general';
  const effectiveNotesTargetName = contextData.notesTargetName || (isDungeonRoute ? 'Campanha' : 'Personagem');

  // Radial positions for the 3 circular options (top-left fan-out arc)
  // Distance from center: ~78px
  // Option 1 (Anotações Rápidas - Top): x: 0px, y: -78px
  // Option 2 (Chat da Sessão - Diagonal Top-Left): x: -58px, y: -58px
  // Option 3 (Rolador de Dados - Left): x: -78px, y: 0px
  const radialOptions = [
    {
      id: 'notes',
      label: 'Anotações Rápidas',
      icon: Feather,
      onClick: handleToggleNotes,
      isActive: isNotesOpen,
      badge: null,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500 text-obsidian ring-2 ring-amber-400 shadow-amber-500/40',
      idleBg: 'bg-obsidian/95 hover:bg-stone-900 text-amber-400 border-amber-500/40 hover:border-amber-400',
      coords: { x: 0, y: -80 }
    },
    {
      id: 'chat',
      label: 'Chat da Sessão',
      icon: MessageSquare,
      onClick: handleToggleChat,
      isActive: isChatOpen,
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null,
      color: 'text-arcane',
      activeBg: 'bg-arcane text-obsidian ring-2 ring-arcane shadow-arcane/40',
      idleBg: 'bg-obsidian/95 hover:bg-stone-900 text-arcane border-arcane/40 hover:border-arcane',
      coords: { x: -60, y: -60 }
    },
    {
      id: 'dice',
      label: 'Rolador de Dados',
      icon: Dices,
      onClick: handleToggleDice,
      isActive: isDiceOpen,
      badge: null,
      color: 'text-cyan-300',
      activeBg: 'bg-cyan-500 text-obsidian ring-2 ring-cyan-300 shadow-cyan-500/40',
      idleBg: 'bg-obsidian/95 hover:bg-stone-900 text-cyan-300 border-cyan-500/40 hover:border-cyan-400',
      coords: { x: -80, y: 0 }
    }
  ];

  return (
    <>
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:right-6 z-[100] max-w-sm px-4 py-3 rounded-2xl bg-amber-950/95 border border-amber-500/50 text-amber-200 text-xs font-mono shadow-2xl backdrop-blur-xl flex items-center gap-2.5"
          >
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controlled Dice Roller Window */}
      <DiceRoller
        isOpen={isDiceOpen}
        onToggleOpen={(val) => setIsDiceOpen(val)}
        hideLauncherButton={true}
      />

      {/* Controlled Session Chat Window */}
      {effectiveSessionId ? (
        <SessionChat
          sessionId={effectiveSessionId}
          senderOverride={contextData.senderOverride}
          isGM={contextData.isGM}
          isOpen={isChatOpen}
          onToggleOpen={(val) => setIsChatOpen(val)}
          hideLauncherButton={true}
          onUnreadCountChange={setUnreadCount}
        />
      ) : null}

      {/* Controlled Quick Notes Modal */}
      <QuickNotes
        targetType={effectiveNotesTargetType}
        targetId={effectiveNotesTargetId}
        targetName={effectiveNotesTargetName}
        isGM={contextData.isGM}
        isOpen={isNotesOpen}
        onOpenChange={setIsNotesOpen}
        showFloatingButton={false}
        characterContext={contextData.characterContext}
      />

      {/* Floating ActionMenu - Circular Radial Menu with Central Toggle Icon */}
      <div 
        ref={menuRef}
        data-toolbar="true"
        className={cn(
          "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] flex items-center justify-center select-none",
          props.className
        )}
      >
        {/* Radial Action Options Fan-Out */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {radialOptions.map((opt, index) => {
                const IconComponent = opt.icon;
                return (
                  <motion.div
                    key={opt.id}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      x: opt.coords.x, 
                      y: opt.coords.y, 
                      opacity: 1 
                    }}
                    exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 450, 
                      damping: 24,
                      delay: index * 0.03
                    }}
                    className="absolute group flex items-center"
                    style={{
                      transformOrigin: 'center center'
                    }}
                  >
                    {/* Hover Label Tooltip */}
                    <div 
                      className={cn(
                        "absolute right-full mr-2.5 px-2.5 py-1 rounded-xl bg-obsidian/95 border border-white/20 text-[11px] font-mono text-parchment shadow-xl backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10",
                        opt.color
                      )}
                    >
                      {opt.label}
                    </div>

                    {/* Circular Action Button */}
                    <button
                      type="button"
                      onClick={opt.onClick}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shadow-xl border cursor-pointer transition-all relative",
                        opt.isActive ? opt.activeBg : opt.idleBg,
                        "hover:scale-110 active:scale-95"
                      )}
                      title={opt.label}
                    >
                      {opt.id === 'dice' ? (
                        <D20Icon className="w-5 h-5" />
                      ) : (
                        <IconComponent size={20} />
                      )}

                      {/* Unread Badge for Chat */}
                      {opt.badge && !opt.isActive && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-ember text-white rounded-full text-[9px] font-mono font-bold flex items-center justify-center border-2 border-obsidian shadow-md animate-bounce">
                          {opt.badge}
                        </span>
                      )}

                      {/* Active Indicator Pulse Ring */}
                      {opt.isActive && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-white/60 animate-ping opacity-40 pointer-events-none" />
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </>
          )}
        </AnimatePresence>

        {/* Central Circular Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border cursor-pointer relative z-20",
            isMenuOpen
              ? "bg-obsidian/95 border-arcane/70 text-arcane backdrop-blur-2xl ring-2 ring-arcane/40 shadow-arcane/30"
              : isAnyToolOpen
              ? "bg-gradient-to-br from-arcane via-cyan-500 to-blue-600 text-obsidian border-cyan-300 shadow-cyan-500/35 ring-2 ring-cyan-400/40"
              : "bg-gradient-to-br from-arcane via-cyan-500 to-blue-600 text-obsidian border-cyan-300/40 shadow-cyan-500/30 hover:shadow-cyan-400/50"
          )}
          title={
            isMenuOpen 
              ? "Colapsar Menu Circular (ESC)" 
              : "Ações Rápidas: Dados, Chat e Notas Rápidas"
          }
        >
          {isMenuOpen ? (
            <X size={22} className="text-arcane animate-in fade-in zoom-in duration-200" />
          ) : (
            <div className="flex items-center justify-center relative">
              {/* Central Toggle Icon: Stylized Dual Core (Dices with Chat/Feather Sparkle) */}
              <Dices size={24} className="text-obsidian drop-shadow-sm" />
              
              <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-obsidian text-cyan-300 border border-cyan-300/60 shadow-sm">
                <Sparkles size={10} fill="currentColor" />
              </div>

              {/* Unread Counter on Central Button when collapsed */}
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-ember border-2 border-obsidian rounded-full text-[9px] font-mono font-bold text-white flex items-center justify-center shadow-md animate-bounce">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          )}
        </motion.button>
      </div>
    </>
  );
}
