import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
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
  ScrollText
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
  Timestamp 
} from '../firebase';

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

export default function SessionJournal({ gameSessionId: propGameSessionId }: { gameSessionId?: string }) {
  const [searchParams] = useSearchParams();
  const gameSessionId = propGameSessionId || searchParams.get('sessionId');
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = React.useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const user = auth.currentUser;

  React.useEffect(() => {
    if (!user) return;

    let q = query(collection(db, 'journalEntries'), where('ownerId', '==', user.uid));
    
    if (gameSessionId) {
      q = query(collection(db, 'journalEntries'), where('gameSessionId', '==', gameSessionId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JournalEntry[];
      
      setEntries(entryData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      if (entryData.length > 0 && !currentEntry) {
        setCurrentEntry(entryData[0]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, gameSessionId]);

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
          gameSessionId: gameSessionId || null,
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

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'journalEntries', id));
      if (currentEntry?.id === id) {
        setCurrentEntry(entries.find(s => s.id !== id) || null);
      }
    } catch (err) {
      console.error('Error deleting journal entry:', err);
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
    <div className="space-y-10">
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
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-arcane/20 text-arcane border border-arcane/30 rounded-xl hover:bg-arcane/30 transition-all text-sm font-medium w-full sm:w-auto"
        >
          <Plus size={18} />
          Novo Registro
        </button>
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
                  >
                    <Edit2 size={18} sm:size={20} />
                  </button>
                  <button 
                    onClick={() => handleDeleteEntry(currentEntry.id)}
                    className="p-2 sm:p-3 glass hover:bg-white/10 rounded-2xl transition-all text-ember"
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
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <Clock className="text-ember" size={24} />
                  Linha do Tempo de Eventos
                </h3>
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
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <Users className="text-gold" size={24} />
                  NPCs Encontrados
                </h3>
                <div className="space-y-4">
                  {currentEntry.npcs.map((npc, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      onClick={() => alert(`${npc.name}\n\nPapel: ${npc.role}\nStatus: ${npc.status}`)}
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
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <ImageIcon className="text-arcane" size={24} />
                  Galeria
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {currentEntry.gallery && currentEntry.gallery.length > 0 ? (
                    currentEntry.gallery.map((url, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => window.open(url, '_blank')}
                        className="aspect-square rounded-2xl overflow-hidden border border-white/10 cursor-pointer relative group"
                      >
                        <img 
                          src={url} 
                          alt={`Gallery item ${i}`} 
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-arcane/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play size={24} className="text-white" />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    [1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => window.open(`https://picsum.photos/seed/gallery-${currentEntry.id}-${i}/1920/1080`, '_blank')}
                        className="aspect-square rounded-2xl overflow-hidden border border-white/10 cursor-pointer relative group"
                      >
                        <img 
                          src={`https://picsum.photos/seed/gallery-${currentEntry.id}-${i}/400/400`} 
                          alt={`Gallery item ${i}`} 
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-arcane/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play size={24} className="text-white" />
                        </div>
                      </motion.div>
                    ))
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
              className="w-full max-w-4xl glass p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 relative z-10 max-h-[90vh] overflow-y-auto no-scrollbar"
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
                onSave={handleSaveEntry}
                onCancel={() => { setIsEditing(false); setIsAdding(false); }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JournalForm({ initialData, onSave, onCancel }: { 
  initialData?: JournalEntry | null, 
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
    ...initialData
  });

  const [newTimeline, setNewTimeline] = React.useState<TimelineItem>({
    time: '',
    event: '',
    type: 'Exploração',
    status: 'completed'
  });

  const [newNPC, setNewNPC] = React.useState<NPCItem>({
    name: '',
    role: '',
    status: 'Neutro',
    image: ''
  });

  const [newImageUrl, setNewImageUrl] = React.useState('');

  const addTimelineItem = () => {
    if (newTimeline.event.trim()) {
      setFormData(prev => ({
        ...prev,
        timeline: [...(prev.timeline || []), { ...newTimeline }]
      }));
      setNewTimeline({ time: '', event: '', type: 'Exploração', status: 'completed' });
    }
  };

  const addNPCItem = () => {
    if (newNPC.name.trim()) {
      setFormData(prev => ({
        ...prev,
        npcs: [...(prev.npcs || []), { ...newNPC }]
      }));
      setNewNPC({ name: '', role: '', status: 'Neutro', image: '' });
    }
  };

  const addGalleryItem = () => {
    if (newImageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        gallery: [...(prev.gallery || []), newImageUrl.trim()]
      }));
      setNewImageUrl('');
    }
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
          <h4 className="text-xl font-serif flex items-center gap-2">
            <Clock size={20} className="text-ember" />
            Linha do Tempo
          </h4>
          <div className="space-y-3">
            {formData.timeline?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 glass rounded-xl text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-parchment/40 font-mono w-10">{item.time}</span>
                  <span>{item.event}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => removeTimelineItem(idx)}
                  className="text-ember hover:bg-ember/10 p-1 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Hora" 
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                value={newTimeline.time}
                onChange={(e) => setNewTimeline({ ...newTimeline, time: e.target.value })}
              />
              <input 
                type="text" 
                placeholder="Evento" 
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                value={newTimeline.event}
                onChange={(e) => setNewTimeline({ ...newTimeline, event: e.target.value })}
              />
              <button 
                type="button"
                onClick={addTimelineItem}
                className="p-1 bg-arcane/20 text-arcane rounded-lg"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* NPCs Editor */}
        <div className="space-y-4">
          <h4 className="text-xl font-serif flex items-center gap-2">
            <Users size={20} className="text-gold" />
            NPCs
          </h4>
          <div className="space-y-3">
            {formData.npcs?.map((npc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 glass rounded-xl text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-serif">{npc.name}</span>
                  <span className="text-parchment/40 text-[10px] uppercase">{npc.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setNewNPC(npc);
                      removeNPCItem(idx);
                    }}
                    className="text-arcane hover:bg-arcane/10 p-1 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => removeNPCItem(idx)}
                    className="text-ember hover:bg-ember/10 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Nome" 
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                value={newNPC.name}
                onChange={(e) => setNewNPC({ ...newNPC, name: e.target.value })}
              />
              <input 
                type="text" 
                placeholder="Papel" 
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                value={newNPC.role}
                onChange={(e) => setNewNPC({ ...newNPC, role: e.target.value })}
              />
              <input 
                type="text" 
                placeholder="URL da Imagem" 
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                value={newNPC.image}
                onChange={(e) => setNewNPC({ ...newNPC, image: e.target.value })}
              />
              <button 
                type="button"
                onClick={addNPCItem}
                className="p-1 bg-arcane/20 text-arcane rounded-lg"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Editor */}
      <div className="space-y-4">
        <h4 className="text-xl font-serif flex items-center gap-2">
          <ImageIcon size={20} className="text-arcane" />
          Galeria de Imagens
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {formData.gallery?.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
              <img 
                src={url} 
                alt={`Gallery ${idx}`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                onClick={() => removeGalleryItem(idx)}
                className="absolute top-2 right-2 p-2 bg-ember text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-4 gap-2">
            <input 
              type="text" 
              placeholder="URL da Imagem" 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px]"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
            <button 
              type="button"
              onClick={addGalleryItem}
              className="w-full flex items-center justify-center gap-1 py-1 bg-arcane/20 text-arcane rounded-lg text-xs font-medium"
            >
              <Plus size={14} />
              Adicionar
            </button>
          </div>
        </div>
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
