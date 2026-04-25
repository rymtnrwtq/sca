import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import { InstallGuideType } from '../../hooks/usePWAInstall';

interface Props {
  type: InstallGuideType;
  onDismiss: () => void;
}

const APP_URL = window.location.origin;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 text-xs font-bold">
        {n}
      </div>
      <p className="text-zinc-300 text-sm leading-relaxed pt-0.5">{children}</p>
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 w-full bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
    >
      <Globe size={14} className="text-zinc-500 shrink-0" />
      <span className="flex-1 text-left truncate font-mono text-xs">{url}</span>
      {copied ? <Check size={15} className="text-green-400 shrink-0" /> : <Copy size={15} className="text-zinc-500 shrink-0" />}
    </button>
  );
}

function GuideContent({ type, onDismiss }: Props) {
  const openInBrowser = () => {
    // Try to open in system browser
    window.open(APP_URL, '_blank');
  };

  if (type === 'ios-safari') {
    return (
      <>
        <p className="text-zinc-400 text-sm mb-5">Установите приложение на экран Домой через Safari:</p>
        <div className="space-y-4">
          <Step n={1}>
            Нажмите <Share size={16} className="inline text-blue-400 mx-0.5 -mt-0.5" />{' '}
            <span className="font-semibold text-white">«Поделиться»</span> в нижней панели браузера
          </Step>
          <Step n={2}>
            Прокрутите список вниз и выберите{' '}
            <span className="font-semibold text-white">«На экран "Домой"»</span>
          </Step>
          <Step n={3}>
            Нажмите <span className="font-semibold text-white">«Добавить»</span> в правом верхнем углу
          </Step>
        </div>
      </>
    );
  }

  if (type === 'ios-inapp') {
    return (
      <>
        <p className="text-zinc-400 text-sm mb-1">
          Встроенный браузер Telegram не поддерживает установку приложений.
        </p>
        <p className="text-zinc-400 text-sm mb-5">
          Откройте сайт в <span className="text-white font-semibold">Safari</span>, затем установите оттуда:
        </p>
        <div className="space-y-4 mb-5">
          <Step n={1}>
            Скопируйте ссылку ниже и вставьте её в{' '}
            <span className="font-semibold text-white">Safari</span>{' '}
            (или нажмите кнопку «Открыть в браузере» внутри Telegram)
          </Step>
          <Step n={2}>
            В Safari нажмите <Share size={15} className="inline text-blue-400 mx-0.5" />{' '}
            <span className="font-semibold text-white">«Поделиться»</span> → <span className="font-semibold text-white">«На экран "Домой"»</span>
          </Step>
        </div>
        <CopyButton url={APP_URL} />
        <button
          onClick={openInBrowser}
          className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-blue-500/15 border border-blue-500/30 rounded-2xl text-sm font-bold text-blue-400 hover:bg-blue-500/25 transition-colors"
        >
          <ExternalLink size={15} /> Открыть в Safari
        </button>
      </>
    );
  }

  if (type === 'android-webview') {
    return (
      <>
        <p className="text-zinc-400 text-sm mb-1">
          Встроенный браузер Telegram не поддерживает установку приложений.
        </p>
        <p className="text-zinc-400 text-sm mb-5">
          Откройте сайт в <span className="text-white font-semibold">Chrome</span>, затем установите оттуда:
        </p>
        <div className="space-y-4 mb-5">
          <Step n={1}>
            Нажмите <span className="font-semibold text-white">«⋮»</span> (три точки) в правом верхнем углу браузера Telegram → <span className="font-semibold text-white">«Открыть в браузере»</span>
          </Step>
          <Step n={2}>
            В Chrome нажмите <span className="font-semibold text-white">«⋮»</span> → <span className="font-semibold text-white">«Добавить на главный экран»</span>
          </Step>
        </div>
        <CopyButton url={APP_URL} />
        <button
          onClick={openInBrowser}
          className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-blue-500/15 border border-blue-500/30 rounded-2xl text-sm font-bold text-blue-400 hover:bg-blue-500/25 transition-colors"
        >
          <ExternalLink size={15} /> Открыть в Chrome
        </button>
      </>
    );
  }

  // generic
  return (
    <>
      <p className="text-zinc-400 text-sm mb-5">
        Откройте сайт в <span className="text-white font-semibold">Chrome</span> или{' '}
        <span className="text-white font-semibold">Safari</span> и установите приложение оттуда:
      </p>
      <div className="space-y-4 mb-5">
        <Step n={1}>
          <span className="font-semibold text-white">Chrome:</span> нажмите <span className="font-semibold text-white">«⋮»</span> → <span className="font-semibold text-white">«Установить приложение»</span> или <span className="font-semibold text-white">«Добавить на главный экран»</span>
        </Step>
        <Step n={2}>
          <span className="font-semibold text-white">Safari (iOS):</span> нажмите <Share size={14} className="inline text-blue-400 mx-0.5" /> → <span className="font-semibold text-white">«На экран "Домой"»</span>
        </Step>
      </div>
      <CopyButton url={APP_URL} />
    </>
  );
}

export function InstallGuideModal({ type, onDismiss }: Props) {
  if (!type) return null;

  const titles: Record<NonNullable<InstallGuideType>, string> = {
    'ios-safari': 'Установить SCA',
    'ios-inapp': 'Открыть в Safari',
    'android-webview': 'Открыть в Chrome',
    'generic': 'Установить SCA',
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6"
          style={{ marginBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">{titles[type]}</h3>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <GuideContent type={type} onDismiss={onDismiss} />

          <button
            onClick={onDismiss}
            className="w-full mt-5 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-bold text-white transition-colors"
          >
            Понятно
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
