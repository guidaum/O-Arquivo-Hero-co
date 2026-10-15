import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Map as MapIcon, 
  Compass, 
  Skull, 
  Shield, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  Layers, 
  Grid, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Users, 
  ArrowRight,
  X,
  Sword,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc 
} from '../firebase';
import { 
  CampaignMapItem, 
  resolveCampaignMaps, 
  toggleCampaignMapActive, 
  deleteCampaignCustomMap 
} from '../lib/campaignMaps';

export default function MapManager() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = auth.currentUser;

  // Selected session ID
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(() => searchParams.get('session') || '');
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [activeSessionData, setActiveSessionData] = React.useState<any | null>(null);
  const [userRole, setUserRole] = React.useState<'user' | 'gm' | 'admin'>('user');
  const [viewMode, setViewMode] = React.useState<'user' | 'gm'>(() => {
    return (localStorage.getItem('preferredViewMode') as 'user' | 'gm') || 'user';
  });

  React.useEffect(() => {
    const handleGlobalModeChange = (e: any) => {
      const newMode = e.detail || localStorage.getItem('preferredViewMode');
      if (newMode && (newMode === 'user' || newMode === 'gm')) {
        setViewMode(newMode);
      }
    };
    window.addEventListener('viewModeChanged', handleGlobalModeChange);
    window.addEventListener('storage', handleGlobalModeChange);
    return () => {
      window.removeEventListener('viewModeChanged', handleGlobalModeChange);
      window.removeEventListener('storage', handleGlobalModeChange);
    };
  }, []);

  // Filter Tab
  const [filterType, setFilterType] = React.useState<'all' | 'world' | 'dungeon'>('all');
  const [sourceFilter, setSourceFilter] = React.useState<'all' | 'custom' | 'presets'>('custom');

  // Custom Maps from Firestore
  const [customWorldMaps, setCustomWorldMaps] = React.useState<CampaignMapItem[]>([]);
  const [customDungeonMaps, setCustomDungeonMaps] = React.useState<CampaignMapItem[]>([]);

  // Safe In-UI Map Deletion State
  const [mapToDelete, setMapToDelete] = React.useState<CampaignMapItem | null>(null);
  const [isDeletingMap, setIsDeletingMap] = React.useState(false);

  // Add Map Form State
  const [isAddingMap, setIsAddingMap] = React.useState(false);
  const [newMapType, setNewMapType] = React.useState<'world' | 'dungeon'>('world');
  const [newName, setNewName] = React.useState('');
  const [newSubtitle, setNewSubtitle] = React.useState('');
  const [newImageUrl, setNewImageUrl] = React.useState('');
  const [newScale, setNewScale] = React.useState('1 cm = 25 léguas');
  const [newGridCols, setNewGridCols] = React.useState(24);
  const [newGridRows, setNewGridRows] = React.useState(14);
  const [newTheme, setNewTheme] = React.useState('Personalizado');
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load User Role
  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserRole(snap.data().role || 'user');
      }
    });
    return () => unsub();
  }, [user]);

  // Load GM Sessions
  React.useEffect(() => {
    if (!user) return;
    const qSessions = query(collection(db, 'gameSessions'));
    const unsub = onSnapshot(qSessions, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, name: data.name || 'Sessão sem nome', gmId: data.gmId, ...data });
      });
      setSessions(list);
    });
    return () => unsub();
  }, [user]);

  // Filter sessions mastered strictly by this GM (a GM only manages their own campaigns)
  const gmSessions = React.useMemo(() => {
    return sessions.filter(s => s.gmId === user?.uid);
  }, [sessions, user]);

  // Set of session IDs mastered by this user
  const userGmSessionIds = React.useMemo(() => {
    return new Set(gmSessions.map(s => s.id));
  }, [gmSessions]);

  // Auto-select first session if none is selected or if current session doesn't belong to this GM
  React.useEffect(() => {
    if (!user) return;
    if (gmSessions.length > 0) {
      const isSelectedValid = gmSessions.some(s => s.id === selectedSessionId);
      if (!isSelectedValid) {
        setSelectedSessionId(gmSessions[0].id);
        setSearchParams({ session: gmSessions[0].id });
      }
    }
  }, [gmSessions, selectedSessionId, setSearchParams, user]);

  // Listen to active session data
  React.useEffect(() => {
    if (!selectedSessionId) {
      setActiveSessionData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'gameSessions', selectedSessionId), (snap) => {
      if (snap.exists()) {
        setActiveSessionData({ id: snap.id, ...snap.data() });
      } else {
        setActiveSessionData(null);
      }
    });
    return () => unsub();
  }, [selectedSessionId]);

  // Load Custom World Maps - Strictly limited to maps belonging to this GM
  React.useEffect(() => {
    if (!user) return;
    const qWorld = query(collection(db, 'worldMaps'));
    const unsub = onSnapshot(qWorld, (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();

        // Strict GM Ownership Filter:
        // A GM can ONLY see maps they created or that belong to a session they master
        const isOwner = data.createdBy === user.uid || 
          (data.sessionId && userGmSessionIds.has(data.sessionId));

        if (!isOwner) return; // Reject other GMs' maps

        // Campaign selection filter:
        const matchesSession = !selectedSessionId 
          ? true 
          : (data.sessionId === selectedSessionId || (!data.sessionId && data.createdBy === user.uid));

        if (matchesSession) {
          list.push({
            id: d.id,
            name: data.name || 'Mapa do Mundo Personalizado',
            subtitle: data.subtitle || 'Mapa personalizado da campanha',
            type: 'world',
            imageUrl: data.imageUrl,
            defaultScale: data.defaultScale || '1 cm = 25 léguas',
            active: data.active !== false,
            isCustom: true,
            sessionId: data.sessionId,
            createdBy: data.createdBy
          });
        }
      });
      setCustomWorldMaps(list);
    });
    return () => unsub();
  }, [user, userRole, selectedSessionId, userGmSessionIds]);

  // Load Custom Dungeon Maps - Strictly limited to maps belonging to this GM
  React.useEffect(() => {
    if (!user) return;
    const qDung = query(collection(db, 'dungeonMaps'));
    const unsub = onSnapshot(qDung, (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();

        // Strict GM Ownership Filter:
        // A GM can ONLY see maps they created or that belong to a session they master
        const isOwner = data.createdBy === user.uid || 
          (data.sessionId && userGmSessionIds.has(data.sessionId));

        if (!isOwner) return; // Reject other GMs' maps

        // Campaign selection filter:
        const matchesSession = !selectedSessionId 
          ? true 
          : (data.sessionId === selectedSessionId || (!data.sessionId && data.createdBy === user.uid));

        if (matchesSession) {
          list.push({
            id: d.id,
            name: data.name || 'Masmorra Personalizada',
            subtitle: data.subtitle || 'Mapa de batalha personalizado',
            theme: data.theme || 'Custom',
            type: 'dungeon',
            imageUrl: data.imageUrl,
            gridCols: Number(data.gridCols) || 24,
            gridRows: Number(data.gridRows) || 14,
            entranceCoord: data.entranceCoord || { x: 10, y: 50 },
            active: data.active !== false,
            isCustom: true,
            sessionId: data.sessionId,
            createdBy: data.createdBy
          });
        }
      });
      setCustomDungeonMaps(list);
    });
    return () => unsub();
  }, [user, userRole, selectedSessionId, userGmSessionIds]);

  // Resolve all campaign maps with GM activations
  const campaignMaps = React.useMemo(() => {
    return resolveCampaignMaps(activeSessionData, customDungeonMaps, customWorldMaps);
  }, [activeSessionData, customDungeonMaps, customWorldMaps]);

  const worldMaps = campaignMaps.worldMaps;
  const dungeonMaps = campaignMaps.dungeonMaps;

  // Filtered list based on tab and source
  const displayedMaps = React.useMemo(() => {
    let list = filterType === 'world' 
      ? worldMaps 
      : filterType === 'dungeon' 
        ? dungeonMaps 
        : [...worldMaps, ...dungeonMaps];

    if (sourceFilter === 'custom') {
      list = list.filter(m => m.isCustom);
    } else if (sourceFilter === 'presets') {
      list = list.filter(m => !m.isCustom);
    }
    return list;
  }, [filterType, sourceFilter, worldMaps, dungeonMaps]);

  const customCount = displayedMaps.filter(m => m.isCustom).length;
  const activeCount = displayedMaps.filter(m => m.active).length;
  const totalCount = displayedMaps.length;

  const handleToggleMap = async (map: CampaignMapItem) => {
    // Only the GM who owns the map or the campaign can toggle it
    if (!map.isCustom) {
      setStatusMessage({ type: 'error', text: 'Os modelos base são fixos. Um mestre só pode gerenciar os seus próprios mapas.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    if (map.createdBy && user && map.createdBy !== user.uid && (!map.sessionId || !userGmSessionIds.has(map.sessionId))) {
      setStatusMessage({ type: 'error', text: 'Você só pode gerenciar os mapas da sua própria campanha.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    try {
      await toggleCampaignMapActive(selectedSessionId, map.id, map.active, map.isCustom, map.type);
      setStatusMessage({
        type: 'success',
        text: `Mapa "${map.name}" foi ${!map.active ? 'ativado (visível aos jogadores)' : 'desativado (oculto dos jogadores)'}!`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling map active:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao alterar status do mapa.' });
    }
  };

  const requestDeleteCustomMap = (map: CampaignMapItem) => {
    if (map.createdBy && user && map.createdBy !== user.uid && (!map.sessionId || !userGmSessionIds.has(map.sessionId))) {
      setStatusMessage({ type: 'error', text: 'Você só pode excluir os seus próprios mapas.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    setMapToDelete(map);
  };

  const handleConfirmDeleteCustomMap = async () => {
    if (!mapToDelete) return;
    setIsDeletingMap(true);
    try {
      await deleteCampaignCustomMap(mapToDelete.id, mapToDelete.type);
      setStatusMessage({ type: 'success', text: `Mapa "${mapToDelete.name}" excluído com sucesso.` });
      setTimeout(() => setStatusMessage(null), 3000);
      setMapToDelete(null);
    } catch (err) {
      console.error('Error deleting map:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao excluir mapa.' });
    } finally {
      setIsDeletingMap(false);
    }
  };

  const handleCreateNewMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newImageUrl.trim()) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      if (newMapType === 'world') {
        await addDoc(collection(db, 'worldMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa do mundo personalizado',
          imageUrl: newImageUrl.trim(),
          defaultScale: newScale.trim() || '1 cm = 25 léguas',
          sessionId: selectedSessionId,
          active: true,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'dungeonMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa tático de batalha',
          theme: newTheme.trim() || 'Personalizado',
          imageUrl: newImageUrl.trim(),
          gridCols: Number(newGridCols) || 24,
          gridRows: Number(newGridRows) || 14,
          entranceCoord: { x: 10, y: 50 },
          sessionId: selectedSessionId,
          active: true,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      }

      setNewName('');
      setNewSubtitle('');
      setNewImageUrl('');
      setIsAddingMap(false);
      setStatusMessage({ type: 'success', text: 'Novo mapa criado e ativado com sucesso para a campanha!' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Error creating map:', err);
      setStatusMessage({ type: 'error', text: 'Falha ao salvar mapa na campanha.' });
    } finally {
      setSaving(false);
    }
  };

  const isGMAuthorized = userRole === 'admin' || (userRole === 'gm' && gmSessions.length > 0) || gmSessions.length > 0;

  // Se o usuário estiver no Modo Jogador ou não for Mestre/Admin:
  if (!isGMAuthorized || viewMode === 'user') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-obsidian text-parchment relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-8 rounded-3xl border border-white/10 text-center space-y-6 shadow-2xl relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-ember/20 border border-ember/30 text-ember mx-auto flex items-center justify-center">
            <Sword size={28} />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-ember px-3 py-1 rounded-full bg-ember/10 border border-ember/20 inline-block mb-2 font-bold">
              Modo Jogador Ativo
            </span>
            <h2 className="text-2xl font-serif font-bold text-glow-arcane">
              Acesso Exclusivo para Mestres
            </h2>
            <p className="text-xs text-parchment/70 mt-2 leading-relaxed">
              Você está no Modo Jogador. Os mapas da sua campanha ficam disponíveis diretamente na <strong>Ficha do seu Personagem</strong>.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/sheet"
              className="w-full py-3 px-4 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-arcane/20"
            >
              <span>Ver Mapas na Ficha do Personagem</span>
              <ArrowRight size={14} />
            </Link>

            {isGMAuthorized && (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('preferredViewMode', 'gm');
                  window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: 'gm' }));
                  setViewMode('gm');
                }}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-parchment/80 transition-all flex items-center justify-center gap-2"
              >
                <Shield size={14} className="text-arcane" />
                <span>Alternar para Modo Mestre</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-obsidian text-parchment space-y-6">
      {/* Top Header & Campaign Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-arcane/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-arcane/25 to-purple-600/20 border border-arcane/40 flex items-center justify-center text-arcane shadow-xl shadow-arcane/10">
            <Shield size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-glow-arcane">
                Gerenciador de Mapas do Mestre
              </h1>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-arcane/20 border border-arcane/40 text-arcane font-bold">
                Painel do Mestre
              </span>
            </div>
            <p className="text-xs text-parchment/60 mt-1 max-w-xl">
              Ative ou desative os mapas de mundo e masmorras da campanha. Os jogadores <strong>só conseguem ver os mapas ativos</strong> através da ficha do seu respectivo personagem, e <strong>com miniatura genérica temática</strong> para proteger os segredos da aventura.
            </p>
          </div>
        </div>

        {/* Campaign Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {gmSessions.length > 0 ? (
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
              <span className="text-xs font-mono uppercase text-parchment/40 px-2">Campanha:</span>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  setSearchParams({ session: e.target.value });
                }}
                className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs font-medium text-parchment focus:outline-none focus:border-arcane"
              >
                {gmSessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'Sessão'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              Nenhuma campanha encontrada como Mestre.
            </div>
          )}

          <button
            onClick={() => setIsAddingMap(!isAddingMap)}
            className="px-4 py-2 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5 shadow-lg shadow-arcane/20"
          >
            {isAddingMap ? <X size={15} /> : <Plus size={15} />}
            <span>{isAddingMap ? 'Fechar Cadastro' : 'Cadastrar Novo Mapa'}</span>
          </button>
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "p-3 rounded-2xl text-xs flex items-center gap-2 border shadow-lg",
            statusMessage.type === 'success'
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-red-500/20 border-red-500/40 text-red-300"
          )}
        >
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </motion.div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Mapas Ativos (Visíveis)</span>
          <div className="text-2xl font-bold font-serif text-emerald-400 mt-1 flex items-center gap-2">
            <Eye size={20} />
            <span>{worldMaps.filter(m => m.active).length + dungeonMaps.filter(m => m.active).length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Liberados para os jogadores</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Mapas Desativados (Ocultos)</span>
          <div className="text-2xl font-bold font-serif text-amber-400 mt-1 flex items-center gap-2">
            <EyeOff size={20} />
            <span>{worldMaps.filter(m => !m.active).length + dungeonMaps.filter(m => !m.active).length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Secretos / Em preparação</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Seus Mapas Criados</span>
          <div className="text-2xl font-bold font-serif text-amber-400 mt-1 flex items-center gap-2">
            <Sparkles size={20} />
            <span>{customWorldMaps.length + customDungeonMaps.length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Exclusivos do seu mestre</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Battlemaps & Dungeons</span>
          <div className="text-2xl font-bold font-serif text-purple-400 mt-1 flex items-center gap-2">
            <Skull size={20} />
            <span>{dungeonMaps.length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Com grade tática e tokens</span>
        </div>
      </div>

      {/* Add New Map Form (Collapsible) */}
      <AnimatePresence>
        {isAddingMap && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreateNewMap}
            className="p-6 rounded-3xl bg-white/[0.04] border border-arcane/30 space-y-4 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-arcane">
                <Plus size={18} />
                <span>Cadastrar Novo Mapa para a Campanha</span>
              </div>
              <div className="flex bg-white/5 p-1 rounded-xl text-xs border border-white/10">
                <button
                  type="button"
                  onClick={() => setNewMapType('world')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold",
                    newMapType === 'world' ? "bg-arcane text-obsidian" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Mapa do Mundo
                </button>
                <button
                  type="button"
                  onClick={() => setNewMapType('dungeon')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold",
                    newMapType === 'dungeon' ? "bg-purple-500 text-obsidian" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Battlemap / Dungeon
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Nome do Mapa *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newMapType === 'world' ? 'Ex: Reinos Perdidos de Valoria' : 'Ex: Catacumba dos Ancestrais'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Subtítulo / Descrição da Região
                </label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="Ex: Florestas místicas, picos e vales proibidos"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                URL da Imagem do Mapa * (Link direto JPG/PNG/WebP)
              </label>
              <input
                type="url"
                required
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... ou link de imagem direta"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane font-mono text-xs"
              />
            </div>

            {newMapType === 'world' ? (
              <div className="max-w-xs">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Escala do Mapa
                </label>
                <input
                  type="text"
                  value={newScale}
                  onChange={(e) => setNewScale(e.target.value)}
                  placeholder="1 cm = 30 léguas"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Tema
                  </label>
                  <input
                    type="text"
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    placeholder="Ex: Cripta, Caverna, Templo"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Colunas da Grade (X)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    value={newGridCols}
                    onChange={(e) => setNewGridCols(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Linhas da Grade (Y)
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="40"
                    value={newGridRows}
                    onChange={(e) => setNewGridRows(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAddingMap(false)}
                className="px-4 py-2 rounded-xl text-xs hover:bg-white/10 text-parchment/60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-arcane text-obsidian hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
              >
                {saving ? 'Cadastrando...' : 'Cadastrar Mapa na Campanha'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filters */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'all'
                  ? "bg-white/15 text-parchment font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Layers size={15} />
              <span>Todos</span>
            </button>

            <button
              onClick={() => setFilterType('world')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'world'
                  ? "bg-arcane text-obsidian font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Compass size={15} />
              <span>Mundo</span>
            </button>

            <button
              onClick={() => setFilterType('dungeon')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'dungeon'
                  ? "bg-purple-500 text-obsidian font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Skull size={15} />
              <span>Dungeons</span>
            </button>
          </div>

          {/* Source filters: Todos / Apenas Meus Mapas / Modelos Base */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => setSourceFilter('all')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all cursor-pointer text-xs",
                sourceFilter === 'all'
                  ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 shadow-sm"
                  : "text-parchment/50 hover:text-parchment"
              )}
            >
              Todos da Campanha
            </button>
            <button
              onClick={() => setSourceFilter('custom')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer text-xs",
                sourceFilter === 'custom'
                  ? "bg-amber-400 text-obsidian font-bold shadow-sm"
                  : "text-parchment/50 hover:text-amber-300"
              )}
            >
              <Sparkles size={13} />
              <span>Apenas Meus Mapas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/20">
                {customWorldMaps.length + customDungeonMaps.length}
              </span>
            </button>
            <button
              onClick={() => setSourceFilter('presets')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all cursor-pointer text-xs",
                sourceFilter === 'presets'
                  ? "bg-white/15 text-parchment font-bold shadow-sm"
                  : "text-parchment/50 hover:text-parchment"
              )}
            >
              Modelos Base
            </button>
          </div>
        </div>

        <div className="text-xs text-parchment/50 font-mono">
          Mostrando {displayedMaps.length} mapas • {activeCount} ativos • {customCount} criados por você
        </div>
      </div>

      {/* Map Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedMaps.map((map) => {
          const isActive = map.active;
          const isWorld = map.type === 'world';

          return (
            <motion.div
              key={map.id}
              layout
              className={cn(
                "rounded-3xl border transition-all flex flex-col justify-between overflow-hidden group shadow-xl",
                isActive
                  ? "bg-white/[0.04] border-white/15 hover:border-arcane/50"
                  : "bg-black/40 border-dashed border-white/10 opacity-70 hover:opacity-100"
              )}
            >
              <div>
                {/* Image Banner (Clickable to view map) */}
                <div 
                  onClick={() => {
                    const targetSession = map.sessionId || selectedSessionId || '';
                    if (isWorld) {
                      navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                    } else {
                      navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                    }
                  }}
                  className="relative h-48 bg-black/60 overflow-hidden border-b border-white/10 cursor-pointer group/banner"
                  title="Clique para abrir e ver este mapa"
                >
                  <img
                    src={map.imageUrl}
                    alt={map.name}
                    className={cn(
                      "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
                      !isActive && "grayscale"
                    )}
                  />

                  {/* Active / Inactive Badge */}
                  <div className="absolute top-3 left-3">
                    {isActive ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/90 text-obsidian text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                        <Eye size={13} />
                        <span>Ativo • Visível aos Jogadores</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-stone-900/90 text-amber-300 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 border border-amber-500/40 shadow-lg backdrop-blur-md">
                        <EyeOff size={13} />
                        <span>Desativado • Oculto</span>
                      </span>
                    )}
                  </div>

                  {/* Type Tag & Ownership Badge */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase shadow-lg backdrop-blur-md",
                      isWorld 
                        ? "bg-arcane/80 text-obsidian" 
                        : "bg-purple-600/80 text-white"
                    )}>
                      {isWorld ? 'Mapa do Mundo' : 'Dungeon Battlemap'}
                    </span>
                    {map.isCustom && (
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase shadow-lg backdrop-blur-md bg-amber-400/90 text-obsidian flex items-center gap-1 border border-amber-300/50">
                        <Sparkles size={10} />
                        <span>Seu Mapa</span>
                      </span>
                    )}
                  </div>

                  {/* Hover Overlay Hint */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="px-4 py-2 rounded-xl bg-obsidian/90 text-arcane text-xs font-bold border border-arcane/50 shadow-2xl flex items-center gap-2 backdrop-blur-md">
                      <ExternalLink size={14} />
                      <span>Abrir Visualizador do Mapa</span>
                    </span>
                  </div>

                  {/* Spec Bar (Bottom) */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/90 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                    <span>{isWorld ? 'Cartografia Geral' : `Grade: ${map.gridCols || 24}x${map.gridRows || 14}`}</span>
                    {map.defaultScale && <span>{map.defaultScale}</span>}
                    {map.theme && <span>{map.theme}</span>}
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-5 space-y-2">
                  <h3 
                    onClick={() => {
                      const targetSession = map.sessionId || selectedSessionId || '';
                      if (isWorld) {
                        navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      } else {
                        navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      }
                    }}
                    className="font-serif font-bold text-lg text-parchment group-hover:text-arcane transition-colors cursor-pointer hover:underline"
                    title="Clique para ver o mapa"
                  >
                    {map.name}
                  </h3>
                  <p className="text-xs text-parchment/60 line-clamp-2 leading-relaxed">
                    {map.subtitle}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-arcane/80 bg-arcane/5 border border-arcane/20 px-2.5 py-1 rounded-lg">
                    <Shield size={11} className="text-arcane" />
                    <span>Visão do Jogador: Miniatura Genérica ({isWorld ? 'Pergaminho Selado' : 'Portal da Masmorra'})</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 pt-0 border-t border-white/5 mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-3">
                  {/* Explicit Ver Mapa Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const targetSession = map.sessionId || selectedSessionId || '';
                      if (isWorld) {
                        navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      } else {
                        navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      }
                    }}
                    className="py-2.5 px-3.5 rounded-2xl bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                    title="Abrir este mapa em tela cheia"
                  >
                    <ExternalLink size={14} />
                    <span>Ver Mapa</span>
                  </button>

                  {/* Toggle Active Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleMap(map)}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer",
                      isActive
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                    )}
                  >
                    {isActive ? (
                      <>
                        <EyeOff size={14} />
                        <span className="truncate">Desativar</span>
                      </>
                    ) : (
                      <>
                        <Eye size={14} />
                        <span className="truncate">Ativar</span>
                      </>
                    )}
                  </button>

                  {/* Delete Custom Map */}
                  {map.isCustom && (
                    <button
                      type="button"
                      onClick={() => requestDeleteCustomMap(map)}
                      className="p-2.5 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Excluir este mapa personalizado"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {displayedMaps.length === 0 && (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <Layers size={40} className="mx-auto text-parchment/30 mb-3" />
          <h3 className="font-serif text-lg font-semibold text-parchment/80">Nenhum mapa encontrado</h3>
          <p className="text-xs text-parchment/40 mt-1 max-w-sm mx-auto">
            Não há mapas cadastrados para os filtros selecionados. Clique no botão de cadastrar novo mapa para começar.
          </p>
        </div>
      )}

      {/* Delete Custom Map Confirmation Modal */}
      <AnimatePresence>
        {mapToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-obsidian border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-parchment"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-white mb-1">
                    Excluir Mapa
                  </h3>
                  <p className="text-xs text-parchment/60 font-mono">
                    Ação irreversível de mestre
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 mb-6 text-xs">
                <p>
                  Tem certeza que deseja excluir o mapa personalizado <strong>"{mapToDelete.name}"</strong>?
                </p>
                <p className="text-parchment/50">
                  Este mapa será removido permanentemente e os jogadores não poderão mais acessá-lo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMapToDelete(null)}
                  disabled={isDeletingMap}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCustomMap}
                  disabled={isDeletingMap}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingMap ? 'Excluindo...' : 'Sim, Excluir Mapa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
