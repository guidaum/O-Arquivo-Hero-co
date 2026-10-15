import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Sword, 
  ScrollText, 
  Settings, 
  Trash2, 
  Edit3, 
  Shield, 
  Search, 
  Filter,
  BarChart3,
  Mail,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Database,
  Check,
  X
} from 'lucide-react';
import { db, collection, getDocs, doc, deleteDoc, updateDoc, query, orderBy } from '../firebase';
import { cn } from '../lib/utils';

interface AdminStats {
  totalUsers: number;
  totalCharacters: number;
  totalSessions: number;
  activeLast24h: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = React.useState<'users' | 'characters' | 'sessions' | 'stats'>('stats');
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterRole, setFilterRole] = React.useState<string>('all');
  const [status, setStatus] = React.useState<{ type: 'success' | 'error', message: string } | null>(null);

  // In-UI Confirmation state for deleting items (avoids iframe-blocked window.confirm)
  const [itemToDelete, setItemToDelete] = React.useState<{
    id: string;
    coll: string;
    name: string;
    typeLabel: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'stats') {
        const usersSnap = await getDocs(collection(db, 'users'));
        const charsSnap = await getDocs(collection(db, 'characters'));
        const sessionsSnap = await getDocs(collection(db, 'gameSessions'));
        
        setStats({
          totalUsers: usersSnap.size,
          totalCharacters: charsSnap.size,
          totalSessions: sessionsSnap.size,
          activeLast24h: usersSnap.docs.filter(d => {
            const lastActive = d.data().lastActive;
            if (!lastActive) return false;
            const activeDate = new Date(lastActive);
            const now = new Date();
            return (now.getTime() - activeDate.getTime()) < 24 * 60 * 60 * 1000;
          }).length
        });
      } else {
        const collectionName = activeTab === 'users' ? 'users' : activeTab === 'characters' ? 'characters' : 'gameSessions';
        try {
          const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (queryErr) {
          console.warn('Fallback fetching without orderBy for', collectionName, queryErr);
          const snap = await getDocs(collection(db, collectionName));
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          setData(list);
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [activeTab]);

  const requestDelete = (item: any, coll: string) => {
    const name = item.name || item.displayName || item.title || item.email || item.code || `ID ${item.id.slice(0, 8)}`;
    const typeLabel = coll === 'users' ? 'Usuário' : coll === 'characters' ? 'Personagem' : 'Sessão de Campanha';
    setItemToDelete({
      id: item.id,
      coll,
      name,
      typeLabel
    });
  };

  const handleDelete = (itemOrId: any, coll: string) => {
    let item = typeof itemOrId === 'object' && itemOrId !== null ? itemOrId : data.find(d => d.id === itemOrId);
    if (!item) {
      item = { id: String(itemOrId), name: `ID: ${String(itemOrId).slice(0, 8)}` };
    }
    requestDelete(item, coll);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, itemToDelete.coll, itemToDelete.id));
      setData(prev => prev.filter(item => item.id !== itemToDelete.id));
      if (stats) {
        setStats(prev => {
          if (!prev) return null;
          if (itemToDelete.coll === 'users') return { ...prev, totalUsers: Math.max(0, prev.totalUsers - 1) };
          if (itemToDelete.coll === 'characters') return { ...prev, totalCharacters: Math.max(0, prev.totalCharacters - 1) };
          if (itemToDelete.coll === 'gameSessions') return { ...prev, totalSessions: Math.max(0, prev.totalSessions - 1) };
          return prev;
        });
      }
      setStatus({ type: 'success', message: `${itemToDelete.typeLabel} "${itemToDelete.name}" foi excluído(a) com sucesso!` });
      setItemToDelete(null);
    } catch (error: any) {
      console.error('Error deleting document:', error);
      setStatus({ 
        type: 'error', 
        message: error?.code === 'permission-denied' 
          ? 'Permissão negada. Apenas administradores podem excluir este registro.' 
          : 'Erro ao excluir item do banco de dados.' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setData(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setStatus({ type: 'success', message: 'Cargo atualizado com sucesso.' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Erro ao atualizar cargo.' });
    }
  };

  const filteredData = data.filter(item => {
    const searchStr = (item.displayName || item.name || item.email || '').toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    const matchesFilter = filterRole === 'all' || item.role === filterRole;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-obsidian">
      {/* Header */}
      <div className="p-4 sm:p-8 border-b border-white/5 bg-black/20 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-400/20 flex items-center justify-center border border-amber-400/30 shrink-0">
            <Shield size={20} className="sm:size-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-serif text-glow-amber">Painel do Administrador</h1>
            <p className="text-parchment/40 font-mono text-[10px] uppercase tracking-widest">
              Gestão Centralizada do Sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1 border border-white/10 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'stats', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'characters', label: 'Personagens', icon: Sword },
            { id: 'sessions', label: 'Sessões', icon: ScrollText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 sm:px-6 sm:py-3 rounded-xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-amber-400 text-obsidian shadow-lg" 
                  : "text-parchment/40 hover:text-parchment hover:bg-white/5"
              )}
            >
              <tab.icon size={16} className="sm:size-[18px]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-2",
              status.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-ember/10 text-ember border-ember/20"
            )}
          >
            {status.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard label="Total de Usuários" value={stats.totalUsers} icon={Users} color="text-arcane" bg="bg-arcane/10" />
            <StatCard label="Personagens Criados" value={stats.totalCharacters} icon={Sword} color="text-ember" bg="bg-ember/10" />
            <StatCard label="Sessões Ativas" value={stats.totalSessions} icon={ScrollText} color="text-gold" bg="bg-gold/10" />
            <StatCard label="Ativos hoje" value={stats.activeLast24h} icon={AlertCircle} color="text-emerald-400" bg="bg-emerald-400/10" />
          </div>
        )}

        {activeTab !== 'stats' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                <input
                  type="text"
                  placeholder={`Buscar ${activeTab === 'users' ? 'usuários' : activeTab === 'characters' ? 'personagens' : 'sessões'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-parchment focus:border-amber-400/50 outline-none transition-all shadow-inner"
                />
              </div>

              {activeTab === 'users' && (
                <div className="flex items-center gap-3">
                  <Filter size={18} className="text-parchment/40" />
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm text-parchment outline-none"
                  >
                    <option value="all">Todos Cargos</option>
                    <option value="admin">Administrador</option>
                    <option value="gm">Mestre</option>
                    <option value="user">Jogador</option>
                  </select>
                </div>
              )}
              
              <button 
                onClick={fetchData}
                className="p-3 rounded-xl bg-white/5 text-parchment/40 hover:bg-white/10 hover:text-parchment transition-all"
              >
                <Database size={20} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-20">
                <Database className="text-amber-400/20 animate-pulse" size={48} />
              </div>
            ) : filteredData.length > 0 ? (
              <div className="grid gap-4">
                {filteredData.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass border border-white/10 rounded-3xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 sm:gap-6 hover:border-amber-400/20 transition-all group"
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {(item.photoURL || item.image) ? (
                          <img src={item.photoURL || item.image} alt={item.displayName || item.name} className="w-full h-full object-cover" />
                        ) : (
                          activeTab === 'users' ? <Users size={20} className="sm:size-6 text-parchment/20" /> : 
                          activeTab === 'characters' ? <Sword size={20} className="sm:size-6 text-parchment/20" /> : 
                          <ScrollText size={20} className="sm:size-6 text-parchment/20" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                          <h3 className="text-base sm:text-lg font-bold text-parchment truncate">{item.displayName || item.name || 'Sem nome'}</h3>
                          {activeTab === 'users' && (
                            <span className={cn(
                              "text-[8px] sm:text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border shrink-0",
                              item.role === 'admin' ? "bg-amber-400/20 text-amber-400 border-amber-400/30" :
                              item.role === 'gm' ? "bg-arcane/20 text-arcane border-arcane/30" :
                              "bg-emerald-400/20 text-emerald-400 border-emerald-400/30"
                            )}>
                              {item.role || 'user'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-sm text-parchment/40">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail size={12} className="sm:size-3.5" />
                            <span className="truncate">{item.email || item.class || item.code}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Calendar size={12} className="sm:size-3.5" />
                            <span>ID: {item.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {activeTab === 'users' && (
                        <div className="flex items-center gap-2">
                          <select
                            value={item.role || 'user'}
                            onChange={(e) => handleUpdateRole(item.id, e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-sm text-parchment outline-none focus:border-amber-400/30"
                          >
                            <option value="user">Jogador</option>
                            <option value="gm">Mestre</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => handleDelete(item.id, activeTab === 'users' ? 'users' : activeTab === 'characters' ? 'characters' : 'gameSessions')}
                        className="p-3 rounded-2xl bg-ember/10 text-ember hover:bg-ember hover:text-white transition-all shadow-lg shadow-ember/10"
                        title="Excluir Permanentemente"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-parchment/20">
                <Database size={48} className="mx-auto mb-4 opacity-10" />
                <p>Nenhum dado encontrado com os filtros atuais.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-obsidian border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              {/* Top ambient glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start gap-4 mb-6">
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-white mb-1">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-xs text-parchment/60 font-mono">
                    Ação irreversível de administrador
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 mb-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-parchment/40 font-mono uppercase tracking-wider">Tipo:</span>
                  <span className="font-bold text-amber-400">{itemToDelete.typeLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-parchment/40 font-mono uppercase tracking-wider">Identificador:</span>
                  <span className="font-mono text-parchment truncate max-w-[220px]">{itemToDelete.name}</span>
                </div>
                <p className="text-xs text-red-300/80 pt-2 border-t border-white/5 leading-relaxed">
                  Tem certeza que deseja excluir este registro permanentemente do banco de dados? Todos os dados associados serão perdidos.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-parchment/70 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Sim, Excluir</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="glass border border-white/10 p-6 rounded-3xl group hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", bg)}>
          <Icon className={color} size={24} />
        </div>
        <div className="text-3xl font-serif text-white">{value}</div>
      </div>
      <p className="text-sm font-mono text-parchment/40 uppercase tracking-widest">{label}</p>
    </div>
  );
}
