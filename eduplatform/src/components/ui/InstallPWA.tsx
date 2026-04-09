import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function InstallPWAButton() {
  const { canInstall, isIOS, showIOSGuide, install, dismissIOSGuide } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={install}
        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-orange-500/25"
      >
        <Download size={18} />
        <span>Скачать</span>
      </motion.button>

      {/* iOS guide overlay */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
            onClick={dismissIOSGuide}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-4"
              style={{ marginBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Установить SCA</h3>
                <button
                  onClick={dismissIOSGuide}
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-zinc-300 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p>
                    Нажмите <Share size={16} className="inline text-blue-400 -mt-0.5" /> <span className="font-semibold text-white">Поделиться</span> в нижней панели Safari
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p>
                    Прокрутите вниз и нажмите <span className="font-semibold text-white">«На экран Домой»</span>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p>
                    Нажмите <span className="font-semibold text-white">«Добавить»</span>
                  </p>
                </div>
              </div>

              <button
                onClick={dismissIOSGuide}
                className="w-full mt-5 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-bold text-white transition-colors"
              >
                Понятно
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
