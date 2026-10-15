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
  ExternalLink,
  Sliders,
  Music,
  Dices,
  ShieldAlert,
  Flame,
  Award,
  Zap,
  Save,
  Globe
} from 'lucide-react';
import { 
  SoundConfig, 
  SoundEffectType, 
  SOUND_PRESETS, 
  DEFAULT_SOUNDS, 
  playSoundEffect, 
  playRollOutcomeSound, 
  stopActiveAudio,
  convertAudioFileToDataUrl,
  RollOutcome
} from '../lib/soundEngine';

interface SoundEffectManagerProps {
  currentSettings: SoundConfig;
  sessionName?: string;
  sessionId?: string;
  isGlobalMode?: boolean;
  onSaveSession?: (sounds: SoundConfig, alsoSaveGlobal: boolean) => Promise<void>;
  onSaveGlobal?: (sounds: SoundConfig) => Promise<void>;
  onUpdateSound?: (key: keyof SoundConfig, value: string) => void;
}

interface SoundCardConfig {
  key: keyof SoundConfig;
  type: SoundEffectType;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  bgTint: string;
}

const SOUND_CARDS: SoundCardConfig[] = [
  {
    key: 'diceRollSound',
    type: 'diceRoll',
    title: 'Rolagem de Dados',
    subtitle: 'Tocado enquanto os dados estão chacoalhando e sendo lançados.',
    badge: 'Chocalho',
    badgeColor: 'text-arcane border-arcane/30 bg-arcane/10',
    icon: Dices,
    accentColor: 'text-arcane',
    bgTint: 'border-arcane/20 bg-arcane/[0.03]'
  },
  {
    key: 'successSound',
    type: 'success',
    title: 'Sucesso Normal',
    subtitle: 'Tocado quando o resultado atinge ou supera a dificuldade (CD/Alvo).',
    badge: 'Sucesso',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    icon: Award,
    accentColor: 'text-emerald-400',
    bgTint: 'border-emerald-500/20 bg-emerald-950/[0.10]'
  },
  {
    key: 'failureSound',
    type: 'failure',
    title: 'Falha Normal',
    subtitle: 'Tocado quando o resultado fica abaixo da dificuldade ou meta.',
    badge: 'Falha',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    icon: ShieldAlert,
    accentColor: 'text-amber-400',
    bgTint: 'border-amber-500/20 bg-amber-950/[0.10]'
  },
  {
    key: 'criticalSound',
    type: 'critical',
    title: 'Acerto Crítico (20 Natural)',
    subtitle: 'Tocado em acertos críticos lendários, 20s naturais ou sucessos extremos.',
    badge: 'Crítico Épico',
    badgeColor: 'text-gold border-gold/40 bg-gold/15',
    icon: Sparkles,
    accentColor: 'text-gold',
    bgTint: 'border-gold/30 bg-gold/[0.05]'
  },
  {
    key: 'fumbleSound',
    type: 'fumble',
    title: 'Falha Crítica / Desastre (1 Natural)',
    subtitle: 'Tocado em desastres catastróficos, 1s naturais ou falhas críticas.',
    badge: 'Desastre',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    icon: Flame,
    accentColor: 'text-rose-400',
    bgTint: 'border-rose-500/25 bg-rose-950/[0.12]'
  }
];

