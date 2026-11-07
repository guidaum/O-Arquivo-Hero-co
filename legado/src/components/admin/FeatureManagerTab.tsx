import React from 'react';
import { 
  Shield, 
  Crown, 
  Sword, 
  Check, 
  X, 
  RotateCcw, 
  Save, 
  Info, 
  Sparkles,
  Layers,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { db, doc, onSnapshot, setDoc } from '../../firebase';
import { 
  UserRole, 
  FeatureKey, 
  MENU_FEATURE_DEFINITIONS, 
  DEFAULT_ROLE_PERMISSIONS, 
  RoleFeaturePermissions 
} from '../../types/menuFeatures';
import { cn } from '../../lib/utils';

export default function FeatureManagerTab() {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('user');
  const [permissions, setPermissions] = React.useState<RoleFeaturePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Load from Firestore globalSettings/menuFeatures
  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'globalSettings', 'menuFeatures'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RoleFeaturePermissions>;
        setPermissions({
          admin: { ...DEFAULT_ROLE_PERMISSIONS.admin, ...(data.admin || {}) },
          gm: { ...DEFAULT_ROLE_PERMISSIONS.gm, ...(data.gm || {}) },
          user: { ...DEFAULT_ROLE_PERMISSIONS.user, ...(data.user || {}) },
        });
      } else {
        setPermissions(DEFAULT_ROLE_PERMISSIONS);
      }
    });

    return () => unsub();
  }, []);

  const handleToggle = (featureKey: FeatureKey) => {
    setPermissions(prev => {
      const currentRolePerms = prev[selectedRole];
      const updatedRolePerms = {
        ...currentRolePerms,
        [featureKey]: !currentRolePerms[featureKey]
      };
      return {
        ...prev,
        [selectedRole]: updatedRolePerms
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'globalSettings', 'menuFeatures'), permissions, { merge: true });
      setHasUnsavedChanges(false);
      setSaveStatus({
        type: 'success',
        message: 'Permissões de recursos do menu atualizadas e sincronizadas com sucesso!'
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error('Error saving menu feature settings:', err);
      setSaveStatus({
        type: 'error',
        message: 'Erro ao salvar configurações no banco de dados.'
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPermissions(DEFAULT_ROLE_PERMISSIONS);
    setHasUnsavedChanges(true);
  };

  const handleEnableAllForRole = () => {
    setPermissions(prev => {
      const allTrue = Object.keys(DEFAULT_ROLE_PERMISSIONS[selectedRole]).reduce((acc, k) => {
        acc[k as FeatureKey] = true;
        return acc;
      }, {} as Record<FeatureKey, boolean>);
      return { ...prev, [selectedRole]: allTrue };
    });
    setHasUnsavedChanges(true);
  };

  const rolesList: Array<{ id: UserRole; label: string; sub: string; icon: any; color: string; bg: string }> = [
    {
      id: 'user',
      label: 'Jogador (User)',
      sub: 'Jogadores comuns da mesa',
      icon: Sword,
      color: 'text-ember',
      bg: 'bg-ember/10 border-ember/30'
    },
    {
      id: 'gm',
      label: 'Mestre (GM)',
      sub: 'Mestres de sessões de RPG',
      icon: Shield,
      color: 'text-arcane',
      bg: 'bg-arcane/10 border-arcane/30'
    },
    {
      id: 'admin',
      label: 'Administrador',
      sub: 'Gestores do sistema',
      icon: Crown,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10 border-amber-400/30'
    }
  ];

  const currentRoleObj = rolesList.find(r => r.id === selectedRole)!;
  const activeCount = Object.values(permissions[selectedRole] || {}).filter(Boolean).length;
  const totalCount = MENU_FEATURE_DEFINITIONS.length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Profile Switcher */}
      <div className="glass p-6 rounded-3xl border border-white/10 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Sliders size={22} />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-parchment">
                Gerenciador de Recursos do Menu por Perfil
              </h2>
              <p className="text-xs font-mono text-parchment/60">
                Ative ou desative seções e funcionalidades visíveis na navegação conforme o perfil de usuário.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 glass rounded-xl text-xs font-mono text-parchment/70 hover:text-parchment border border-white/10 hover:border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Restaurar valores padrão"
            >
              <RotateCcw size={13} />
              <span>Restaurar Padrões</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50",
                hasUnsavedChanges
                  ? "bg-amber-400 hover:bg-amber-300 text-obsidian shadow-amber-400/20 animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}
            >
              <Save size={14} />
              <span>{isSaving ? 'Salvando...' : hasUnsavedChanges ? 'Salvar Alterações *' : 'Configurações Salvas'}</span>
            </button>
          </div>
        </div>

        {/* Status Alert */}
        {saveStatus && (
          <div className={cn(
            "p-3 rounded-xl border flex items-center gap-2 text-xs font-mono transition-all",
            saveStatus.type === 'success' 
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" 
              : "bg-ember/10 text-ember border-ember/30"
          )}>
            {saveStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {/* Profile Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {rolesList.map(role => {
            const isSelected = selectedRole === role.id;
            const Icon = role.icon;
            const roleActiveCount = Object.values(permissions[role.id] || {}).filter(Boolean).length;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3",
                  isSelected
                    ? `${role.bg} shadow-lg shadow-black/40 border-current`
                    : "bg-white/5 border-white/10 hover:border-white/20 text-parchment/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl border", isSelected ? role.bg : "bg-white/5 border-white/10")}>
                    <Icon size={18} className={role.color} />
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-serif font-bold", isSelected ? "text-parchment" : "text-parchment/80")}>
                      {role.label}
                    </h4>
                    <p className="text-[10px] font-mono text-parchment/40">
                      {role.sub}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-parchment block">
                    {roleActiveCount}/{totalCount}
                  </span>
                  <span className="text-[9px] font-mono text-parchment/40 uppercase">Ativos</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role Management Details */}
      <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-parchment/50">Editando permissões para:</span>
              <span className={cn("text-sm font-bold font-serif px-2.5 py-0.5 rounded-lg border", currentRoleObj.bg, currentRoleObj.color)}>
                {currentRoleObj.label}
              </span>
            </div>
            <p className="text-xs text-parchment/50 mt-1 font-mono">
              Os itens desmarcados ficarão completamente invisíveis no menu e barra de navegação para usuários com este perfil.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAllForRole}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-parchment/80 hover:text-parchment transition-all cursor-pointer"
            >
              Ativar Todos
            </button>
          </div>
        </div>

        {/* Feature Grid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {MENU_FEATURE_DEFINITIONS.map(feat => {
            const isEnabled = Boolean(permissions[selectedRole]?.[feat.key]);
            
            return (
              <div
                key={feat.key}
                onClick={() => handleToggle(feat.key)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-4",
                  isEnabled
                    ? "bg-white/[0.07] border-amber-400/40 shadow-sm"
                    : "bg-white/[0.02] border-white/10 opacity-60 hover:opacity-85"
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-serif font-bold text-parchment truncate">
                      {feat.label}
                    </span>
                    <span className={cn(
                      "text-[9px] font-mono uppercase tracking-wider px-2 py-0.2 rounded-full border",
                      feat.category === 'gm' ? "bg-amber-400/20 text-amber-300 border-amber-400/30" :
                      feat.category === 'creative' ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                      feat.category === 'session' ? "bg-arcane/20 text-arcane border-arcane/30" :
                      "bg-white/10 text-parchment/70 border-white/10"
                    )}>
                      {feat.category}
                    </span>
                    <span className="text-[10px] font-mono text-parchment/40">
                      {feat.path}
                    </span>
                  </div>
                  <p className="text-xs text-parchment/60 font-sans leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                {/* Switch indicator */}
                <div className="shrink-0 flex items-center gap-2">
                  <div className={cn(
                    "w-12 h-6 rounded-full transition-colors relative p-0.5",
                    isEnabled ? "bg-amber-400" : "bg-white/10"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-full bg-obsidian shadow-md transition-transform flex items-center justify-center text-[10px]",
                      isEnabled ? "translate-x-6 text-amber-400 font-bold" : "translate-x-0 text-parchment/40"
                    )}>
                      {isEnabled ? <Check size={11} /> : <X size={11} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
