import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Map as MapIcon, 
  Skull, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Shield, 
  Compass, 
  Grid,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Upload,
  Ratio,
  Loader2
} from 'lucide-react';
import { cn, compressImageFile, compressDataUrl } from '../lib/utils';
import { db, collection, addDoc, auth } from '../firebase';
import { 
  CampaignMapItem, 
  toggleCampaignMapActive, 
  deleteCampaignCustomMap 
} from '../lib/campaignMaps';

interface CampaignMapManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  worldMaps: CampaignMapItem[];
  dungeonMaps: CampaignMapItem[];
  onSelectMap?: (type: 'world' | 'dungeon', mapId: string) => void;
}

export default function CampaignMapManagerModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  worldMaps,
  dungeonMaps,
  onSelectMap
}: CampaignMapManagerModalProps) {
  const [activeTab, setActiveTab] = React.useState<'world' | 'dungeon'>('world');
  const [isAddingMap, setIsAddingMap] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // New Map Form State
  const [newMapType, setNewMapType] = React.useState<'world' | 'dungeon'>('world');
  const [newName, setNewName] = React.useState('');
  const [newSubtitle, setNewSubtitle] = React.useState('');
  const [newImageUrl, setNewImageUrl] = React.useState('');
  const [newScale, setNewScale] = React.useState('1 cm = 25 léguas');
  const [newGridCols, setNewGridCols] = React.useState(24);
  const [newGridRows, setNewGridRows] = React.useState(14);
  const [newTheme, setNewTheme] = React.useState('Personalizado');
  const [detectedDimensions, setDetectedDimensions] = React.useState<{ width: number; height: number; ratioStr: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Measure Image Dimensions and Auto-calculate Grid
  const measureImageDimensions = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;
      let ratioStr = `${w} × ${h}`;
      if (Math.abs(ratio - 16 / 9) < 0.15) ratioStr += ' (16:9)';
      else if (Math.abs(ratio - 1) < 0.15) ratioStr += ' (1:1 Quadrado)';
      else if (Math.abs(ratio - 21 / 9) < 0.2) ratioStr += ' (21:9 Panorâmico)';
      else if (ratio < 0.8) ratioStr += ' (Vertical)';

      setDetectedDimensions({ width: w, height: h, ratioStr });

      if (newMapType === 'dungeon') {
        if (ratio >= 1.5) {
          setNewGridCols(24);
          setNewGridRows(14);
        } else if (ratio >= 0.85 && ratio <= 1.25) {
          setNewGridCols(24);
          setNewGridRows(24);
        } else if (ratio < 0.85) {
          setNewGridCols(14);
          setNewGridRows(24);
        }
      }
    };
    img.src = url;
  };

  const [isCompressing, setIsCompressing] = React.useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    setIsCompressing(true);
    setErrorMsg(null);
    try {
      const compressedDataUrl = await compressImageFile(file, 1920, 1080, 0.82);
      setNewImageUrl(compressedDataUrl);
      measureImageDimensions(compressedDataUrl);
      if (!newName.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err) {
      console.error('Error compressing map file:', err);
      setErrorMsg('Erro ao processar imagem.');
    } finally {
      setIsCompressing(false);
    }
  };

  if (!isOpen) return null;

  const currentList = activeTab === 'world' ? worldMaps : dungeonMaps;
  const activeCount = currentList.filter(m => m.active).length;

  const handleToggle = async (map: CampaignMapItem) => {
    try {
      await toggleCampaignMapActive(sessionId, map.id, map.active, map.isCustom, map.type);
    } catch (err: any) {
      console.error('Failed to toggle map active state:', err);
      setErrorMsg('Erro ao alterar status do mapa. Verifique a conexão.');
    }
  };

  const handleDelete = async (map: CampaignMapItem) => {
    const user = auth.currentUser;
    if (map.createdBy && user && map.createdBy !== user.uid) {
      setErrorMsg('Você só pode excluir os seus próprios mapas.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o mapa "${map.name}"?`)) return;
    try {
      await deleteCampaignCustomMap(map.id, map.type);
    } catch (err: any) {
      console.error('Failed to delete custom map:', err);
      setErrorMsg('Erro ao excluir mapa customizado.');
    }
  };

  const handleCreateNewMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newImageUrl.trim()) {
      setErrorMsg('Preencha o nome e o link da imagem do mapa.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const user = auth.currentUser;
      const finalImg = await compressDataUrl(newImageUrl.trim(), 1920, 1080, 0.82);

      if (newMapType === 'world') {
        await addDoc(collection(db, 'worldMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa do mundo da campanha',
          imageUrl: finalImg,
          defaultScale: newScale.trim() || '1 cm = 25 léguas',
          sessionId,
          active: true,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'dungeonMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa de batalha tático criado pelo Mestre',
          theme: newTheme.trim() || 'Personalizado',
          imageUrl: finalImg,
          gridCols: Number(newGridCols) || 24,
          gridRows: Number(newGridRows) || 14,
          entranceCoord: { x: 10, y: 50 },
          sessionId,
          active: true,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      }

      // Reset form
      setNewName('');
      setNewSubtitle('');
      setNewImageUrl('');
      setDetectedDimensions(null);
      setIsAddingMap(false);
      setActiveTab(newMapType);
    } catch (err: any) {
      console.error('Failed to create new custom map:', err);
      setErrorMsg('Falha ao salvar mapa na campanha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl max-h-[90vh] bg-obsidian border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-parchment"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-arcane/20 border border-arcane/40 flex items-center justify-center text-arcane shadow-lg shadow-arcane/10">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold tracking-wide">
                  Gerenciamento de Mapas da Campanha
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-arcane/15 border border-arcane/30 text-arcane font-semibold">
                  Mestre
                </span>
              </div>
              <p className="text-xs text-parchment/60 mt-0.5">
                Campanha ativa: <span className="text-arcane font-medium">{sessionName || 'Sessão Atual'}</span> • Ative ou desative os mapas visíveis para os jogadores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-parchment/50 hover:text-parchment hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Informative Rule Banner */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-arcane/15 via-purple-500/10 to-transparent border-b border-white/5 flex items-center gap-2 text-xs text-parchment/80">
          <Sparkles size={14} className="text-arcane shrink-0" />
          <span>
            <strong>Controle do Mestre:</strong> Os jogadores só conseguem acessar e visualizar os mapas que estiverem marcados como 
            <span className="text-emerald-400 font-semibold mx-1">Ativo</span>. Mapas marcados como 
            <span className="text-amber-400 font-semibold mx-1">Desativado</span> ficam ocultos aos jogadores.
          </span>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Controls & Add Map Button */}
        <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5">
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => { setActiveTab('world'); setIsAddingMap(false); }}
              className={cn(
                "px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
                activeTab === 'world'
                  ? "bg-arcane text-obsidian shadow-md font-bold"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Compass size={15} />
              <span>Mapas do Mundo</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === 'world' ? "bg-obsidian/30 text-obsidian" : "bg-white/10 text-parchment/60"
              )}>
                {worldMaps.filter(m => m.active).length}/{worldMaps.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('dungeon'); setIsAddingMap(false); }}
              className={cn(
                "px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
                activeTab === 'dungeon'
                  ? "bg-purple-500 text-obsidian shadow-md font-bold"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Skull size={15} />
              <span>Mapas de Masmorra (Dungeons)</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === 'dungeon' ? "bg-obsidian/30 text-obsidian" : "bg-white/10 text-parchment/60"
              )}>
                {dungeonMaps.filter(m => m.active).length}/{dungeonMaps.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              setIsAddingMap(!isAddingMap);
              setNewMapType(activeTab);
            }}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md",
              isAddingMap
                ? "bg-white/10 text-parchment border border-white/20"
                : "bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/40"
            )}
          >
            {isAddingMap ? <X size={14} /> : <Plus size={14} />}
            <span>{isAddingMap ? 'Cancelar Cadastro' : `Adicionar ${activeTab === 'world' ? 'Mapa do Mundo' : 'Dungeon'}`}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add New Map Form Accordion */}
          <AnimatePresence>
            {isAddingMap && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateNewMap}
                className="p-5 rounded-2xl bg-white/[0.04] border border-arcane/30 space-y-4 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-arcane">
                    <Plus size={16} />
                    <span>Novo Mapa para a Campanha ({newMapType === 'world' ? 'Mundo' : 'Dungeon'})</span>
                  </div>
                  <div className="flex bg-white/5 p-1 rounded-xl text-xs border border-white/10">
                    <button
                      type="button"
                      onClick={() => setNewMapType('world')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg",
                        newMapType === 'world' ? "bg-arcane text-obsidian font-bold" : "text-parchment/60"
                      )}
                    >
                      Mundo
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMapType('dungeon')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg",
                        newMapType === 'dungeon' ? "bg-purple-500 text-obsidian font-bold" : "text-parchment/60"
                      )}
                    >
                      Dungeon
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
                      placeholder={newMapType === 'world' ? 'Ex: Floresta Proibida de Eldoria' : 'Ex: Catacumba dos Esquecidos'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Subtítulo / Descrição Curta
                    </label>
                    <input
                      type="text"
                      value={newSubtitle}
                      onChange={(e) => setNewSubtitle(e.target.value)}
                      placeholder="Ex: Pântanos traiçoeiros e ruínas esquecidas"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>
                </div>

                {/* Image Source Selection: URL or Local File */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60">
                      Imagem do Mapa * (Arquivo local ou Link direto)
                    </label>
                    {detectedDimensions && (
                      <span className="text-[10px] font-mono text-arcane bg-arcane/10 border border-arcane/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Ratio size={11} />
                        <span>Dimensão detectada: <strong>{detectedDimensions.ratioStr}</strong></span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-8">
                      <input
                        type="url"
                        value={newImageUrl.startsWith('data:') ? '' : newImageUrl}
                        onChange={(e) => {
                          setNewImageUrl(e.target.value);
                          measureImageDimensions(e.target.value);
                        }}
                        placeholder="Cole um link direto JPG/PNG/WebP ou use o botão ao lado"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-arcane font-mono"
                      />
                    </div>

                    <div className="sm:col-span-4 flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-parchment border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload size={14} className="text-arcane" />
                        <span>Enviar Arquivo</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview image thumbnail if available */}
                  {newImageUrl && (
                    <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex items-center justify-center group">
                      <img src={newImageUrl} alt="Prévia do Mapa" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setNewImageUrl('');
                            setDetectedDimensions(null);
                          }}
                          className="px-3 py-1 rounded-lg bg-rose-500/80 text-white text-xs font-semibold"
                        >
                          Remover Imagem
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {newMapType === 'world' ? (
                  <div className="max-w-xs">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Escala Estimada
                    </label>
                    <input
                      type="text"
                      value={newScale}
                      onChange={(e) => setNewScale(e.target.value)}
                      placeholder="1 cm = 25 léguas"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Tema / Atmosfera
                        </label>
                        <input
                          type="text"
                          value={newTheme}
                          onChange={(e) => setNewTheme(e.target.value)}
                          placeholder="Ex: Cripta, Ruína, Caverna"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Colunas do Grid (X)
                        </label>
                        <input
                          type="number"
                          min="6"
                          max="80"
                          value={newGridCols}
                          onChange={(e) => setNewGridCols(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Linhas do Grid (Y)
                        </label>
                        <input
                          type="number"
                          min="6"
                          max="60"
                          value={newGridRows}
                          onChange={(e) => setNewGridRows(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane"
                        />
                      </div>
                    </div>

                    {/* Grid Presets for Battlemaps */}
                    <div>
                      <span className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
                        Atalhos de Proporção da Grade:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { label: '16:9 Padrão (24×14)', cols: 24, rows: 14 },
                          { label: 'Quadrado 1:1 (24×24)', cols: 24, rows: 24 },
                          { label: 'Vertical 9:16 (14×24)', cols: 14, rows: 24 },
                          { label: 'Panorâmico 21:9 (32×12)', cols: 32, rows: 12 },
                          { label: 'Grande (36×20)', cols: 36, rows: 20 },
                          { label: 'Épico (48×28)', cols: 48, rows: 28 },
                        ].map(p => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              setNewGridCols(p.cols);
                              setNewGridRows(p.rows);
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border",
                              newGridCols === p.cols && newGridRows === p.rows
                                ? "bg-purple-500/30 text-purple-200 border-purple-400 font-bold"
                                : "bg-white/5 text-parchment/60 hover:text-white border-white/10"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
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
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-arcane text-obsidian hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {saving ? 'Salvando...' : 'Salvar Mapa na Campanha'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Maps for Current Tab */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentList.map((map) => {
              const isActive = map.active;
              return (
                <div
                  key={map.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between group",
                    isActive
                      ? "bg-white/[0.04] border-white/15 hover:border-arcane/40 shadow-sm"
                      : "bg-black/40 border-dashed border-white/10 opacity-75 hover:opacity-100"
                  )}
                >
                  <div>
                    {/* Image Preview & Status Badge */}
                    <div className="relative h-36 rounded-xl overflow-hidden bg-black/60 mb-3 border border-white/10">
                      <img
                        src={map.imageUrl}
                        alt={map.name}
                        className={cn(
                          "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
                          !isActive && "grayscale"
                        )}
                      />
                      
                      {/* Active Status Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-obsidian text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 shadow-lg backdrop-blur-sm">
                            <Eye size={12} />
                            <span>Ativo • Visível</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-stone-900/90 text-amber-300 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 border border-amber-500/40 shadow-lg backdrop-blur-sm">
                            <EyeOff size={12} />
                            <span>Desativado • Oculto</span>
                          </span>
                        )}
                      </div>

                      {/* Custom Map Tag */}
                      {map.isCustom && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-arcane/80 text-obsidian text-[9px] font-mono font-bold uppercase shadow">
                            Personalizado
                          </span>
                        </div>
                      )}

                      {/* Map Specific Spec Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-mono text-white/80 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span>{map.type === 'world' ? 'Mundo' : `Grid: ${map.gridCols || 24}x${map.gridRows || 14}`}</span>
                        {map.defaultScale && <span>{map.defaultScale}</span>}
                        {map.theme && <span>{map.theme}</span>}
                      </div>
                    </div>

                    {/* Title & Info */}
                    <div>
                      <h4 className="font-serif font-bold text-base text-parchment group-hover:text-arcane transition-colors">
                        {map.name}
                      </h4>
                      <p className="text-xs text-parchment/60 line-clamp-2 mt-0.5">
                        {map.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggle(map)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm",
                        isActive
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                      )}
                    >
                      {isActive ? (
                        <>
                          <EyeOff size={14} />
                          <span>Desativar para Jogadores</span>
                        </>
                      ) : (
                        <>
                          <Eye size={14} />
                          <span>Ativar para Jogadores</span>
                        </>
                      )}
                    </button>

                    {/* Open/Select Map in view */}
                    {onSelectMap && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMap(map.type, map.id);
                          onClose();
                        }}
                        className="py-2 px-3 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-parchment/80 hover:text-parchment border border-white/10 transition-colors"
                        title="Abrir este mapa na tela"
                      >
                        Abrir
                      </button>
                    )}

                    {/* Delete Custom Map */}
                    {map.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDelete(map)}
                        className="p-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir este mapa personalizado da campanha"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {currentList.length === 0 && (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
              <Layers size={32} className="mx-auto text-parchment/30 mb-2" />
              <p className="text-sm font-medium text-parchment/70">Nenhum mapa cadastrado nesta categoria</p>
              <p className="text-xs text-parchment/40 mt-1">Clique no botão "Adicionar" acima para cadastrar o primeiro mapa.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-parchment/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sincronização em tempo real com todos os jogadores da campanha</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment font-medium transition-colors"
          >
            Concluir
          </button>
        </div>
      </motion.div>
    </div>
  );
}
