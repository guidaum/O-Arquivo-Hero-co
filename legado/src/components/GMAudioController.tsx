import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Music, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Swords, 
  Dice6, 
  Skull, 
  Shield, 
  Radio, 
  CloudRain, 
  Wind, 
  Mountain, 
  Flame, 
  Heart, 
  Footprints, 
  AlertTriangle, 
  DoorClosed, 
  Archive, 
  ExternalLink,
  Zap,
  Volume1
} from 'lucide-react';
import { 
  atmospherePlayer, 
  AtmosphereType, 
  ATMOSPHERE_PRESETS,
  AtmospherePreset 
} from '../lib/atmosphereEngine';
import { 
  playSystemSound, 
  stopActiveAudio, 
  SoundConfig 
} from '../lib/soundEngine';
import { 
  SYSTEM_SOUND_DEFINITIONS, 
  SystemSoundDefinition, 
  SoundCategory, 
  CATEGORY_LABELS 
} from '../types/soundManager';
import { db, doc, setDoc, onSnapshot } from '../firebase';
import { cn } from '../lib/utils';

interface GMAudioControllerProps {
  sessionId?: string;
  sessionName?: string;
  campaignSounds?: SoundConfig;
  onOpenFullSoundManager?: () => void;
  className?: string;
  defaultTab?: 'ambient' | 'sfx';
}

