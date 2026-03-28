import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  ChevronRight, 
  ChevronLeft, 
  Dice6, 
  Sparkles, 
  Shield, 
  Sword, 
  Zap, 
  Brain, 
  Eye, 
  Heart,
  Plus,
  Trash2,
  Flame,
  Activity,
  Scroll,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, collection, setDoc, doc, OperationType, handleFirestoreError, query, where, getDocs } from '../firebase';

export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const steps = ['Origens', 'Atributos', 'Perícias/Disciplinas', 'Equipamento', 'Revisão'];

  const [basics, setBasics] = React.useState({
    name: '',
    class: 'Paladino',
    image: 'https://picsum.photos/seed/paladin/400/600',
    color: 'arcane',
    icon: 'Shield',
    sessionId: ''
  });

  React.useEffect(() => {
    const fetchSessions = async () => {
      if (!auth.currentUser) return;
      try {
        // Fetch sessions where user is Player
        const qPlayer = query(collection(db, 'gameSessions'), where('playerIds', 'array-contains', auth.currentUser.uid));
        const playerSnapshot = await getDocs(qPlayer);
        const playerSessions = playerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'player' }));

        // Fetch sessions where user is GM
        const qGm = query(collection(db, 'gameSessions'), where('gmId', '==', auth.currentUser.uid));
        const gmSnapshot = await getDocs(qGm);
        const gmSessions = gmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'gm' }));

        // Combine and remove duplicates (though unlikely in this logic)
        const allSessions = [...playerSessions, ...gmSessions];
        setSessions(allSessions);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };
    fetchSessions();
  }, []);

  const availableIcons = [
    { id: 'Shield', icon: Shield },
    { id: 'Sword', icon: Sword },
    { id: 'Flame', icon: Flame },
    { id: 'Eye', icon: Eye },
    { id: 'Zap', icon: Zap },
    { id: 'Brain', icon: Brain },
    { id: 'Heart', icon: Heart },
    { id: 'Activity', icon: Activity },
    { id: 'Scroll', icon: Scroll },
    { id: 'Dice6', icon: Dice6 },
    { id: 'Sparkles', icon: Sparkles },
  ];

  const classes = [
    { name: 'Paladino', icon: Shield, color: 'arcane', image: 'https://picsum.photos/seed/paladin/400/600' },
    { name: 'Guerreiro', icon: Sword, color: 'ember', image: 'https://picsum.photos/seed/warrior/400/600' },
    { name: 'Mago', icon: Flame, color: 'arcane', image: 'https://picsum.photos/seed/mage/400/600' },
    { name: 'Ranger', icon: Eye, color: 'gold', image: 'https://picsum.photos/seed/ranger/400/600' },
    { name: 'Ladino', icon: Zap, color: 'ember', image: 'https://picsum.photos/seed/rogue/400/600' },
  ];

  const attributes = [
    { id: 'for', label: 'Força', icon: Sword, color: 'text-ember', description: 'Poder físico e força bruta.' },
    { id: 'con', label: 'Constituição', icon: Shield, color: 'text-ember', description: 'Saúde, resistência e força vital.' },
    { id: 'agi', label: 'Agilidade', icon: Zap, color: 'text-arcane', description: 'Destreza, reflexos e equilíbrio.' },
    { id: 'per', label: 'Percepção', icon: Eye, color: 'text-gold', description: 'Intuição, sentidos e observação.' },
    { id: 'vel', label: 'Velocidade', icon: Zap, color: 'text-arcane', description: 'Capacidade de deslocamento rápido.' },
    { id: 'ini', label: 'Iniciativa', icon: Zap, color: 'text-gold', description: 'Prontidão para o combate.' },
    { id: 'int', label: 'Inteligência', icon: Brain, color: 'text-arcane', description: 'Agudeza mental e raciocínio.' },
    { id: 'cor', label: 'Coragem', icon: Heart, color: 'text-ember', description: 'Força de vontade e bravura.' },
  ];

  const [values, setValues] = React.useState<Record<string, number>>({
    for: 0, con: 0, agi: 0, per: 0, vel: 0, ini: 0, int: 0, cor: 0
  });

  const [maxPoints, setMaxPoints] = React.useState(120);
  const [maxSingleAttr, setMaxSingleAttr] = React.useState(100);

  React.useEffect(() => {
    if (basics.sessionId) {
      const session = sessions.find(s => s.id === basics.sessionId);
      if (session) {
        setMaxPoints(session.maxAttributePoints ?? 120);
        setMaxSingleAttr(session.maxSingleAttributeValue ?? 100);
      } else {
        setMaxPoints(120);
        setMaxSingleAttr(100);
      }
    } else {
      setMaxPoints(120);
      setMaxSingleAttr(100);
    }
    // Reset values when session changes to ensure they obey new limits
    setValues({
      for: 0, con: 0, agi: 0, per: 0, vel: 0, ini: 0, int: 0, cor: 0
    });
  }, [basics.sessionId, sessions]);

  const [skills, setSkills] = React.useState([
    { id: crypto.randomUUID(), name: 'Golpe de Escudo', description: 'Usa o escudo para atordoar o inimigo.', atp: 4, damage: '1d6+FOR', type: 'Luta' },
  ]);

  const [equipment, setEquipment] = React.useState([
    { id: crypto.randomUUID(), name: 'Lâmina Forjada no Sol', description: 'Uma espada que brilha com a luz do sol.', quantity: 1, ammo: '-', damage: '1d8+FOR', defense: 0, equipped: true },
  ]);

  const [newSkill, setNewSkill] = React.useState({
    name: '',
    description: '',
    atp: 0,
    damage: '',
    type: 'Luta' as 'Luta' | 'Mística' | 'Diversos'
  });

  const [newEquip, setNewEquip] = React.useState({
    name: '',
    description: '',
    quantity: 1,
    ammo: '-',
    damage: '',
    defense: 0,
    equipped: false
  });

  const handleAddSkill = () => {
    if (newSkill.name.trim()) {
      setSkills([...skills, { ...newSkill, id: crypto.randomUUID() }]);
      setNewSkill({ name: '', description: '', atp: 0, damage: '', type: 'Luta' });
    }
  };

  const handleAddEquip = () => {
    if (newEquip.name.trim()) {
      setEquipment([...equipment, { ...newEquip, id: crypto.randomUUID() }]);
      setNewEquip({ name: '', description: '', quantity: 1, ammo: '-', damage: '', defense: 0, equipped: false });
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const removeEquip = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const handleValueChange = (id: string, delta: number) => {
    const currentTotal = (Object.values(values) as number[]).reduce((a, b) => a + b, 0);
    if (delta > 0 && currentTotal >= maxPoints) return;

    setValues(prev => ({
      ...prev,
      [id]: Math.min(maxSingleAttr, Math.max(0, prev[id] + delta))
    }));
  };

  const getModifier = (value: number) => {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const handleSaveCharacter = async () => {
    if (!auth.currentUser || !basics.sessionId) return;
    setLoading(true);
    try {
      const characterId = crypto.randomUUID();
      const characterData = {
        id: characterId,
        ownerId: auth.currentUser.uid,
        name: basics.name || 'Sem Nome',
        class: basics.class,
        level: 1,
        xp: 0,
        xpMax: 1000,
        image: basics.image,
        color: basics.color,
        icon: basics.icon,
        sessionId: basics.sessionId,
        stats: values,
        statsMods: {},
        canEditStats: false,
        skills,
        equipment,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'characters', characterId), characterData);
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Stepper */}
      <div className="flex items-center justify-between px-2 sm:px-4">
        {steps.map((s, idx) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-2 relative">
              <div className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                step > idx + 1 ? "bg-arcane border-arcane text-obsidian" :
                step === idx + 1 ? "border-arcane text-arcane shadow-[0_0_15px_rgba(71,214,255,0.3)]" :
                "border-white/10 text-parchment/20"
              )}>
                {step > idx + 1 ? <Sparkles size={14} sm:size={18} /> : <span className="text-xs sm:text-sm font-mono">{idx + 1}</span>}
              </div>
              <span className={cn(
                "text-[8px] sm:text-[10px] font-mono uppercase tracking-widest absolute -bottom-6 whitespace-nowrap hidden sm:block",
                step === idx + 1 ? "text-arcane" : "text-parchment/20"
              )}>
                {s}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 sm:mx-4 rounded-full transition-all duration-500",
                step > idx + 1 ? "bg-arcane" : "bg-white/10"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="pt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Origens da Lenda</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 01: Nome e Vocação</p>
                </header>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Personagem</label>
                      <input 
                        type="text" 
                        value={basics.name}
                        onChange={e => setBasics({...basics, name: e.target.value})}
                        placeholder="Ex: Aethelgard, o Destemido"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Sua Vocação (Nome)</label>
                      <input 
                        type="text" 
                        value={basics.class}
                        onChange={e => setBasics({...basics, class: e.target.value})}
                        placeholder="Ex: Paladino, Caçador de Sombras..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Vincular a uma Campanha (Obrigatório)</label>
                      <select 
                        value={basics.sessionId}
                        onChange={e => setBasics({...basics, sessionId: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                        required
                      >
                        <option value="" className="bg-obsidian">Selecione uma Campanha...</option>
                        {sessions.map(session => (
                          <option key={session.id} value={session.id} className="bg-obsidian">
                            {session.name}
                          </option>
                        ))}
                      </select>
                      {sessions.length === 0 ? (
                        <p className="text-[10px] text-ember font-mono px-2">Você não está em nenhuma campanha. Entre em uma campanha no Dashboard primeiro.</p>
                      ) : (
                        <p className="text-[10px] text-parchment/40 font-mono px-2">Você deve selecionar uma campanha para que os limites de atributos sejam aplicados.</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Ou insira uma URL de imagem personalizada</label>
                      <input 
                        type="text" 
                        value={basics.image}
                        onChange={e => setBasics({...basics, image: e.target.value})}
                        placeholder="https://exemplo.com/imagem.png"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-mono focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Escolha o Ícone da Vocação</label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-3">
                        {availableIcons.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setBasics({ ...basics, icon: item.id })}
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                              basics.icon === item.id ? "border-arcane bg-arcane/10 shadow-[0_0_15px_rgba(71,214,255,0.2)]" : "border-white/10 hover:border-white/20"
                            )}
                          >
                            <item.icon size={20} className={basics.icon === item.id ? "text-arcane" : "text-parchment/40"} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Ou escolha um arquétipo pronto</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classes.map((cls) => (
                          <button
                            key={cls.name}
                            onClick={() => setBasics({
                              ...basics, 
                              class: cls.name, 
                              color: cls.color,
                              image: cls.image,
                              icon: cls.name === 'Paladino' ? 'Shield' : 
                                    cls.name === 'Guerreiro' ? 'Sword' :
                                    cls.name === 'Mago' ? 'Flame' :
                                    cls.name === 'Ranger' ? 'Eye' : 'Zap'
                            })}
                            className={cn(
                              "glass p-6 rounded-3xl flex items-center gap-4 transition-all border",
                              basics.class === cls.name ? "border-arcane bg-arcane/10 shadow-[0_0_20px_rgba(71,214,255,0.1)]" : "border-white/10 hover:border-white/20"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              cls.color === 'arcane' ? "bg-arcane/20 text-arcane" : 
                              cls.color === 'ember' ? "bg-ember/20 text-ember" : "bg-gold/20 text-gold"
                            )}>
                              <cls.icon size={24} />
                            </div>
                            <div className="text-left">
                              <h4 className="font-serif text-lg">{cls.name}</h4>
                              <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">Vocação</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Defina seus Atributos</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 02: A Essência do Herói</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border border-arcane/30 bg-arcane/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos Restantes</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        (maxPoints - (Object.values(values) as number[]).reduce((a, b) => a + b, 0)) === 0 ? "text-gold" : "text-arcane"
                      )}>
                        {maxPoints - (Object.values(values) as number[]).reduce((a, b) => a + b, 0)} / {maxPoints}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-arcane/10 flex items-center justify-center text-arcane">
                      <Dice6 size={24} />
                    </div>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {attributes.map((attr, idx) => (
                    <motion.div
                      key={attr.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass p-6 rounded-3xl group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-3 rounded-2xl bg-white/5", attr.color)}>
                            <attr.icon size={24} />
                          </div>
                          <div>
                            <h4 className="font-serif text-xl">{attr.label}</h4>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Modificador: {getModifier(values[attr.id])}</p>
                          </div>
                        </div>
                        <div className="text-3xl font-serif text-glow-arcane">
                          {values[attr.id]}
                          <span className="text-xs text-parchment/20 ml-1">/ {maxSingleAttr}</span>
                        </div>
                      </div>

                      <p className="text-xs text-parchment/40 mb-6 leading-relaxed">{attr.description}</p>

                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleValueChange(attr.id, -1)}
                          className="flex-1 py-3 glass rounded-xl hover:bg-ember/10 hover:text-ember transition-all text-xl font-serif"
                        >
                          -
                        </button>
                        <button 
                          onClick={() => handleValueChange(attr.id, 1)}
                          className="flex-1 py-3 glass rounded-xl hover:bg-arcane/10 hover:text-arcane transition-all text-xl font-serif"
                        >
                          +
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Perícias & Disciplinas</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 03: Talentos e Mistérios</p>
                </header>

                {/* Skill Form */}
                <div className="glass p-8 rounded-[2.5rem] space-y-6 border border-white/10">
                  <h3 className="text-xl font-serif flex items-center gap-2">
                    <Plus className="text-arcane" size={20} />
                    Adicionar Nova Perícia
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                      <input 
                        type="text" 
                        value={newSkill.name}
                        onChange={e => setNewSkill({...newSkill, name: e.target.value})}
                        placeholder="Ex: Golpe de Escudo"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo</label>
                      <select 
                        value={newSkill.type}
                        onChange={e => setNewSkill({...newSkill, type: e.target.value as any})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                      >
                        <option value="Luta" className="bg-obsidian">Luta</option>
                        <option value="Mística" className="bg-obsidian">Mística</option>
                        <option value="Diversos" className="bg-obsidian">Diversos</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">ATP</label>
                      <input 
                        type="number" 
                        value={newSkill.atp}
                        onChange={e => setNewSkill({...newSkill, atp: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                      <input 
                        type="text" 
                        value={newSkill.damage}
                        onChange={e => setNewSkill({...newSkill, damage: e.target.value})}
                        placeholder="Ex: 1d8+FOR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                      <textarea 
                        value={newSkill.description}
                        onChange={e => setNewSkill({...newSkill, description: e.target.value})}
                        placeholder="Descreva o efeito da perícia..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleAddSkill}
                    className="w-full py-4 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-arcane/30"
                  >
                    <Plus size={20} />
                    Confirmar Perícia
                  </button>
                </div>

                {/* Skill List */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Perícias Adicionadas</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {skills.map((skill, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-5 rounded-3xl flex items-center justify-between group border border-white/10 hover:border-arcane/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            skill.type === 'Luta' ? "bg-ember/10 text-ember" : 
                            skill.type === 'Mística' ? "bg-arcane/10 text-arcane" : "bg-gold/10 text-gold"
                          )}>
                            {skill.type === 'Luta' ? <Sword size={18} /> : 
                             skill.type === 'Mística' ? <Flame size={18} /> : <Activity size={18} />}
                          </div>
                          <div>
                            <h5 className="font-serif text-lg">{skill.name}</h5>
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">{skill.type} • {skill.atp} ATP • {skill.damage || 'N/A'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeSkill(idx)}
                          className="p-2 hover:bg-ember/10 text-parchment/20 hover:text-ember rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Equipamento & Inventário</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 04: Preparação para a Jornada</p>
                </header>

                {/* Equipment Form */}
                <div className="glass p-8 rounded-[2.5rem] space-y-6 border border-white/10">
                  <h3 className="text-xl font-serif flex items-center gap-2">
                    <Plus className="text-arcane" size={20} />
                    Adicionar Novo Equipamento
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                      <input 
                        type="text" 
                        value={newEquip.name}
                        onChange={e => setNewEquip({...newEquip, name: e.target.value})}
                        placeholder="Ex: Espada Longa"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                      <input 
                        type="text" 
                        value={newEquip.damage}
                        onChange={e => setNewEquip({...newEquip, damage: e.target.value})}
                        placeholder="Ex: 1d8+FOR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Quantidade</label>
                      <input 
                        type="number" 
                        value={newEquip.quantity}
                        onChange={e => setNewEquip({...newEquip, quantity: parseInt(e.target.value) || 1})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Munição</label>
                      <input 
                        type="text" 
                        value={newEquip.ammo}
                        onChange={e => setNewEquip({...newEquip, ammo: e.target.value})}
                        placeholder="Ex: 20 flechas ou -"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Defesa</label>
                      <input 
                        type="number" 
                        value={newEquip.defense}
                        onChange={e => setNewEquip({...newEquip, defense: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-3 px-2 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={newEquip.equipped}
                          onChange={e => setNewEquip({...newEquip, equipped: e.target.checked})}
                          className="w-5 h-5 rounded border-white/10 bg-white/5 text-arcane focus:ring-arcane/50"
                        />
                        <span className="text-xs font-mono text-parchment/40 uppercase tracking-widest group-hover:text-parchment transition-colors">Equipado</span>
                      </label>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                      <textarea 
                        value={newEquip.description}
                        onChange={e => setNewEquip({...newEquip, description: e.target.value})}
                        placeholder="Descreva o item e suas propriedades..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleAddEquip}
                    className="w-full py-4 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-arcane/30"
                  >
                    <Plus size={20} />
                    Confirmar Equipamento
                  </button>
                </div>

                {/* Equipment List */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Itens no Inventário</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {equipment.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-5 rounded-3xl flex items-center justify-between group border border-white/10 hover:border-arcane/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-arcane">
                            <Shield size={18} />
                          </div>
                          <div>
                            <h5 className="font-serif text-lg">{item.name}</h5>
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">
                              Qtd: {item.quantity} • Mun: {item.ammo} • Dano: {item.damage || 'N/A'} 
                              {item.defense > 0 && ` • Defesa: +${item.defense}`}
                              {item.equipped && ' • [EQUIPADO]'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeEquip(idx)}
                          className="p-2 hover:bg-ember/10 text-parchment/20 hover:text-ember rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Revisão Final</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 05: Selando o Destino</p>
                </header>

                <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border border-white/10">
                      <img src={basics.image} alt={basics.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif">{basics.name || 'Sem Nome'}</h3>
                      <p className="text-arcane font-mono text-sm uppercase tracking-widest">{basics.class} Nível 1</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {attributes.map(attr => (
                      <div key={attr.id} className="glass p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-mono text-parchment/40 uppercase">{attr.label}</p>
                        <p className="text-xl font-serif">{values[attr.id]}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Resumo de Habilidades</h4>
                    <p className="text-sm text-parchment/60 leading-relaxed">
                      {skills.length} Perícias aprendidas e {equipment.length} itens no inventário. 
                      Pronto para enfrentar os desafios que aguardam.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleSaveCharacter}
                  disabled={loading}
                  className="w-full py-6 bg-arcane text-obsidian rounded-3xl font-bold text-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-arcane/30 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-obsidian/20 border-t-obsidian rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={24} />
                      <span>Concluir Criação</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: Preview & Actions */}
        <div className="space-y-8 lg:sticky lg:top-24 h-fit order-first lg:order-last">
          <section className="glass p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] space-y-6">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-arcane/20 to-ember/20 border-2 border-white/10 mx-auto overflow-hidden p-1">
                <img 
                  src="https://picsum.photos/seed/creation/200/200" 
                  alt="Prévia do Personagem" 
                  className="w-full h-full object-cover rounded-full opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="text-xl sm:text-2xl font-serif">{basics.name || 'Aethelgard'}</h3>
              <p className="text-[10px] sm:text-xs font-mono text-arcane uppercase tracking-widest">{basics.class} Humano</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-parchment/40">TOTAL DE PONTOS</span>
                <span className="text-sm font-serif">
                  {(Object.values(values) as number[]).reduce((a, b) => a + b, 0)} / {maxPoints}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-arcane transition-all duration-500 rounded-full" 
                  style={{ width: `${Math.min(100, ((Object.values(values) as number[]).reduce((a, b) => a + b, 0) / maxPoints) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {step < 5 && (
                <button 
                  onClick={() => setStep(prev => Math.min(steps.length, prev + 1))}
                  disabled={step === 1 && (!basics.sessionId || !basics.name)}
                  className={cn(
                    "w-full py-4 bg-arcane text-obsidian rounded-2xl flex items-center justify-center gap-2 font-bold hover:scale-105 transition-transform shadow-lg shadow-arcane/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  )}
                >
                  <span>{step === 1 ? 'Continuar para Atributos' : step === 2 ? 'Continuar para Perícias' : step === 3 ? 'Continuar para Equipamento' : step === 4 ? 'Revisar Personagem' : 'Continuar'}</span>
                  <ChevronRight size={18} />
                </button>
              )}
              <button 
                onClick={() => setStep(prev => Math.max(1, prev - 1))}
                className="w-full py-4 text-parchment/40 hover:text-parchment transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <ChevronLeft size={16} />
                <span>Voltar</span>
              </button>
            </div>

            <div className="p-4 glass-ember rounded-2xl flex items-start gap-3">
              <Sparkles size={18} className="text-ember shrink-0 mt-0.5" />
              <p className="text-[10px] text-ember leading-relaxed font-mono uppercase tracking-wider">
                Dica: Paladinos se beneficiam mais de Força e Coragem para seus ataques divinos e liderança.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
