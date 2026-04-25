import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallGuideModal } from './InstallGuide';

export function MobileInstallBanner() {
  const { canInstall, guideType, install, dismissGuide } = usePWAInstall();
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

      <InstallGuideModal type={guideType} onDismiss={dismissGuide} />
    </>
  );
}
