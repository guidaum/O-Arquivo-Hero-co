import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Square, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Sliders, 
  Music, 
  Dices, 
  ShieldAlert, 
  Flame, 
  Award, 
  Zap, 
  Save, 
  Radio, 
  Swords, 
  Shield, 
  Crosshair, 
  Heart, 
  Footprints, 
  Compass, 
  Coins, 
  FolderLock, 
  Skull, 
  TrendingUp, 
  Layers, 
  Filter, 
  Plus, 
  Search, 
  Share2, 
  X,
  FileAudio,
  CloudRain
} from 'lucide-react';
import { 
  SoundConfig, 
  SoundEffectType, 
  SOUND_PRESETS, 
  DEFAULT_SOUNDS, 
  playSoundEffect, 
  playRollOutcomeSound, 
  playSystemSound,
  stopActiveAudio,
  convertAudioFileToDataUrl,
  RollOutcome
} from '../lib/soundEngine';
import { 
  SYSTEM_SOUND_DEFINITIONS, 
  CATEGORY_LABELS, 
  SoundCategory, 
  CustomSoundItem 
} from '../types/soundManager';
import { 
  atmospherePlayer, 
  AtmosphereType, 
  ATMOSPHERE_PRESETS 
} from '../lib/atmosphereEngine';
import { 
  auth, 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from '../firebase';
import { cn } from '../lib/utils';

interface SoundEffectManagerProps {
  currentSettings: SoundConfig;
  sessionName?: string;
  sessionId?: string;
  isGlobalMode?: boolean;
  onSaveSession?: (sounds: SoundConfig, alsoSaveGlobal: boolean) => Promise<void>;
  onSaveGlobal?: (sounds: SoundConfig) => Promise<void>;
  onUpdateSound?: (key: string, value: string) => void;
  onClose?: () => void;
}

// Icon helper by sound category
const getCategoryIcon = (category: SoundCategory) => {
  switch (category) {
    case 'dice': return Dices;
    case 'combat': return Swords;
    case 'magic': return Sparkles;
    case 'dungeon': return Compass;
    case 'system': return Radio;
    case 'ambient': return CloudRain;
    default: return Music;
  }
};

export default function SoundEffectManager({
  currentSettings,
  sessionName,
  sessionId,
  isGlobalMode = false,
  onSaveSession,
  onSaveGlobal,
  onUpdateSound,
  onClose
}: SoundEffectManagerProps) {
  const user = auth.currentUser;

  // Active Sound configuration state
  const [sounds, setSounds] = React.useState<SoundConfig>(() => ({
    ...DEFAULT_SOUNDS,
    ...currentSettings
  }));

  // Ambient soundscape customization state
  const [customAmbientUrl, setCustomAmbientUrl] = React.useState<string>(
    currentSettings.customAmbientSound || ''
  );
  const [customAmbientName, setCustomAmbientName] = React.useState<string>(
    currentSettings.customAmbientName || ''
  );
  const [ambientVolume, setAmbientVolume] = React.useState<number>(0.5);
  const [isPlayingAmbient, setIsPlayingAmbient] = React.useState<boolean>(false);
  const [selectedProceduralPreset, setSelectedProceduralPreset] = React.useState<AtmosphereType>('dungeon_rain');

  // Navigation & Category Filtering
  const [activeTab, setActiveTab] = React.useState<SoundCategory | 'library' | 'upload_new'>('dice');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [libraryFilter, setLibraryFilter] = React.useState<'all' | 'session' | 'my'>('all');

  // Playback & UI States
  const [activePlayingKey, setActivePlayingKey] = React.useState<string | null>(null);
  const [uploadLoadingKey, setUploadLoadingKey] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [alsoSaveGlobal, setAlsoSaveGlobal] = React.useState(true);
  const [testVolume, setTestVolume] = React.useState<number>(0.6);

  // Sound Library collection from Firestore
  const [soundLibrary, setSoundLibrary] = React.useState<CustomSoundItem[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = React.useState(true);

  // New Sound Form state (Direct Upload to Library)
  const [newSoundForm, setNewSoundForm] = React.useState({
    name: '',
    category: 'combat' as SoundCategory,
    type: 'sfx' as 'sfx' | 'ambient',
    url: '',
    dataUrl: '',
    format: 'MP3',
    size: 0,
    scope: 'session' as 'session' | 'global',
    targetSlot: 'attackSound'
  });
  const [newSoundFile, setNewSoundFile] = React.useState<File | null>(null);
  const [isSubmittingNewSound, setIsSubmittingNewSound] = React.useState(false);

  // Assign popover state
  const [assigningSoundItem, setAssigningSoundItem] = React.useState<CustomSoundItem | null>(null);

  // Sync state when props change
  React.useEffect(() => {
    setSounds({
      ...DEFAULT_SOUNDS,
      ...currentSettings
    });
    if (currentSettings.customAmbientSound) {
      setCustomAmbientUrl(currentSettings.customAmbientSound);
    }
    if (currentSettings.customAmbientName) {
      setCustomAmbientName(currentSettings.customAmbientName);
    }
  }, [currentSettings]);

  // Load Sound Library from Firestore
  React.useEffect(() => {
    if (!user) {
      setIsLibraryLoading(false);
      return;
    }

    const qSounds = query(collection(db, 'customSounds'));
    const unsubscribe = onSnapshot(qSounds, (snap) => {
      const items: CustomSoundItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        items.push({
          id: d.id,
          name: data.name || 'Som Personalizado',
          category: data.category || 'combat',
          type: data.type || 'sfx',
          sourceType: data.sourceType || 'url',
          url: data.url || '',
          size: data.size,
          format: data.format || 'MP3',
          duration: data.duration,
          sessionId: data.sessionId,
          sessionName: data.sessionName,
          userId: data.userId || '',
          userName: data.userName,
          systemSoundKey: data.systemSoundKey,
          createdAt: data.createdAt || new Date().toISOString()
        });
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSoundLibrary(items);
      setIsLibraryLoading(false);
    }, (err) => {
      console.warn('Error loading custom sound library:', err);
      setIsLibraryLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle slot audio update
  const handleSoundChange = (key: string, value: string) => {
    setSounds(prev => ({ ...prev, [key]: value }));
    if (onUpdateSound) {
      onUpdateSound(key, value);
    }
  };

  // Test sound effect playback
  const handleTestSound = (key: string, soundUrl?: string) => {
    if (activePlayingKey === key) {
      stopActiveAudio();
      setActivePlayingKey(null);
      return;
    }

    stopActiveAudio();
    setActivePlayingKey(key);
    const urlToPlay = soundUrl || sounds[key] || DEFAULT_SOUNDS[key as keyof typeof DEFAULT_SOUNDS];
    const audio = playSoundEffect(key as SoundEffectType, urlToPlay, testVolume);

    if (audio) {
      audio.onended = () => {
        setActivePlayingKey(null);
      };
    } else {
      setTimeout(() => {
        setActivePlayingKey(null);
      }, 700);
    }
  };

  // Simulate roll outcome sound
  const handleSimulateOutcome = (outcome: RollOutcome) => {
    stopActiveAudio();
    const key = outcome === 'critical' ? 'criticalSound' :
      outcome === 'fumble' ? 'fumbleSound' :
      outcome === 'success' ? 'successSound' : 'failureSound';

    setActivePlayingKey(key);
    playRollOutcomeSound(outcome, sounds, testVolume);
    setTimeout(() => {
      setActivePlayingKey(null);
    }, 1200);
  };

  // Upload file for a specific sound slot (MP3 or WAV)
  const handleFileUpload = async (key: string, file: File, slotName: string, category: SoundCategory) => {
    setUploadError(null);
    setUploadLoadingKey(key);
    try {
      const result = await convertAudioFileToDataUrl(file);
      handleSoundChange(key, result.dataUrl);

      // Save to Firestore sound library for reuse across campaigns and by user
      if (user) {
        await addDoc(collection(db, 'customSounds'), {
          name: `${slotName} (${result.name.replace(/\.[^/.]+$/, "")})`,
          category,
          type: 'sfx',
          sourceType: 'upload',
          url: result.dataUrl,
          size: result.size,
          format: result.format,
          sessionId: sessionId || '',
          sessionName: sessionName || 'Campanha Ativa',
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'Mestre',
          systemSoundKey: key,
          createdAt: new Date().toISOString()
        });
      }

      setSaveStatus({
        type: 'success',
        message: `Áudio "${result.name}" (${(result.size / 1024).toFixed(0)} KB) carregado e salvo na biblioteca!`
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao carregar arquivo de áudio.');
    } finally {
      setUploadLoadingKey(null);
    }
  };

  // Upload custom ambient track
  const handleAmbientUpload = async (file: File) => {
    setUploadError(null);
    setUploadLoadingKey('ambient');
    try {
      const result = await convertAudioFileToDataUrl(file);
      setCustomAmbientUrl(result.dataUrl);
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setCustomAmbientName(cleanName);

      // Save to library
      if (user) {
        await addDoc(collection(db, 'customSounds'), {
          name: `Trilha: ${cleanName}`,
          category: 'ambient',
          type: 'ambient',
          sourceType: 'upload',
          url: result.dataUrl,
          size: result.size,
          format: result.format,
          sessionId: sessionId || '',
          sessionName: sessionName || 'Campanha Ativa',
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'Mestre',
          createdAt: new Date().toISOString()
        });
      }

      setSaveStatus({
        type: 'success',
        message: `Ambiência "${result.name}" carregada com sucesso!`
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao carregar trilha de áudio.');
    } finally {
      setUploadLoadingKey(null);
    }
  };

  // Play/Test ambient track preview
  const handleToggleAmbientPreview = () => {
    if (isPlayingAmbient) {
      atmospherePlayer.stop();
      setIsPlayingAmbient(false);
    } else {
      atmospherePlayer.setVolume(ambientVolume);
      if (customAmbientUrl) {
        atmospherePlayer.playCustomTrack(customAmbientUrl, customAmbientName || 'Ambiência Personalizada');
      } else {
        atmospherePlayer.play(selectedProceduralPreset);
      }
      setIsPlayingAmbient(true);
    }
  };

  // Assign sound from library to a system sound slot
  const handleAssignSoundToSlot = (item: CustomSoundItem, slotKey: string) => {
    if (slotKey === 'customAmbientSound') {
      setCustomAmbientUrl(item.url);
      setCustomAmbientName(item.name);
    } else {
      handleSoundChange(slotKey, item.url);
    }
    setAssigningSoundItem(null);
    setSaveStatus({
      type: 'success',
      message: `Som "${item.name}" vinculado a "${slotKey}" com sucesso!`
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Delete sound from library
  const handleDeleteFromLibrary = async (soundId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este som da sua biblioteca?')) return;
    try {
      await deleteDoc(doc(db, 'customSounds', soundId));
      setSaveStatus({ type: 'success', message: 'Som removido da biblioteca.' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: 'Erro ao remover som.' });
    }
  };

  // Create new sound item in library directly
  const handleCreateNewSoundInLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newSoundForm.name.trim()) {
      setUploadError('Informe um nome para o som.');
      return;
    }

    let finalUrl = newSoundForm.url.trim();
    let finalFormat = newSoundForm.format;
    let finalSize = newSoundForm.size;

    if (newSoundFile) {
      try {
        setIsSubmittingNewSound(true);
        const result = await convertAudioFileToDataUrl(newSoundFile);
        finalUrl = result.dataUrl;
        finalFormat = result.format;
        finalSize = result.size;
      } catch (err: any) {
        setUploadError(err.message || 'Falha ao processar arquivo.');
        setIsSubmittingNewSound(false);
        return;
      }
    }

    if (!finalUrl) {
      setUploadError('Forneça um link de áudio (MP3/WAV) ou envie um arquivo.');
      setIsSubmittingNewSound(false);
      return;
    }

    try {
      setIsSubmittingNewSound(true);
      await addDoc(collection(db, 'customSounds'), {
        name: newSoundForm.name.trim(),
        category: newSoundForm.category,
        type: newSoundForm.type,
        sourceType: newSoundFile ? 'upload' : 'url',
        url: finalUrl,
        size: finalSize,
        format: finalFormat,
        sessionId: newSoundForm.scope === 'session' ? (sessionId || '') : '',
        sessionName: newSoundForm.scope === 'session' ? (sessionName || 'Campanha') : 'Global',
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Mestre',
        systemSoundKey: newSoundForm.targetSlot || '',
        createdAt: new Date().toISOString()
      });

      // Optionally assign immediately
      if (newSoundForm.targetSlot) {
        if (newSoundForm.targetSlot === 'customAmbientSound') {
          setCustomAmbientUrl(finalUrl);
          setCustomAmbientName(newSoundForm.name.trim());
        } else {
          handleSoundChange(newSoundForm.targetSlot, finalUrl);
        }
      }

      setNewSoundForm({
        name: '',
        category: 'combat',
        type: 'sfx',
        url: '',
        dataUrl: '',
        format: 'MP3',
        size: 0,
        scope: 'session',
        targetSlot: 'attackSound'
      });
      setNewSoundFile(null);
      setActiveTab('library');
      setSaveStatus({ type: 'success', message: 'Novo som cadastrado e pronto para uso!' });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao salvar novo som.');
    } finally {
      setIsSubmittingNewSound(false);
    }
  };

  // Reset a sound slot to default
  const handleResetToDefault = (key: string) => {
    const defaultVal = (DEFAULT_SOUNDS as any)[key] || '';
    handleSoundChange(key, defaultVal);
  };

  // Reset all system sounds
  const handleResetAll = () => {
    setSounds({ ...DEFAULT_SOUNDS });
    setCustomAmbientUrl('');
    setCustomAmbientName('');
    if (onUpdateSound) {
      Object.entries(DEFAULT_SOUNDS).forEach(([k, v]) => {
        onUpdateSound(k, v || '');
      });
    }
    setSaveStatus({
      type: 'success',
      message: 'Todos os sons do sistema foram restaurados para os padrões!'
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Save all settings to Firestore
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const payload: SoundConfig = {
        ...sounds,
        customAmbientSound: customAmbientUrl,
        customAmbientName: customAmbientName
      };

      if (isGlobalMode) {
        if (onSaveGlobal) {
          await onSaveGlobal(payload);
          setSaveStatus({ type: 'success', message: 'Configuração sonora global salva com sucesso!' });
        }
      } else {
        if (onSaveSession) {
          await onSaveSession(payload, alsoSaveGlobal);
          setSaveStatus({ 
            type: 'success', 
            message: alsoSaveGlobal 
              ? 'Sons salvos nesta campanha e sincronizados com a biblioteca global!' 
              : 'Sons salvos com sucesso nesta campanha!' 
          });
        }
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Erro ao salvar efeitos sonoros.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Filtered system sounds
  const filteredSounds = React.useMemo(() => {
    return SYSTEM_SOUND_DEFINITIONS.filter(def => {
      if (activeTab !== 'library' && activeTab !== 'upload_new' && activeTab !== 'ambient') {
        if (def.category !== activeTab) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return def.name.toLowerCase().includes(q) || 
               def.description.toLowerCase().includes(q) || 
               def.badge.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeTab, searchQuery]);

  // Filtered Sound Library items
  const filteredLibrary = React.useMemo(() => {
    return soundLibrary.filter(item => {
      // Campaign vs User filter
      if (libraryFilter === 'session') {
        if (sessionId && item.sessionId !== sessionId) return false;
      } else if (libraryFilter === 'my') {
        if (user && item.userId !== user.uid) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || 
               item.category.toLowerCase().includes(q) ||
               (item.sessionName && item.sessionName.toLowerCase().includes(q));
      }
      return true;
    });
  }, [soundLibrary, libraryFilter, searchQuery, sessionId, user]);

  return (
    <div className="space-y-6 text-parchment font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-arcane/20 via-purple-950/20 to-black/60 border border-arcane/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-arcane/20 border border-arcane/40 text-arcane">
              <Music size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-parchment flex items-center gap-2">
                Gestor de Efeitos Sonoros & Ambiências
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-arcane/20 text-arcane border border-arcane/30 uppercase tracking-widest">
                  Mestre TTRPG
                </span>
              </h3>
              <p className="text-xs text-parchment/60 font-mono mt-0.5">
                Controle total sobre todos os sons do sistema: dados, combate, magias, masmorra, pings e trilhas de ambiente.
              </p>
            </div>
          </div>
        </div>

        {/* Scope info & actions */}
        <div className="flex items-center gap-3 z-10">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-parchment/40 block">Escopo Atual</span>
            <span className="text-xs font-mono font-bold text-arcane truncate max-w-[180px] block">
              {isGlobalMode ? 'Padrão Global do Sistema' : sessionName ? `Campanha: ${sessionName}` : 'Campanha Ativa'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="p-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/70 hover:text-parchment text-xs font-mono flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            title="Restaurar todos os sons para o padrão original"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Restaurar Padrões</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-parchment cursor-pointer transition-colors"
              title="Fechar gestor"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Outcome Simulator Bar (Quick Preview of critical sounds) */}
      <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-gold animate-bounce" />
            <span className="text-xs font-bold font-serif text-parchment">
              Painel de Teste Rápido de Áudio
            </span>
            <span className="text-[10px] font-mono text-parchment/40">
              (Clique para testar instantaneamente os sons que os jogadores ouvem)
            </span>
          </div>

          {/* Test Volume slider */}
          <div className="flex items-center gap-2 text-xs font-mono text-parchment/60">
            <Volume2 size={14} className="text-arcane" />
            <span>Volume:</span>
            <input 
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={testVolume}
              onChange={(e) => setTestVolume(parseFloat(e.target.value))}
              className="w-24 accent-arcane cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
              title={`Volume: ${Math.round(testVolume * 100)}%`}
            />
            <span className="w-8 text-[10px] text-parchment/40">{Math.round(testVolume * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => handleTestSound('diceRollSound')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'diceRollSound'
                ? 'bg-arcane text-obsidian border-arcane shadow-md shadow-arcane/20 scale-[0.98]'
                : 'bg-white/5 hover:bg-arcane/20 text-arcane border-arcane/30'
            }`}
          >
            <Dices size={14} />
            <span>Dados</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateOutcome('success')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'successSound'
                ? 'bg-emerald-400 text-obsidian border-emerald-400 shadow-md shadow-emerald-400/20 scale-[0.98]'
                : 'bg-emerald-950/30 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <Award size={14} />
            <span>Sucesso</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateOutcome('failure')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'failureSound'
                ? 'bg-amber-400 text-obsidian border-amber-400 shadow-md shadow-amber-400/20 scale-[0.98]'
                : 'bg-amber-950/30 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Falha</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateOutcome('critical')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'criticalSound'
                ? 'bg-gold text-obsidian border-gold shadow-md shadow-gold/30 scale-[0.98]'
                : 'bg-gold/15 hover:bg-gold/25 text-gold border-gold/40'
            }`}
          >
            <Sparkles size={14} />
            <span>Crítico (20)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateOutcome('fumble')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'fumbleSound'
                ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30 scale-[0.98]'
                : 'bg-rose-950/30 hover:bg-rose-600/20 text-rose-300 border-rose-500/30'
            }`}
          >
            <Flame size={14} />
            <span>Desastre (1)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTestSound('attackSound')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'attackSound'
                ? 'bg-red-500 text-white border-red-500 shadow-md scale-[0.98]'
                : 'bg-white/5 hover:bg-red-500/20 text-red-300 border-red-500/30'
            }`}
          >
            <Swords size={14} />
            <span>Ataque</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['dice', 'combat', 'magic', 'dungeon', 'system', 'ambient', 'library', 'upload_new'] as const).map((tab) => {
            const isActive = activeTab === tab;
            let label = '';
            let Icon = Music;

            if (tab === 'library') {
              label = `Biblioteca Reutilizável (${soundLibrary.length})`;
              Icon = Layers;
            } else if (tab === 'upload_new') {
              label = '+ Cadastrar Som';
              Icon = Plus;
            } else if (tab === 'ambient') {
              label = 'Sons de Ambiente (Ambiência)';
              Icon = CloudRain;
            } else {
              label = CATEGORY_LABELS[tab].label;
              Icon = getCategoryIcon(tab);
            }

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery('');
                }}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-all cursor-pointer border",
                  isActive
                    ? "bg-arcane text-obsidian border-arcane font-bold shadow-md shadow-arcane/20 scale-[1.02]"
                    : "bg-white/5 border-white/10 text-parchment/70 hover:bg-white/10 hover:text-parchment"
                )}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        {(activeTab !== 'upload_new') && (
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar sons..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-arcane/60"
            />
          </div>
        )}
      </div>

      {/* Global Alerts / Messages */}
      {uploadError && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-2 text-xs text-red-300 font-mono">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: SYSTEM SOUNDS CATALOG (DADOS, COMBATE, MAGIA, DUNGEON, SISTEMA) */}
      {/* ============================================================== */}
      {activeTab !== 'ambient' && activeTab !== 'library' && activeTab !== 'upload_new' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-parchment/60 px-1">
            <span>
              {CATEGORY_LABELS[activeTab].description} ({filteredSounds.length} sons disponíveis)
            </span>
            <span className="text-[11px] text-arcane">
              Envie arquivos em <strong>MP3</strong> ou <strong>WAV</strong> ou cole links diretos
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSounds.map((def) => {
              const currentVal = sounds[def.key] || (DEFAULT_SOUNDS as any)[def.key] || '';
              const isPlaying = activePlayingKey === def.key;
              const isUploaded = currentVal.startsWith('data:audio');
              const isSynth = currentVal.startsWith('synth:');
              const presets = SOUND_PRESETS[def.key as SoundEffectType] || [];
              const matchedPreset = presets.find(p => p.url === currentVal);

              return (
                <div
                  key={def.key}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all bg-black/40 border-white/10 hover:border-arcane/30 ${
                    isPlaying ? 'ring-2 ring-arcane shadow-lg shadow-arcane/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-black/60 border border-white/10 ${def.accentColor}`}>
                        {React.createElement(getCategoryIcon(def.category), { size: 20 })}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-sm text-parchment">
                            {def.name}
                          </h4>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${def.badgeColor}`}>
                            {def.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-parchment/50 font-mono mt-0.5">
                          {def.description}
                        </p>
                      </div>
                    </div>

                    {/* Preview / Stop Button */}
                    <button
                      type="button"
                      onClick={() => handleTestSound(def.key, currentVal)}
                      className={`p-2 px-3 rounded-xl font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        isPlaying
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 animate-pulse'
                          : 'bg-arcane hover:bg-arcane/80 text-obsidian font-bold shadow-md shadow-arcane/20'
                      }`}
                      title={isPlaying ? 'Parar reprodução' : 'Ouvir este som'}
                    >
                      {isPlaying ? (
                        <>
                          <Square size={13} fill="currentColor" />
                          <span>Parar</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Ouvir</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Source indicator */}
                  <div className="flex items-center justify-between text-[10px] font-mono px-1 py-1 text-parchment/60 border-t border-white/5 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span>Origem:</span>
                      {isUploaded ? (
                        <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check size={10} /> Arquivo Próprio (MP3/WAV)
                        </span>
                      ) : isSynth ? (
                        <span className="text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                          Sintetizador Web Audio (Offline)
                        </span>
                      ) : matchedPreset ? (
                        <span className="text-arcane bg-arcane/15 border border-arcane/30 px-2 py-0.5 rounded-md">
                          Predefinição: {matchedPreset.name}
                        </span>
                      ) : currentVal ? (
                        <span className="text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md truncate max-w-[160px]">
                          URL Externa
                        </span>
                      ) : (
                        <span className="text-parchment/40">Padrão</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResetToDefault(def.key)}
                      className="hover:text-parchment text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Restaurar som padrão"
                    >
                      <RotateCcw size={10} />
                      <span>Restaurar Padrão</span>
                    </button>
                  </div>

                  {/* Presets Grid (if defined) */}
                  {presets.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40 px-1">
                        Predefinições do Sistema:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {presets.map((preset) => {
                          const isSelected = currentVal === preset.url;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSoundChange(def.key, preset.url)}
                              className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-arcane/20 border-arcane text-parchment font-semibold shadow-sm'
                                  : 'bg-black/30 hover:bg-white/5 border-white/5 text-parchment/70'
                              }`}
                            >
                              <div className="truncate mr-2">
                                <div className="truncate text-[11px] font-medium">{preset.name}</div>
                                <div className="text-[9px] text-parchment/40 truncate">{preset.description}</div>
                              </div>
                              {isSelected && <Check size={14} className="text-arcane shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom URL or MP3/WAV Upload */}
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-parchment/40 px-1">
                        Enviar Arquivo ou Link:
                      </span>

                      {/* File Upload Button (MP3 or WAV) */}
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono cursor-pointer transition-all border border-white/10 hover:border-arcane/50">
                        <Upload size={12} className="text-arcane" />
                        <span>
                          {uploadLoadingKey === def.key ? 'Processando...' : 'Enviar MP3 / WAV'}
                        </span>
                        <input
                          type="file"
                          accept="audio/mp3,audio/wav,audio/mpeg,audio/x-wav,audio/ogg,.mp3,.wav"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(def.key, file, def.name, def.category);
                              e.target.value = '';
                            }
                          }}
                          disabled={uploadLoadingKey === def.key}
                        />
                      </label>
                    </div>

                    {isUploaded ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/60 border border-emerald-500/30">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileAudio size={14} className="text-emerald-400 shrink-0" />
                          <div className="truncate font-mono text-xs text-emerald-300">
                            Arquivo salvo na biblioteca (Base64)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResetToDefault(def.key)}
                          className="p-1 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                          title="Remover áudio personalizado e usar padrão"
                        >
                          <Trash2 size={11} />
                          <span>Remover</span>
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={currentVal.startsWith('synth:') ? '' : currentVal}
                          onChange={(e) => handleSoundChange(def.key, e.target.value)}
                          placeholder={currentVal.startsWith('synth:') ? 'Usando sintetizador procedural...' : 'Cole um link de áudio (https://...mp3 ou .wav)'}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-arcane/60 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SONS DE AMBIENTE & TRILHAS (AMBIÊNCIA CUSTOMIZÁVEL) */}
      {/* ============================================================== */}
      {activeTab === 'ambient' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-950/40 via-black/50 to-purple-950/30 border border-sky-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
                  <CloudRain size={24} />
                </div>
                <div>
                  <h4 className="text-base font-serif font-bold text-parchment">
                    Customização de Sons de Ambiente
                  </h4>
                  <p className="text-xs text-parchment/60 font-mono">
                    Defina a trilha sonora de fundo ou ambiência contínua que ecoa na campanha e no mapa para todos os jogadores.
                  </p>
                </div>
              </div>

              {/* Ambient Test Play/Stop */}
              <button
                type="button"
                onClick={handleToggleAmbientPreview}
                className={cn(
                  "px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer",
                  isPlayingAmbient
                    ? "bg-rose-500 text-white shadow-rose-500/30 animate-pulse"
                    : "bg-sky-500 text-obsidian shadow-sky-500/30 hover:bg-sky-400"
                )}
              >
                {isPlayingAmbient ? (
                  <>
                    <Square size={14} fill="currentColor" />
                    <span>Parar Ambiência</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Testar Ambiência</span>
                  </>
                )}
              </button>
            </div>

            {/* Ambient Volume slider */}
            <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/10">
              <Volume2 size={16} className="text-sky-400 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs font-mono text-parchment/70">
                  <span>Volume da Trilha de Ambiente</span>
                  <span>{Math.round(ambientVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={ambientVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAmbientVolume(val);
                    atmospherePlayer.setVolume(val);
                  }}
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Option A: Custom Ambient Track (URL or File Upload) */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h5 className="font-serif font-bold text-sm text-parchment flex items-center gap-2">
                  <FileAudio size={16} className="text-sky-400" />
                  <span>Trilha de Áudio Customizada (Link ou Arquivo MP3/WAV)</span>
                </h5>
                <p className="text-xs text-parchment/50 font-mono mt-0.5">
                  Substitui a síntese procedural por uma música ou loop sonoro real enviado por você.
                </p>
              </div>

              {/* Upload MP3/WAV button */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-mono cursor-pointer transition-all border border-sky-500/40">
                <Upload size={13} />
                <span>{uploadLoadingKey === 'ambient' ? 'Enviando...' : 'Enviar Áudio MP3 / WAV'}</span>
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/mpeg,audio/x-wav,audio/ogg,.mp3,.wav"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleAmbientUpload(f);
                      e.target.value = '';
                    }
                  }}
                  disabled={uploadLoadingKey === 'ambient'}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                  Nome da Trilha de Fundo:
                </label>
                <input
                  type="text"
                  value={customAmbientName}
                  onChange={(e) => setCustomAmbientName(e.target.value)}
                  placeholder="Ex: Taverna do Javali Saltitante"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-sky-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                  URL Direta do Áudio (MP3 / WAV):
                </label>
                <input
                  type="text"
                  value={customAmbientUrl.startsWith('data:audio') ? '' : customAmbientUrl}
                  onChange={(e) => setCustomAmbientUrl(e.target.value)}
                  placeholder={customAmbientUrl.startsWith('data:audio') ? 'Usando áudio enviado via upload (Base64)...' : 'https://exemplo.com/trilha.mp3'}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-sky-500/60"
                />
              </div>
            </div>

            {customAmbientUrl && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/20 border border-sky-500/30">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-sky-400" />
                  <span className="text-xs font-mono text-sky-200">
                    Trilha ativa: <strong>{customAmbientName || 'Áudio Customizado'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomAmbientUrl('');
                    setCustomAmbientName('');
                    if (isPlayingAmbient) {
                      atmospherePlayer.stop();
                      setIsPlayingAmbient(false);
                    }
                  }}
                  className="text-[10px] font-mono text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Limpar Trilha</span>
                </button>
              </div>
            )}
          </div>

          {/* Option B: Procedural Synthesized Soundscapes */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
            <div>
              <h5 className="font-serif font-bold text-sm text-parchment">
                Ambiências Procedurais do Sistema (100% Offline / WebAudio)
              </h5>
              <p className="text-xs text-parchment/50 font-mono mt-0.5">
                Utilizadas caso nenhuma trilha personalizada em MP3/WAV seja fornecida.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ATMOSPHERE_PRESETS.map((preset) => {
                const isSelected = selectedProceduralPreset === preset.id && !customAmbientUrl;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedProceduralPreset(preset.id);
                      if (isPlayingAmbient) {
                        atmospherePlayer.play(preset.id);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2",
                      isSelected
                        ? "bg-sky-500/20 border-sky-500/60 shadow-md shadow-sky-500/10"
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-parchment/70"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-xs text-parchment">{preset.name}</span>
                        {isSelected && <Check size={14} className="text-sky-400" />}
                      </div>
                      <span className="text-[10px] font-mono text-sky-300 block mt-0.5">{preset.subtitle}</span>
                      <p className="text-[10px] text-parchment/40 mt-1 line-clamp-2">{preset.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BIBLIOTECA DE SONS & REUTILIZAÇÃO (POR CAMPANHA E USUÁRIO) */}
      {/* ============================================================== */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          {/* Sub-filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-black/40 border border-white/10">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-arcane" />
              <span className="text-xs font-mono font-bold text-parchment">
                Filtrar Biblioteca:
              </span>
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setLibraryFilter('all')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer",
                    libraryFilter === 'all'
                      ? "bg-arcane text-obsidian font-bold"
                      : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Todos ({soundLibrary.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryFilter('session')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer",
                    libraryFilter === 'session'
                      ? "bg-arcane text-obsidian font-bold"
                      : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Esta Campanha ({soundLibrary.filter(s => s.sessionId === sessionId).length})
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryFilter('my')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer",
                    libraryFilter === 'my'
                      ? "bg-arcane text-obsidian font-bold"
                      : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Meus Sons ({soundLibrary.filter(s => s.userId === user?.uid).length})
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('upload_new')}
              className="px-3 py-1.5 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-arcane/20"
            >
              <Plus size={14} />
              <span>Adicionar Novo Som</span>
            </button>
          </div>

          {/* Library Items Grid */}
          {isLibraryLoading ? (
            <div className="p-12 text-center text-xs font-mono text-parchment/40">
              Carregando biblioteca de efeitos sonoros...
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-black/30 border border-dashed border-white/10 space-y-3">
              <Music size={32} className="mx-auto text-parchment/20" />
              <h5 className="font-serif font-bold text-sm text-parchment">
                Nenhum som encontrado nesta categoria
              </h5>
              <p className="text-xs text-parchment/40 font-mono max-w-sm mx-auto">
                Envie arquivos em MP3 ou WAV nos slots do sistema ou clique em "Adicionar Novo Som" para construir seu acervo.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('upload_new')}
                className="px-4 py-2 rounded-xl bg-arcane text-obsidian text-xs font-mono font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Cadastrar Primeiro Som</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLibrary.map((item) => {
                const isPlaying = activePlayingKey === item.id;
                const isMySound = user && item.userId === user.uid;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-arcane/40 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-arcane shrink-0">
                          {React.createElement(getCategoryIcon(item.category), { size: 16 })}
                        </div>
                        <div className="truncate">
                          <h5 className="font-serif font-bold text-xs text-parchment truncate" title={item.name}>
                            {item.name}
                          </h5>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-parchment/50 mt-0.5">
                            <span className="uppercase text-arcane font-semibold">{item.format || 'MP3'}</span>
                            <span>•</span>
                            <span>{item.size ? `${(item.size / 1024).toFixed(0)} KB` : 'URL'}</span>
                            <span>•</span>
                            <span className="text-parchment/40 truncate">{item.sessionName || 'Campanha'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Play Preview */}
                      <button
                        type="button"
                        onClick={() => handleTestSound(item.id, item.url)}
                        className={cn(
                          "p-2 rounded-xl text-xs font-mono transition-all cursor-pointer shrink-0",
                          isPlaying
                            ? "bg-rose-500 text-white animate-pulse"
                            : "bg-arcane/20 hover:bg-arcane text-arcane hover:text-obsidian"
                        )}
                        title="Ouvir som"
                      >
                        {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                      </button>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="text-[9px] font-mono text-parchment/40 truncate">
                        Por: {item.userName || 'Mestre'}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Assign Sound Button */}
                        <button
                          type="button"
                          onClick={() => setAssigningSoundItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-arcane/30 hover:text-arcane text-parchment text-[10px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reutilizar e atribuir este som a um efeito do sistema"
                        >
                          <Share2 size={11} />
                          <span>Reutilizar</span>
                        </button>

                        {/* Delete Sound button */}
                        {isMySound && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFromLibrary(item.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-parchment/40 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remover som da biblioteca"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: FORMULÁRIO DE CADASTRO DE NOVO SOM NA BIBLIOTECA */}
      {/* ============================================================== */}
      {activeTab === 'upload_new' && (
        <form onSubmit={handleCreateNewSoundInLibrary} className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-5 max-w-2xl mx-auto">
          <div className="border-b border-white/10 pb-3">
            <h4 className="font-serif font-bold text-base text-parchment flex items-center gap-2">
              <Plus size={18} className="text-arcane" />
              <span>Cadastrar Novo Som na Biblioteca do Mestre</span>
            </h4>
            <p className="text-xs text-parchment/60 font-mono mt-0.5">
              Faça upload de arquivos em <strong>MP3</strong> ou <strong>WAV</strong> ou cole links diretos para reutilizar em qualquer campanha.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                Nome do Som *
              </label>
              <input
                type="text"
                required
                value={newSoundForm.name}
                onChange={(e) => setNewSoundForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Rugido do Beholder / Trombeta de Gondor"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                  Categoria
                </label>
                <select
                  value={newSoundForm.category}
                  onChange={(e) => setNewSoundForm(prev => ({ ...prev, category: e.target.value as SoundCategory }))}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane"
                >
                  <option value="dice">Dados & Desfechos</option>
                  <option value="combat">Combate & Ações</option>
                  <option value="magic">Magias & Feitiços</option>
                  <option value="dungeon">Masmorra & Exploração</option>
                  <option value="system">Sinais & Sistema</option>
                  <option value="ambient">Ambiências & Trilhas</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                  Escopo de Disponibilidade
                </label>
                <select
                  value={newSoundForm.scope}
                  onChange={(e) => setNewSoundForm(prev => ({ ...prev, scope: e.target.value as 'session' | 'global' }))}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane"
                >
                  <option value="session">Apenas Esta Campanha ({sessionName || 'Atual'})</option>
                  <option value="global">Minha Biblioteca Global (Todas as Campanhas)</option>
                </select>
              </div>
            </div>

            {/* File Upload (MP3 / WAV) or URL input */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-arcane font-bold block">
                Arquivo de Áudio (MP3 / WAV) ou Link Direto:
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-md">
                  <Upload size={14} />
                  <span>{newSoundFile ? newSoundFile.name : 'Selecionar Arquivo (MP3/WAV)'}</span>
                  <input
                    type="file"
                    accept="audio/mp3,audio/wav,audio/mpeg,audio/x-wav,audio/ogg,.mp3,.wav"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setNewSoundFile(f);
                        if (!newSoundForm.name) {
                          setNewSoundForm(prev => ({ ...prev, name: f.name.replace(/\.[^/.]+$/, "") }));
                        }
                      }
                    }}
                  />
                </label>

                <span className="text-xs font-mono text-parchment/40">ou cole o link:</span>

                <input
                  type="text"
                  value={newSoundForm.url}
                  onChange={(e) => setNewSoundForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://...mp3 ou .wav"
                  disabled={Boolean(newSoundFile)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane disabled:opacity-40"
                />
              </div>

              {newSoundFile && (
                <div className="flex items-center justify-between text-xs font-mono text-emerald-400 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/30">
                  <span>Arquivo selecionado: {newSoundFile.name} ({(newSoundFile.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => setNewSoundFile(null)}
                    className="text-red-400 hover:text-red-300 text-[10px]"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>

            {/* Target Slot to assign immediately */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">
                Atribuir Imediatamente a um Efeito Sonoro (Opcional):
              </label>
              <select
                value={newSoundForm.targetSlot}
                onChange={(e) => setNewSoundForm(prev => ({ ...prev, targetSlot: e.target.value }))}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane"
              >
                <option value="">Não vincular agora (Apenas salvar na biblioteca)</option>
                <option value="customAmbientSound">🎵 Trilha de Ambiente da Campanha</option>
                {SYSTEM_SOUND_DEFINITIONS.map(def => (
                  <option key={def.key} value={def.key}>{def.name} ({def.badge})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmittingNewSound}
              className="px-6 py-2 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-arcane/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingNewSound ? (
                <div className="w-4 h-4 border-2 border-obsidian/30 border-t-obsidian rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>{isSubmittingNewSound ? 'Salvando...' : 'Salvar na Biblioteca'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* REUSE / ASSIGN POPOVER MODAL */}
      {/* ============================================================== */}
      {assigningSoundItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian border border-arcane/40 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-arcane">
                <Share2 size={18} />
                <h4 className="font-serif font-bold text-sm text-parchment">
                  Reutilizar Som: {assigningSoundItem.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setAssigningSoundItem(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-parchment/60 font-mono">
              Selecione em qual efeito do sistema ou ambiência você deseja usar este áudio:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleAssignSoundToSlot(assigningSoundItem, 'customAmbientSound')}
                className="w-full text-left p-2.5 rounded-xl bg-sky-950/40 hover:bg-sky-500/20 border border-sky-500/30 text-sky-200 flex items-center justify-between cursor-pointer"
              >
                <span>🎵 Trilha Sonora de Ambiente da Campanha</span>
                <Check size={14} className="text-sky-400" />
              </button>

              {SYSTEM_SOUND_DEFINITIONS.map((def) => (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => handleAssignSoundToSlot(assigningSoundItem, def.key)}
                  className="w-full text-left p-2 rounded-xl bg-white/5 hover:bg-arcane/20 border border-white/5 text-parchment/80 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-parchment font-medium">{def.name}</span>
                    <span className="text-[9px] text-parchment/40">({def.badge})</span>
                  </div>
                  <Check size={13} className="text-arcane opacity-50" />
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAssigningSoundItem(null)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Action Footer Bar */}
      <div className="p-5 rounded-2xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Sliders size={16} className="text-arcane" />
            <h4 className="font-serif font-bold text-sm text-parchment">
              Salvar Alterações Sonoras
            </h4>
          </div>
          <p className="text-xs text-parchment/50 font-mono">
            {isGlobalMode
              ? 'Os sons serão salvos como padrão global do sistema para todas as novas campanhas.'
              : 'As alterações valerão imediatamente para esta campanha e para todos os jogadores conectados.'}
          </p>

          {!isGlobalMode && (
            <label className="flex items-center gap-2 text-xs font-mono text-parchment/70 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={alsoSaveGlobal}
                onChange={(e) => setAlsoSaveGlobal(e.target.checked)}
                className="rounded border-white/20 text-arcane focus:ring-0 accent-arcane cursor-pointer"
              />
              <span>Sincronizar também com o padrão global para futuras campanhas</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {saveStatus && (
            <span className={`text-xs font-mono px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              saveStatus.type === 'success' 
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' 
                : 'bg-red-950/40 text-red-300 border-red-500/30'
            }`}>
              {saveStatus.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{saveStatus.message}</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none p-3 px-6 rounded-xl bg-arcane hover:bg-arcane/80 text-obsidian font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-lg shadow-arcane/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-obsidian/30 border-t-obsidian rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{isSaving ? 'Salvando Sons...' : 'Salvar Efeitos Sonoros'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