export const GMAudioController: React.FC<GMAudioControllerProps> = ({
  sessionId,
  sessionName = 'Campanha Atual',
  campaignSounds = {} as SoundConfig,
  onOpenFullSoundManager,
  className,
  defaultTab = 'ambient'
}) => {
  // Controller layout states
  const [isExpanded, setIsExpanded] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('gm_audio_controller_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = React.useState<'ambient' | 'sfx'>(defaultTab);
  const [sfxCategoryFilter, setSfxCategoryFilter] = React.useState<SoundCategory | 'all'>('all');

  // Player state mirrors
  const [isPlayingAmbient, setIsPlayingAmbient] = React.useState<boolean>(atmospherePlayer.isPlaying());
  const [isPausedAmbient, setIsPausedAmbient] = React.useState<boolean>(atmospherePlayer.isPaused());
  const [ambientType, setAmbientType] = React.useState<AtmosphereType>(atmospherePlayer.getCurrentType());
  const [customAmbientName, setCustomAmbientName] = React.useState<string | null>(atmospherePlayer.getCustomTrackName());
  const [ambientVolume, setAmbientVolume] = React.useState<number>(atmospherePlayer.getVolume());
  const [isAmbientMuted, setIsAmbientMuted] = React.useState<boolean>(false);
  const [prevAmbientVolume, setPrevAmbientVolume] = React.useState<number>(0.5);

  // SFX volume & state
  const [sfxVolume, setSfxVolume] = React.useState<number>(0.7);
  const [isSfxMuted, setIsSfxMuted] = React.useState<boolean>(false);
  const [activePlayingSfxKey, setActivePlayingSfxKey] = React.useState<string | null>(null);

  // Sync to players toggle
  const [syncToPlayers, setSyncToPlayers] = React.useState<boolean>(true);

  // Save expanded preference
  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem('gm_audio_controller_expanded', String(next));
    } catch {
      // ignore
    }
  };

  // Subscribe to atmospherePlayer state changes
  React.useEffect(() => {
    const unsubscribe = atmospherePlayer.subscribe(() => {
      setIsPlayingAmbient(atmospherePlayer.isPlaying());
      setIsPausedAmbient(atmospherePlayer.isPaused());
      setAmbientType(atmospherePlayer.getCurrentType());
      setCustomAmbientName(atmospherePlayer.getCustomTrackName());
      setAmbientVolume(atmospherePlayer.getVolume());
    });
    return () => unsubscribe();
  }, []);

  // Listen to remote atmosphere if sessionId exists
  React.useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, 'dungeonAtmosphere', sessionId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.soundscape) {
          setAmbientType(data.soundscape as AtmosphereType);
        }
      }
    }, () => {});
    return () => unsub();
  }, [sessionId]);

  // Sync atmosphere change to Firestore for all players
  const broadcastAtmosphereToFirestore = async (type: AtmosphereType, customUrl?: string, customName?: string) => {
    if (!syncToPlayers || !sessionId) return;
    try {
      await setDoc(doc(db, 'dungeonAtmosphere', sessionId), {
        soundscape: type,
        customAmbientUrl: customUrl || '',
        customAmbientName: customName || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('GMAudioController broadcast to Firestore failed:', err);
    }
  };

  // Handle ambient volume change
  const handleAmbientVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setAmbientVolume(clamped);
    if (clamped > 0) {
      setIsAmbientMuted(false);
    }
    atmospherePlayer.setVolume(clamped);
  };

  const handleToggleAmbientMute = () => {
    if (isAmbientMuted || ambientVolume === 0) {
      const restoreVol = prevAmbientVolume > 0 ? prevAmbientVolume : 0.5;
      setIsAmbientMuted(false);
      handleAmbientVolumeChange(restoreVol);
    } else {
      setPrevAmbientVolume(ambientVolume);
      setIsAmbientMuted(true);
      handleAmbientVolumeChange(0);
    }
  };

  // Handle ambient play / pause / stop
  const handleTogglePlayPauseAmbient = () => {
    if (isPlayingAmbient) {
      atmospherePlayer.pause();
    } else if (isPausedAmbient) {
      atmospherePlayer.resume();
    } else if (campaignSounds.customAmbientSound) {
      handlePlayCustomAmbient();
    } else {
      handlePlayPreset('tavern');
    }
  };

  const handleStopAmbient = () => {
    atmospherePlayer.stop();
    broadcastAtmosphereToFirestore('none');
  };

  const handlePlayPreset = (presetId: AtmosphereType) => {
    if (presetId === 'none') {
      handleStopAmbient();
      return;
    }
    atmospherePlayer.play(presetId);
    broadcastAtmosphereToFirestore(presetId);
  };

  const handlePlayCustomAmbient = () => {
    if (!campaignSounds.customAmbientSound) return;
    atmospherePlayer.playCustomTrack(
      campaignSounds.customAmbientSound, 
      campaignSounds.customAmbientName || 'Ambiência da Campanha'
    );
    broadcastAtmosphereToFirestore(
      'none', 
      campaignSounds.customAmbientSound, 
      campaignSounds.customAmbientName || 'Ambiência da Campanha'
    );
  };

  // Panic / Stop All Sounds
  const handleStopAll = () => {
    atmospherePlayer.stop();
    stopActiveAudio();
    setActivePlayingSfxKey(null);
    broadcastAtmosphereToFirestore('none');
  };

  // Play Sound Effect
  const handleTriggerSfx = (def: SystemSoundDefinition) => {
    const effectiveVol = isSfxMuted ? 0 : sfxVolume;
    setActivePlayingSfxKey(def.key);
    playSystemSound(def.key, campaignSounds, effectiveVol);

    setTimeout(() => {
      setActivePlayingSfxKey(prev => prev === def.key ? null : prev);
    }, 1200);
  };

  // Filtered system sound definitions
  const filteredSounds = React.useMemo(() => {
    if (sfxCategoryFilter === 'all') return SYSTEM_SOUND_DEFINITIONS;
    return SYSTEM_SOUND_DEFINITIONS.filter(s => s.category === sfxCategoryFilter);
  }, [sfxCategoryFilter]);

  // Current track name label
  const currentAmbientLabel = React.useMemo(() => {
    if (customAmbientName) return customAmbientName;
    const found = ATMOSPHERE_PRESETS.find(p => p.id === ambientType);
    return found ? found.name : 'Nenhuma trilha ativa';
  }, [customAmbientName, ambientType]);

  // Quick preset icons map
  const getPresetIcon = (id: AtmosphereType) => {
    switch (id) {
      case 'dungeon_rain': return <CloudRain size={15} className="text-sky-400" />;
      case 'cold_wind': return <Wind size={15} className="text-teal-300" />;
      case 'tavern': return <Flame size={15} className="text-amber-400" />;
      case 'deep_cavern': return <Mountain size={15} className="text-purple-400" />;
      case 'combat_drums': return <Swords size={15} className="text-rose-400" />;
      case 'arcane_mystery': return <Sparkles size={15} className="text-emerald-400" />;
      default: return <VolumeX size={15} className="text-stone-400" />;
    }
  };

  const getSfxIcon = (category: SoundCategory, key: string) => {
    if (key.includes('dice') || key.includes('Roll') || key.includes('critical') || key.includes('fumble') || key.includes('success') || key.includes('failure')) {
      return <Dice6 size={14} />;
    }
    if (key.includes('attack') || key.includes('damage') || key.includes('combat')) {
      return <Swords size={14} />;
    }
    if (key.includes('shield')) return <Shield size={14} />;
    if (key.includes('roar')) return <Skull size={14} />;
    if (key.includes('spell')) return <Sparkles size={14} />;
    if (key.includes('heal')) return <Heart size={14} />;
    if (key.includes('footsteps')) return <Footprints size={14} />;
    if (key.includes('trap')) return <AlertTriangle size={14} />;
    if (key.includes('chest')) return <Archive size={14} />;
    if (key.includes('door')) return <DoorClosed size={14} />;
    if (key.includes('ping')) return <Radio size={14} />;
    if (key.includes('level')) return <Zap size={14} />;
    return <Music size={14} />;
  };

  return (
    <div className={cn("fixed bottom-4 right-4 z-40 select-none", className)}>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // ==========================================
          // COMPACT / MINIMIZED DOCKED CONTROLLER
          // ==========================================
          <motion.div
            key="compact-audio-bar"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-obsidian/95 backdrop-blur-xl border border-arcane/40 shadow-2xl shadow-black/80 text-parchment"
          >
            {/* Visualizer / Playing Indicator */}
            <div className="flex items-center gap-1.5 pl-1 pr-2 border-r border-white/10 shrink-0">
              {isPlayingAmbient ? (
                <div className="flex items-end gap-0.5 h-4 w-4">
                  <span className="w-1 bg-arcane animate-[pulse_0.6s_ease-in-out_infinite] h-3 rounded-full" />
                  <span className="w-1 bg-emerald-400 animate-[pulse_0.9s_ease-in-out_infinite] h-4 rounded-full" />
                  <span className="w-1 bg-arcane animate-[pulse_0.75s_ease-in-out_infinite] h-2 rounded-full" />
                </div>
              ) : isPausedAmbient ? (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" title="Ambiência Pausada" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-stone-500" title="Ambiência Inativa" />
              )}

              <button
                type="button"
                onClick={handleTogglePlayPauseAmbient}
                className={cn(
                  "p-1.5 rounded-xl transition-all cursor-pointer shrink-0",
                  isPlayingAmbient 
                    ? "bg-arcane text-obsidian font-bold shadow-md shadow-arcane/30" 
                    : isPausedAmbient 
                      ? "bg-amber-400 text-obsidian"
                      : "bg-white/10 hover:bg-white/20 text-parchment"
                )}
                title={isPlayingAmbient ? "Pausar Ambiência" : "Tocar Ambiência"}
              >
                {isPlayingAmbient ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
              </button>
            </div>

            {/* Track Name & Quick Volume */}
            <div className="flex items-center gap-2 max-w-[140px] sm:max-w-[200px]">
              <span className="text-xs font-medium font-serif truncate text-parchment/90" title={currentAmbientLabel}>
                {isPlayingAmbient ? currentAmbientLabel : isPausedAmbient ? `[Pausado] ${currentAmbientLabel}` : 'Ambiência Mestre'}
              </span>

              <button
                type="button"
                onClick={handleToggleAmbientMute}
                className="text-parchment/60 hover:text-parchment shrink-0"
                title={isAmbientMuted ? "Desmutar" : "Mutar Ambiência"}
              >
                {isAmbientMuted || ambientVolume === 0 ? (
                  <VolumeX size={14} className="text-red-400" />
                ) : ambientVolume < 0.5 ? (
                  <Volume1 size={14} />
                ) : (
                  <Volume2 size={14} />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambientVolume}
                onChange={(e) => handleAmbientVolumeChange(parseFloat(e.target.value))}
                className="w-14 sm:w-18 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-arcane shrink-0"
                title={`Volume Ambiência: ${Math.round(ambientVolume * 100)}%`}
              />
            </div>

            {/* Quick SFX launcher pills */}
            <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-white/10">
              <button
                type="button"
                onClick={() => handleTriggerSfx(SYSTEM_SOUND_DEFINITIONS[0])} // Dado
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-mono text-arcane flex items-center gap-1 cursor-pointer transition-colors"
                title="Tocar som de Rolagem de Dados"
              >
                <Dice6 size={12} />
                <span>Dado</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSfx(SYSTEM_SOUND_DEFINITIONS[5])} // Ataque
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-mono text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Tocar som de Golpe / Ataque"
              >
                <Swords size={12} />
                <span>Ataque</span>
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSfx(SYSTEM_SOUND_DEFINITIONS[13])} // Rugido
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-mono text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Tocar Rugido de Monstro"
              >
                <Skull size={12} />
                <span>Rugido</span>
              </button>
            </div>

            {/* Expand button */}
            <button
              type="button"
              onClick={toggleExpanded}
              className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/70 hover:text-parchment cursor-pointer transition-all ml-1"
              title="Expandir Controlador Completo de Áudio"
            >
              <ChevronUp size={16} />
            </button>
          </motion.div>
        ) : (
          // ==========================================
          // FULL EXPANDED AUDIO CONSOLE
          // ==========================================
          <motion.div
            key="expanded-audio-console"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[94vw] sm:w-[480px] md:w-[540px] max-h-[85vh] flex flex-col bg-obsidian/95 backdrop-blur-2xl border border-arcane/40 rounded-3xl shadow-2xl shadow-black/90 overflow-hidden text-parchment"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-arcane/20 border border-arcane/40 text-arcane flex items-center justify-center shrink-0">
                  <Music size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-serif font-bold text-parchment">
                      Controlador de Áudio do Mestre
                    </h3>
                    {isPlayingAmbient && (
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Tocando
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-parchment/50 truncate max-w-[240px]">
                    {sessionName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Panic Mute Button */}
                <button
                  type="button"
                  onClick={handleStopAll}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all"
                  title="Parar imediatamente todos os sons e ambiências ativas"
                >
                  <Square size={11} className="fill-current" />
                  <span>Silenciar Tudo</span>
                </button>

                {/* Minimize button */}
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/60 hover:text-parchment cursor-pointer transition-colors"
                  title="Minimizar controlador"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>

            {/* Sub-Header Navigation Tabs */}
            <div className="flex items-center border-b border-white/10 bg-white/5 p-1.5 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('ambient')}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  activeTab === 'ambient' 
                    ? "bg-arcane text-obsidian font-bold shadow-md shadow-arcane/20" 
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                )}
              >
                <CloudRain size={13} />
                <span>Ambiência & Trilha</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sfx')}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  activeTab === 'sfx' 
                    ? "bg-arcane text-obsidian font-bold shadow-md shadow-arcane/20" 
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                )}
              >
                <Zap size={13} />
                <span>Efeitos Sonoros ({SYSTEM_SOUND_DEFINITIONS.length})</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="p-4 overflow-y-auto space-y-4 max-h-[55vh]">
              {activeTab === 'ambient' ? (
                // ==========================================
                // TAB 1: AMBIÊNCIA SONORA
                // ==========================================
                <div className="space-y-4">
                  {/* Current Active Status Card */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-arcane/20 text-arcane">
                          <Music size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest block">
                            Faixa Selecionada
                          </span>
                          <span className="text-xs sm:text-sm font-serif font-bold text-parchment">
                            {currentAmbientLabel}
                          </span>
                        </div>
                      </div>

                      {/* Main Transport Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleTogglePlayPauseAmbient}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all",
                            isPlayingAmbient 
                              ? "bg-arcane text-obsidian hover:bg-arcane/90 shadow-arcane/30" 
                              : "bg-emerald-500 text-obsidian hover:bg-emerald-400 shadow-emerald-500/20"
                          )}
                        >
                          {isPlayingAmbient ? (
                            <>
                              <Pause size={13} />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Play size={13} className="ml-0.5 fill-current" />
                              <span>Tocar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleStopAmbient}
                          disabled={!isPlayingAmbient && !isPausedAmbient}
                          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-parchment/80 hover:text-parchment disabled:opacity-40 cursor-pointer transition-all"
                          title="Parar completamente a ambiência"
                        >
                          <Square size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Ambient Volume Slider */}
                    <div className="pt-2 border-t border-white/10 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleToggleAmbientMute}
                        className="text-parchment/60 hover:text-parchment shrink-0"
                      >
                        {isAmbientMuted || ambientVolume === 0 ? (
                          <VolumeX size={16} className="text-red-400" />
                        ) : ambientVolume < 0.5 ? (
                          <Volume1 size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>

                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isAmbientMuted ? 0 : ambientVolume}
                          onChange={(e) => handleAmbientVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-arcane"
                        />
                        <span className="text-[11px] font-mono text-parchment/60 w-9 text-right shrink-0">
                          {Math.round((isAmbientMuted ? 0 : ambientVolume) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Sync to players option */}
                    {sessionId && (
                      <label className="flex items-center gap-2 pt-1 text-[11px] text-parchment/70 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={syncToPlayers}
                          onChange={(e) => setSyncToPlayers(e.target.checked)}
                          className="rounded border-white/20 text-arcane focus:ring-0 focus:ring-offset-0 bg-obsidian cursor-pointer"
                        />
                        <span>Transmitir e sincronizar ambiência em tempo real aos jogadores da mesa</span>
                      </label>
                    )}
                  </div>

                  {/* Custom Session Track if configured */}
                  {campaignSounds.customAmbientSound && (
                    <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 shrink-0">
                          <Music size={14} />
                        </div>
                        <div className="truncate">
                          <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest block">
                            Trilha Personalizada da Mesa
                          </span>
                          <span className="text-xs font-serif text-sky-100 truncate block">
                            {campaignSounds.customAmbientName || 'Áudio Customizado'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePlayCustomAmbient}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-obsidian text-xs font-mono font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Play size={11} className="fill-current" />
                        <span>Tocar Trilha</span>
                      </button>
                    </div>
                  )}

                  {/* Procedural Soundscape Presets Grid */}
                  <div>
                    <h4 className="text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-2 flex items-center gap-1.5">
                      <Sliders size={12} />
                      <span>Cenários Sonoros Procedurais (Web Audio API)</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      {ATMOSPHERE_PRESETS.filter(p => p.id !== 'none').map(preset => {
                        const isThisActive = ambientType === preset.id && !customAmbientName && isPlayingAmbient;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handlePlayPreset(preset.id)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 cursor-pointer group",
                              isThisActive
                                ? "bg-arcane/20 border-arcane text-parchment shadow-md shadow-arcane/20"
                                : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 text-parchment/80"
                            )}
                          >
                            <div className="p-1.5 rounded-lg bg-black/40 shrink-0 mt-0.5">
                              {getPresetIcon(preset.id)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-serif font-bold block truncate group-hover:text-parchment">
                                {preset.name}
                              </span>
                              <span className="text-[10px] font-mono text-parchment/50 block truncate">
                                {preset.subtitle}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                // ==========================================
                // TAB 2: EFEITOS SONOROS (SFX SOUNDBOARD)
                // ==========================================
                <div className="space-y-3">
                  {/* SFX Volume bar */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSfxMuted(!isSfxMuted)}
                      className="text-parchment/60 hover:text-parchment shrink-0"
                      title={isSfxMuted ? "Desmutar Efeitos" : "Mutar Efeitos"}
                    >
                      {isSfxMuted || sfxVolume === 0 ? (
                        <VolumeX size={15} className="text-red-400" />
                      ) : (
                        <Volume2 size={15} />
                      )}
                    </button>

                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-parchment/50 shrink-0 uppercase">
                        Vol SFX:
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isSfxMuted ? 0 : sfxVolume}
                        onChange={(e) => {
                          setSfxVolume(parseFloat(e.target.value));
                          if (isSfxMuted) setIsSfxMuted(false);
                        }}
                        className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-arcane"
                      />
                      <span className="text-[10px] font-mono text-parchment/60 w-8 text-right shrink-0">
                        {Math.round((isSfxMuted ? 0 : sfxVolume) * 100)}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => stopActiveAudio()}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono text-parchment/70 hover:text-parchment shrink-0 cursor-pointer"
                      title="Parar efeito em reprodução"
                    >
                      Parar SFX
                    </button>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSfxCategoryFilter('all')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer",
                        sfxCategoryFilter === 'all'
                          ? "bg-arcane text-obsidian font-bold"
                          : "bg-white/5 hover:bg-white/10 text-parchment/60"
                      )}
                    >
                      Todos ({SYSTEM_SOUND_DEFINITIONS.length})
                    </button>
                    {(Object.keys(CATEGORY_LABELS) as SoundCategory[]).filter(c => c !== 'ambient').map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSfxCategoryFilter(cat)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer",
                          sfxCategoryFilter === cat
                            ? "bg-arcane text-obsidian font-bold"
                            : "bg-white/5 hover:bg-white/10 text-parchment/60"
                        )}
                      >
                        {CATEGORY_LABELS[cat]?.label || cat}
                      </button>
                    ))}
                  </div>

                  {/* Soundboard Buttons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredSounds.map((sound) => {
                      const isTriggering = activePlayingSfxKey === sound.key;
                      return (
                        <button
                          key={sound.key}
                          type="button"
                          onClick={() => handleTriggerSfx(sound)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer group relative overflow-hidden",
                            isTriggering 
                              ? "bg-arcane/30 border-arcane text-parchment scale-[0.98] shadow-lg shadow-arcane/30 ring-1 ring-arcane" 
                              : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 text-parchment/80"
                          )}
                          title={`${sound.name} — ${sound.description}`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className={cn("p-1 rounded-md bg-black/40 shrink-0", sound.accentColor)}>
                              {getSfxIcon(sound.category, sound.key)}
                            </span>
                            <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0", sound.badgeColor)}>
                              {sound.badge}
                            </span>
                          </div>

                          <div className="min-w-0 mt-1">
                            <span className="text-xs font-serif font-medium truncate block group-hover:text-parchment">
                              {sound.name}
                            </span>
                          </div>

                          {isTriggering && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcane animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Shortcut */}
            {onOpenFullSoundManager && (
              <div className="p-3 border-t border-white/10 bg-black/40 flex items-center justify-between">
                <span className="text-[11px] font-mono text-parchment/50">
                  Precisa enviar sons em MP3/WAV ou links?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    onOpenFullSoundManager();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink size={12} />
                  <span>Gestor Completo</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GMAudioController;
