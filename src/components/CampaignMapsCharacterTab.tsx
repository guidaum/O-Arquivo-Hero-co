import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Map as MapIcon, 
  Compass, 
  Skull, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Grid, 
  Layers, 
  Shield, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  BookOpen,
  Info,
  Maximize2,
  X,
  Lock,
  Scroll
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  doc 
} from '../firebase';
import { 
  CampaignMapItem, 
  resolveCampaignMaps, 
  toggleCampaignMapActive,
  getMapThumbnail,
  GENERIC_WORLD_THUMB,
  GENERIC_DUNGEON_THUMB
} from '../lib/campaignMaps';

interface CampaignMapsCharacterTabProps {
  character: any;
  characterId: string;
  activeSessionId?: string;
  session?: any;
  isGM?: boolean;
}

export default function CampaignMapsCharacterTab({
  character,
  characterId,
  activeSessionId,
  session,
  isGM = false
}: CampaignMapsCharacterTabProps) {
  const [activeTab, setActiveTab] = React.useState<'all' | 'world' | 'dungeon'>('all');
  const [customWorldMaps, setCustomWorldMaps] = React.useState<CampaignMapItem[]>([]);
  const [customDungeonMaps, setCustomDungeonMaps] = React.useState<CampaignMapItem[]>([]);
  const [sessionData, setSessionData] = React.useState<any>(session || null);
  const [previewMap, setPreviewMap] = React.useState<CampaignMapItem | null>(null);
  const [previewAsPlayer, setPreviewAsPlayer] = React.useState<boolean>(false);

  // Sync sessionData
  React.useEffect(() => {
    if (!activeSessionId) {
      setSessionData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'gameSessions', activeSessionId), (snap) => {
      if (snap.exists()) {
        setSessionData({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [activeSessionId]);

  // Load custom world maps for this session
  React.useEffect(() => {
    if (!activeSessionId) return;
    const unsub = onSnapshot(query(collection(db, 'worldMaps')), (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.sessionId === activeSessionId) {
          list.push({
            id: d.id,
            name: data.name || 'Mapa do Mundo',
            subtitle: data.subtitle || 'Mapa da campanha',
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
  }, [activeSessionId]);

  // Load custom dungeon maps for this session
  React.useEffect(() => {
    if (!activeSessionId) return;
    const unsub = onSnapshot(query(collection(db, 'dungeonMaps')), (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.sessionId === activeSessionId) {
          list.push({
            id: d.id,
            name: data.name || 'Masmorra',
            subtitle: data.subtitle || 'Mapa de batalha',
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
  }, [activeSessionId]);

  // Resolve maps for this campaign
  const campaignMaps = React.useMemo(() => {
    return resolveCampaignMaps(sessionData, customDungeonMaps, customWorldMaps);
  }, [sessionData, customDungeonMaps, customWorldMaps]);

  // Filter based on GM vs Player:
  // - GM can see all maps of this campaign (with active/inactive status)
  // - Player can ONLY see maps carrying a binding with this campaign, NEVER model maps!
  const isEffectiveGM = isGM && !previewAsPlayer;

  const availableWorldMaps = React.useMemo(() => {
    if (isEffectiveGM) return customWorldMaps;
    return customWorldMaps.filter(m => m.isCustom && m.sessionId === activeSessionId && m.active);
  }, [customWorldMaps, activeSessionId, isEffectiveGM]);

  const availableDungeonMaps = React.useMemo(() => {
    if (isEffectiveGM) return customDungeonMaps;
    return customDungeonMaps.filter(m => m.isCustom && m.sessionId === activeSessionId && m.active);
  }, [customDungeonMaps, activeSessionId, isEffectiveGM]);

  const displayedMaps = React.useMemo(() => {
    if (activeTab === 'world') return availableWorldMaps;
    if (activeTab === 'dungeon') return availableDungeonMaps;
    return [...availableWorldMaps, ...availableDungeonMaps];
  }, [activeTab, availableWorldMaps, availableDungeonMaps]);

  // If character has no campaign linked
  if (!activeSessionId) {
    return (
      <div className="glass p-8 sm:p-12 rounded-[2.5rem] border border-white/10 text-center space-y-6 max-w-2xl mx-auto shadow-2xl">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
          <Compass size={36} />
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 inline-block mb-3">
            Campanha Não Vinculada
          </span>
          <h3 className="text-2xl font-serif font-bold text-glow-arcane">
            Nenhum Mapa Disponível Fora de Campanha
          </h3>
          <p className="text-sm text-parchment/70 max-w-md mx-auto mt-2 leading-relaxed">
            De acordo com as regras do Arquivo Heroico, <strong>jogadores só visualizam os mapas da campanha vinculada ao seu personagem</strong>.
            Vincule este personagem a uma mesa com o Mestre para desbloquear os mapas de mundo e masmorras ativados por ele.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-arcane/20"
          >
            <BookOpen size={16} />
            <span>Ver Campanhas no Painel</span>
          </Link>
          <Link
            to="/journal"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-parchment/80 transition-all flex items-center justify-center gap-2"
          >
            <span>Acessar Diário de Sessão</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-arcane/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-arcane/20 to-purple-600/20 border border-arcane/40 flex items-center justify-center text-arcane shadow-xl">
              <MapIcon size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-arcane px-2.5 py-0.5 rounded-full bg-arcane/10 border border-arcane/30 font-semibold">
                  Campanha: {sessionData?.name || 'Sessão Ativa'}
                </span>
                {isGM ? (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gold px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 font-semibold flex items-center gap-1">
                    <Shield size={11} />
                    <span>{previewAsPlayer ? 'Testando Modo Jogador' : 'Visão de Mestre'}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <Shield size={11} />
                    <span>Visão de Jogador</span>
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-glow-arcane mt-1">
                Mapas da Sua Campanha
              </h2>
              <p className="text-xs text-parchment/60 mt-0.5">
                {isGM 
                  ? 'Como Mestre, você gerencia quais mapas estão ativos. Para jogadores, miniaturas genéricas protegem os segredos da aventura.'
                  : `Mapas de mundo e masmorras ativados pelo Mestre para ${character?.name || 'seu personagem'}. Miniaturas genéricas ocultam spoilers da trama.`}
              </p>
            </div>
          </div>

          {/* Quick Tabs & GM Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="glass p-1 rounded-2xl flex gap-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all",
                  activeTab === 'all' ? "bg-arcane text-obsidian shadow" : "text-parchment/50 hover:text-parchment"
                )}
              >
                Todos ({availableWorldMaps.length + availableDungeonMaps.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('world')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'world' ? "bg-arcane text-obsidian shadow" : "text-parchment/50 hover:text-parchment"
                )}
              >
                <Compass size={13} />
                <span>Mundo ({availableWorldMaps.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dungeon')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'dungeon' ? "bg-arcane text-obsidian shadow" : "text-parchment/50 hover:text-parchment"
                )}
              >
                <Skull size={13} />
                <span>Dungeons ({availableDungeonMaps.length})</span>
              </button>
            </div>

            {/* GM Mode Toggle between Real Map & Player Generic Thumb */}
            {isGM && (
              <button
                type="button"
                onClick={() => setPreviewAsPlayer(!previewAsPlayer)}
                className={cn(
                  "px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5",
                  previewAsPlayer
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md"
                    : "bg-white/5 hover:bg-white/10 text-parchment/80 border-white/10"
                )}
                title="Alternar entre ver as plantas reais do Mestre ou as miniaturas genéricas sem spoiler dos jogadores"
              >
                <Shield size={13} className={previewAsPlayer ? "text-amber-400" : "text-arcane"} />
                <span>{previewAsPlayer ? 'Voltar à Visão do Mestre' : 'Ver Como Jogador (Thumbs Genéricas)'}</span>
              </button>
            )}

            {isGM && !previewAsPlayer && (
              <Link
                to={`/map-manager?session=${activeSessionId}`}
                className="px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-parchment flex items-center gap-1.5 transition-all"
              >
                <Shield size={14} className="text-arcane" />
                <span>Gerenciador de Mapas</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Anti-Spoiler Notice Banner for Players */}
      {(!isGM || previewAsPlayer) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-3xl bg-gradient-to-r from-arcane/10 via-purple-900/10 to-obsidian border border-arcane/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-arcane/20 border border-arcane/30 flex items-center justify-center text-arcane shrink-0">
              <Shield size={18} />
            </div>
            <div>
              <p className="font-bold text-parchment flex items-center gap-1.5">
                <span>Proteção de Segredos da Aventura</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-arcane/10 text-arcane border border-arcane/20">
                  Anti-Spoiler Ativo
                </span>
              </p>
              <p className="text-parchment/70 text-[11px] mt-0.5 leading-relaxed">
                Para manter em segredo corredores, salas ocultas e armadilhas, os mapas possuem <strong>miniaturas genéricas temáticas</strong> (pergaminho selado ou portal subterrâneo). Os detalhes da área só são revelados na exploração com o grupo!
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-arcane/80 shrink-0 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            {displayedMaps.length} mapa(s) liberado(s) pelo Mestre
          </div>
        </motion.div>
      )}

      {/* Maps Grid */}
      {displayedMaps.length === 0 ? (
        <div className="p-12 text-center glass rounded-[2.5rem] border border-dashed border-white/15 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-parchment/30 mx-auto">
            <EyeOff size={32} />
          </div>
          <div>
            <h4 className="text-lg font-serif font-bold text-parchment/80">
              Nenhum mapa liberado no momento
            </h4>
            <p className="text-xs text-parchment/50 max-w-md mx-auto mt-1 leading-relaxed">
              O Mestre da campanha ainda não ativou nenhum mapa desta categoria para os jogadores.
              Assim que o Mestre liberar um mapa no Gerenciador de Mapas, ele aparecerá aqui automaticamente!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMaps.map((mapItem) => {
            const isWorld = mapItem.type === 'world';
            const targetSession = activeSessionId || mapItem.sessionId || '';
            const exploreUrl = isWorld 
              ? `/map?map=${encodeURIComponent(mapItem.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}&characterId=${characterId}` 
              : `/dungeon?map=${encodeURIComponent(mapItem.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}&characterId=${characterId}`;

            // Determina a miniatura a ser exibida:
            // - Para jogadores (ou GM no modo de prévia de jogador): SEMPRE exibe a miniatura genérica (sem spoilers)!
            // - Para o Mestre na visão normal: exibe a imagem real do mapa para controle técnico.
            const showRealThumbnail = isGM && !previewAsPlayer;
            const thumbUrl = getMapThumbnail(mapItem, showRealThumbnail);

            return (
              <motion.div
                key={mapItem.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "glass rounded-3xl border overflow-hidden transition-all duration-300 flex flex-col group relative",
                  mapItem.active 
                    ? "border-white/10 hover:border-arcane/40 hover:shadow-2xl hover:shadow-arcane/10" 
                    : "border-dashed border-amber-500/30 opacity-70"
                )}
              >
                {/* Map Preview Image / Generic Thumbnail */}
                <div className="relative h-52 bg-stone-950 overflow-hidden cursor-pointer" onClick={() => setPreviewMap(mapItem)}>
                  <img
                    src={thumbUrl}
                    alt={mapItem.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/30 to-transparent" />

                  {/* Top-Left Category Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md backdrop-blur-md",
                      isWorld 
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" 
                        : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    )}>
                      {isWorld ? <Compass size={12} /> : <Skull size={12} />}
                      {isWorld ? 'Mapa de Mundo' : 'Masmorra / Batalha'}
                    </span>
                  </div>

                  {/* Top-Right Badge: Anti-Spoiler Status OR GM Status */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {!showRealThumbnail ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider bg-obsidian/80 text-arcane border border-arcane/40 flex items-center gap-1 backdrop-blur-md shadow-md">
                        <Shield size={11} className="text-arcane" />
                        <span>Thumb Genérica</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider bg-gold/20 text-gold border border-gold/40 flex items-center gap-1 backdrop-blur-md shadow-md">
                        <Eye size={11} />
                        <span>Planta Real (Mestre)</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom Image Protective Caption */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-parchment/80 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="flex items-center gap-1.5">
                      <Lock size={11} className="text-amber-400" />
                      <span>{!showRealThumbnail ? 'Segredos Protegidos' : 'Visão Irrestrita'}</span>
                    </span>
                    <span className="text-parchment/50">
                      {!showRealThumbnail 
                        ? (isWorld ? 'Pergaminho Selado' : 'Entrada Misteriosa') 
                        : (isWorld ? 'Cartografia' : 'Grid Tático')}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-xl font-bold text-parchment group-hover:text-arcane transition-colors">
                        {mapItem.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setPreviewMap(mapItem)}
                        className="p-1 rounded-lg text-parchment/40 hover:text-arcane hover:bg-white/5 transition-colors"
                        title="Inspecionar detalhes da área"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-parchment/60 mt-1 line-clamp-2">
                      {mapItem.subtitle || 'Mapa disponível para exploração na campanha ativa.'}
                    </p>
                  </div>

                  {/* Technical Specs */}
                  <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/40 pt-2 border-t border-white/5">
                    {isWorld ? (
                      <div className="flex items-center gap-1">
                        <Layers size={12} className="text-sky-400" />
                        <span>Escala: {mapItem.defaultScale || '1 cm = 25 léguas'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Grid size={12} className="text-red-400" />
                        <span>Grid: {mapItem.gridCols || 24}x{mapItem.gridRows || 14}</span>
                      </div>
                    )}
                    {mapItem.theme && (
                      <span className="text-parchment/40 ml-auto">{mapItem.theme}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      to={exploreUrl}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-arcane/20"
                    >
                      <span>Abrir Mapa da Campanha</span>
                      <ExternalLink size={14} />
                    </Link>

                    {isGM && !previewAsPlayer && (
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleCampaignMapActive(activeSessionId, mapItem.id, mapItem.active, mapItem.isCustom, mapItem.type);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all text-xs flex items-center justify-center",
                          mapItem.active 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                        )}
                        title={mapItem.active ? "Desativar (Ocultar dos Jogadores)" : "Ativar (Liberar para Jogadores)"}
                      >
                        {mapItem.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Map Details & Inspection Modal */}
      <AnimatePresence>
        {previewMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="max-w-2xl w-full glass p-6 rounded-3xl border border-white/15 space-y-5 shadow-2xl relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setPreviewMap(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/60 hover:text-parchment transition-colors z-20"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-arcane/20 border border-arcane/30 text-arcane flex items-center justify-center shrink-0">
                  {previewMap.type === 'world' ? <Compass size={20} /> : <Skull size={20} />}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-arcane font-bold">
                    {previewMap.type === 'world' ? 'Cartografia do Mundo' : 'Masmorra & Combate'}
                  </span>
                  <h3 className="text-xl font-serif font-bold text-parchment">
                    {previewMap.name}
                  </h3>
                </div>
              </div>

              {/* Modal Map Artwork Banner */}
              <div className="relative h-64 rounded-2xl overflow-hidden border border-white/10 bg-black/70">
                <img
                  src={getMapThumbnail(previewMap, isGM && !previewAsPlayer)}
                  alt={previewMap.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-parchment/90 bg-obsidian/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                  <span className="flex items-center gap-1.5 text-arcane font-bold">
                    <Shield size={13} />
                    <span>{(!isGM || previewAsPlayer) ? 'Miniatura Genérica Sem Spoilers' : 'Planta Técnica do Mestre'}</span>
                  </span>
                  <span>{previewMap.type === 'world' ? (previewMap.defaultScale || 'Escala de Viagem') : `Grid ${previewMap.gridCols || 24}x${previewMap.gridRows || 14}`}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-parchment/80 leading-relaxed">
                  {previewMap.subtitle}
                </p>
                <p className="text-[11px] text-parchment/50 italic">
                  {(!isGM || previewAsPlayer) 
                    ? 'A miniatura genérica garante que armadilhas, rotas e segredos permaneçam desconhecidos até a exploração in-game.' 
                    : 'Como Mestre, você possui visão irrestrita de todas as salas, tokens e névoa de guerra desta área.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPreviewMap(null)}
                  className="px-4 py-2.5 rounded-xl text-xs hover:bg-white/10 text-parchment/60 transition-colors"
                >
                  Fechar
                </button>
                <Link
                  to={previewMap.type === 'world' 
                    ? `/map?map=${encodeURIComponent(previewMap.id)}${activeSessionId || previewMap.sessionId ? `&session=${encodeURIComponent(activeSessionId || previewMap.sessionId || '')}` : ''}&characterId=${characterId}` 
                    : `/dungeon?map=${encodeURIComponent(previewMap.id)}${activeSessionId || previewMap.sessionId ? `&session=${encodeURIComponent(activeSessionId || previewMap.sessionId || '')}` : ''}&characterId=${characterId}`}
                  className="px-6 py-2.5 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-[1.02] transition-transform flex items-center gap-2 shadow-lg shadow-arcane/25"
                >
                  <span>Entrar no Mapa da Campanha</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
