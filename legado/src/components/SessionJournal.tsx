import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Map as MapIcon,
  Clock, 
  Users, 
  Image as ImageIcon, 
  MessageSquare, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Save,
  Trash2,
  X,
  Edit2,
  ScrollText,
  Filter,
  Shield,
  Gamepad2,
  Upload,
  Link as LinkIcon,
  Eye,
  Loader2,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  Timestamp,
  OperationType,
  handleFirestoreError 
} from '../firebase';
import { ImagePickerModal, processImageFile } from './ImagePickerModal';

interface TimelineItem {
  time: string;
  event: string;
  type: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface NPCItem {
  name: string;
  role: string;
  status: string;
  image: string;
}

interface JournalEntry {
  id: string;
  ownerId: string;
  gameSessionId?: string;
  characterId?: string;
  title: string;
  date: string;
  location: string;
  duration: string;
  playersCount: number;
  content: string;
  timeline: TimelineItem[];
  npcs: NPCItem[];
  gallery: string[];
  createdAt: string;
}

export default function SessionJournal({ gameSessionId: propGameSessionId, characterId: propCharacterId }: { gameSessionId?: string, characterId?: string }) {
  const [searchParams] = useSearchParams();
  const gameSessionId = propGameSessionId || searchParams.get('sessionId');
  const characterId = propCharacterId || searchParams.get('characterId');
  
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [userCharacters, setUserCharacters] = React.useState<any[]>([]);
  const [currentEntry, setCurrentEntry] = React.useState<JournalEntry | null>(null);
  const [filterMode, setFilterMode] = React.useState<'session' | 'character' | 'all'>(
    gameSessionId ? 'session' : characterId ? 'character' : 'all'
  );
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string>(characterId || '');
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Gallery, Lightbox, NPC, and deletion modal states
  const [isAddImageModalOpen, setIsAddImageModalOpen] = React.useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = React.useState<{ url: string; index: number } | null>(null);
  const [selectedNPC, setSelectedNPC] = React.useState<NPCItem | null>(null);
  const [deletingEntryId, setDeletingEntryId] = React.useState<string | null>(null);

  const user = auth.currentUser;

  React.useEffect(() => {
    if (!user) return;

    // Fetch user characters for the dropdown
    const charQuery = query(collection(db, 'characters'), where('ownerId', '==', user.uid));
    const unsubscribeChars = onSnapshot(charQuery, (snapshot) => {
      const charData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserCharacters(charData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
    });

    return () => unsubscribeChars();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;

    let q;
    
    if (filterMode === 'session' && gameSessionId) {
      q = query(collection(db, 'journalEntries'), where('gameSessionId', '==', gameSessionId));
    } else if (filterMode === 'character' && selectedCharacterId) {
      q = query(collection(db, 'journalEntries'), where('characterId', '==', selectedCharacterId));
    } else {
      q = query(collection(db, 'journalEntries'), where('ownerId', '==', user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JournalEntry[];
      
      const sortedEntries = entryData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(sortedEntries);
      
      if (sortedEntries.length > 0) {
        if (!currentEntry || !sortedEntries.find(e => e.id === currentEntry.id)) {
          setCurrentEntry(sortedEntries[0]);
        }
      } else {
        setCurrentEntry(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journalEntries');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, gameSessionId, filterMode, selectedCharacterId]);

  const handleSaveEntry = async (entry: Partial<JournalEntry>) => {
    if (!user) return;

    try {
      if (entry.id) {
        const { id, ...data } = entry;
        await updateDoc(doc(db, 'journalEntries', id), data);
      } else {
        const newEntry = {
          ...entry,
          ownerId: user.uid,
          gameSessionId: entry.gameSessionId || gameSessionId || null,
          characterId: entry.characterId || selectedCharacterId || null,
          createdAt: new Date().toISOString(),
          timeline: entry.timeline || [],
          npcs: entry.npcs || [],
          gallery: entry.gallery || [],
          content: entry.content || '',
          location: entry.location || 'Local Desconhecido',
          duration: entry.duration || '0h',
          playersCount: entry.playersCount || 0,
        };
        await addDoc(collection(db, 'journalEntries'), newEntry);
      }
      setIsEditing(false);
      setIsAdding(false);
    } catch (err) {
      console.error('Error saving journal entry:', err);
    }
  };

  const confirmDeleteEntry = async () => {
    if (!deletingEntryId) return;
    try {
      await deleteDoc(doc(db, 'journalEntries', deletingEntryId));
      if (currentEntry?.id === deletingEntryId) {
        setCurrentEntry(entries.find(s => s.id !== deletingEntryId) || null);
      }
    } catch (err) {
      console.error('Error deleting journal entry:', err);
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleAddImageToCurrentEntry = async (imageUrl: string) => {
    if (!currentEntry) return;
    const updatedGallery = [...(currentEntry.gallery || []), imageUrl];
    try {
      await updateDoc(doc(db, 'journalEntries', currentEntry.id), {
        gallery: updatedGallery
      });
      setCurrentEntry({
        ...currentEntry,
        gallery: updatedGallery
      });
    } catch (err) {
      console.error('Error adding image to gallery:', err);
    }
  };

  const handleRemoveImageFromCurrentEntry = async (index: number) => {
    if (!currentEntry) return;
    const updatedGallery = currentEntry.gallery.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, 'journalEntries', currentEntry.id), {
        gallery: updatedGallery
      });
      setCurrentEntry({
        ...currentEntry,
        gallery: updatedGallery
      });
      setSelectedLightboxImage(null);
    } catch (err) {
      console.error('Error removing image from gallery:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-arcane border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Entry Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <h2 className="text-2xl sm:text-3xl font-serif text-glow-arcane">Diário de Sessão</h2>
          <select 
            className="glass px-4 py-2 rounded-xl text-sm font-serif focus:outline-none border-white/10 w-full sm:w-auto"
            value={currentEntry?.id || ''}
            onChange={(e) => setCurrentEntry(entries.find(s => s.id === e.target.value) || null)}
          >
            {entries.map(s => (
              <option key={s.id} value={s.id} className="bg-obsidian">{s.title} ({s.date})</option>
            ))}
            {entries.length === 0 && <option value="">Nenhum registro encontrado</option>}
          </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to={currentEntry?.gameSessionId ? `/map?session=${currentEntry.gameSessionId}` : '/map'}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all text-sm font-medium flex-1 sm:flex-initial font-mono uppercase tracking-wider"
            title="Abrir o Mapa do Mundo com locais descobertos"
          >
            <MapIcon size={16} />
            <span className="hidden xs:inline">Mapa do Mundo</span>
          </Link>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-arcane/20 text-arcane border border-arcane/30 rounded-xl hover:bg-arcane/30 transition-all text-sm font-medium flex-1 sm:flex-initial font-mono uppercase tracking-wider"
          >
            <Plus size={18} />
            Novo Registro
          </button>
        </div>
      </div>

      {/* Filtering Controls */}
      <div className="flex flex-wrap gap-4 items-center glass p-4 rounded-2xl border-white/5">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-arcane" />
          <span className="text-sm font-mono text-parchment/40 uppercase tracking-widest">Visualizar:</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterMode('all')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              filterMode === 'all' ? "bg-arcane text-obsidian" : "glass hover:bg-white/10"
            )}
          >
            <ScrollText size={12} /> Tudo
          </button>
          <button 
            onClick={() => setFilterMode('session')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all invisible hidden",
              gameSessionId && "visible flex items-center gap-1.5",
              filterMode === 'session' ? "bg-arcane text-obsidian" : "glass hover:bg-white/10"
            )}
          >
            <Gamepad2 size={12} /> Campanha
          </button>
          <button 
            onClick={() => setFilterMode('character')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              filterMode === 'character' ? "bg-arcane text-obsidian" : "glass hover:bg-white/10"
            )}
          >
            <Shield size={12} /> Personagem
          </button>
        </div>
        
        {filterMode === 'character' && (
          <select 
            className="glass px-4 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider focus:outline-none border-white/10 bg-obsidian text-parchment/70"
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
          >
            <option value="">Selecione um Personagem</option>
            {userCharacters.map(char => (
              <option key={char.id} value={char.id} className="bg-obsidian">{char.name}</option>
            ))}
          </select>
        )}
      </div>

      {currentEntry ? (
        <>
          {/* Hero Section */}
          <div className="relative h-64 sm:h-80 rounded-[2rem] sm:rounded-[3rem] overflow-hidden border border-white/10 group">
            <img 
              src={`https://picsum.photos/seed/${currentEntry.id}/1920/1080`} 
              alt={currentEntry.title} 
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent" />
            <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div className="flex flex-col gap-2 sm:gap-4">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 glass-arcane text-arcane text-[10px] font-mono uppercase tracking-widest rounded-full">Registro</span>
                    {currentEntry.characterId && (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold text-[10px] font-mono uppercase tracking-widest rounded-full border border-gold/20">
                        <Shield size={10} /> {userCharacters.find(c => c.id === currentEntry.characterId)?.name || 'Personagem'}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-parchment/60 text-xs font-mono">
                      <Calendar size={14} /> {new Date(currentEntry.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-serif text-glow-arcane leading-tight">{currentEntry.title}</h2>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 sm:p-3 glass hover:bg-white/10 rounded-2xl transition-all text-arcane"
                    title="Editar Registro"
                  >
                    <Edit2 size={18} sm:size={20} />
                  </button>
                  <button 
                    onClick={() => setDeletingEntryId(currentEntry.id)}
                    className="p-2 sm:p-3 glass hover:bg-white/10 rounded-2xl transition-all text-ember"
                    title="Excluir Registro"
                  >
                    <Trash2 size={18} sm:size={20} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-parchment/60 mt-4 sm:mt-6">
                <div className="flex items-center gap-2">
                  <MapPin size={14} sm:size={16} className="text-ember" />
                  <span>{currentEntry.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} sm:size={16} className="text-ember" />
                  <span>{currentEntry.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={14} sm:size={16} className="text-ember" />
                  <span>{currentEntry.playersCount} Jogadores</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left Column: Timeline & Summary */}
            <div className="lg:col-span-2 space-y-10">
              {/* Summary */}
              <section className="glass p-8 rounded-[2.5rem] space-y-6">
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <MessageSquare className="text-arcane" size={24} />
                  Resumo da Sessão
                </h3>
                <div className="space-y-4 text-parchment/70 leading-relaxed font-serif text-lg italic">
                  {currentEntry.content ? (
                    currentEntry.content.split('\n').map((p, i) => (
                      <p key={i}>{p}</p>
                    ))
                  ) : (
                    <p className="opacity-40">Nenhum resumo escrito para este registro...</p>
                  )}
                </div>
              </section>

              {/* Timeline */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-serif flex items-center gap-3">
                    <Clock className="text-ember" size={24} />
                    Linha do Tempo de Eventos
                  </h3>
                  {user && (currentEntry.ownerId === user.uid || !currentEntry.ownerId) && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ember/20 text-ember hover:bg-ember/30 border border-ember/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Nova Linha
                    </button>
                  )}
                </div>
                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                  {currentEntry.timeline.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative group"
                    >
                      <div className={cn(
                        "absolute -left-[29px] top-1 w-6 h-6 rounded-full border-4 border-obsidian z-10 transition-all group-hover:scale-125",
                        item.status === 'completed' ? "bg-arcane" : 
                        item.status === 'current' ? "bg-ember animate-pulse" : "bg-white/10"
                      )} />
                      
                      <div className={cn(
                        "glass p-5 rounded-2xl flex items-center justify-between transition-all",
                        item.status === 'current' ? "border-ember/30 bg-ember/5" : "hover:bg-white/5"
                      )}>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-parchment/40 w-12">{item.time}</span>
                          <div>
                            <h5 className="font-serif text-lg">{item.event}</h5>
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">{item.type}</span>
                          </div>
                        </div>
                        {item.status === 'completed' ? (
                          <CheckCircle2 size={20} className="text-arcane/40" />
                        ) : item.status === 'current' ? (
                          <Play size={20} className="text-ember" />
                        ) : (
                          <AlertCircle size={20} className="text-white/10" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {currentEntry.timeline.length === 0 && (
                    <p className="text-parchment/40 text-sm italic">Nenhum evento registrado.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: NPCs & Gallery */}
            <div className="space-y-10">
              {/* NPCs */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-serif flex items-center gap-3">
                    <Users className="text-gold" size={24} />
                    NPCs Encontrados
                  </h3>
                  {user && (currentEntry.ownerId === user.uid || !currentEntry.ownerId) && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Inserir NPC
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {currentEntry.npcs.map((npc, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      onClick={() => setSelectedNPC(npc)}
                      className="glass p-4 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 group-hover:border-gold/50 transition-colors">
                        <img 
                          src={npc.image || `https://picsum.photos/seed/${npc.name}/100/100`} 
                          alt={npc.name} 
                          className="w-full h-full object-cover opacity-80"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-serif text-base">{npc.name}</h5>
                        <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">{npc.role}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-mono",
                        npc.status === 'Amigável' ? "bg-arcane/10 text-arcane" :
                        npc.status === 'Hostil' ? "bg-ember/10 text-ember" : "bg-white/5 text-parchment/40"
                      )}>
                        {npc.status}
                      </span>
                    </motion.div>
                  ))}
                  {currentEntry.npcs.length === 0 && (
                    <p className="text-parchment/40 text-sm italic">Nenhum NPC registrado.</p>
                  )}
                </div>
              </section>

              {/* Gallery */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-serif flex items-center gap-3">
                    <ImageIcon className="text-arcane" size={24} />
                    Galeria
                  </h3>
                  {user && (currentEntry.ownerId === user.uid || !currentEntry.ownerId) && (
                    <button
                      type="button"
                      onClick={() => setIsAddImageModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {currentEntry.gallery && currentEntry.gallery.length > 0 ? (
                    <>
                      {currentEntry.gallery.map((url, i) => (
                        <motion.div
                          key={i}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedLightboxImage({ url, index: i })}
                          className="aspect-square rounded-2xl overflow-hidden border border-white/10 cursor-pointer relative group"
                        >
                          <img 
                            src={url} 
                            alt={`Gallery item ${i}`} 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-arcane/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={24} className="text-white drop-shadow" />
                          </div>
                        </motion.div>
                      ))}
                      {user && (currentEntry.ownerId === user.uid || !currentEntry.ownerId) && (
                        <button
                          type="button"
                          onClick={() => setIsAddImageModalOpen(true)}
                          className="aspect-square rounded-2xl border-2 border-dashed border-white/20 hover:border-arcane/50 bg-white/5 hover:bg-arcane/5 flex flex-col items-center justify-center gap-2 p-4 transition-all group cursor-pointer text-parchment/50 hover:text-arcane"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-arcane/20 flex items-center justify-center transition-colors">
                            <Plus size={20} />
                          </div>
                          <span className="text-xs font-mono uppercase tracking-wider">Adicionar</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="col-span-2 p-8 border-2 border-dashed border-white/15 rounded-2xl text-center space-y-3 bg-white/5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-parchment/40">
                        <ImageIcon size={24} />
                      </div>
                      <p className="text-sm text-parchment/60 font-serif">Nenhuma imagem adicionada a esta sessão ainda.</p>
                      {user && (currentEntry.ownerId === user.uid || !currentEntry.ownerId) && (
                        <button
                          type="button"
                          onClick={() => setIsAddImageModalOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
                        >
                          <Plus size={14} /> Adicionar Imagem
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="glass p-20 rounded-[3rem] text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
            <ScrollText size={40} className="text-parchment/20" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-serif">Nenhum Registro Encontrado</h3>
            <p className="text-parchment/40 max-w-md mx-auto">
              Comece a documentar sua jornada heróica. Registre eventos, NPCs e resumos de suas aventuras.
            </p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-8 py-3 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-105 transition-transform"
          >
            Criar Primeiro Registro
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isEditing || isAdding) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsEditing(false); setIsAdding(false); }}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-4xl glass-modal bg-obsidian/85 backdrop-blur-xl p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/25 relative z-10 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h3 className="text-2xl sm:text-3xl font-serif">{isAdding ? 'Novo Registro' : 'Editar Registro'}</h3>
                <button 
                  onClick={() => { setIsEditing(false); setIsAdding(false); }}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} sm:size={24} />
                </button>
              </div>

              <JournalForm 
                initialData={isEditing ? currentEntry : undefined}
                userCharacters={userCharacters}
                onSave={handleSaveEntry}
                onCancel={() => { setIsEditing(false); setIsAdding(false); }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Image Modal for Current Entry */}
      <AnimatePresence>
        {isAddImageModalOpen && (
          <AddImageModal
            isOpen={isAddImageModalOpen}
            onClose={() => setIsAddImageModalOpen(false)}
            onAddImage={handleAddImageToCurrentEntry}
          />
        )}
      </AnimatePresence>

      {/* Lightbox for Gallery Image */}
      <AnimatePresence>
        {selectedLightboxImage && (
          <ImageLightbox
            image={selectedLightboxImage}
            onClose={() => setSelectedLightboxImage(null)}
            onDelete={
              user && (currentEntry?.ownerId === user.uid || !currentEntry?.ownerId)
                ? () => handleRemoveImageFromCurrentEntry(selectedLightboxImage.index)
                : undefined
            }
          />
        )}
      </AnimatePresence>

      {/* NPC Details Modal */}
      <AnimatePresence>
        {selectedNPC && (
          <NPCModal
            npc={selectedNPC}
            onClose={() => setSelectedNPC(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete Entry Modal */}
      <AnimatePresence>
        {deletingEntryId && (
          <DeleteEntryModal
            isOpen={!!deletingEntryId}
            onClose={() => setDeletingEntryId(null)}
            onConfirm={confirmDeleteEntry}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function JournalForm({ initialData, userCharacters, onSave, onCancel }: { 
  initialData?: JournalEntry | null, 
  userCharacters: any[],
  onSave: (data: Partial<JournalEntry>) => void,
  onCancel: () => void 
}) {
  const [formData, setFormData] = React.useState<Partial<JournalEntry>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    duration: '',
    playersCount: 0,
    content: '',
    timeline: [],
    npcs: [],
    gallery: [],
    characterId: '',
    ...initialData
  });

  // Timeline editor state
  const [isAddingTimeline, setIsAddingTimeline] = React.useState(false);
  const [editingTimelineIndex, setEditingTimelineIndex] = React.useState<number | null>(null);
  const [timelineForm, setTimelineForm] = React.useState<TimelineItem>({
    time: '',
    event: '',
    type: 'Exploração',
    status: 'completed'
  });

  // NPC editor state
  const [isAddingNPC, setIsAddingNPC] = React.useState(false);
  const [editingNPCIndex, setEditingNPCIndex] = React.useState<number | null>(null);
  const [npcForm, setNpcForm] = React.useState<NPCItem>({
    name: '',
    role: '',
    status: 'Neutro',
    image: ''
  });

  const [isFormAddImageModalOpen, setIsFormAddImageModalOpen] = React.useState(false);
  const [isNpcImagePickerOpen, setIsNpcImagePickerOpen] = React.useState(false);

  const handleSaveTimelineLine = () => {
    if (!timelineForm.event.trim()) return;
    if (editingTimelineIndex !== null) {
      setFormData(prev => ({
        ...prev,
        timeline: prev.timeline?.map((t, i) => i === editingTimelineIndex ? { ...timelineForm } : t)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        timeline: [...(prev.timeline || []), { ...timelineForm }]
      }));
    }
    setTimelineForm({ time: '', event: '', type: 'Exploração', status: 'completed' });
    setIsAddingTimeline(false);
    setEditingTimelineIndex(null);
  };

  const handleSaveNPC = () => {
    if (!npcForm.name.trim()) return;
    if (editingNPCIndex !== null) {
      setFormData(prev => ({
        ...prev,
        npcs: prev.npcs?.map((n, i) => i === editingNPCIndex ? { ...npcForm } : n)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        npcs: [...(prev.npcs || []), { ...npcForm }]
      }));
    }
    setNpcForm({ name: '', role: '', status: 'Neutro', image: '' });
    setIsAddingNPC(false);
    setEditingNPCIndex(null);
  };

  const removeTimelineItem = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      timeline: prev.timeline?.filter((_, i) => i !== idx)
    }));
  };

  const removeNPCItem = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      npcs: prev.npcs?.filter((_, i) => i !== idx)
    }));
  };

  const removeGalleryItem = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery?.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Título da Sessão</label>
          <input 
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
            placeholder="Ex: O Portão de Ferro"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Data</label>
          <input 
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Localização</label>
          <input 
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
            placeholder="Ex: Montanhas do Pico das Sombras"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Duração</label>
            <input 
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
              placeholder="Ex: 4 Horas"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Jogadores</label>
            <input 
              type="number"
              value={formData.playersCount}
              onChange={(e) => setFormData({ ...formData, playersCount: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Vincular a Personagem (Opcional)</label>
        <select 
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors text-parchment/70 bg-obsidian"
          value={formData.characterId || ''}
          onChange={(e) => setFormData({ ...formData, characterId: e.target.value })}
        >
          <option value="">Nenhum Personagem (Geral da Sessão)</option>
          {userCharacters.map(char => (
            <option key={char.id} value={char.id}>{char.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Resumo da Sessão</label>
        <textarea 
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-serif italic text-lg"
          placeholder="Escreva o que aconteceu nesta sessão..."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Timeline Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-serif flex items-center gap-2">
              <Clock size={20} className="text-ember" />
              Linha do Tempo
            </h4>
            <button
              type="button"
              onClick={() => {
                setTimelineForm({ time: '', event: '', type: 'Exploração', status: 'completed' });
                setEditingTimelineIndex(null);
                setIsAddingTimeline(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ember/20 text-ember hover:bg-ember/30 border border-ember/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              <Plus size={14} /> Nova Linha
            </button>
          </div>

          <div className="space-y-3">
            {formData.timeline?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 glass rounded-2xl text-sm border border-white/10 hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono text-parchment/50 w-14 shrink-0">{item.time || '—'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-base text-parchment truncate">{item.event}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        item.type === 'Combate' ? "bg-ember/15 text-ember border-ember/30" :
                        item.type === 'Roleplay' ? "bg-gold/15 text-gold border-gold/30" :
                        item.type === 'Mistério' ? "bg-purple-500/15 text-purple-300 border-purple-500/30" :
                        item.type === 'Descanso' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
                        "bg-arcane/15 text-arcane border-arcane/30"
                      )}>
                        {item.type}
                      </span>
                      <span className="text-[10px] text-parchment/40 font-mono">
                        {item.status === 'completed' ? 'Concluído' : item.status === 'current' ? 'Em Andamento' : 'Planejado'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setTimelineForm(item);
                      setEditingTimelineIndex(idx);
                      setIsAddingTimeline(true);
                    }}
                    className="p-1.5 text-arcane hover:bg-arcane/10 rounded-lg transition-colors cursor-pointer"
                    title="Editar Linha"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => removeTimelineItem(idx)}
                    className="p-1.5 text-ember hover:bg-ember/10 rounded-lg transition-colors cursor-pointer"
                    title="Remover Linha"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {(!formData.timeline || formData.timeline.length === 0) && !isAddingTimeline && (
              <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl text-center space-y-2 bg-white/5">
                <Clock size={24} className="text-parchment/30 mx-auto" />
                <p className="text-xs text-parchment/50 font-serif">Nenhum evento registrado na linha do tempo.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTimelineForm({ time: '', event: '', type: 'Exploração', status: 'completed' });
                    setEditingTimelineIndex(null);
                    setIsAddingTimeline(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ember/20 text-ember hover:bg-ember/30 border border-ember/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Plus size={14} /> Inserir Nova Linha
                </button>
              </div>
            )}
          </div>

          {/* New / Edit Timeline Line Panel */}
          {isAddingTimeline && (
            <div className="p-4 rounded-2xl glass border border-ember/30 bg-ember/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-ember flex items-center gap-1.5 font-bold">
                  <Clock size={14} /> {editingTimelineIndex !== null ? 'Editar Linha do Tempo' : 'Inserir Nova Linha'}
                </span>
                <button
                  type="button"
                  onClick={() => { setIsAddingTimeline(false); setEditingTimelineIndex(null); }}
                  className="p-1 text-parchment/40 hover:text-parchment rounded-lg cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase">Horário</label>
                  <input
                    type="text"
                    placeholder="Ex: 14:00"
                    value={timelineForm.time}
                    onChange={(e) => setTimelineForm({ ...timelineForm, time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-ember/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase">Tipo</label>
                  <select
                    value={timelineForm.type}
                    onChange={(e) => setTimelineForm({ ...timelineForm, type: e.target.value })}
                    className="w-full bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-ember/50 text-parchment"
                  >
                    <option value="Exploração">Exploração</option>
                    <option value="Combate">Combate</option>
                    <option value="Roleplay">Roleplay</option>
                    <option value="Mistério">Mistério</option>
                    <option value="Descanso">Descanso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-parchment/40 uppercase">Descrição do Evento *</label>
                <input
                  type="text"
                  placeholder="O que aconteceu neste momento?"
                  value={timelineForm.event}
                  onChange={(e) => setTimelineForm({ ...timelineForm, event: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-ember/50"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-parchment/40 uppercase">Status:</span>
                  <select
                    value={timelineForm.status}
                    onChange={(e) => setTimelineForm({ ...timelineForm, status: e.target.value as any })}
                    className="bg-obsidian border border-white/10 rounded-lg px-2 py-1 text-xs text-parchment"
                  >
                    <option value="completed">Concluído</option>
                    <option value="current">Em Andamento</option>
                    <option value="upcoming">Planejado</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingTimeline(false); setEditingTimelineIndex(null); }}
                    className="px-3 py-1.5 glass rounded-xl text-xs font-mono hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTimelineLine}
                    disabled={!timelineForm.event.trim()}
                    className={cn(
                      "px-4 py-1.5 bg-ember text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md",
                      !timelineForm.event.trim() ? "opacity-40 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"
                    )}
                  >
                    {editingTimelineIndex !== null ? 'Salvar Linha' : 'Inserir Linha'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isAddingTimeline && formData.timeline && formData.timeline.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTimelineForm({ time: '', event: '', type: 'Exploração', status: 'completed' });
                setEditingTimelineIndex(null);
                setIsAddingTimeline(true);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-ember/40 bg-white/5 hover:bg-ember/5 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-parchment/50 hover:text-ember transition-all cursor-pointer"
            >
              <Plus size={14} /> Nova Linha
            </button>
          )}
        </div>

        {/* NPCs Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-serif flex items-center gap-2">
              <Users size={20} className="text-gold" />
              NPCs Encontrados
            </h4>
            <button
              type="button"
              onClick={() => {
                setNpcForm({ name: '', role: '', status: 'Neutro', image: '' });
                setEditingNPCIndex(null);
                setIsAddingNPC(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              <Plus size={14} /> Inserir NPC
            </button>
          </div>

          <div className="space-y-3">
            {formData.npcs?.map((npc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 glass rounded-2xl text-sm border border-white/10 hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/15 bg-white/5 shrink-0">
                    <img 
                      src={npc.image || `https://picsum.photos/seed/${npc.name}/80/80`} 
                      alt={npc.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-serif text-base truncate">{npc.name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-parchment/40 uppercase font-mono truncate">{npc.role || 'Sem papel definido'}</span>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-mono border",
                        npc.status === 'Amigável' ? "bg-arcane/15 text-arcane border-arcane/30" :
                        npc.status === 'Hostil' ? "bg-ember/15 text-ember border-ember/30" : 
                        "bg-white/10 text-parchment/60 border-white/15"
                      )}>
                        {npc.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setNpcForm(npc);
                      setEditingNPCIndex(idx);
                      setIsAddingNPC(true);
                    }}
                    className="p-1.5 text-arcane hover:bg-arcane/10 rounded-lg transition-colors cursor-pointer"
                    title="Editar NPC"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => removeNPCItem(idx)}
                    className="p-1.5 text-ember hover:bg-ember/10 rounded-lg transition-colors cursor-pointer"
                    title="Remover NPC"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {(!formData.npcs || formData.npcs.length === 0) && !isAddingNPC && (
              <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl text-center space-y-2 bg-white/5">
                <Users size={24} className="text-parchment/30 mx-auto" />
                <p className="text-xs text-parchment/50 font-serif">Nenhum NPC registrado nesta sessão ainda.</p>
                <button
                  type="button"
                  onClick={() => {
                    setNpcForm({ name: '', role: '', status: 'Neutro', image: '' });
                    setEditingNPCIndex(null);
                    setIsAddingNPC(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Plus size={14} /> Inserir NPC
                </button>
              </div>
            )}
          </div>

          {/* New / Edit NPC Panel */}
          {isAddingNPC && (
            <div className="p-4 rounded-2xl glass border border-gold/30 bg-gold/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-gold flex items-center gap-1.5 font-bold">
                  <Users size={14} /> {editingNPCIndex !== null ? 'Editar NPC' : 'Inserir Novo NPC'}
                </span>
                <button
                  type="button"
                  onClick={() => { setIsAddingNPC(false); setEditingNPCIndex(null); }}
                  className="p-1 text-parchment/40 hover:text-parchment rounded-lg cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-start gap-4">
                {/* Avatar Preview */}
                <div 
                  onClick={() => setIsNpcImagePickerOpen(true)}
                  className="relative group shrink-0 cursor-pointer"
                  title="Clique para escolher ou enviar imagem do NPC"
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/20 bg-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {npcForm.image ? (
                      <img
                        src={npcForm.image}
                        alt="Avatar do NPC"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Users size={24} className="text-parchment/30" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-obsidian/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-arcane text-[9px] font-mono">
                    <Upload size={14} />
                    <span>Alterar</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-[10px] font-mono text-parchment/40 uppercase">Nome do NPC *</label>
                    <input
                      type="text"
                      placeholder="Ex: Mestre Kenneth"
                      value={npcForm.name}
                      onChange={(e) => setNpcForm({ ...npcForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold/50"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-parchment/40 uppercase">Papel / Título</label>
                      <input
                        type="text"
                        placeholder="Ex: Comandante da Guarda"
                        value={npcForm.role}
                        onChange={(e) => setNpcForm({ ...npcForm, role: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-parchment/40 uppercase">Status</label>
                      <select
                        value={npcForm.status}
                        onChange={(e) => setNpcForm({ ...npcForm, status: e.target.value })}
                        className="w-full bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold/50 text-parchment"
                      >
                        <option value="Amigável">Amigável</option>
                        <option value="Neutro">Neutro</option>
                        <option value="Hostil">Hostil</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase">URL da Imagem ou Upload</label>
                  <button
                    type="button"
                    onClick={() => setIsNpcImagePickerOpen(true)}
                    className="text-[10px] font-mono text-arcane hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon size={12} />
                    Escolher Imagem
                  </button>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="url"
                    placeholder="insira a URL da imagem"
                    value={npcForm.image}
                    onChange={(e) => setNpcForm({ ...npcForm, image: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold/50"
                  />
                  <button
                    type="button"
                    onClick={() => setIsNpcImagePickerOpen(true)}
                    className="px-3 py-2 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <ImageIcon size={12} /> Galeria / Upload
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setIsAddingNPC(false); setEditingNPCIndex(null); }}
                  className="px-3 py-1.5 glass rounded-xl text-xs font-mono hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNPC}
                  disabled={!npcForm.name.trim()}
                  className={cn(
                    "px-4 py-1.5 bg-gold text-obsidian rounded-xl text-xs font-mono font-bold transition-all shadow-md",
                    !npcForm.name.trim() ? "opacity-40 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"
                  )}
                >
                  {editingNPCIndex !== null ? 'Salvar NPC' : 'Inserir NPC'}
                </button>
              </div>
            </div>
          )}

          {!isAddingNPC && formData.npcs && formData.npcs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setNpcForm({ name: '', role: '', status: 'Neutro', image: '' });
                setEditingNPCIndex(null);
                setIsAddingNPC(true);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-gold/40 bg-white/5 hover:bg-gold/5 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-parchment/50 hover:text-gold transition-all cursor-pointer"
            >
              <Plus size={14} /> Inserir NPC
            </button>
          )}
        </div>
      </div>

      {/* Gallery Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-serif flex items-center gap-2">
            <ImageIcon size={20} className="text-arcane" />
            Galeria de Imagens
          </h4>
          <button
            type="button"
            onClick={() => setIsFormAddImageModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {formData.gallery?.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
              <img 
                src={url} 
                alt={`Gallery ${idx}`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                onClick={() => removeGalleryItem(idx)}
                className="absolute top-2 right-2 p-2 bg-ember text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                title="Remover imagem"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setIsFormAddImageModalOpen(true)}
            className="aspect-square rounded-2xl border-2 border-dashed border-white/20 hover:border-arcane/50 bg-white/5 hover:bg-arcane/5 flex flex-col items-center justify-center gap-2 p-4 transition-all group cursor-pointer text-parchment/50 hover:text-arcane"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-arcane/20 flex items-center justify-center transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-xs font-mono uppercase tracking-wider">Adicionar Imagem</span>
          </button>
        </div>

        <AddImageModal
          isOpen={isFormAddImageModalOpen}
          onClose={() => setIsFormAddImageModalOpen(false)}
          onAddImage={(url) => {
            setFormData(prev => ({
              ...prev,
              gallery: [...(prev.gallery || []), url]
            }));
          }}
        />

        {/* NPC Avatar Image Picker Modal */}
        <ImagePickerModal
          isOpen={isNpcImagePickerOpen}
          onClose={() => setIsNpcImagePickerOpen(false)}
          onConfirm={(url) => {
            setNpcForm(prev => ({ ...prev, image: url }));
            setIsNpcImagePickerOpen(false);
          }}
          title="Avatar do NPC"
          subtitle="Insira uma URL ou faça upload da imagem do NPC"
          confirmText="Definir Imagem"
          initialUrl={npcForm.image}
          maxDimension={600}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-6 border-t border-white/10">
        <button 
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-6 py-3 glass rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
        >
          Cancelar
        </button>
        <button 
          type="button"
          onClick={() => onSave(formData)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-xl font-bold hover:scale-105 transition-transform"
        >
          <Save size={18} />
          Salvar Sessão
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Add Image Modal Component
// ----------------------------------------------------
interface AddImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddImage: (url: string) => void;
}

function AddImageModal({ isOpen, onClose, onAddImage }: AddImageModalProps) {
  return (
    <ImagePickerModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onAddImage}
      title="Adicionar Imagem"
      subtitle="Galeria da Sessão"
      confirmText="Adicionar à Galeria"
    />
  );
}

// ----------------------------------------------------
// Image Lightbox Component
// ----------------------------------------------------
function ImageLightbox({ 
  image, 
  onClose, 
  onDelete 
}: { 
  image: { url: string; index: number } | null; 
  onClose: () => void; 
  onDelete?: () => void; 
}) {
  if (!image) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-obsidian/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative max-w-4xl max-h-[90vh] glass-modal bg-obsidian/85 backdrop-blur-xl border border-white/25 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 w-full"
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2 text-xs font-mono text-parchment/60 uppercase tracking-widest">
            <ImageIcon size={16} className="text-arcane" />
            Imagem {image.index + 1}
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 hover:bg-ember/15 text-ember rounded-xl transition-colors text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                title="Excluir da galeria"
              >
                <Trash2 size={16} /> Excluir
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-hidden bg-black/40">
          <img
            src={image.url}
            alt={`Imagem ${image.index + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-xl"
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------
// NPC Details Modal
// ----------------------------------------------------
function NPCModal({ npc, onClose }: { npc: NPCItem | null; onClose: () => void }) {
  if (!npc) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md glass-modal bg-obsidian/85 backdrop-blur-xl border border-white/25 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 z-10"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/20 bg-white/5">
              <img
                src={npc.image || `https://picsum.photos/seed/${npc.name}/150/150`}
                alt={npc.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h4 className="text-2xl font-serif">{npc.name}</h4>
              <p className="text-xs text-parchment/50 font-mono uppercase tracking-wider">{npc.role}</p>
              <span className={cn(
                "inline-block text-[10px] px-2.5 py-0.5 rounded-full font-mono mt-2",
                npc.status === 'Amigável' ? "bg-arcane/15 text-arcane border border-arcane/30" :
                npc.status === 'Hostil' ? "bg-ember/15 text-ember border border-ember/30" : "bg-white/10 text-parchment/60"
              )}>
                {npc.status}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------
// Delete Entry Modal
// ----------------------------------------------------
function DeleteEntryModal({ 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md glass-modal bg-obsidian/85 backdrop-blur-xl border border-red-500/25 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-center z-10"
      >
        <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
          <Trash2 size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-serif">Excluir Registro</h3>
          <p className="text-parchment/60 text-sm">
            Tem certeza que deseja apagar este registro do diário? Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 glass rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-mono uppercase tracking-wider font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
          >
            Sim, Excluir
          </button>
        </div>
      </motion.div>
    </div>
  );
}
