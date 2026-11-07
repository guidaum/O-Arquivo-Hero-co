import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Trash2, 
  X, 
  ChevronUp, 
  ChevronDown,
  Sparkles,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Play,
  Target,
  CheckCircle2,
  AlertCircle,
  Skull,
  Music,
  Sliders,
  ShieldAlert,
  Award,
  Dices,
  Flame
} from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { auth, db, collection, addDoc, doc, getDoc, getDocs, query, where, onSnapshot } from '../firebase';
import { cn, playAudio } from '../lib/utils';
import { 
  SoundConfig, 
  DEFAULT_SOUNDS, 
  playSoundEffect, 
  playRollOutcomeSound, 
  stopActiveAudio 
} from '../lib/soundEngine';
import DiceAnimationOverlay from './DiceAnimationOverlay';

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;
export type AdvantageMode = 'normal' | 'advantage' | 'disadvantage';
export type RollOutcome = 'critical' | 'fumble' | 'success' | 'failure';

export interface RollResult {
  id: string;
  timestamp: number;
  timeFormatted: string;
  dieType: DieType;
  quantity: number;
  modifier: number;
  advantageMode: AdvantageMode;
  targetDC?: number;
  isRollUnder?: boolean;
  outcome: RollOutcome;
  outcomeLabel: string;
  rolls: number[];
  discardedRolls?: number[];
  total: number;
  isNat20: boolean;
  isNat1: boolean;
  isMaxRoll: boolean;
  formula: string;
  details: string;
}

// Geometric SVG Icons for common TTRPG dice
export function D4Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 3 2 20 22 20" />
      <line x1="12" y1="3" x2="12" y2="20" strokeWidth="1.5" />
      <line x1="2" y1="20" x2="12" y2="13" strokeWidth="1.5" />
      <line x1="22" y1="20" x2="12" y2="13" strokeWidth="1.5" />
    </svg>
  );
}

export function D6Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function D8Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 21 12 12 22 3 12" />
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.5" />
      <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.5" />
      <polygon points="12 6 17 12 12 18 7 12" strokeWidth="1" strokeDasharray="1 1" opacity="0.6" />
    </svg>
  );
}

export function D10Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 21 9 12 22 3 9" />
      <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.5" />
      <line x1="3" y1="9" x2="12" y2="12" strokeWidth="1.5" />
      <line x1="21" y1="9" x2="12" y2="12" strokeWidth="1.5" />
    </svg>
  );
}

export function D12Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 21 8 18 20 6 20 3 8" />
      <polygon points="12 6 17 10 15 16 9 16 7 10" strokeWidth="1.2" />
      <line x1="12" y1="2" x2="12" y2="6" strokeWidth="1.2" />
      <line x1="21" y1="8" x2="17" y2="10" strokeWidth="1.2" />
      <line x1="18" y1="20" x2="15" y2="16" strokeWidth="1.2" />
      <line x1="6" y1="20" x2="9" y2="16" strokeWidth="1.2" />
      <line x1="3" y1="8" x2="7" y2="10" strokeWidth="1.2" />
    </svg>
  );
}

export function D20Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
      <polygon points="12 6 18 15 6 15" strokeWidth="1.3" />
      <line x1="12" y1="2" x2="12" y2="6" strokeWidth="1.2" />
      <line x1="21" y1="7" x2="18" y2="15" strokeWidth="1.2" />
      <line x1="21" y1="17" x2="18" y2="15" strokeWidth="1.2" />
      <line x1="12" y1="22" x2="12" y2="19" strokeWidth="1.2" />
      <line x1="3" y1="17" x2="6" y2="15" strokeWidth="1.2" />
      <line x1="3" y1="7" x2="6" y2="15" strokeWidth="1.2" />
    </svg>
  );
}

export function D100Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 21 9 12 22 3 9" />
      <text x="12" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">%</text>
    </svg>
  );
}

// Procedural Web Audio API sound for realistic dice clatter (fallback)
function playDiceRollSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const rattleTimes = [0, 0.07, 0.15, 0.24, 0.35];

    rattleTimes.forEach((time, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(280 + Math.random() * 220, now + time);
      osc.frequency.exponentialRampToValueAtTime(70, now + time + 0.06);

      const vol = 0.2 / (index * 0.4 + 1);
      gain.gain.setValueAtTime(vol, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + 0.07);
    });
  } catch {
    // Ignore audio failures if browser blocks autoplay
  }
}

