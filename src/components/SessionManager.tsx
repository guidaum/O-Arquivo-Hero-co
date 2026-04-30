import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Users, 
  Key, 
  LogOut, 
  ChevronRight, 
  Shield, 
  User, 
  Copy, 
  Check,
  X,
  LayoutDashboard,
  Sword,
  ScrollText,
  UserCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  auth, 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs,
  OperationType, 
  handleFirestoreError,
  arrayUnion,
  orderBy,
  limit
} from '../firebase';
import { cn } from '../lib/utils';

const playerNamesCache: Record<string, string> = {};

function PlayerSessionCard({ session }: any) {
  const navigate = useNavigate();
  const [latestJournal, setLatestJournal] = React.useState<any>(null);
  const [otherCharacters, setOtherCharacters] = React.useState<any[]>([]);
  const [playerNames, setPlayerNames] = React.useState<Record<string, string>>(playerNamesCache);
  const [lastNpc, setLastNpc] = React.useState<any>(null);
  const [userCharacterId, setUserCharacterId] = React.useState<string | null>(null);
  const user = auth.currentUser;

  React.useEffect(() => {
    if (!session.id) return;

    // Fetch latest journal entry
    const journalQuery = query(
      collection(db, 'journalEntries'),
      where('gameSessionId', '==', session.id),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribeJournal = onSnapshot(journalQuery, (snapshot) => {
      if (!snapshot.empty) {
        const entry = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
        setLatestJournal(entry);
        
        // Get last NPC from this entry if available
        if (entry.npcs && entry.npcs.length > 0) {
          setLastNpc(entry.npcs[entry.npcs.length - 1]);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journalEntries');
    });

    // Fetch characters in this session
    const charsQuery = query(
      collection(db, 'characters'),
      where('sessionId', '==', session.id)
    );

    const unsubscribeChars = onSnapshot(charsQuery, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Filter out current user's characters if needed, but user asked for "demais personagens de jogadores"
      setOtherCharacters(chars.filter(c => c.ownerId !== user?.uid));
      
      // Find current user's character
      const myChar = chars.find(c => c.ownerId === user?.uid);
      if (myChar) {
        setUserCharacterId(myChar.id);
      } else {
        setUserCharacterId(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
    });

    // Fetch player names
    const fetchPlayerNames = async () => {
      if (!session.playerIds || session.playerIds.length === 0) return;
      
      const names: Record<string, string> = { ...playerNamesCache };
      // Also include GM
      const allUserIds = [...new Set([...(session.playerIds || []), session.gmId])];
      let updated = false;
      
      for (const uid of allUserIds) {
        if (!names[uid]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              names[uid] = userDoc.data().displayName || 'Jogador';
              playerNamesCache[uid] = names[uid];
              updated = true;
            }
          } catch (error) {
            console.error('Error fetching user name:', error);
          }
        }
      }
      if (updated) {
        setPlayerNames({ ...names });
      }
    };

    fetchPlayerNames();

    return () => {
      unsubscribeJournal();
      unsubscribeChars();
    };
  }, [session.id, session.playerIds, session.gmId, user?.uid]);

  const handleAccess = () => {
    if (userCharacterId) {
      navigate(`/sheet?id=${userCharacterId}`);
    } else {
      navigate(`/journal?sessionId=${session.id}`);
    }
  };

  return (
    <motion.div
      key={session.id}
      className="glass p-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 hover:border-ember/30 transition-all cursor-pointer group/card overflow-hidden"
      onClick={handleAccess}
    >
      <div className="h-24 sm:h-32 w-full relative">
        <img 
          src={session.image || 'https://picsum.photos/seed/campaign/800/400'} 
          alt={session.name}
          className="w-full h-full object-cover opacity-30 group-hover/card:opacity-50 transition-opacity"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian to-transparent" />
        <div className="absolute bottom-4 left-6 sm:left-8">
          <h5 className="font-serif text-xl sm:text-2xl text-glow-ember group-hover/card:text-ember transition-colors line-clamp-1">{session.name}</h5>
          <p className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
            Mestre: {playerNames[session.gmId] || 'Carregando...'}
          </p>
        </div>
        <div className="absolute top-4 right-6 sm:right-8">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleAccess();
            }}
            className="p-2 sm:p-3 glass rounded-xl sm:rounded-2xl text-ember hover:bg-ember/10 transition-all group"
          >
            <ChevronRight size={20} sm:size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="p-6 pt-2 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Journal Summary */}
        <div className="space-y-3">
          <h6 className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest flex items-center gap-2">
            <ScrollText size={10} sm:size={12} className="text-arcane" />
            Último Relato
          </h6>
          <div className="glass p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 min-h-[80px] sm:min-h-[100px] flex flex-col justify-center">
            {latestJournal ? (
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-serif italic text-parchment/70 line-clamp-3 leading-relaxed">
                  "{latestJournal.content}"
                </p>
                <p className="text-[8px] sm:text-[10px] font-mono text-arcane uppercase">
                  {latestJournal.title} • {new Date(latestJournal.date).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm font-serif italic text-parchment/20">Nenhum diário registrado ainda...</p>
            )}
          </div>
        </div>

        {/* Other Players & NPC */}
        <div className="space-y-4">
          <div className="space-y-3">
            <h6 className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest flex items-center gap-2">
              <Users size={10} sm:size={12} className="text-gold" />
              Companheiros
            </h6>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {otherCharacters.length > 0 ? (
                otherCharacters.map(char => (
                  <div key={char.id} className="px-2 sm:px-3 py-1 sm:py-1.5 glass rounded-lg sm:rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2 border border-white/5">
                    <UserCircle size={12} sm:size={14} className="text-parchment/40" />
                    <span className="font-serif truncate max-w-[80px] sm:max-w-none">{char.name}</span>
                    <span className="text-[8px] sm:text-[10px] text-parchment/40 font-mono">({playerNames[char.ownerId] || '...'})</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] sm:text-xs text-parchment/20 italic">Apenas você nesta jornada por enquanto.</p>
              )}
            </div>
          </div>

          {lastNpc && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <h6 className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest flex items-center gap-2">
                <User size={10} sm:size={12} className="text-ember" />
                Último NPC
              </h6>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-white/10">
                  <img 
                    src={lastNpc.image || `https://picsum.photos/seed/${lastNpc.name}/100/100`} 
                    alt={lastNpc.name} 
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-serif">{lastNpc.name}</p>
                  <p className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-wider">{lastNpc.role}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleAccess();
          }}
          className="text-[10px] sm:text-xs font-bold text-ember hover:underline flex items-center gap-1"
        >
          Acessar Painel <ChevronRight size={12} sm:size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export default function SessionManager({ viewMode = 'user' }: { viewMode?: 'user' | 'gm' }) {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [gmSessions, setGmSessions] = React.useState<any[]>([]);
  const [playerSessions, setPlayerSessions] = React.useState<any[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const [newSessionName, setNewSessionName] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [baseSettings, setBaseSettings] = React.useState<any>(null);

  React.useEffect(() => {
    // Fetch base settings from global config
    const fetchBaseSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'globalSettings', 'config'));
        if (settingsDoc.exists()) {
          setBaseSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error('Error fetching base settings:', error);
      }
    };
    fetchBaseSettings();
  }, []);

  React.useEffect(() => {
    if (!user) return;

    // Sessions where user is GM
    const gmQuery = query(collection(db, 'gameSessions'), where('gmId', '==', user.uid));
    const unsubscribeGm = onSnapshot(gmQuery, (snapshot) => {
      setGmSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gameSessions');
    });

    // Sessions where user is Player
    const playerQuery = query(collection(db, 'gameSessions'), where('playerIds', 'array-contains', user.uid));
    const unsubscribePlayer = onSnapshot(playerQuery, (snapshot) => {
      setPlayerSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gameSessions');
      setLoading(false);
    });

    return () => {
      unsubscribeGm();
      unsubscribePlayer();
    };
  }, [user]);

  const handleCreateSession = async () => {
    if (!user || !newSessionName.trim()) return;
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Merge base settings if available
      const sessionData = {
        gmId: user.uid,
        name: newSessionName,
        code,
        active: true,
        playerIds: [],
        createdAt: new Date().toISOString(),
        ...(baseSettings || {
          maxAttributePoints: 120,
          maxSingleAttributeValue: 100,
          initialSkillPoints: 0,
          initialPowerPoints: 0,
          attrPointsPerLevel: 10,
          skillPointsPerLevel: 5,
          powerPointsPerLevel: 2,
          npcDefaultMinAttr: 0,
          npcDefaultMaxAttr: 100,
          npcDefaultAttrPoints: 120,
          npcDefaultSkillPoints: 10,
          npcDefaultPowerPoints: 5,
          pvFormula: '((FOR / 2) + CON) * 10',
          atpFormula: '(INT + 3) * 3',
        })
      };

      await addDoc(collection(db, 'gameSessions'), sessionData);
      setNewSessionName('');
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gameSessions');
    }
  };

  const handleJoinSession = async () => {
    if (!user || !joinCode.trim()) return;

    try {
      const q = query(collection(db, 'gameSessions'), where('code', '==', joinCode.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert('Código de sessão inválido.');
        return;
      }

      const sessionDoc = snapshot.docs[0];
      const sessionData = sessionDoc.data();

      if (sessionData.gmId === user.uid) {
        alert('Você é o mestre desta sessão.');
        return;
      }

      await updateDoc(doc(db, 'gameSessions', sessionDoc.id), {
        playerIds: arrayUnion(user.uid)
      });

      setJoinCode('');
      setIsJoining(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameSessions');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-serif flex items-center gap-3">
          <LayoutDashboard className="text-arcane" size={24} />
          Sessões de Jogo
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsJoining(true)}
            className="px-4 py-2 glass rounded-xl text-sm font-mono uppercase tracking-wider hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <Key size={16} />
            Entrar
          </button>
          {viewMode === 'gm' && (
            <button 
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-arcane text-obsidian rounded-xl text-sm font-bold hover:scale-105 transition-transform flex items-center gap-2"
            >
              <Plus size={16} />
              Mestrar
            </button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 gap-6",
        viewMode === 'gm' ? "md:grid-cols-2" : "md:grid-cols-1"
      )}>
        {/* GM Section */}
        {viewMode === 'gm' && (
          <div className="space-y-4">
            <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4 flex items-center gap-2">
              <Shield size={12} className="text-ember" />
              Minhas Campanhas (Mestre)
            </h4>
            <div className="space-y-3">
              {gmSessions.length === 0 ? (
                <div className="glass p-8 rounded-3xl text-center border-dashed border-white/10">
                  <p className="text-sm text-parchment/40">Você ainda não mestra nenhuma campanha.</p>
                </div>
              ) : (
                gmSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    layoutId={session.id}
                    className="glass p-5 rounded-3xl border border-white/10 hover:border-arcane/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-serif text-lg">{session.name}</h5>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/10 text-arcane">
                          {session.code}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(session.code, session.id)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-parchment/40 hover:text-parchment"
                        >
                          {copiedId === session.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] font-mono text-parchment/40">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {session.playerIds?.length || 0} Jogadores
                        </span>
                      </div>
                      <button 
                        onClick={() => navigate(`/gm/session/${session.id}`)}
                        className="text-xs font-bold text-arcane hover:underline flex items-center gap-1"
                      >
                        Painel do Mestre <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Player Section */}
        <div className="space-y-4">
          <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4 flex items-center gap-2">
            <Sword size={12} className="text-arcane" />
            Campanhas Ativas (Jogador)
          </h4>
          <div className="space-y-4">
            {playerSessions.length === 0 ? (
              <div className="glass p-8 rounded-3xl text-center border-dashed border-white/10">
                <p className="text-sm text-parchment/40">Você ainda não entrou em nenhuma campanha.</p>
              </div>
            ) : (
              playerSessions.map((session) => (
                <PlayerSessionCard key={session.id} session={session} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setIsCreating(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl font-serif mb-6">Nova Campanha</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Campanha</label>
                  <input 
                    type="text" 
                    value={newSessionName}
                    onChange={e => setNewSessionName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, newSessionName: true }))}
                    placeholder="Ex: As Crônicas de Eldoria"
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors",
                      touched.newSessionName && !newSessionName.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                    )}
                  />
                  {touched.newSessionName && !newSessionName.trim() && (
                    <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome da campanha é obrigatório</p>
                  )}
                </div>
                <button 
                  onClick={handleCreateSession}
                  className="w-full py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-arcane/20"
                >
                  Criar Campanha
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isJoining && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJoining(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setIsJoining(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl font-serif mb-6">Entrar em Campanha</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Código da Sessão</label>
                  <input 
                    type="text" 
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onBlur={() => setTouched(prev => ({ ...prev, joinCode: true }))}
                    placeholder="Ex: ABC123"
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors font-mono tracking-widest text-center text-xl",
                      touched.joinCode && !joinCode.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-ember/50"
                    )}
                  />
                  {touched.joinCode && !joinCode.trim() && (
                    <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O código é obrigatório</p>
                  )}
                </div>
                <button 
                  onClick={handleJoinSession}
                  className="w-full py-4 bg-ember text-obsidian rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-ember/20"
                >
                  Entrar na Jornada
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
