import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StickyNote, 
  Plus, 
  Trash2, 
  X, 
  Copy, 
  Check, 
  Pin, 
  Sparkles, 
  Feather, 
  Search, 
  AlertCircle,
  Shield,
  User,
  RefreshCw
} from 'lucide-react';
import { auth, db, doc, getDoc, updateDoc, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { cn } from '../lib/utils';

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  category: 'npc' | 'hook' | 'loot' | 'location' | 'general';
  createdAt: string;
  pinned?: boolean;
}

export interface QuickNotesProps {
  targetType?: 'character' | 'campaign' | 'general';
  targetId?: string;
  targetName?: string;
  isGM?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showFloatingButton?: boolean;
  // Optional secondary character context when GM is viewing a character sheet
  characterContext?: {
    id: string;
    name: string;
  };
}

const CATEGORIES = [
  { id: 'general', label: 'Geral', color: 'bg-parchment/20 text-parchment border-parchment/30' },
  { id: 'npc', label: 'NPC', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'hook', label: 'Gancho', color: 'bg-arcane/20 text-arcane border-arcane/30' },
  { id: 'loot', label: 'Loot/Item', color: 'bg-gold/20 text-gold border-gold/30' },
  { id: 'location', label: 'Local', color: 'bg-ember/20 text-ember border-ember/30' },
] as const;

