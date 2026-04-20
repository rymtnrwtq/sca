import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';

export const Chat = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="w-20 h-20 bg-orange-500/10 rounded-[28px] flex items-center justify-center text-orange-500 mx-auto mb-6">
          <MessageSquare size={40} />
        </div>
        
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight italic uppercase">
          В разработке
        </h1>
        <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-sm">
          Скоро будет
        </p>
      </motion.div>
    </div>
  );
};
