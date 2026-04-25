import React from 'react';
import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallGuideModal } from './InstallGuide';

export function InstallPWAButton() {
  const { canInstall, guideType, install, dismissGuide } = usePWAInstall();

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

      <InstallGuideModal type={guideType} onDismiss={dismissGuide} />
    </>
  );
}
