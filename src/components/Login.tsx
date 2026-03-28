import React from 'react';
import { motion } from 'motion/react';
import { LogIn, Shield, Sword, ScrollText } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, googleProvider, signInWithPopup, db, doc, setDoc, getDoc } from '../firebase';

export default function Login() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [role, setRole] = React.useState<'user' | 'gm'>('user');

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore, if not create
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: role,
          createdAt: new Date().toISOString()
        });
      } else {
        // Update role if it's different (optional, but good for this request)
        await setDoc(doc(db, 'users', user.uid), { role }, { merge: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Falha ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-arcane/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ember/20 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass p-10 rounded-[2.5rem] border border-white/10 relative z-10 text-center"
      >
        <div className="flex justify-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-arcane/20 flex items-center justify-center border border-arcane/30">
            <Shield size={24} className="text-arcane" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-ember/20 flex items-center justify-center border border-ember/30">
            <Sword size={24} className="text-ember" />
          </div>
        </div>

        <h1 className="text-4xl font-serif mb-4 text-glow-arcane">O Arquivo Heroico</h1>
        <p className="text-parchment/60 font-mono text-sm uppercase tracking-widest mb-10">
          Sua jornada começa aqui
        </p>

        <div className="space-y-6">
          {/* Role Selection */}
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 mb-6">
            <button
              onClick={() => setRole('user')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                role === 'user' ? "bg-white text-obsidian shadow-lg" : "text-parchment/40 hover:text-parchment"
              )}
            >
              Jogador
            </button>
            <button
              onClick={() => setRole('gm')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                role === 'gm' ? "bg-arcane text-obsidian shadow-lg" : "text-parchment/40 hover:text-parchment"
              )}
            >
              Mestre
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-white/5",
              role === 'gm' ? "bg-arcane text-obsidian" : "bg-white text-obsidian"
            )}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-obsidian/20 border-t-obsidian rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                <span>Entrar com Google</span>
              </>
            )}
          </button>

          {error && (
            <p className="text-ember text-sm font-medium">{error}</p>
          )}

          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 text-parchment/40 text-xs font-mono">
              <ScrollText size={14} />
              <span>SISTEMA DE ARQUIVAMENTO MÍSTICO v1.0</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