export default function QuickNotes({
  targetType = 'general',
  targetId,
  targetName,
  isGM = false,
  isOpen: externalIsOpen,
  onOpenChange,
  showFloatingButton = true,
  characterContext
}: QuickNotesProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    setInternalIsOpen(open);
  };

  // If GM is in CharacterSheet, allow toggling scope if desired, defaulting always to 'campaign'
  const [activeScope, setActiveScope] = React.useState<'campaign' | 'character'>(
    targetType === 'campaign' ? 'campaign' : (targetType === 'character' ? 'character' : 'campaign')
  );

  React.useEffect(() => {
    if (targetType === 'campaign') {
      setActiveScope('campaign');
    } else if (targetType === 'character') {
      setActiveScope('character');
    }
  }, [targetType, targetId]);

  const effectiveType = activeScope === 'character' && characterContext ? 'character' : targetType;
  const effectiveId = (activeScope === 'character' && characterContext ? characterContext.id : targetId) || 'global';
  const effectiveName = (activeScope === 'character' && characterContext ? characterContext.name : targetName) || 'Geral';

  const user = auth.currentUser;
  const userId = user?.uid || 'guest';
  const storageKey = `heroic_quick_notes_${effectiveType}_${effectiveId}_${userId}`;

  const [notes, setNotes] = React.useState<QuickNote[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Editor state
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [newCategory, setNewCategory] = React.useState<QuickNote['category']>('general');
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Load from local storage and sync with Firestore
  React.useEffect(() => {
    let isMounted = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotes(JSON.parse(saved));
      } else {
        // Sample starter note tailored to target type
        const defaultNotes: QuickNote[] = effectiveType === 'campaign' ? [
          {
            id: 'sample-camp-1',
            title: 'Gancho da Campanha',
            content: 'Rumores na taverna indicam que as ruínas do norte guardam um artefato proibido.',
            category: 'hook',
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            pinned: true
          }
        ] : effectiveType === 'character' ? [
          {
            id: 'sample-char-1',
            title: 'Objetivo do Personagem',
            content: 'Buscar pistas sobre o paradeiro da minha família ou do meu mestre desaparecido.',
            category: 'hook',
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            pinned: true
          }
        ] : [];

        setNotes(defaultNotes);
        if (defaultNotes.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(defaultNotes));
        }
      }
    } catch (e) {
      console.warn('Failed to load notes from localStorage', e);
    }

    // Attempt to sync from Firestore if effectiveId is a real doc
    if (effectiveId && effectiveId !== 'global') {
      const collectionName = effectiveType === 'campaign' ? 'gameSessions' : effectiveType === 'character' ? 'characters' : null;
      if (collectionName) {
        const docRef = doc(db, collectionName, effectiveId);
        getDoc(docRef).then((snap) => {
          if (!isMounted || !snap.exists()) return;
          const data = snap.data();
          if (Array.isArray(data?.quickNotes) && data.quickNotes.length > 0) {
            setNotes(data.quickNotes);
            try {
              localStorage.setItem(storageKey, JSON.stringify(data.quickNotes));
            } catch (err) {
              console.warn('Error syncing quick notes to storage', err);
            }
          }
        }).catch((err) => {
          console.warn('Firestore quick notes read failed (using local cache):', err?.message || err);
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [storageKey, effectiveType, effectiveId]);

  // Save notes locally and sync to Firestore
  const saveNotes = async (updated: QuickNote[]) => {
    setNotes(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save quick notes locally', e);
    }

    // Cloud sync
    if (effectiveId && effectiveId !== 'global') {
      const collectionName = effectiveType === 'campaign' ? 'gameSessions' : effectiveType === 'character' ? 'characters' : null;
      if (collectionName) {
        setIsSyncing(true);
        try {
          await updateDoc(doc(db, collectionName, effectiveId), {
            quickNotes: updated
          });
        } catch (err: any) {
          console.warn(`Could not sync quick notes to ${collectionName}/${effectiveId} (saved locally):`, err?.message || err);
        } finally {
          setIsSyncing(false);
        }
      }
    }
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() && !newTitle.trim()) return;

    if (editingId) {
      const updated = notes.map(n => n.id === editingId ? {
        ...n,
        title: newTitle.trim() || 'Ideia sem título',
        content: newContent.trim(),
        category: newCategory,
      } : n);
      saveNotes(updated);
      setEditingId(null);
    } else {
      const newNote: QuickNote = {
        id: Date.now().toString(),
        title: newTitle.trim() || (effectiveType === 'campaign' ? 'Nota da Campanha' : 'Ideia do Personagem'),
        content: newContent.trim(),
        category: newCategory,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pinned: false
      };
      saveNotes([newNote, ...notes]);
    }

    setNewTitle('');
    setNewContent('');
    setNewCategory('general');
    setIsAdding(false);
  };

  const handleStartEdit = (note: QuickNote) => {
    setEditingId(note.id);
    setNewTitle(note.title);
    setNewContent(note.content);
    setNewCategory(note.category);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    if (editingId === id) {
      setIsAdding(false);
      setEditingId(null);
    }
  };

  const handleTogglePin = (id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    saveNotes(updated);
  };

  const handleCopyNote = (note: QuickNote) => {
    const prefix = effectiveType === 'campaign' ? `[Campanha: ${effectiveName}]` : `[Personagem: ${effectiveName}]`;
    const text = `${prefix} [${note.title}] (${note.category.toUpperCase()})\n${note.content}`;
    navigator.clipboard.writeText(text);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (notes.length === 0) return;
    const header = effectiveType === 'campaign' 
      ? `=== Anotações da Campanha: ${effectiveName} ===\n\n`
      : `=== Anotações de ${effectiveName} ===\n\n`;
    const allText = header + notes.map(n => `• [${n.title}] (${n.category.toUpperCase()} - ${n.createdAt})\n${n.content}`).join('\n\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleClearAll = () => {
    saveNotes([]);
    setIsAdding(false);
    setEditingId(null);
    setNewTitle('');
    setNewContent('');
    setIsConfirmingClear(false);
  };

  const filteredNotes = notes.filter(note => {
    const matchesTab = activeTab === 'all' || note.category === activeTab;
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <>
      {/* Floating Action Button (FAB) - Collapsed by default, reveals label on hover */}
      {showFloatingButton && (
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`Anotações Rápidas (${effectiveName})`}
          title={`Anotações Rápidas - ${effectiveType === 'campaign' ? 'Campanha: ' : 'Personagem: '}${effectiveName}`}
          className={cn(
            "fixed bottom-24 lg:bottom-8 left-4 sm:left-6 lg:left-28 z-40 flex items-center p-3 rounded-full bg-obsidian/95 border shadow-2xl backdrop-blur-md transition-all duration-300 group cursor-pointer hover:px-4 hover:rounded-2xl",
            effectiveType === 'campaign' 
              ? "border-ember/50 hover:border-ember text-parchment shadow-ember/20" 
              : "border-gold/40 hover:border-gold text-parchment shadow-gold/20"
          )}
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <Feather className={cn(
              "w-5 h-5 transition-transform duration-300 group-hover:rotate-12",
              effectiveType === 'campaign' ? "text-ember" : "text-gold"
            )} />
            {notes.length > 0 && (
              <span className={cn(
                "absolute -top-2 -right-2 text-obsidian text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md",
                effectiveType === 'campaign' ? "bg-ember" : "bg-gold"
              )}>
                {notes.length}
              </span>
            )}
          </div>
          <div className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2.5 overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap flex flex-col text-left pointer-events-none">
            <span className={cn(
              "font-serif text-xs font-bold tracking-wide leading-none",
              effectiveType === 'campaign' ? "text-ember" : "text-gold"
            )}>
              Anotações Rápidas
            </span>
            <span className="text-[9px] font-mono text-parchment/60 truncate max-w-[150px] leading-tight">
              {effectiveType === 'campaign' ? `Mestre • ${effectiveName}` : effectiveName}
            </span>
          </div>
        </motion.button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl glass-modal bg-obsidian/90 backdrop-blur-xl border border-white/25 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-surface-low/30">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-2xl border",
                    effectiveType === 'campaign'
                      ? "bg-ember/15 text-ember border-ember/30"
                      : "bg-gold/15 text-gold border-gold/30"
                  )}>
                    <Feather size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn(
                        "text-xl font-serif font-bold",
                        effectiveType === 'campaign' ? "text-ember" : "text-glow-gold"
                      )}>
                        Anotações Rápidas
                      </h3>
                      {effectiveType === 'campaign' ? (
                        <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-ember/20 border border-ember/30 text-ember font-bold flex items-center gap-1">
                          <Shield size={10} />
                          Campanha • {effectiveName} {isGM ? '(Mestre)' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-arcane/20 border border-arcane/30 text-arcane font-bold flex items-center gap-1">
                          <User size={10} />
                          Personagem • {effectiveName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-parchment/60 font-mono mt-0.5">
                      {effectiveType === 'campaign' 
                        ? `Notas, ganchos e segredos vinculados a esta campanha (${effectiveName})`
                        : `Anotações e objetivos isolados deste aventureiro (${effectiveName})`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {notes.length > 0 && (
                    <button
                      onClick={handleCopyAll}
                      title="Copiar todas as notas para a área de transferência"
                      className="p-2 rounded-xl text-parchment/60 hover:text-parchment hover:bg-white/5 transition-colors text-xs flex items-center gap-1.5 font-mono cursor-pointer"
                    >
                      {copiedAll ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      <span className="hidden sm:inline">{copiedAll ? 'Copiado!' : 'Copiar Todas'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsAdding(false);
                      setEditingId(null);
                      setIsConfirmingClear(false);
                    }}
                    className="p-2 rounded-xl text-parchment/50 hover:text-parchment hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Optional GM Scope Selector if both campaign and character context exist */}
              {isGM && characterContext && targetType === 'campaign' && (
                <div className="px-5 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-parchment/50 text-[11px]">Contexto de Anotações:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveScope('campaign')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer",
                        activeScope === 'campaign' 
                          ? "bg-ember text-obsidian font-bold shadow-sm" 
                          : "text-parchment/50 hover:text-parchment hover:bg-white/5"
                      )}
                    >
                      <Shield size={12} />
                      Campanha ({targetName})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveScope('character')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer",
                        activeScope === 'character' 
                          ? "bg-arcane text-obsidian font-bold shadow-sm" 
                          : "text-parchment/50 hover:text-parchment hover:bg-white/5"
                      )}
                    >
                      <User size={12} />
                      Personagem ({characterContext.name})
                    </button>
                  </div>
                </div>
              )}

              {/* Action Bar: New Note Button, Search, Category Tabs */}
              <div className="p-4 sm:p-5 border-b border-white/10 space-y-3 bg-surface-low/10">
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  <button
                    onClick={() => {
                      setIsAdding(!isAdding);
                      setEditingId(null);
                      setNewTitle('');
                      setNewContent('');
                      setNewCategory('general');
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer",
                      isAdding 
                        ? "bg-white/10 text-parchment border border-white/15" 
                        : effectiveType === 'campaign'
                          ? "bg-ember text-obsidian shadow-ember/20 hover:brightness-110"
                          : "bg-gold text-obsidian shadow-gold/20 hover:brightness-110"
                    )}
                  >
                    {isAdding ? <X size={15} /> : <Plus size={15} />}
                    {isAdding ? 'Cancelar Edição' : 'Nova Anotação'}
                  </button>

                  <div className="relative flex-1 sm:max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
                    <input
                      type="text"
                      placeholder="Pesquisar ideias..."
                      value={searchQuery || ''}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-parchment focus:outline-none focus:border-gold/50"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg font-mono text-[11px] whitespace-nowrap transition-all border cursor-pointer",
                      activeTab === 'all' 
                        ? "bg-white/15 text-parchment border-white/30 font-bold" 
                        : "text-parchment/40 border-transparent hover:text-parchment/70 hover:bg-white/5"
                    )}
                  >
                    Todas ({notes.length})
                  </button>
                  {CATEGORIES.map(cat => {
                    const count = notes.filter(n => n.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-mono text-[11px] whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer",
                          activeTab === cat.id 
                            ? cat.color + " font-bold" 
                            : "text-parchment/40 border-transparent hover:text-parchment/70 hover:bg-white/5"
                        )}
                      >
                        <span>{cat.label}</span>
                        {count > 0 && <span className="opacity-60 text-[9px]">({count})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note Editor Drawer / Card */}
              <AnimatePresence>
                {isAdding && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSaveNote}
                    className={cn(
                      "p-4 sm:p-5 border-b space-y-3 overflow-hidden",
                      effectiveType === 'campaign' 
                        ? "border-ember/30 bg-ember/5" 
                        : "border-gold/30 bg-gold/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-mono uppercase font-bold flex items-center gap-1.5",
                        effectiveType === 'campaign' ? "text-ember" : "text-gold"
                      )}>
                        <Sparkles size={14} />
                        {editingId ? 'Editar Anotação' : `Anotar Ideia (${effectiveType === 'campaign' ? 'Campanha' : 'Personagem'})`}
                      </span>
                      {/* Category selector */}
                      <div className="flex gap-1">
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setNewCategory(cat.id)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer",
                              newCategory === cat.id 
                                ? cat.color + " font-bold shadow-sm" 
                                : "text-parchment/40 border-white/5 hover:text-parchment/80"
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder={effectiveType === 'campaign' ? "Título do Gancho ou Evento da Campanha" : "Título do Objetivo ou Pista"}
                      value={newTitle || ''}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm font-serif font-bold text-parchment focus:outline-none focus:border-gold/50"
                      autoFocus
                    />

                    <textarea
                      placeholder={effectiveType === 'campaign' 
                        ? "Anote planos do mestre, segredos da campanha, pistas, encontros ou tesouros..." 
                        : "Anote segredos, itens de interesse, contatos ou pendências do seu herói..."}
                      value={newContent || ''}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-parchment/90 focus:outline-none focus:border-gold/50 resize-none"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setEditingId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono text-parchment/60 hover:text-parchment hover:bg-white/5 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!newContent.trim() && !newTitle.trim()}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-obsidian font-mono text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-md cursor-pointer",
                          effectiveType === 'campaign' ? "bg-ember shadow-ember/20" : "bg-gold shadow-gold/20"
                        )}
                      >
                        {editingId ? 'Atualizar Ideia' : 'Salvar Ideia'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                {filteredNotes.length === 0 ? (
                  <div className="py-12 text-center text-parchment/40 space-y-3">
                    <StickyNote size={36} className="mx-auto opacity-30 stroke-[1.5]" />
                    <p className="font-mono text-xs italic">
                      {searchQuery 
                        ? 'Nenhuma anotação encontrada com este termo.' 
                        : `Nenhuma anotação registrada para ${effectiveName}. Clique em "Nova Anotação" acima para adicionar!`
                      }
                    </p>
                  </div>
                ) : (
                  filteredNotes.map((note) => {
                    const catInfo = CATEGORIES.find(c => c.id === note.category) || CATEGORIES[0];
                    const isCopied = copiedId === note.id;

                    return (
                      <motion.div
                        key={note.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "group p-4 rounded-2xl border transition-all duration-200 relative",
                          note.pinned 
                            ? "bg-surface-high/40 border-gold/40 shadow-lg shadow-gold/5" 
                            : "bg-surface-low/30 border-white/10 hover:border-white/20 hover:bg-surface-low/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold",
                              catInfo.color
                            )}>
                              {catInfo.label}
                            </span>
                            <h4 className="font-serif font-bold text-sm text-parchment group-hover:text-glow-gold transition-colors">
                              {note.title}
                            </h4>
                            {note.pinned && (
                              <Pin size={12} className="text-gold fill-gold rotate-45" />
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleTogglePin(note.id)}
                              title={note.pinned ? "Desafixar" : "Fixar no topo"}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors cursor-pointer",
                                note.pinned ? "text-gold bg-gold/10" : "text-parchment/40 hover:text-parchment hover:bg-white/5"
                              )}
                            >
                              <Pin size={13} className={note.pinned ? "fill-gold rotate-45" : ""} />
                            </button>
                            <button
                              onClick={() => handleCopyNote(note)}
                              title="Copiar texto da nota"
                              className="p-1.5 rounded-lg text-parchment/40 hover:text-parchment hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => handleStartEdit(note)}
                              title="Editar nota"
                              className="p-1.5 rounded-lg text-parchment/40 hover:text-arcane hover:bg-white/5 transition-colors text-xs font-mono cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(note.id)}
                              title="Excluir nota"
                              className="p-1.5 rounded-lg text-parchment/40 hover:text-ember hover:bg-ember/10 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs font-mono text-parchment/80 whitespace-pre-wrap leading-relaxed select-text">
                          {note.content}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-parchment/40">
                          <span>Criado às {note.createdAt}</span>
                          {isCopied && (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check size={10} /> Copiado para a área de transferência!
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-surface-low/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-parchment/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Atribuído a: <strong className="text-parchment font-semibold">{effectiveName}</strong> ({effectiveType === 'campaign' ? 'Campanha' : 'Personagem'})
                  </span>
                  {isSyncing && (
                    <span className="flex items-center gap-1 text-[10px] text-parchment/40 animate-spin">
                      <RefreshCw size={10} />
                    </span>
                  )}
                </div>
                {notes.length > 0 && (
                  isConfirmingClear ? (
                    <div className="flex items-center gap-2 bg-ember/15 border border-ember/30 px-3 py-1 rounded-xl text-ember text-xs">
                      <AlertCircle size={14} className="shrink-0" />
                      <span className="font-semibold text-[11px]">Apagar todas as anotações?</span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-2.5 py-1 bg-ember text-obsidian font-bold rounded-lg hover:bg-ember/90 transition-colors shadow-sm text-[11px] cursor-pointer"
                      >
                        Sim, limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingClear(false)}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-parchment rounded-lg transition-colors text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClear(true)}
                      className="text-ember/80 hover:text-ember hover:bg-ember/10 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-[11px] font-mono border border-ember/20 hover:border-ember/40 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      Limpar Tudo
                    </button>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
