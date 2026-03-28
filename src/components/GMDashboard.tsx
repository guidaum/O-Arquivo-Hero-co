import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ChevronLeft, 
  Shield, 
  User, 
  Dice6, 
  Zap, 
  Heart, 
  Activity, 
  Sword, 
  Scroll,
  Plus,
  History,
  Sparkles,
  Save,
  Trash2,
  Edit2,
  ChevronRight as ChevronRightIcon,
  Brain,
  Eye,
  Copy,
  X,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { 
  auth,
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  OperationType, 
  handleFirestoreError 
} from '../firebase';
import { cn } from '../lib/utils';
import SessionJournal from './SessionJournal';

interface GameSession {
  id: string;
  name: string;
  code: string;
  gmId: string;
  playerIds: string[];
  gmNotes?: string;
  maxAttributePoints?: number;
  maxSingleAttributeValue?: number;
}

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  image: string;
  currentPV: number;
  currentATP: number;
  stats: {
    pv: number;
    atp: number;
    for: number;
    agi: number;
    con: number;
  };
}

interface Talent {
  id: string;
  name: string;
  description: string;
  composition: string[];
  sessionId: string;
  gmId: string;
}

const ATTRIBUTES = [
  { id: 'for', label: 'Força', icon: Sword, color: 'text-ember' },
  { id: 'con', label: 'Constituição', icon: Shield, color: 'text-ember' },
  { id: 'agi', label: 'Agilidade', icon: Zap, color: 'text-arcane' },
  { id: 'per', label: 'Percepção', icon: Eye, color: 'text-gold' },
  { id: 'vel', label: 'Velocidade', icon: Zap, color: 'text-arcane' },
  { id: 'ini', label: 'Iniciativa', icon: Zap, color: 'text-gold' },
  { id: 'int', label: 'Inteligência', icon: Brain, color: 'text-arcane' },
  { id: 'cor', label: 'Coragem', icon: Heart, color: 'text-ember' },
];

