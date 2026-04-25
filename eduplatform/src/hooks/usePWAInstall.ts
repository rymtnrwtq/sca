import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallGuideType =
  | 'ios-safari'      // iOS Safari → share → add to home screen
  | 'ios-inapp'       // iOS in-app browser (Telegram, Chrome iOS) → open in Safari first
  | 'android-webview' // Android WebView / Telegram → open in Chrome first
  | 'generic'         // Desktop Firefox, other
  | null;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [guideType, setGuideType] = useState<InstallGuideType>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (isStandalone || localStorage.getItem('pwa_installed') === '1') {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    // iOS Safari has "Safari/" in UA; in-app browsers (Telegram, Chrome iOS) don't
    const isIOSSafari = isIOS && /Safari\//.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
    // WebView indicators
    const isWebView = /wv\b|WebView/i.test(ua) || (isAndroid && !/Chrome\//.test(ua)) ||
      (typeof (window as any).Telegram !== 'undefined') ||
      // Telegram in-app browser on Android often lacks "Chrome/" but has "Version/"
      (isAndroid && /Version\//.test(ua) && /Mobile/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', '1');
    });

    // Pre-compute guide type for when native prompt is unavailable
    if (isIOS) {
      if (isIOSSafari) {
        (window as any).__pwaGuideType = 'ios-safari';
      } else {
        (window as any).__pwaGuideType = 'ios-inapp';
      }
    } else if (isAndroid && isWebView) {
      (window as any).__pwaGuideType = 'android-webview';
    } else {
      (window as any).__pwaGuideType = 'generic';
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('pwa_installed', '1');
      }
      setDeferredPrompt(null);
    } else {
      setGuideType((window as any).__pwaGuideType || 'generic');
    }
  }, [deferredPrompt]);

  const dismissGuide = useCallback(() => setGuideType(null), []);

  const canInstall = !isInstalled;

  return { canInstall, isInstalled, guideType, install, dismissGuide };
}
