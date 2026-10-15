import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Lock, UserPlus, BookOpen, Skull, Compass, ArrowRight } from 'lucide-react';

interface MapRestrictedAccessProps {
  mapType: 'world' | 'dungeon';
  userRole?: string;
  userCharactersCount?: number;
}

export default function MapRestrictedAccess({
  mapType,
  userCharactersCount = 0
}: MapRestrictedAccessProps) {
  const isDungeon = mapType === 'dungeon';

  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-obsidian text-parchment relative overflow-hidden select-none">
      {/* Background Ambience Elements */}
      <div className="absolute inset-0 bg-radial-vignette opacity-80 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-arcane/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full glass-popup bg-stone-950/80 border border-white/15 rounded-3xl p-8 text-center relative z-10 shadow-2xl backdrop-blur-xl"
      >
        {/* Fantasy Seal Icon */}
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-arcane/20 via-obsidian to-stone-900 border border-arcane/40 flex items-center justify-center text-arcane shadow-xl shadow-arcane/10 relative mb-6">
          <div className="absolute -inset-1 rounded-3xl border border-arcane/20 animate-pulse pointer-events-none" />
          <Lock size={36} className="text-arcane" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-stone-900 border border-white/20 flex items-center justify-center text-parchment/80">
            {isDungeon ? <Skull size={14} /> : <Compass size={14} />}
          </div>
        </div>

        {/* Title */}
        <span className="text-[11px] font-mono uppercase tracking-widest text-arcane font-semibold px-3 py-1 rounded-full bg-arcane/10 border border-arcane/30 inline-block mb-3">
          Regra de Visibilidade da Campanha
        </span>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-glow-arcane mb-3">
          {isDungeon ? 'Masmorras Trancadas pelo Destino' : 'Mapas Restritos ao Seu Herói'}
        </h2>

        {/* Description explaining the strict rule */}
        <p className="text-sm text-parchment/70 leading-relaxed mb-6">
          Como jogador, você <strong>só pode visualizar os mapas da campanha vinculada ao seu personagem</strong>, nunca fora dele. 
          {userCharactersCount === 0 
            ? ' Você ainda não possui nenhum personagem cadastrado no reino.' 
            : ' Nenhum dos seus personagens está atualmente vinculado a uma campanha ativa.'}
        </p>

        {/* Action Cards */}
        <div className="space-y-3 mb-6">
          <Link
            to="/create"
            className="w-full p-4 rounded-2xl bg-arcane/20 hover:bg-arcane/30 border border-arcane/40 flex items-center justify-between group transition-all text-left shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arcane text-obsidian flex items-center justify-center shrink-0">
                <UserPlus size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-parchment group-hover:text-arcane transition-colors">
                  Criar Personagem em uma Campanha
                </h4>
                <p className="text-xs text-parchment/50">
                  Crie sua lenda e selecione a campanha do seu Mestre
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-arcane group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/"
            className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-parchment/80 flex items-center justify-center shrink-0">
                <BookOpen size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-parchment group-hover:text-arcane transition-colors">
                  Ver Minhas Lendas / Entrar com Código
                </h4>
                <p className="text-xs text-parchment/50">
                  Consulte suas fichas ou insira o código da sessão
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-parchment/60 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Footnote */}
        <p className="text-[11px] font-mono text-parchment/40">
          Dica: Se você for o Mestre desta mesa, certifique-se de estar conectado com a conta que criou a campanha.
        </p>
      </motion.div>
    </div>
  );
}
