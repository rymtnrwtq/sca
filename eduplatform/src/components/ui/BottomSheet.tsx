import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative z-[70] bg-zinc-900 border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] p-6 pb-8 w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 md:hidden" />
            <div className="flex items-center justify-between mb-6 px-1">
              <h3 className="text-xl font-bold text-white">{title}</h3>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