export default function GMDashboard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [session, setSession] = React.useState<GameSession | null>(null);
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [talents, setTalents] = React.useState<Talent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'characters' | 'journal' | 'notes' | 'settings' | 'talents'>('characters');
  const [gmNotes, setGmNotes] = React.useState('');
  const [maxAttributePoints, setMaxAttributePoints] = React.useState(120);
  const [maxSingleAttributeValue, setMaxSingleAttributeValue] = React.useState(100);
  const [sessionName, setSessionName] = React.useState('');
  const [sessionImage, setSessionImage] = React.useState('');
  const [filterClass, setFilterClass] = React.useState<string>('all');
  const [filterLevel, setFilterLevel] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'level'>('name');

  // Talent Form State
  const [isCreatingTalent, setIsCreatingTalent] = React.useState(false);
  const [newTalent, setNewTalent] = React.useState({
    name: '',
    description: '',
    composition: [] as string[]
  });

  const filteredAndSortedCharacters = React.useMemo(() => {
    return characters
      .filter(char => {
        const matchesClass = filterClass === 'all' || char.class === filterClass;
        const matchesLevel = filterLevel === 'all' || char.level.toString() === filterLevel;
        // Mock status filter for now, as we don't have real presence yet
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'online' ? true : false);
        return matchesClass && matchesLevel && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.level - a.level;
        }
      });
  }, [characters, filterClass, filterLevel, filterStatus, sortBy]);

  const uniqueClasses = React.useMemo(() => {
    const classes = new Set(characters.map(c => c.class));
    return Array.from(classes).sort();
  }, [characters]);

  const uniqueLevels = React.useMemo(() => {
    const levels = new Set(characters.map(c => c.level.toString()));
    return Array.from(levels).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  }, [characters]);

  React.useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, 'gameSessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // SECURITY CHECK: Only the GM of this specific session can access this dashboard
        if (data.gmId !== user?.uid) {
          navigate('/');
          return;
        }
        setSession({ id: doc.id, ...data } as GameSession);
        setGmNotes(data.gmNotes || '');
        setMaxAttributePoints(data.maxAttributePoints || 120);
        setMaxSingleAttributeValue(data.maxSingleAttributeValue || 100);
        setSessionName(data.name || '');
        setSessionImage(data.image || '');
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `gameSessions/${sessionId}`);
      setLoading(false);
    });

    const charactersQuery = query(
      collection(db, 'characters'),
      where('sessionId', '==', sessionId)
    );
    const unsubscribeCharacters = onSnapshot(charactersQuery, (snapshot) => {
      const charData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Character[];
      setCharacters(charData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
    });

    const talentsQuery = query(
      collection(db, 'talents'),
      where('sessionId', '==', sessionId)
    );
    const unsubscribeTalents = onSnapshot(talentsQuery, (snapshot) => {
      const talentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Talent[];
      setTalents(talentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'talents');
    });

    return () => {
      unsubscribeSession();
      unsubscribeCharacters();
      unsubscribeTalents();
    };
  }, [sessionId]);

  const handleSaveNotes = async () => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        gmNotes: gmNotes
      });
    } catch (err) {
      console.error('Error saving GM notes:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        name: sessionName,
        image: sessionImage,
        maxAttributePoints: Number(maxAttributePoints),
        maxSingleAttributeValue: Number(maxSingleAttributeValue)
      });
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Error saving session settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, `gameSessions/${sessionId}`);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    if (!confirm('Tem certeza que deseja excluir esta campanha? Todos os dados serão perdidos permanentemente.')) return;
    
    try {
      await deleteDoc(doc(db, 'gameSessions', sessionId));
      navigate('/');
    } catch (err) {
      console.error('Error deleting session:', err);
      handleFirestoreError(err, OperationType.DELETE, `gameSessions/${sessionId}`);
    }
  };

  const handleCreateTalent = async () => {
    if (!sessionId || !user || !newTalent.name || newTalent.composition.length === 0) return;
    try {
      await addDoc(collection(db, 'talents'), {
        ...newTalent,
        sessionId,
        gmId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewTalent({ name: '', description: '', composition: [] });
      setIsCreatingTalent(false);
    } catch (err) {
      console.error('Error creating talent:', err);
      handleFirestoreError(err, OperationType.CREATE, 'talents');
    }
  };

  const handleDeleteTalent = async (talentId: string) => {
    try {
      await deleteDoc(doc(db, 'talents', talentId));
    } catch (err) {
      console.error('Error deleting talent:', err);
      handleFirestoreError(err, OperationType.DELETE, `talents/${talentId}`);
    }
  };

  const addAttributeToTalent = (attrId: string) => {
    setNewTalent(prev => ({
      ...prev,
      composition: [...prev.composition, attrId]
    }));
  };

  const removeAttributeFromTalent = (index: number) => {
    setNewTalent(prev => ({
      ...prev,
      composition: prev.composition.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-arcane/20 border-t-arcane rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-serif">Sessão não encontrada</h2>
        <Link to="/" className="text-arcane hover:underline">Voltar ao Painel</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-parchment p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => navigate('/')}
              className="p-2 sm:p-3 glass rounded-xl sm:rounded-2xl hover:bg-white/10 transition-colors text-parchment/40 hover:text-parchment"
            >
              <ChevronLeft size={20} sm:size={24} />
            </button>
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <Shield size={18} sm:size={20} className="text-ember" />
                <h1 className="text-2xl sm:text-4xl font-serif text-glow-arcane line-clamp-1">{session.name}</h1>
              </div>
              <p className="text-parchment/40 font-mono text-[10px] sm:text-sm uppercase tracking-widest flex items-center gap-2">
                Painel do Mestre • <span className="hidden sm:inline">Código:</span> 
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(session.code);
                    alert('Código da sessão copiado!');
                  }}
                  className="text-arcane hover:text-arcane/80 transition-colors flex items-center gap-1"
                  title="Clique para copiar"
                >
                  {session.code}
                  <Copy size={10} sm:size={12} />
                </button>
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
            <button 
              onClick={() => setActiveTab('characters')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'characters' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Personagens
            </button>
            <button 
              onClick={() => setActiveTab('journal')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'journal' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Diário
            </button>
            <button 
              onClick={() => setActiveTab('talents')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'talents' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Talentos
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'notes' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Notas
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'settings' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Config
            </button>
          </div>
        </header>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'characters' && (
            <motion.div
              key="characters"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters and Sorting */}
              {characters.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <div className="flex items-center gap-2 text-parchment/40">
                    <Filter size={16} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Filtros:</span>
                  </div>
                  
                  <select 
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todas as Classes</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                  <select 
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todos os Níveis</option>
                    {uniqueLevels.map(lvl => (
                      <option key={lvl} value={lvl}>Nível {lvl}</option>
                    ))}
                  </select>

                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>

                  <div className="flex items-center gap-2 text-parchment/40 ml-auto">
                    <ArrowUpDown size={16} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Ordenar:</span>
                  </div>

                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'level')}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="name">Nome (A-Z)</option>
                    <option value="level">Nível (Maior)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {characters.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Users size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum aventureiro ainda</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Compartilhe o código <span className="text-arcane font-mono">{session.code}</span> com seus jogadores para eles entrarem na sessão.</p>
                  </div>
                ) : filteredAndSortedCharacters.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Filter size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum aventureiro encontrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Tente ajustar seus filtros para encontrar o que procura.</p>
                  </div>
                ) : (
                  filteredAndSortedCharacters.map((char, idx) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative overflow-hidden"
                    >
                    <div className="flex items-start justify-between mb-4 sm:mb-6 relative z-10">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-arcane/50 transition-colors">
                          <img 
                            src={char.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`} 
                            alt={char.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h4 className="text-lg sm:text-xl font-serif mb-0.5 sm:mb-1">{char.name}</h4>
                          <p className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Nível {char.level} • {char.class}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                          <Heart size={10} sm:size={12} />
                          <span className="text-[10px] sm:text-xs font-bold">{char.currentPV}/{char.stats.pv}</span>
                        </div>
                        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Zap size={10} sm:size={12} />
                          <span className="text-[10px] sm:text-xs font-bold">{char.currentATP}/{char.stats.atp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 relative z-10">
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">FOR</p>
                        <p className="text-lg font-serif">{char.stats.for}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">AGI</p>
                        <p className="text-lg font-serif">{char.stats.agi}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">CON</p>
                        <p className="text-lg font-serif">{char.stats.con}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-parchment/40 uppercase">Online</span>
                      </div>
                      <Link 
                        to={`/sheet?id=${char.id}`}
                        className="p-2 glass rounded-xl hover:bg-arcane/20 transition-colors text-arcane"
                      >
                        <ChevronRightIcon size={20} />
                      </Link>
                    </div>

                    {/* Background Decoration */}
                    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Dice6 size={120} />
                    </div>
                  </motion.div>
                ))
              )}
              </div>
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SessionJournal gameSessionId={sessionId} />
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif">Notas do Mestre</h3>
                <button 
                  onClick={handleSaveNotes}
                  className="flex items-center gap-2 px-4 py-2 bg-arcane/20 text-arcane rounded-xl hover:bg-arcane/30 transition-all text-sm font-medium"
                >
                  <Save size={18} />
                  Salvar Notas
                </button>
              </div>
              <textarea 
                value={gmNotes}
                onChange={(e) => setGmNotes(e.target.value)}
                className="w-full h-[500px] bg-transparent border-none focus:ring-0 font-serif text-lg leading-relaxed placeholder:text-parchment/20 resize-none"
                placeholder="Suas anotações secretas, planos e segredos da campanha..."
              />
            </motion.div>
          )}

          {activeTab === 'talents' && (
            <motion.div
              key="talents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Cadastro de Talentos</h3>
                  <p className="text-sm text-parchment/40">Defina talentos e suas composições de atributos para esta campanha.</p>
                </div>
                <button 
                  onClick={() => setIsCreatingTalent(!isCreatingTalent)}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Plus size={18} />
                  {isCreatingTalent ? 'Cancelar' : 'Novo Talento'}
                </button>
              </div>

              {isCreatingTalent && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Talento</label>
                        <input 
                          type="text" 
                          value={newTalent.name}
                          onChange={e => setNewTalent(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Mestre das Lâminas"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={newTalent.description}
                          onChange={e => setNewTalent(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="O que este talento faz?"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-32 resize-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Composição Atual</label>
                        <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-white/5 border border-white/10 rounded-xl">
                          {newTalent.composition.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full">
                              <span className="text-xs text-parchment/20 italic">Nenhum atributo selecionado</span>
                            </div>
                          ) : (
                            newTalent.composition.map((attrId, index) => {
                              const attr = ATTRIBUTES.find(a => a.id === attrId);
                              if (!attr) return null;
                              return (
                                <motion.div 
                                  key={`${attrId}-${index}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-arcane/10 border border-arcane/30 text-arcane text-xs font-medium"
                                >
                                  <attr.icon size={12} />
                                  {attr.label}
                                  <button 
                                    onClick={() => removeAttributeFromTalent(index)}
                                    className="hover:text-ember transition-colors ml-1"
                                  >
                                    <X size={14} />
                                  </button>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Adicionar Atributo</label>
                        <div className="grid grid-cols-2 gap-3">
                          {ATTRIBUTES.map(attr => (
                            <button
                              key={attr.id}
                              onClick={() => addAttributeToTalent(attr.id)}
                              className="flex items-center gap-3 p-3 rounded-xl border bg-white/5 border-white/10 text-parchment/40 hover:border-arcane/50 hover:text-parchment transition-all text-left group"
                            >
                              <attr.icon size={16} className="group-hover:text-arcane transition-colors" />
                              <span className="text-sm font-medium">{attr.label}</span>
                              <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-parchment/40 font-mono px-2">Clique nos atributos para adicioná-los à composição. Você pode adicionar o mesmo atributo múltiplas vezes.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleCreateTalent}
                      disabled={!newTalent.name || newTalent.composition.length === 0}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Save size={18} />
                      Criar Talento
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {talents.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Sparkles size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum talento cadastrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Crie talentos personalizados para que seus jogadores possam usá-los em suas fichas.</p>
                  </div>
                ) : (
                  talents.map((talent) => (
                    <div key={talent.id} className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-serif text-glow-arcane">{talent.name}</h4>
                        <button 
                          onClick={() => handleDeleteTalent(talent.id)}
                          className="p-2 text-parchment/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <p className="text-sm text-parchment/60 mb-6 line-clamp-3">{talent.description || 'Sem descrição.'}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {talent.composition.map(attrId => {
                          const attr = ATTRIBUTES.find(a => a.id === attrId);
                          if (!attr) return null;
                          return (
                            <div key={attrId} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider">
                              <attr.icon size={10} className={attr.color} />
                              {attr.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif">Configurações da Campanha</h3>
                <button 
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Save size={18} />
                  Salvar Alterações
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Campanha</label>
                  <input 
                    type="text" 
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">URL da Imagem de Capa</label>
                  <input 
                    type="text" 
                    value={sessionImage}
                    onChange={e => setSessionImage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos de Atributo Iniciais</label>
                  <input 
                    type="number" 
                    value={maxAttributePoints}
                    onChange={e => setMaxAttributePoints(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define quantos pontos os jogadores podem distribuir na criação de personagem.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Valor Máximo por Atributo</label>
                  <input 
                    type="number" 
                    value={maxSingleAttributeValue}
                    onChange={e => setMaxSingleAttributeValue(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define o valor máximo que um único atributo pode atingir na criação.</p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10">
                <div className="bg-ember/5 border border-ember/20 p-6 rounded-2xl space-y-4">
                  <h4 className="text-ember font-serif text-lg">Zona de Perigo</h4>
                  <p className="text-sm text-parchment/60">A exclusão da campanha é permanente e não pode ser desfeita. Todos os personagens vinculados perderão o vínculo com esta campanha.</p>
                  <button 
                    onClick={handleDeleteSession}
                    className="flex items-center gap-2 px-6 py-3 bg-ember/10 text-ember border border-ember/20 rounded-xl hover:bg-ember/20 transition-all font-bold text-sm"
                  >
                    <Trash2 size={18} />
                    Excluir Campanha Permanentemente
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChevronRight({ size, className }: { size: number, className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
