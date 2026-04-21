import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function MobileInstallBanner() {
  const { canInstall, isIOS, showIOSGuide, install, dismissIOSGuide } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <>
      {/* Mobile-only floating banner above TabBar */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="fixed left-3 right-3 z-40 md:hidden"
          style={{ bottom: 'calc(4.5rem + max(8px, env(safe-area-inset-bottom)))' }}
        >
          <div className="bg-zinc-900/95 backdrop-blur-2xl border border-orange-500/20 rounded-2xl p-3 flex items-center gap-3 shadow-xl shadow-black/40">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Download size={20} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Установить SCA</p>
              <p className="text-xs text-zinc-400 truncate">Быстрый доступ с домашнего экрана</p>
            </div>
            <button
              onClick={install}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shrink-0"
            >
              Скачать
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-zinc-500 hover:text-white shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* iOS instruction overlay */}
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
