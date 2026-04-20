import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Clock } from 'lucide-react';

export const Chat = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="relative mb-8 inline-block">
          <div className="w-24 h-24 bg-orange-500/10 rounded-[32px] flex items-center justify-center text-orange-500 relative z-10">
            <MessageSquare size={48} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-orange-500 shadow-xl z-20">
            <Clock size={20} />
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-white mb-4 tracking-tight italic">
          AI Ассистент
        </h1>
        
        <div className="inline-block px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full mb-6">
          <span className="text-orange-500 text-sm font-black uppercase tracking-widest">
            В разработке
          </span>
        </div>

        <p className="text-zinc-500 leading-relaxed font-medium">
          Мы работаем над созданием персонального тютора на базе искусственного интеллекта, 
          который поможет вам анализировать технику плавания и составлять программы тренировок.
        </p>

        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em]">
            Следите за обновлениями
          </p>
        </div>
      </motion.div>
    </div>
  );
};