const DICE_CONFIG: {
  type: DieType;
  label: string;
  name: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { type: 4, label: 'd4', name: 'D4', color: 'text-amber-400', badgeBg: 'bg-amber-500/15', borderColor: 'border-amber-500/30', icon: D4Icon, description: 'Dano leve / Adaga' },
  { type: 6, label: 'd6', name: 'D6', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/15', borderColor: 'border-emerald-500/30', icon: D6Icon, description: 'Ataque / Dano básico' },
  { type: 8, label: 'd8', name: 'D8', color: 'text-cyan-400', badgeBg: 'bg-cyan-500/15', borderColor: 'border-cyan-500/30', icon: D8Icon, description: 'Espada / Magias' },
  { type: 10, label: 'd10', name: 'D10', color: 'text-blue-400', badgeBg: 'bg-blue-500/15', borderColor: 'border-blue-500/30', icon: D10Icon, description: 'Armas pesadas / Truques' },
  { type: 12, label: 'd12', name: 'D12', color: 'text-purple-400', badgeBg: 'bg-purple-500/15', borderColor: 'border-purple-500/30', icon: D12Icon, description: 'Machado grande' },
  { type: 20, label: 'd20', name: 'D20', color: 'text-rose-400', badgeBg: 'bg-rose-500/15', borderColor: 'border-rose-500/30', icon: D20Icon, description: 'Ataques & Testes' },
  { type: 100, label: 'd100', name: 'D100', color: 'text-gold', badgeBg: 'bg-gold/15', borderColor: 'border-gold/30', icon: D100Icon, description: 'Percentual / Tabelas' },
];

const LOCAL_STORAGE_KEY = 'ttrpg_dice_roller_history_v2';
const SOUND_PREF_KEY = 'ttrpg_dice_sound_enabled';

export interface DiceRollerProps {
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  hideLauncherButton?: boolean;
  className?: string;
}

export default function DiceRoller(props: DiceRollerProps = {}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = React.useState<any>(null);
  const [sessionSettings, setSessionSettings] = React.useState<any>(null);
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const isOpen = props.isOpen !== undefined ? props.isOpen : internalIsOpen;
  const setIsOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isOpen) : val;
    setInternalIsOpen(nextVal);
    props.onToggleOpen?.(nextVal);
  };
  const [activeTab, setActiveTab] = React.useState<'roller' | 'history'>('roller');
  const [quantity, setQuantity] = React.useState<number>(1);
  const [modifier, setModifier] = React.useState<number>(0);
  const [advantageMode, setAdvantageMode] = React.useState<AdvantageMode>('normal');
  const [selectedDie, setSelectedDie] = React.useState<DieType>(20);
  
  // Target DC / Meta (Difficulty) configuration - por padrão sistema Menor é Melhor (Roll-Under)
  const [isTargetEnabled, setIsTargetEnabled] = React.useState<boolean>(false);
  const [targetDC, setTargetDC] = React.useState<number | ''>(15);
  const [isRollUnder, setIsRollUnder] = React.useState<boolean>(true);
  
  // Show Sound Settings Inspector Modal
  const [showSoundModal, setShowSoundModal] = React.useState(false);
  const [previewPlayingKey, setPreviewPlayingKey] = React.useState<string | null>(null);

  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(() => {
    return localStorage.getItem(SOUND_PREF_KEY) !== 'false';
  });

  const rollingAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const handlePreviewSound = (key: string, type: 'diceRoll' | 'success' | 'failure' | 'critical' | 'fumble', url: string) => {
    if (previewPlayingKey === key) {
      stopActiveAudio();
      setPreviewPlayingKey(null);
      return;
    }
    stopActiveAudio();
    setPreviewPlayingKey(key);
    const audio = playSoundEffect(type, url, 0.6);
    if (audio) {
      audio.onended = () => setPreviewPlayingKey(null);
    } else {
      setTimeout(() => setPreviewPlayingKey(null), 800);
    }
  };

  // History Log with persistent localStorage
  const [history, setHistory] = React.useState<RollResult[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [isRolling, setIsRolling] = React.useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = React.useState(false);
  const autoCloseTimerRef = React.useRef<any>(null);
  const [lastRoll, setLastRoll] = React.useState<RollResult | null>(() => history[0] || null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = React.useState<number | 'all'>('all');
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [recentlyCleared, setRecentlyCleared] = React.useState<RollResult[] | null>(null);

  // Clean up autoClose timer on unmount
  React.useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // 1. Listen in real-time to globalSettings/config (where Master saves default sounds)
  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'globalSettings', 'config'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (err) => {
      console.warn('Could not load globalSettings in DiceRoller:', err);
    });
    return () => unsub();
  }, []);

  // 2. Resolve active sessionId with multi-source fallback
  React.useEffect(() => {
    // 1) Direct GM Session route: /gm/session/:sessionId
    const pathParts = location.pathname.split('/');
    if (pathParts[1] === 'gm' && pathParts[2] === 'session' && pathParts[3]) {
      setSessionId(pathParts[3]);
      localStorage.setItem('last_active_session_id', pathParts[3]);
      return;
    }

    // 2) Query parameters: ?session=... or ?fromSession=...
    const paramSession = searchParams.get('session') || searchParams.get('fromSession');
    if (paramSession) {
      setSessionId(paramSession);
      localStorage.setItem('last_active_session_id', paramSession);
      return;
    }

    // 3) Character sheet parameter: /sheet?id=...
    const charId = searchParams.get('id');
    if (charId && location.pathname === '/sheet') {
      getDoc(doc(db, 'characters', charId)).then(docSnap => {
        if (docSnap.exists()) {
          const charSessionId = docSnap.data().sessionId;
          if (charSessionId) {
            setSessionId(charSessionId);
            localStorage.setItem('last_active_session_id', charSessionId);
          }
        }
      }).catch(() => {});
      return;
    }

    // 4) Saved in localStorage
    const savedSession = localStorage.getItem('last_active_session_id');
    if (savedSession) {
      setSessionId(savedSession);
      return;
    }

    // 5) Query user's current session in database if authenticated
    if (auth.currentUser) {
      const qGm = query(collection(db, 'gameSessions'), where('gmId', '==', auth.currentUser.uid));
      getDocs(qGm).then(snap => {
        if (!snap.empty) {
          const firstId = snap.docs[0].id;
          setSessionId(firstId);
          localStorage.setItem('last_active_session_id', firstId);
        } else if (auth.currentUser) {
          const qPlayer = query(collection(db, 'gameSessions'), where('playerIds', 'array-contains', auth.currentUser.uid));
          getDocs(qPlayer).then(pSnap => {
            if (!pSnap.empty) {
              const pId = pSnap.docs[0].id;
              setSessionId(pId);
              localStorage.setItem('last_active_session_id', pId);
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [location, searchParams]);

  // 3. Listen in real-time to gameSessions/{sessionId} (where Master can customize session sounds)
  React.useEffect(() => {
    if (!sessionId) {
      setSessionSettings(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'gameSessions', sessionId), (snap) => {
      if (snap.exists()) {
        setSessionSettings(snap.data());
      }
    }, (err) => {
      console.warn('Could not load session settings in DiceRoller:', err);
    });
    return () => unsub();
  }, [sessionId]);

  // Cleanup rolling sound on unmount
  React.useEffect(() => {
    return () => {
      if (rollingAudioRef.current) {
        try {
          rollingAudioRef.current.pause();
        } catch {}
        rollingAudioRef.current = null;
      }
    };
  }, []);

  // Resolve Master Audio Configuration
  const effectiveSettings: SoundConfig = {
    diceRollSound: sessionSettings?.diceRollSound || globalSettings?.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
    successSound: sessionSettings?.successSound || globalSettings?.successSound || DEFAULT_SOUNDS.successSound,
    failureSound: sessionSettings?.failureSound || globalSettings?.failureSound || DEFAULT_SOUNDS.failureSound,
    criticalSound: sessionSettings?.criticalSound || globalSettings?.criticalSound || DEFAULT_SOUNDS.criticalSound,
    fumbleSound: sessionSettings?.fumbleSound || globalSettings?.fumbleSound || DEFAULT_SOUNDS.fumbleSound
  };
  const diceRollSound = effectiveSettings.diceRollSound!;
  const successSound = effectiveSettings.successSound!;
  const failureSound = effectiveSettings.failureSound!;
  const criticalSound = effectiveSettings.criticalSound!;
  const fumbleSound = effectiveSettings.fumbleSound!;

  // Sync history to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // Ignore quota errors
    }
  }, [history]);

  // Sync sound preference
  React.useEffect(() => {
    localStorage.setItem(SOUND_PREF_KEY, String(soundEnabled));
  }, [soundEnabled]);

  // Execute Roll with Visual Animation Overlay
  const rollDice = (
    dieType: DieType = selectedDie, 
    qty: number = quantity, 
    mod: number = modifier, 
    advMode: AdvantageMode = advantageMode
  ) => {
    if (isRolling) return;
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    if (!isOpen) {
      setIsOpen(true);
    }
    setIsOverlayOpen(true);
    setIsRolling(true);

    // Stop previous rolling audio if still playing
    if (rollingAudioRef.current) {
      try {
        rollingAudioRef.current.pause();
      } catch {}
      rollingAudioRef.current = null;
    }

    if (soundEnabled) {
      // Play Master's configured rolling audio with infallible synth fallback
      rollingAudioRef.current = playSoundEffect('diceRoll', diceRollSound, 0.4);
      // Play procedural audio backdrop as well
      playDiceRollSound();
    }

    setTimeout(() => {
      // Stop rolling audio
      if (rollingAudioRef.current) {
        try {
          rollingAudioRef.current.pause();
        } catch {}
        rollingAudioRef.current = null;
      }

      let rolls: number[] = [];
      let discardedRolls: number[] | undefined;

      if (advMode === 'normal' || qty > 1) {
        rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * dieType) + 1);
      } else {
        // Advantage or Disadvantage on a single die roll
        const roll1 = Math.floor(Math.random() * dieType) + 1;
        const roll2 = Math.floor(Math.random() * dieType) + 1;
        if (isRollUnder) {
          // No sistema Menor é Melhor:
          // Vantagem seleciona o menor valor (melhor resultado)
          // Desvantagem seleciona o maior valor (pior resultado)
          if (advMode === 'advantage') {
            rolls = [Math.min(roll1, roll2)];
            discardedRolls = [Math.max(roll1, roll2)];
          } else {
            rolls = [Math.max(roll1, roll2)];
            discardedRolls = [Math.min(roll1, roll2)];
          }
        } else {
          // Sistema convencional Roll-Over (maior é melhor)
          if (advMode === 'advantage') {
            rolls = [Math.max(roll1, roll2)];
            discardedRolls = [Math.min(roll1, roll2)];
          } else {
            rolls = [Math.min(roll1, roll2)];
            discardedRolls = [Math.max(roll1, roll2)];
          }
        }
      }

      const rawSum = rolls.reduce((sum, r) => sum + r, 0);
      const total = rawSum + mod;

      const isNat20 = dieType === 20 && rolls.includes(20);
      const isNat1 = dieType === 20 && rolls.includes(1);
      const isMaxRoll = rolls.every(r => r === dieType);
      const isMinRoll = rolls.every(r => r === 1);

      // Determine outcome: Critical, Fumble, Success, Failure
      // No sistema atual: Menor é melhor (1 é sucesso crítico, 20 é falha crítica)
      let outcome: RollOutcome;
      let outcomeLabel: string;

      const hasTarget = isTargetEnabled && targetDC !== '';
      const dcVal = hasTarget ? Number(targetDC) : null;

      if (hasTarget && dcVal !== null) {
        if (isRollUnder) {
          // Sistema Padrão Menor é Melhor (Roll-Under): total <= alvo é sucesso; 1 é crit, 20 é fumble
          if (isNat1 || (qty === 1 && isMinRoll)) {
            outcome = 'critical';
            outcomeLabel = 'Acerto Crítico!';
          } else if (isNat20 || (qty === 1 && isMaxRoll)) {
            outcome = 'fumble';
            outcomeLabel = 'Falha Crítica!';
          } else if (total <= dcVal) {
            outcome = 'success';
            outcomeLabel = `Sucesso! (≤ ${dcVal})`;
          } else {
            outcome = 'failure';
            outcomeLabel = `Falha! (> ${dcVal})`;
          }
        } else {
          // Modo alternativo Roll-Over: total >= CD é sucesso; 20 é crit, 1 é fumble
          if (isNat20 || (qty === 1 && isMaxRoll)) {
            outcome = 'critical';
            outcomeLabel = 'Acerto Crítico!';
          } else if (isNat1 || (qty === 1 && isMinRoll)) {
            outcome = 'fumble';
            outcomeLabel = 'Falha Crítica!';
          } else if (total >= dcVal) {
            outcome = 'success';
            outcomeLabel = `Sucesso! (≥ ${dcVal})`;
          } else {
            outcome = 'failure';
            outcomeLabel = `Falha! (< ${dcVal})`;
          }
        }
      } else {
        // Rolagem Livre sem Meta de Dificuldade:
        if (isRollUnder) {
          // Menor é melhor por padrão: 1 é Acerto Crítico, 20 é Falha Crítica
          if (isNat1 || (qty === 1 && isMinRoll)) {
            outcome = 'critical';
            outcomeLabel = 'Acerto Crítico!';
          } else if (isNat20 || (qty === 1 && isMaxRoll)) {
            outcome = 'fumble';
            outcomeLabel = 'Falha Crítica!';
          } else {
            // Em menor é melhor, rolar abaixo ou igual à média é sucesso
            const average = Math.ceil((dieType * qty) / 2);
            if (rawSum <= average) {
              outcome = 'success';
              outcomeLabel = 'Sucesso! (≤ média)';
            } else {
              outcome = 'failure';
              outcomeLabel = 'Falha! (> média)';
            }
          }
        } else {
          // Roll-Over: 20 é crit, 1 é fumble
          if (isNat20 || (qty === 1 && isMaxRoll)) {
            outcome = 'critical';
            outcomeLabel = 'Acerto Crítico!';
          } else if (isNat1 || (qty === 1 && isMinRoll)) {
            outcome = 'fumble';
            outcomeLabel = 'Falha Crítica!';
          } else {
            const average = Math.ceil((dieType * qty) / 2);
            if (rawSum >= average) {
              outcome = 'success';
              outcomeLabel = 'Sucesso!';
            } else {
              outcome = 'failure';
              outcomeLabel = 'Falha!';
            }
          }
        }
      }

      // Play the Master's outcome sound registered in settings
      if (soundEnabled) {
        playRollOutcomeSound(outcome, effectiveSettings, 0.6);
      }

      const now = new Date();
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      let formulaStr = `${qty}d${dieType}`;
      if (advMode === 'advantage') formulaStr += ' (Vantagem)';
      if (advMode === 'disadvantage') formulaStr += ' (Desvantagem)';
      if (mod !== 0) formulaStr += mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`;
      if (hasTarget && dcVal !== null) formulaStr += ` vs ${isRollUnder ? '≤' : '≥'}${dcVal}`;

      let detailsStr = `[${rolls.join(', ')}]`;
      if (discardedRolls && discardedRolls.length > 0) {
        detailsStr += ` (desc. ${discardedRolls.join(', ')})`;
      }
      if (mod !== 0) {
        detailsStr += mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`;
      }

      const result: RollResult = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        timeFormatted,
        dieType,
        quantity: qty,
        modifier: mod,
        advantageMode: advMode,
        targetDC: hasTarget && dcVal !== null ? dcVal : undefined,
        isRollUnder: hasTarget ? isRollUnder : undefined,
        outcome,
        outcomeLabel,
        rolls,
        discardedRolls,
        total,
        isNat20,
        isNat1,
        isMaxRoll,
        formula: formulaStr,
        details: detailsStr
      };

      setLastRoll(result);
      setHistory(prev => [result, ...prev].slice(0, 50));
      setIsRolling(false);

      // Auto dismiss overlay after 3.8s if not re-rolled or closed manually
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        setIsOverlayOpen(false);
      }, 3800);

      // Send to active campaign chat session if connected
      if (sessionId && auth.currentUser) {
        addDoc(collection(db, 'chatMessages'), {
          sessionId,
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Jogador',
          senderPhoto: auth.currentUser.photoURL || '',
          text: `🎲 ${formulaStr} ➔ ${total} (${detailsStr}) [${outcomeLabel}]`,
          type: 'roll',
          rollData: {
            total,
            formula: formulaStr,
            details: detailsStr,
            rolls: [{ die: `${qty}d${dieType}`, values: rolls }],
            outcome,
            isNat20,
            isNat1
          },
          createdAt: new Date().toISOString()
        }).catch(() => {});
      }
    }, 800);
  };

  // Listen to external dice roll requests (e.g. from Character Sheet skills or Dungeon Map)
  React.useEffect(() => {
    const handleTriggerRoll = (e: any) => {
      if (e.detail) {
        const { dieType = 20, quantity = 1, modifier = 0, advantageMode = 'normal' } = e.detail;
        setSelectedDie(dieType as DieType);
        setQuantity(quantity);
        setModifier(modifier);
        setAdvantageMode(advantageMode as AdvantageMode);
        setIsOpen(true);
        rollDice(dieType as DieType, quantity, modifier, advantageMode as AdvantageMode);
      }
    };
    window.addEventListener('heroic_trigger_roll', handleTriggerRoll);
    return () => window.removeEventListener('heroic_trigger_roll', handleTriggerRoll);
  }, []);

  const copyRollResult = (result: RollResult) => {
    const textToCopy = `🎲 ${result.formula} = ${result.total} (${result.details}) - ${result.outcomeLabel}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(result.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const handleClearHistory = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (history.length === 0) return;
    setRecentlyCleared(history);
    setHistory([]);
    setLastRoll(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // fallback
    }
    setIsConfirmingClear(false);
  };

  const handleRestoreHistory = () => {
    if (!recentlyCleared || recentlyCleared.length === 0) return;
    setHistory(recentlyCleared);
    setLastRoll(recentlyCleared[0] || null);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recentlyCleared.slice(0, 50)));
    } catch {
      // fallback
    }
    setRecentlyCleared(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
      } catch {
        // fallback
      }
      if (lastRoll?.id === id) {
        setLastRoll(updated[0] || null);
      }
      return updated;
    });
  };

  const filteredHistory = historyFilter === 'all' 
    ? history 
    : history.filter(h => h.dieType === historyFilter);

  // Statistics
  const totalRollsCount = history.length;
  const criticalCount = history.filter(h => h.outcome === 'critical').length;
  const fumbleCount = history.filter(h => h.outcome === 'fumble').length;
  const successCount = history.filter(h => h.outcome === 'success').length;
  const avgResult = totalRollsCount > 0 
    ? Math.round((history.reduce((acc, h) => acc + h.total, 0) / totalRollsCount) * 10) / 10 
    : 0;

  return (
    <div className={cn(
      props.hideLauncherButton 
        ? "fixed bottom-24 right-4 sm:right-6 z-[70]" 
        : "fixed bottom-[9.5rem] right-4 lg:bottom-10 lg:right-28 z-[60]",
      props.className
    )}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 25 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className={cn(
              "glass-popup bg-obsidian/95 backdrop-blur-2xl rounded-[2.2rem] border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[82vh] z-50 text-parchment relative",
              props.hideLauncherButton
                ? "w-[calc(100vw-2rem)] sm:w-[27rem]"
                : "absolute bottom-14 right-0 w-[calc(100vw-2rem)] sm:w-[27rem]"
            )}
          >
            {/* Visual Animation Overlay with 3D Spinning Die and Reveal */}
            <DiceAnimationOverlay
              isOpen={isOverlayOpen}
              isSpinning={isRolling}
              dieType={selectedDie}
              quantity={quantity}
              modifier={modifier}
              formula={lastRoll?.formula || `${quantity}d${selectedDie}${modifier ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''}`}
              result={lastRoll}
              onReroll={() => rollDice(selectedDie, quantity, modifier, advantageMode)}
              onClose={() => {
                if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                setIsOverlayOpen(false);
                setIsRolling(false);
              }}
            />

            {/* Header with Tabs */}
            <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
              <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('roller');
                    setShowSoundModal(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeTab === 'roller' && !showSoundModal
                      ? "bg-arcane text-obsidian shadow-md"
                      : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                  )}
                >
                  <D20Icon className="w-4 h-4" />
                  <span>Rolador</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    setShowSoundModal(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer relative",
                    activeTab === 'history' && !showSoundModal
                      ? "bg-arcane text-obsidian shadow-md"
                      : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                  )}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Histórico</span>
                  {history.length > 0 && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      activeTab === 'history' && !showSoundModal ? "bg-obsidian/40 text-obsidian" : "bg-white/10 text-parchment/80"
                    )}>
                      {history.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-1">
                {/* Master Audio Inspector Modal Button */}
                <button
                  type="button"
                  onClick={() => setShowSoundModal(!showSoundModal)}
                  title="Sons cadastrados pelo Mestre (Rolagem, Sucesso, Falha, Crítico, Desastre)"
                  className={cn(
                    "p-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono",
                    showSoundModal 
                      ? "bg-arcane/25 text-arcane border border-arcane/30" 
                      : "hover:bg-white/10 text-parchment/50 hover:text-parchment"
                  )}
                >
                  <Music size={15} className="text-arcane" />
                  <span className="hidden sm:inline text-[10px]">Sons do Mestre</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Som ativado (clique para mutar)" : "Som desativado (clique para ativar)"}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/50 hover:text-parchment cursor-pointer"
                >
                  {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} />}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-ember cursor-pointer"
                  title="Fechar rolador"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* SOUNDS INSPECTOR PANEL (Shows Master's Configured Audio) */}
            {showSoundModal && (
              <div className="p-4 bg-black/60 border-b border-white/10 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music size={16} className="text-arcane animate-pulse" />
                    <h4 className="font-serif font-bold text-xs text-parchment">
                      Sons Cadastrados pelo Mestre
                    </h4>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {sessionSettings?.name ? `Campanha: ${sessionSettings.name}` : sessionId ? 'Campanha Ativa' : 'Padrão Global'}
                  </span>
                </div>
                <p className="text-[10px] text-parchment/60 leading-relaxed font-mono">
                  Estes são os efeitos sonoros registrados pelo Mestre no painel da campanha. Toque em "Ouvir" para testar qualquer áudio:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Dice Roll Sound */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="overflow-hidden mr-2">
                      <span className="text-parchment/80 font-mono text-[11px] flex items-center gap-1.5 font-medium">
                        <Dices size={12} className="text-arcane" />
                        <span>Dados Rolando</span>
                      </span>
                      <span className="text-[9px] font-mono text-parchment/40 truncate block">
                        {diceRollSound.startsWith('data:') ? 'Áudio do Mestre (Upload)' : diceRollSound.startsWith('synth:') ? 'Sintetizador Web Audio' : 'Predefinição / URL'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound('diceRoll', 'diceRoll', diceRollSound)}
                      className={`p-1 px-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shrink-0 ${
                        previewPlayingKey === 'diceRoll'
                          ? 'bg-arcane text-obsidian font-bold shadow-sm'
                          : 'bg-arcane/20 hover:bg-arcane/30 text-arcane'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{previewPlayingKey === 'diceRoll' ? 'Tocando...' : 'Ouvir'}</span>
                    </button>
                  </div>

                  {/* Success Sound */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                    <div className="overflow-hidden mr-2">
                      <span className="text-emerald-300 font-mono text-[11px] flex items-center gap-1.5 font-medium">
                        <Award size={12} className="text-emerald-400" />
                        <span>Som de Sucesso</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400/50 truncate block">
                        {successSound.startsWith('data:') ? 'Áudio do Mestre (Upload)' : successSound.startsWith('synth:') ? 'Sintetizador Web Audio' : 'Predefinição / URL'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound('success', 'success', successSound)}
                      className={`p-1 px-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shrink-0 ${
                        previewPlayingKey === 'success'
                          ? 'bg-emerald-400 text-obsidian font-bold shadow-sm'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{previewPlayingKey === 'success' ? 'Tocando...' : 'Ouvir'}</span>
                    </button>
                  </div>

                  {/* Failure Sound */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/20 border border-amber-500/20">
                    <div className="overflow-hidden mr-2">
                      <span className="text-amber-300 font-mono text-[11px] flex items-center gap-1.5 font-medium">
                        <ShieldAlert size={12} className="text-amber-400" />
                        <span>Som de Falha</span>
                      </span>
                      <span className="text-[9px] font-mono text-amber-400/50 truncate block">
                        {failureSound.startsWith('data:') ? 'Áudio do Mestre (Upload)' : failureSound.startsWith('synth:') ? 'Sintetizador Web Audio' : 'Predefinição / URL'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound('failure', 'failure', failureSound)}
                      className={`p-1 px-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shrink-0 ${
                        previewPlayingKey === 'failure'
                          ? 'bg-amber-400 text-obsidian font-bold shadow-sm'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{previewPlayingKey === 'failure' ? 'Tocando...' : 'Ouvir'}</span>
                    </button>
                  </div>

                  {/* Critical Sound */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-gold/10 border border-gold/25">
                    <div className="overflow-hidden mr-2">
                      <span className="text-gold font-mono text-[11px] flex items-center gap-1.5 font-bold">
                        <Sparkles size={12} className="text-gold" />
                        <span>Som de Crítico</span>
                      </span>
                      <span className="text-[9px] font-mono text-gold/50 truncate block">
                        {criticalSound.startsWith('data:') ? 'Áudio do Mestre (Upload)' : criticalSound.startsWith('synth:') ? 'Sintetizador Web Audio' : 'Predefinição / URL'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound('critical', 'critical', criticalSound)}
                      className={`p-1 px-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shrink-0 ${
                        previewPlayingKey === 'critical'
                          ? 'bg-gold text-obsidian font-bold shadow-sm'
                          : 'bg-gold/20 hover:bg-gold/30 text-gold'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{previewPlayingKey === 'critical' ? 'Tocando...' : 'Ouvir'}</span>
                    </button>
                  </div>

                  {/* Fumble Sound */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-red-950/30 border border-red-500/30 sm:col-span-2">
                    <div className="overflow-hidden mr-2">
                      <span className="text-red-300 font-mono text-[11px] flex items-center gap-1.5 font-bold">
                        <Flame size={12} className="text-red-400" />
                        <span>Som de Desastre (Falha Crítica)</span>
                      </span>
                      <span className="text-[9px] font-mono text-red-400/50 truncate block">
                        {fumbleSound.startsWith('data:') ? 'Áudio do Mestre (Upload)' : fumbleSound.startsWith('synth:') ? 'Sintetizador Web Audio' : 'Predefinição / URL'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound('fumble', 'fumble', fumbleSound)}
                      className={`p-1 px-2.5 rounded-lg text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all shrink-0 ${
                        previewPlayingKey === 'fumble'
                          ? 'bg-rose-500 text-white font-bold shadow-sm'
                          : 'bg-red-600/25 hover:bg-red-600/35 text-red-300'
                      }`}
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{previewPlayingKey === 'fumble' ? 'Tocando...' : 'Ouvir'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Roll Simulation triggers */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-parchment/50">
                  <span>Simular Desfechos no Rolador:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => playRollOutcomeSound('success', effectiveSettings, 0.6)}
                      className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                    >
                      ✨ Sucesso
                    </button>
                    <button
                      type="button"
                      onClick={() => playRollOutcomeSound('failure', effectiveSettings, 0.6)}
                      className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer"
                    >
                      ❌ Falha
                    </button>
                    <button
                      type="button"
                      onClick={() => playRollOutcomeSound('critical', effectiveSettings, 0.6)}
                      className="px-2 py-0.5 rounded bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 cursor-pointer"
                    >
                      🌟 Crítico
                    </button>
                    <button
                      type="button"
                      onClick={() => playRollOutcomeSound('fumble', effectiveSettings, 0.6)}
                      className="px-2 py-0.5 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 cursor-pointer"
                    >
                      💀 Desastre
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: DICE ROLLER */}
            {activeTab === 'roller' && (
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
                {/* Dice Selection Grid (d4, d6, d8, d10, d12, d20, d100) */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest">
                      Selecione o Dado ou Toque para Rolar 1x
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {DICE_CONFIG.map((die) => {
                      const Icon = die.icon;
                      const isSelected = selectedDie === die.type;
                      return (
                        <button
                          key={die.type}
                          type="button"
                          onClick={() => {
                            setSelectedDie(die.type);
                            rollDice(die.type, quantity, modifier, advantageMode);
                          }}
                          disabled={isRolling}
                          title={`${die.name}: ${die.description} (Clique para rolar)`}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer relative group",
                            isSelected
                              ? "bg-white/15 border-arcane shadow-[0_0_15px_rgba(56,189,248,0.25)] text-parchment"
                              : "bg-white/[0.04] border-white/10 hover:bg-white/10 hover:border-white/20 text-parchment/70",
                            isRolling && "opacity-50 pointer-events-none"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-xl mb-1 transition-transform group-hover:scale-110", die.color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-serif font-bold tracking-tight">{die.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modifiers, Quantity & Target DC Panel */}
                <div className="bg-white/[0.03] p-3.5 rounded-2xl border border-white/10 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest">
                          Quantidade
                        </label>
                        <span className="text-[10px] font-mono text-arcane">{quantity}d{selectedDie}</span>
                      </div>
                      <div className="flex items-center bg-black/40 rounded-xl overflow-hidden border border-white/10">
                        <button 
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="p-2 hover:bg-white/10 text-parchment/70 cursor-pointer active:scale-90"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <input 
                          type="number" 
                          min="1"
                          max="20"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                          className="w-full bg-transparent text-center font-mono text-sm focus:outline-none text-parchment font-bold"
                        />
                        <button 
                          type="button"
                          onClick={() => setQuantity(Math.min(20, quantity + 1))}
                          className="p-2 hover:bg-white/10 text-parchment/70 cursor-pointer active:scale-90"
                        >
                          <ChevronUp size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Modifier */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest">
                          Modificador
                        </label>
                        <span className="text-[10px] font-mono text-gold">
                          {modifier >= 0 ? `+${modifier}` : modifier}
                        </span>
                      </div>
                      <div className="flex items-center bg-black/40 rounded-xl overflow-hidden border border-white/10">
                        <button 
                          type="button"
                          onClick={() => setModifier(modifier - 1)}
                          className="p-2 hover:bg-white/10 text-parchment/70 cursor-pointer active:scale-90"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <input 
                          type="number" 
                          value={modifier}
                          onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent text-center font-mono text-sm focus:outline-none text-parchment font-bold"
                        />
                        <button 
                          type="button"
                          onClick={() => setModifier(modifier + 1)}
                          className="p-2 hover:bg-white/10 text-parchment/70 cursor-pointer active:scale-90"
                        >
                          <ChevronUp size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Advantage / Disadvantage Mode Toggle (d20) */}
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest">
                        Modo de Rolagem (d20)
                      </span>
                      {advantageMode !== 'normal' && (
                        <button
                          type="button"
                          onClick={() => setAdvantageMode('normal')}
                          className="text-[9px] font-mono text-parchment/40 hover:text-ember uppercase underline cursor-pointer"
                        >
                          Normal
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAdvantageMode('normal')}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-mono font-semibold transition-all border cursor-pointer",
                          advantageMode === 'normal'
                            ? "bg-white/15 border-white/30 text-parchment"
                            : "bg-black/20 border-white/5 text-parchment/50 hover:bg-white/5"
                        )}
                      >
                        Padrão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDie(20);
                          setAdvantageMode('advantage');
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-mono font-semibold transition-all border flex items-center justify-center gap-1 cursor-pointer",
                          advantageMode === 'advantage'
                            ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-300 shadow-sm"
                            : "bg-black/20 border-white/5 text-parchment/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                        )}
                      >
                        <Sparkles size={11} />
                        <span>Vantagem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDie(20);
                          setAdvantageMode('disadvantage');
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-mono font-semibold transition-all border flex items-center justify-center gap-1 cursor-pointer",
                          advantageMode === 'disadvantage'
                            ? "bg-rose-500/25 border-rose-500/50 text-rose-300 shadow-sm"
                            : "bg-black/20 border-white/5 text-parchment/50 hover:bg-rose-500/10 hover:text-rose-300"
                        )}
                      >
                        <ShieldAlert size={11} />
                        <span>Desvantagem</span>
                      </button>
                    </div>
                  </div>

                  {/* Target DC / Meta de Dificuldade (Toca som de Sucesso/Falha com precisão) */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <Target size={13} className={isTargetEnabled ? "text-arcane" : "text-parchment/40"} />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-parchment/60">
                          Meta / Dificuldade (CD)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTargetEnabled(!isTargetEnabled)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold transition-all border cursor-pointer",
                          isTargetEnabled 
                            ? "bg-arcane/20 text-arcane border-arcane/40" 
                            : "bg-black/30 text-parchment/40 border-white/10 hover:text-parchment"
                        )}
                      >
                        {isTargetEnabled ? "Ativa" : "Desativada"}
                      </button>
                    </div>

                    {isTargetEnabled && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/10 animate-in fade-in">
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-xs font-mono text-parchment/60 pl-1">
                            {isRollUnder ? "Alvo ≤" : "CD ≥"}
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={targetDC}
                            onChange={(e) => setTargetDC(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                            placeholder="Ex: 15"
                            className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center font-mono text-xs focus:outline-none focus:border-arcane"
                          />
                        </div>

                        {/* Quick DC Presets */}
                        <div className="flex items-center gap-1">
                          {[10, 15, 20].map(dc => (
                            <button
                              key={dc}
                              type="button"
                              onClick={() => setTargetDC(dc)}
                              className={cn(
                                "px-1.5 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer",
                                targetDC === dc 
                                  ? "bg-arcane text-obsidian font-bold border-arcane" 
                                  : "bg-white/5 border-white/5 text-parchment/60 hover:text-parchment"
                              )}
                            >
                              CD{dc}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setIsRollUnder(!isRollUnder)}
                            title={isRollUnder ? "Modo Roll-Under (Teste ≤ Alvo)" : "Modo Padrão D20 (Total ≥ CD)"}
                            className={cn(
                              "px-1.5 py-1 rounded-lg text-[9px] font-mono border transition-colors cursor-pointer",
                              isRollUnder ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-white/5 border-white/5 text-parchment/40"
                            )}
                          >
                            {isRollUnder ? "≤ Alvo" : "≥ CD"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Big Roll Action Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => rollDice(selectedDie, quantity, modifier, advantageMode)}
                  disabled={isRolling}
                  className={cn(
                    "w-full py-3.5 rounded-2xl font-serif font-bold text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 border transition-all cursor-pointer",
                    "bg-gradient-to-r from-arcane via-cyan-500 to-blue-600 text-obsidian border-cyan-300/40 hover:shadow-cyan-500/25",
                    isRolling && "opacity-75 cursor-wait"
                  )}
                >
                  <motion.div
                    animate={isRolling ? { rotate: 360 } : { rotate: 0 }}
                    transition={isRolling ? { repeat: Infinity, duration: 0.45, ease: "linear" } : { type: "spring" }}
                  >
                    <D20Icon className="w-5 h-5 text-obsidian" />
                  </motion.div>
                  <span>
                    {isRolling 
                      ? "Rolando dados..." 
                      : `Rolar ${quantity}d${selectedDie}${modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''}${isTargetEnabled && targetDC !== '' ? ` (Meta ${targetDC})` : ''}`}
                  </span>
                </motion.button>

                {/* Latest Result Display with Outcome Badges & Sound Feedback */}
                <AnimatePresence mode="wait">
                  {lastRoll && (
                    <motion.div
                      key={lastRoll.id}
                      initial={{ opacity: 0, y: 15, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "p-4 rounded-3xl border relative overflow-hidden transition-all shadow-xl",
                        lastRoll.outcome === 'critical' && "bg-gradient-to-br from-amber-500/25 via-gold/15 to-transparent border-gold shadow-[0_0_25px_rgba(234,179,8,0.3)]",
                        lastRoll.outcome === 'fumble' && "bg-gradient-to-br from-red-600/25 via-rose-950/40 to-transparent border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)]",
                        lastRoll.outcome === 'success' && "bg-gradient-to-br from-emerald-500/20 via-teal-950/30 to-transparent border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
                        lastRoll.outcome === 'failure' && "bg-gradient-to-br from-amber-500/15 via-black/40 to-transparent border-amber-500/30"
                      )}
                    >
                      {/* Ambient Glow */}
                      {lastRoll.outcome === 'critical' && (
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gold/20 rounded-full blur-2xl pointer-events-none" />
                      )}
                      {lastRoll.outcome === 'fumble' && (
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />
                      )}
                      {lastRoll.outcome === 'success' && (
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                      )}

                      {/* Header info */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-parchment/60 uppercase tracking-widest">
                            {lastRoll.formula}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-parchment/40">
                          {lastRoll.timeFormatted}
                        </span>
                      </div>

                      {/* Big Center Total */}
                      <div className="flex items-center justify-center gap-4 py-2">
                        <div className={cn(
                          "text-5xl font-serif font-black tracking-tight",
                          lastRoll.outcome === 'critical' && "text-gold text-glow-gold animate-bounce",
                          lastRoll.outcome === 'fumble' && "text-red-400 text-glow-ember animate-pulse",
                          lastRoll.outcome === 'success' && "text-emerald-300 text-glow-arcane",
                          lastRoll.outcome === 'failure' && "text-amber-300"
                        )}>
                          {lastRoll.total}
                        </div>
                      </div>

                      {/* Explicit Outcome Feedback Badge with Master Sound Match */}
                      <div className="flex items-center justify-center mb-2">
                        {lastRoll.outcome === 'critical' && (
                          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-gold/20 text-gold border border-gold/50 text-xs font-bold font-mono uppercase tracking-wider shadow-sm">
                            <Sparkles size={14} className="animate-pulse" />
                            <span>Acerto Crítico! (Som de Crítico)</span>
                          </div>
                        )}
                        {lastRoll.outcome === 'fumble' && (
                          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-red-600/20 text-red-400 border border-red-500/50 text-xs font-bold font-mono uppercase tracking-wider shadow-sm">
                            <Skull size={14} className="animate-pulse" />
                            <span>Falha Crítica! (Som de Desastre)</span>
                          </div>
                        )}
                        {lastRoll.outcome === 'success' && (
                          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono uppercase tracking-wider shadow-sm">
                            <CheckCircle2 size={14} />
                            <span>{lastRoll.outcomeLabel} (Som de Sucesso)</span>
                          </div>
                        )}
                        {lastRoll.outcome === 'failure' && (
                          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono uppercase tracking-wider shadow-sm">
                            <AlertCircle size={14} />
                            <span>{lastRoll.outcomeLabel} (Som de Falha)</span>
                          </div>
                        )}
                      </div>

                      {/* Dice Breakdown Details */}
                      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-parchment/70 font-mono pt-2 border-t border-white/10">
                        <span>Dados:</span>
                        <div className="flex flex-wrap items-center gap-1">
                          {lastRoll.rolls.map((r, i) => (
                            <span 
                              key={i} 
                              className={cn(
                                "px-2 py-0.5 rounded-lg border font-bold text-xs",
                                r === lastRoll.dieType ? "bg-gold/20 border-gold/40 text-gold" :
                                r === 1 ? "bg-red-500/20 border-red-500/40 text-red-300" :
                                "bg-black/30 border-white/10 text-parchment"
                              )}
                            >
                              {r}
                            </span>
                          ))}
                          {lastRoll.discardedRolls && lastRoll.discardedRolls.map((dr, di) => (
                            <span 
                              key={`disc-${di}`}
                              className="px-2 py-0.5 rounded-lg border bg-black/20 border-white/5 text-parchment/30 line-through text-xs"
                              title="Descartado pela Vantagem/Desvantagem"
                            >
                              {dr}
                            </span>
                          ))}
                          {lastRoll.modifier !== 0 && (
                            <span className="text-gold font-bold ml-1">
                              {lastRoll.modifier > 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action footer (Re-roll, Copy & Replay Sound) */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            playRollOutcomeSound(lastRoll.outcome, effectiveSettings, 0.6);
                          }}
                          className="text-[10px] font-mono text-parchment/50 hover:text-arcane flex items-center gap-1 cursor-pointer transition-colors"
                          title="Tocar som deste resultado novamente"
                        >
                          <Volume2 size={12} />
                          <span>Repetir som</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyRollResult(lastRoll)}
                            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-mono text-parchment/70 hover:text-parchment flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedId === lastRoll.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => rollDice(lastRoll.dieType, lastRoll.quantity, lastRoll.modifier, lastRoll.advantageMode)}
                            className="px-2.5 py-1 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-[10px] font-mono text-arcane flex items-center gap-1 transition-colors border border-arcane/30 cursor-pointer font-bold"
                          >
                            <RotateCcw size={12} />
                            <span>Re-rolar</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* TAB 2: DETAILED HISTORY LOG */}
            {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
                {/* Stats Summary Bar */}
                <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-3 rounded-2xl border border-white/10 text-center">
                  <div>
                    <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest block">Total</span>
                    <span className="text-base font-serif font-bold text-parchment">{totalRollsCount}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest block">Críticos</span>
                    <span className="text-base font-serif font-bold text-gold">{criticalCount}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest block">Sucessos</span>
                    <span className="text-base font-serif font-bold text-emerald-400">{successCount}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest block">Desastres</span>
                    <span className="text-base font-serif font-bold text-red-400">{fumbleCount}</span>
                  </div>
                </div>

                {/* Filter and Clear History Bar */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('all')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer",
                        historyFilter === 'all'
                          ? "bg-arcane text-obsidian font-bold"
                          : "bg-white/5 text-parchment/50 hover:bg-white/10"
                      )}
                    >
                      Todos
                    </button>
                    {[4, 6, 8, 10, 12, 20].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setHistoryFilter(d as DieType)}
                        className={cn(
                          "px-1.5 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer",
                          historyFilter === d
                            ? "bg-arcane text-obsidian font-bold"
                            : "bg-white/5 text-parchment/50 hover:bg-white/10"
                        )}
                      >
                        d{d}
                      </button>
                    ))}
                  </div>

                  {history.length > 0 && (
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={(e) => handleClearHistory(e)}
                        className="p-1.5 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-mono border border-red-500/20 hover:border-red-500/40 active:scale-95 shadow-sm"
                        title="Limpar todo o histórico de rolagens"
                      >
                        <Trash2 size={13} className="text-red-400" />
                        <span>Limpar</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Undo Notification Banner */}
                {recentlyCleared && recentlyCleared.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px]">
                      <Trash2 size={13} className="text-amber-400 shrink-0" />
                      <span>Histórico apagado com sucesso!</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestoreHistory}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30 cursor-pointer transition-colors active:scale-95 shrink-0"
                    >
                      Desfazer
                    </button>
                  </div>
                )}

                {/* Log List */}
                {filteredHistory.length === 0 ? (
                  <div className="py-12 text-center text-parchment/40 space-y-2">
                    <History size={32} className="mx-auto opacity-30" />
                    <p className="text-xs font-serif">Nenhuma rolagem no histórico ainda.</p>
                    <p className="text-[10px] font-mono">Use a aba Rolador para rolar dados de TTRPG.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "p-3 rounded-2xl border transition-all relative overflow-hidden group bg-white/[0.03]",
                          item.outcome === 'critical' && "border-gold/50 bg-gold/[0.05]",
                          item.outcome === 'fumble' && "border-red-500/40 bg-red-950/15",
                          item.outcome === 'success' && "border-emerald-500/30 bg-emerald-950/10",
                          item.outcome === 'failure' && "border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase",
                                item.outcome === 'critical' ? "bg-gold text-obsidian" :
                                item.outcome === 'fumble' ? "bg-red-500 text-white" :
                                item.outcome === 'success' ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40" :
                                "bg-white/10 text-arcane"
                              )}>
                                {item.formula}
                              </span>
                              <span className="text-[10px] font-mono text-parchment/40">
                                {item.timeFormatted}
                              </span>
                            </div>

                            <p className="text-xs font-mono text-parchment/60 mt-1">
                              {item.details}
                            </p>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "text-xl font-serif font-black",
                              item.outcome === 'critical' && "text-gold text-glow-gold",
                              item.outcome === 'fumble' && "text-red-400 text-glow-ember",
                              item.outcome === 'success' && "text-emerald-300",
                              item.outcome === 'failure' && "text-parchment"
                            )}>
                              {item.total}
                            </span>
                            <span className={cn(
                              "text-[9px] font-mono font-bold uppercase",
                              item.outcome === 'critical' && "text-gold",
                              item.outcome === 'fumble' && "text-red-400",
                              item.outcome === 'success' && "text-emerald-400",
                              item.outcome === 'failure' && "text-parchment/50"
                            )}>
                              {item.outcomeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Replay specific outcome sound */}
                          <button
                            type="button"
                            onClick={() => {
                              playRollOutcomeSound(item.outcome, effectiveSettings, 0.6);
                            }}
                            className="p-1 rounded-lg hover:bg-white/10 text-[10px] font-mono text-parchment/40 hover:text-arcane flex items-center gap-1 cursor-pointer"
                            title="Tocar som deste resultado"
                          >
                            <Volume2 size={11} />
                            <span>Tocar som</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-parchment/40 hover:text-red-400 transition-colors cursor-pointer"
                              title="Excluir esta rolagem do histórico"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyRollResult(item)}
                              className="p-1 rounded-lg hover:bg-white/10 text-[10px] font-mono text-parchment/50 hover:text-parchment flex items-center gap-1 cursor-pointer"
                              title="Copiar resultado"
                            >
                              {copiedId === item.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>Copiar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('roller');
                                rollDice(item.dieType, item.quantity, item.modifier, item.advantageMode);
                              }}
                              className="p-1 px-2 rounded-lg bg-arcane/15 hover:bg-arcane/25 text-[10px] font-mono text-arcane flex items-center gap-1 cursor-pointer font-bold border border-arcane/20"
                              title="Rolar novamente a mesma fórmula"
                            >
                              <RotateCcw size={11} />
                              <span>Re-rolar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Launcher Button */}
      {!props.hideLauncherButton && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Rolador de Dados TTRPG (d4, d6, d8, d10, d12, d20) com Sons do Mestre"
          className={cn(
            "w-13 h-13 rounded-2xl flex items-center justify-center shadow-2xl transition-all border cursor-pointer relative",
            isOpen 
              ? "bg-obsidian/90 border-white/30 text-parchment backdrop-blur-xl shadow-cyan-950/50" 
              : "bg-gradient-to-br from-arcane via-cyan-500 to-blue-600 border-cyan-300/40 text-obsidian shadow-cyan-500/30 hover:shadow-cyan-400/50"
          )}
        >
          {isOpen ? (
            <X size={22} className="text-parchment" />
          ) : (
            <>
              <D20Icon className="w-6 h-6 text-obsidian" />
              {history.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-ember border border-obsidian rounded-full text-[9px] font-mono font-bold text-obsidian flex items-center justify-center shadow-md">
                  {history.length > 9 ? '9+' : history.length}
                </span>
              )}
            </>
          )}
        </motion.button>
      )}
    </div>
  );
}
