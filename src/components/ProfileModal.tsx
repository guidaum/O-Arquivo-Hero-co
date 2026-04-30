import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Camera, Mail, Phone, MapPin, Shield, CheckCircle2, AlertCircle, Save, Loader2 } from 'lucide-react';
import { auth, db, doc, getDoc, updateDoc } from '../firebase';
import { cn } from '../lib/utils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [userData, setUserData] = React.useState<any>(null);
  const [formData, setFormData] = React.useState({
    displayName: '',
    photoURL: '',
    bio: '',
    location: '',
    phoneNumber: ''
  });
  const [message, setMessage] = React.useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchUserData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setFormData({
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          bio: data.bio || '',
          location: data.location || '',
          phoneNumber: data.phoneNumber || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      fetchUserData();
      setMessage(null);
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        ...formData,
        updatedAt: new Date().toISOString()
      });
      
      setUserData((prev: any) => ({ ...prev, ...formData }));
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      // Update local storage/context if needed, but Firestore is the source of truth
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const isRegistrationComplete = formData.displayName && formData.photoURL && formData.bio && formData.location && formData.phoneNumber;
  const isFinalVerified = userData?.isVerified || isRegistrationComplete;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl glass border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arcane/20 flex items-center justify-center border border-arcane/30">
                <Shield size={20} className="text-arcane" />
              </div>
              <div>
                <h2 className="text-xl font-serif text-glow-arcane">Configurações de Perfil</h2>
                <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Gerencie seus dados e verificação</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-parchment/40 hover:text-parchment"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-8 h-8 text-arcane animate-spin" />
                <p className="text-sm text-parchment/40 font-mono uppercase">Carregando dados da lenda...</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-8">
                {/* Status Section */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between transition-all",
                  isFinalVerified 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-ember/10 border-ember/20 text-ember"
                )}>
                  <div className="flex items-center gap-3">
                    {isFinalVerified ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <div>
                      <p className="font-bold text-sm">Verificação de Cadastro</p>
                      <p className="text-xs opacity-70">
                        {userData?.isVerified 
                          ? 'Sua conta foi verificada por um administrador.' 
                          : isRegistrationComplete 
                            ? 'Seu perfil está completo. Aguarde a verificação final se necessário.' 
                            : 'Complete todos os campos para verificar seu cadastro.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded bg-black/20 border border-current">
                    {userData?.isVerified ? 'Verificado' : isRegistrationComplete ? 'Pendente' : 'Incompleto'}
                  </div>
                </div>

                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-xl text-sm font-medium border",
                      message.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-ember/10 border-ember/20 text-ember"
                    )}
                  >
                    {message.text}
                  </motion.div>
                )}

                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-2 border-arcane overflow-hidden bg-white/5 relative">
                      <img 
                        src={formData.photoURL || "https://picsum.photos/seed/empty/100/100"} 
                        alt="Avatar Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                      <Camera size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2">URL do Avatar</label>
                    <input 
                      type="url"
                      value={formData.photoURL}
                      onChange={e => setFormData({...formData, photoURL: e.target.value})}
                      placeholder="https://exemplo.com/avatar.jpg"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2 flex items-center gap-2">
                      <User size={12} />
                      Nome de Exibição
                    </label>
                    <input 
                      type="text"
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      placeholder="Sua alcunha heroica"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2 flex items-center gap-2">
                      <Mail size={12} />
                      E-mail (Imutável)
                    </label>
                    <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm opacity-50 cursor-not-allowed">
                      {userData?.email}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2 flex items-center gap-2">
                      <Phone size={12} />
                      Telefone
                    </label>
                    <input 
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="(99) 99999-9999"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2 flex items-center gap-2">
                      <MapPin size={12} />
                      Localização
                    </label>
                    <input 
                      type="text"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      placeholder="Ex: Minas Gerais, Brasil"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest px-2">Biografia / Relato do Arquivista</label>
                  <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    placeholder="Conte um pouco sobre sua jornada no RPG..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-arcane/50 transition-colors resize-none no-scrollbar"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/10">
                  <div className="text-[10px] text-parchment/20 font-mono uppercase">
                    Membro desde: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Desconhecido'}
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-8 py-3 rounded-xl bg-arcane text-obsidian font-bold transition-all shadow-lg shadow-arcane/20",
                      saving ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                    )}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
