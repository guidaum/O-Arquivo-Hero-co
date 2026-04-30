import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  History, 
  Trophy, 
  Coins, 
  Plus, 
  ArrowRight, 
  Star, 
  Shield, 
  Sword, 
  Zap,
  Flame,
  Eye,
  Brain,
  Heart,
  Activity,
  Scroll,
  Dice6,
  Sparkles,
  X,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, collection, query, where, onSnapshot, getDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../firebase';
import SessionManager from './SessionManager';

const iconMap: Record<string, any> = {
  Shield, Sword, Zap, Flame, Eye, Brain, Heart, Activity, Scroll, Dice6, Sparkles
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [userRole, setUserRole] = React.useState<'user' | 'gm'>('user');
  const [viewMode, setViewMode] = React.useState<'user' | 'gm'>('user');
  const [characters, setCharacters] = React.useState<any[]>([]);
  const [gmSessions, setGmSessions] = React.useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'globalSettings', 'config'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'globalSettings/config');
    });
    return () => unsubscribe();
  }, []);

  const [isCreatingSession, setIsCreatingSession] = React.useState(false);
  const [newSessionName, setNewSessionName] = React.useState('');
  const [newSessionImage, setNewSessionImage] = React.useState('https://picsum.photos/seed/campaign/800/400');

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ id: string, type: 'character' | 'session', name: string } | null>(null);

  const handleDeleteCharacter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'characters', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `characters/${id}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'gameSessions', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gameSessions/${id}`);
    }
  };

  const handleCreateSession = async () => {
    if (!user || !newSessionName.trim()) return;
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'gameSessions'), {
        gmId: user.uid,
        name: newSessionName,
        image: newSessionImage,
        code,
        maxAttributePoints: 120,
        playerIds: [],
        active: true,
        createdAt: new Date().toISOString()
      });
      setNewSessionName('');
      setNewSessionImage('https://picsum.photos/seed/campaign/800/400');
      setIsCreatingSession(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gameSessions');
    }
  };

  React.useEffect(() => {
    if (!user) return;

    // Fetch user role
    const fetchUserRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role || 'user';
          setUserRole(role);
          setViewMode(role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
    fetchUserRole();

    // Fetch characters (for players)
    const qChars = query(collection(db, 'characters'), where('ownerId', '==', user.uid));
    const unsubscribeChars = onSnapshot(qChars, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCharacters(chars);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
    });

    // Fetch GM sessions (for GMs)
    const qSessions = query(collection(db, 'gameSessions'), where('gmId', '==', user.uid));
    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGmSessions(sessions);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gameSessions');
      setLoading(false);
    });

    return () => {
      unsubscribeChars();
      unsubscribeSessions();
    };
  }, [user]);

  const CharacterCard = ({ char, idx }: { char: any, idx: number, key?: any }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 + idx * 0.1 }}
      className={cn(
        "relative h-[450px] rounded-[2rem] overflow-hidden group border border-white/10",
        char.color === 'arcane' ? "hover:border-arcane/50" : "hover:border-ember/50"
      )}
    >
      {/* Background Image */}
      <img 
        src={char.image} 
        alt={char.name} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
        referrerPolicy="no-referrer"
      />
      
      {/* Delete Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setDeleteConfirm({ id: char.id, type: 'character', name: char.name });
        }}
        className="absolute top-2 right-2 z-10 p-1 glass rounded-xl text-parchment/40 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
        title="Excluir Personagem"
      >
        <Trash2 size={16} />
      </button>

      {/* Clickable Area */}
      <div 
        onClick={() => navigate(`/sheet?id=${char.id}`)}
        className="absolute inset-0 cursor-pointer"
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/40 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-end pointer-events-none">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-xs font-mono uppercase tracking-widest mb-1",
                char.color === 'arcane' ? "text-arcane" : "text-ember"
              )}>
                Nível {char.level} • {char.class}
              </p>
              <h4 className="text-3xl font-serif">{char.name}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center">
              {(() => {
                const Icon = iconMap[char.icon] || (char.color === 'arcane' ? Shield : Sword);
                return <Icon size={24} className={char.color === 'arcane' ? "text-arcane" : "text-ember"} />;
              })()}
            </div>
          </div>

          {/* XP Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-parchment/40">
              <span>PROGRESSO DE XP</span>
              <span>{(char.xp ?? 0).toLocaleString()} / {(char.xpMax ?? 0).toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(char.xp / char.xpMax) * 100}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className={cn(
                  "h-full rounded-full",
                  char.color === 'arcane' ? "bg-arcane" : "bg-ember"
                )}
              />
            </div>
          </div>

          {/* Stats Preview */}
          <div className="grid grid-cols-3 gap-2">
            {(globalSettings?.attributes || [
              { id: 'for', label: 'FOR' },
              { id: 'agi', label: 'AGI' },
              { id: 'con', label: 'CON' }
            ]).slice(0, 3).map((attr: any) => (
              <div key={attr.id} className="glass p-2 rounded-xl text-center">
                <p className="text-[10px] text-parchment/40 font-mono">{attr.id.toUpperCase()}</p>
                <p className="text-sm font-serif">{char.stats[attr.id] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 lg:space-y-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl lg:text-4xl font-serif mb-2">
            {viewMode === 'gm' ? 'Painel do Mestre' : 'Minhas Lendas'}, {user?.displayName?.split(' ')[0]}
          </h2>
          <p className="text-parchment/40 font-mono text-xs lg:text-sm uppercase tracking-widest">
            {viewMode === 'gm' ? 'Gerencie suas campanhas e lendas' : 'As Crônicas da Sua Jornada'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:gap-4">
          <button 
            onClick={() => navigate('/create')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-obsidian rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-white/10 text-sm lg:text-base"
          >
            <Plus size={20} />
            <span>Nova Lenda</span>
          </button>
          {viewMode === 'gm' && (
            <button 
              onClick={() => setIsCreatingSession(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-arcane/20 text-sm lg:text-base"
            >
              <Plus size={20} />
              <span>Nova Campanha</span>
            </button>
          )}
        </div>
      </header>

      {/* Role Toggle for GMs */}
      {userRole === 'gm' && (
        <div className="flex justify-center">
          <div className="glass p-1 rounded-2xl flex gap-1">
            <button 
              onClick={() => setViewMode('gm')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                viewMode === 'gm' ? "bg-arcane text-obsidian" : "text-parchment/40 hover:bg-white/5"
              )}
            >
              Modo Mestre
            </button>
            <button 
              onClick={() => setViewMode('user')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                viewMode === 'user' ? "bg-ember text-obsidian" : "text-parchment/40 hover:bg-white/5"
              )}
            >
              Modo Jogador
            </button>
          </div>
        </div>
      )}

      {/* Session Manager */}
      <SessionManager viewMode={viewMode} />

      {/* Create Session Modal */}
      {isCreatingSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 rounded-[2.5rem] w-full max-w-md border border-white/10 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-serif">Nova Campanha</h3>
              <button 
                onClick={() => setIsCreatingSession(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Campanha</label>
                <input 
                  type="text" 
                  value={newSessionName}
                  onChange={e => setNewSessionName(e.target.value)}
                  placeholder="Ex: As Crônicas de Eldoria"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">URL da Imagem de Capa</label>
                <input 
                  type="text" 
                  value={newSessionImage}
                  onChange={e => setNewSessionImage(e.target.value)}
                  placeholder="URL da imagem..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                />
              </div>
            </div>

            <button 
              onClick={handleCreateSession}
              className="w-full py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-arcane/20"
            >
              Criar Campanha
            </button>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 rounded-[2.5rem] w-full max-w-md border border-red-500/20 space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={40} className="text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-serif">Excluir {deleteConfirm.type === 'character' ? 'Personagem' : 'Campanha'}?</h3>
              <p className="text-parchment/60">
                Tem certeza que deseja excluir <span className="text-white font-bold">"{deleteConfirm.name}"</span>? 
                Esta ação não pode ser desfeita.
              </p>
              {deleteConfirm.type === 'session' && (
                <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest mt-4">
                  Nota: Talentos, perícias e configurações globais serão preservados.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="py-4 glass rounded-2xl font-bold hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (deleteConfirm.type === 'character') {
                    handleDeleteCharacter(deleteConfirm.id);
                  } else {
                    handleDeleteSession(deleteConfirm.id);
                  }
                }}
                className="py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {viewMode === 'gm' ? (
        <div className="space-y-12">
          <section className="space-y-8">
            <h3 className="text-2xl font-serif flex items-center gap-3">
              <Users className="text-arcane" size={24} />
              Minhas Campanhas Ativas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gmSessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass p-0 rounded-[2rem] border border-white/10 hover:border-arcane/50 group transition-all overflow-hidden relative"
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: session.id, type: 'session', name: session.name });
                    }}
                    className="absolute top-2 right-2 z-10 p-1 glass rounded-xl text-parchment/20 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                    title="Excluir Campanha"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div 
                    onClick={() => navigate(`/gm/session/${session.id}`)}
                    className="cursor-pointer"
                  >
                    <div className="h-32 w-full relative">
                      <img 
                        src={session.image || 'https://picsum.photos/seed/campaign/800/400'} 
                        alt={session.name}
                        className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-obsidian to-transparent" />
                    </div>
                    <div className="p-6 pt-2">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-serif mb-1 group-hover:text-arcane transition-colors">{session.name}</h4>
                          <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">CÓDIGO: {session.code}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-arcane/10 flex items-center justify-center">
                          <History size={20} className="text-arcane" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-parchment/60">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{session.playerIds?.length || 0} Jogadores</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Scroll size={14} />
                          <span>{session.journalEntriesCount || 0} Registros</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {gmSessions.length === 0 && (
                <div className="col-span-full py-12 text-center glass rounded-[2rem] border-dashed border-white/10">
                  <p className="text-parchment/40 font-mono italic">Você ainda não criou nenhuma sessão.</p>
                </div>
              )}
            </div>
          </section>

          {/* GM's own characters */}
          <section className="space-y-8">
            <h3 className="text-2xl font-serif flex items-center gap-3">
              <Sword className="text-ember" size={24} />
              Minhas Lendas (DMPCs/NPCs)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {characters.length === 0 ? (
                <div className="col-span-full py-12 text-center glass rounded-[2.5rem] border-dashed border-white/5">
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Nenhum personagem criado</p>
                </div>
              ) : (
                characters.map((char, idx) => (
                  <CharacterCard key={char.id} char={char} idx={idx} />
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif flex items-center gap-3">
              <Users className="text-arcane" size={24} />
              Lendas Ativas
            </h3>
            <button className="text-sm text-arcane hover:underline flex items-center gap-1">
              Ver Tudo <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((char, idx) => (
              <CharacterCard key={char.id} char={char} idx={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookOpen({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
