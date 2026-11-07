import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-xl transition-all flex items-center justify-center border",
        theme === 'dark' 
          ? "bg-white/5 border-white/10 text-parchment/60 hover:text-parchment hover:bg-white/10" 
          : "bg-surface border-black/10 text-text-secondary hover:text-primary hover:bg-black/5",
        className
      )}
      title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </motion.button>
  );
}
