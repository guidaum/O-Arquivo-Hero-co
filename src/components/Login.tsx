import React from 'react';
import { motion } from 'motion/react';
import { LogIn, Shield, Sword, ScrollText } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, googleProvider, signInWithPopup, db, doc, setDoc, getDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../firebase';

export default function Login() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<'user' | 'gm'>('user');
  
  // Email/Password state
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [emailAuthEnabled, setEmailAuthEnabled] = React.useState(import.meta.env.VITE_ENABLE_EMAIL_PASSWORD_AUTH === 'true');

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        // We fetch without auth because firestore.rules allow public read for this doc
        const settingsDoc = await getDoc(doc(db, 'globalSettings', 'config'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.enableEmailPasswordAuth !== undefined) {
            setEmailAuthEnabled(data.enableEmailPasswordAuth);
          }
        }
      } catch (err) {
        console.error('Error fetching global settings:', err);
        // Fallback to env var if firestore fetch fails
      }
    };
    fetchSettings();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
      const isAdminEmail = adminEmail && user.email === adminEmail;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: isAdminEmail ? 'admin' : role,
          createdAt: new Date().toISOString()
        });
      } else {
        // If it is the admin email, force the role to 'admin'
        if (isAdminEmail) {
          await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
        } else {
          await setDoc(doc(db, 'users', user.uid), { role }, { merge: true });
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Falha ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let user;
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: email.split('@')[0],
          role: role,
          createdAt: new Date().toISOString()
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
        await setDoc(doc(db, 'users', user.uid), { role }, { merge: true });
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O login por e-mail/senha não está ativado no Firebase Console. Entre no console e ative o provedor "Email/Password" em Authentication > Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro ao autenticar. Tente novamente.');
      }
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

          {emailAuthEnabled && (
            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
              <div className="space-y-2">
                <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest pl-2">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-parchment placeholder:text-parchment/20 focus:outline-none focus:border-arcane/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest pl-2">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-parchment placeholder:text-parchment/20 focus:outline-none focus:border-arcane/50 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-4 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50",
                  role === 'gm' ? "bg-arcane/20 text-arcane border border-arcane/30" : "bg-white/10 text-parchment border border-white/20"
                )}
              >
                {loading ? "Processando..." : isRegistering ? "Criar Conta" : "Entrar com Senha"}
              </button>
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full text-xs font-mono text-parchment/40 hover:text-parchment transition-colors text-center"
              >
                {isRegistering ? "Já tem uma conta? Entre aqui" : "Novo por aqui? Crie uma conta"}
              </button>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-xs font-mono text-parchment/20 uppercase">ou</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>
            </form>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-white/5",
              role === 'gm' ? "bg-arcane text-obsidian" : "bg-white text-obsidian"
            )}
          >
            {loading && !email ? (
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