export default function SoundEffectManager({
  currentSettings,
  sessionName,
  sessionId,
  isGlobalMode = false,
  onSaveSession,
  onSaveGlobal,
  onUpdateSound
}: SoundEffectManagerProps) {
  const [sounds, setSounds] = React.useState<Required<SoundConfig>>({
    diceRollSound: currentSettings.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
    successSound: currentSettings.successSound || DEFAULT_SOUNDS.successSound,
    failureSound: currentSettings.failureSound || DEFAULT_SOUNDS.failureSound,
    criticalSound: currentSettings.criticalSound || DEFAULT_SOUNDS.criticalSound,
    fumbleSound: currentSettings.fumbleSound || DEFAULT_SOUNDS.fumbleSound
  });

  const [activePlayingKey, setActivePlayingKey] = React.useState<keyof SoundConfig | null>(null);
  const [uploadLoadingKey, setUploadLoadingKey] = React.useState<keyof SoundConfig | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [alsoSaveGlobal, setAlsoSaveGlobal] = React.useState(true);
  const [volume, setVolume] = React.useState<number>(0.6);

  // Sync state when props change
  React.useEffect(() => {
    setSounds({
      diceRollSound: currentSettings.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
      successSound: currentSettings.successSound || DEFAULT_SOUNDS.successSound,
      failureSound: currentSettings.failureSound || DEFAULT_SOUNDS.failureSound,
      criticalSound: currentSettings.criticalSound || DEFAULT_SOUNDS.criticalSound,
      fumbleSound: currentSettings.fumbleSound || DEFAULT_SOUNDS.fumbleSound
    });
  }, [currentSettings]);

  const handleSoundChange = (key: keyof SoundConfig, value: string) => {
    setSounds(prev => ({ ...prev, [key]: value }));
    if (onUpdateSound) {
      onUpdateSound(key, value);
    }
  };

  const handleTestSound = (key: keyof SoundConfig, type: SoundEffectType) => {
    if (activePlayingKey === key) {
      stopActiveAudio();
      setActivePlayingKey(null);
      return;
    }

    stopActiveAudio();
    setActivePlayingKey(key);
    const audio = playSoundEffect(type, sounds[key], volume);
    
    if (audio) {
      audio.onended = () => {
        setActivePlayingKey(null);
      };
    } else {
      // Procedural synthesizer finishes quickly
      setTimeout(() => {
        setActivePlayingKey(null);
      }, 700);
    }
  };

  const handleSimulateOutcome = (outcome: RollOutcome) => {
    stopActiveAudio();
    setActivePlayingKey(
      outcome === 'critical' ? 'criticalSound' :
      outcome === 'fumble' ? 'fumbleSound' :
      outcome === 'success' ? 'successSound' : 'failureSound'
    );
    playRollOutcomeSound(outcome, sounds, volume);
    setTimeout(() => {
      setActivePlayingKey(null);
    }, 1200);
  };

  const handleFileUpload = async (key: keyof SoundConfig, file: File) => {
    setUploadError(null);
    setUploadLoadingKey(key);
    try {
      const result = await convertAudioFileToDataUrl(file);
      handleSoundChange(key, result.dataUrl);
      setSaveStatus({
        type: 'success',
        message: `Áudio "${result.name}" (${(result.size / 1024).toFixed(0)} KB) carregado com sucesso!`
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao carregar arquivo de áudio.');
    } finally {
      setUploadLoadingKey(null);
    }
  };

  const handleResetToDefault = (key: keyof SoundConfig) => {
    handleSoundChange(key, DEFAULT_SOUNDS[key]);
  };

  const handleResetAll = () => {
    setSounds({ ...DEFAULT_SOUNDS });
    if (onUpdateSound) {
      Object.entries(DEFAULT_SOUNDS).forEach(([k, v]) => {
        onUpdateSound(k as keyof SoundConfig, v);
      });
    }
    setSaveStatus({
      type: 'success',
      message: 'Todos os sons foram redefinidos para os padrões de fábrica!'
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      if (isGlobalMode) {
        if (onSaveGlobal) {
          await onSaveGlobal(sounds);
          setSaveStatus({ type: 'success', message: 'Efeitos sonoros globais salvos com sucesso!' });
        }
      } else {
        if (onSaveSession) {
          await onSaveSession(sounds, alsoSaveGlobal);
          setSaveStatus({ 
            type: 'success', 
            message: alsoSaveGlobal 
              ? 'Sons salvos nesta campanha e sincronizados no padrão global!' 
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Context Info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-arcane/15 via-white/[0.03] to-purple-950/20 border border-arcane/30 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Music size={22} className="text-arcane animate-pulse" />
            <h3 className="text-xl font-serif font-bold text-parchment">
              Gerenciador de Efeitos Sonoros do Mestre
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-arcane/20 text-arcane border border-arcane/30 uppercase tracking-widest">
              Rolador TTRPG
            </span>
          </div>
          <p className="text-xs text-parchment/60 font-mono">
            Personalize os efeitos de áudio que tocam para o Mestre e todos os jogadores durante rolagens, acertos, falhas e críticos.
          </p>
        </div>

        {/* Global Context Tag */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono text-parchment/40 block">Escopo Atual</span>
            <span className="text-xs font-mono font-bold text-arcane">
              {isGlobalMode ? 'Configuração Padrão Global' : sessionName ? `Campanha: ${sessionName}` : 'Campanha Ativa'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="p-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/60 hover:text-parchment text-xs font-mono flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            title="Redefinir todos os sons para o padrão"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Restaurar Padrões</span>
          </button>
        </div>
      </div>

      {/* Outcome Simulator Bar */}
      <div className="p-4 rounded-xl bg-obsidian/60 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-gold" />
            <span className="text-xs font-bold font-serif text-parchment">
              Simulador de Desfechos em Tempo Real
            </span>
            <span className="text-[10px] font-mono text-parchment/40">
              (Clique para testar o som que o jogador ouve ao rolar)
            </span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 text-xs font-mono text-parchment/60">
            <Volume2 size={14} className="text-arcane" />
            <span>Volume:</span>
            <input 
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-arcane cursor-pointer"
              title={`Volume de teste: ${Math.round(volume * 100)}%`}
            />
            <span className="w-8 text-[10px] text-parchment/40">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => handleTestSound('diceRollSound', 'diceRoll')}
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activePlayingKey === 'diceRollSound'
                ? 'bg-arcane text-obsidian border-arcane shadow-md shadow-arcane/20 scale-[0.98]'
                : 'bg-white/5 hover:bg-arcane/20 text-arcane border-arcane/30'
            }`}
          >
            <Dices size={14} />
            <span>Rolagem</span>
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
            className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              activePlayingKey === 'fumbleSound'
                ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30 scale-[0.98]'
                : 'bg-rose-950/30 hover:bg-rose-600/20 text-rose-300 border-rose-500/30'
            }`}
          >
            <Flame size={14} />
            <span>Desastre (1)</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-2 text-xs text-red-300 font-mono">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Grid of 5 Sound Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SOUND_CARDS.map((card) => {
          const soundVal = sounds[card.key] || '';
          const isPlaying = activePlayingKey === card.key;
          const isUploaded = soundVal.startsWith('data:audio');
          const isSynth = soundVal.startsWith('synth:');
          const isCustomUrl = !isUploaded && !isSynth && !SOUND_PRESETS[card.type].some(p => p.url === soundVal);
          const presets = SOUND_PRESETS[card.type];
          const matchedPreset = presets.find(p => p.url === soundVal);

          return (
            <div
              key={card.key}
              className={`p-5 rounded-2xl border transition-all ${card.bgTint} ${
                isPlaying ? 'ring-2 ring-arcane shadow-lg' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-black/40 border border-white/10 ${card.accentColor}`}>
                    <card.icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-sm text-parchment">
                        {card.title}
                      </h4>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-parchment/50 font-mono mt-0.5">
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                {/* Preview / Stop Button */}
                <button
                  type="button"
                  onClick={() => handleTestSound(card.key, card.type)}
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

              {/* Status Badge: Source of Sound */}
              <div className="flex items-center justify-between text-[10px] font-mono px-1 py-1 text-parchment/60">
                <div className="flex items-center gap-1.5">
                  <span>Origem Atual:</span>
                  {isUploaded ? (
                    <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Check size={10} /> Arquivo Próprio (Upload)
                    </span>
                  ) : isSynth ? (
                    <span className="text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                      Sintetizador Web Audio
                    </span>
                  ) : matchedPreset ? (
                    <span className="text-arcane bg-arcane/15 border border-arcane/30 px-2 py-0.5 rounded-md">
                      Predefinição: {matchedPreset.name}
                    </span>
                  ) : (
                    <span className="text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      URL Customizada
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleResetToDefault(card.key)}
                  className="hover:text-parchment text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                  title="Restaurar padrão"
                >
                  <RotateCcw size={10} />
                  <span>Padrão</span>
                </button>
              </div>

              {/* Option 1: Select from Curated Presets */}
              <div className="mt-3 space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/40 px-1">
                  Selecionar Predefinição:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {presets.map((preset) => {
                    const isSelected = soundVal === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSoundChange(card.key, preset.url)}
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

              {/* Option 2: Upload File or Custom URL */}
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-parchment/40 px-1">
                    Arquivo Personalizado ou URL:
                  </span>
                  
                  {/* File Upload Button */}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono cursor-pointer transition-all border border-white/10 hover:border-arcane/50">
                    <Upload size={12} className="text-arcane" />
                    <span>{uploadLoadingKey === card.key ? 'Processando...' : 'Fazer Upload (MP3/WAV)'}</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(card.key, file);
                          e.target.value = '';
                        }
                      }}
                      disabled={uploadLoadingKey === card.key}
                    />
                  </label>
                </div>

                {isUploaded ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-emerald-500/30">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Music size={14} className="text-emerald-400 shrink-0" />
                      <div className="truncate font-mono text-xs text-emerald-300">
                        Áudio personalizado salvo (Base64)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetToDefault(card.key)}
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
                      value={soundVal.startsWith('synth:') ? '' : soundVal}
                      onChange={(e) => handleSoundChange(card.key, e.target.value)}
                      placeholder={soundVal.startsWith('synth:') ? 'Usando sintetizador procedural...' : 'Cole uma URL de áudio (https://...)'}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-arcane/60 transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Action Footer */}
      <div className="p-5 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Sliders size={16} className="text-arcane" />
            <h4 className="font-serif font-bold text-sm text-parchment">
              Aplicar Alterações Sonoras
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
              <span>Definir também como padrão para novas campanhas futuras</span>
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
