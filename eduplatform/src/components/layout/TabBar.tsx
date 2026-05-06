import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, BookOpen, MessageSquare, User as UserIcon, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallGuideModal } from '../ui/InstallGuide';

export const TabBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { canInstall, guideType, install, dismissGuide } = usePWAInstall();

  const tabs = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/learn', icon: BookOpen, label: 'Материалы' },
    { path: '/chat', icon: MessageSquare, label: 'AI' },
    { path: '/profile', icon: UserIcon, label: 'Профиль' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      <div className="bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-[24px] px-1 py-1.5 flex justify-around items-center shadow-2xl shadow-black/50">
        {tabs.map((tab: any) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] rounded-2xl transition-all duration-300 active:scale-95",
                isActive ? "text-orange-500" : "text-zinc-500"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-orange-500/10 rounded-2xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
              <span className="text-[11px] font-bold relative z-10 leading-none mt-0.5 whitespace-nowrap text-center">{tab.label}</span>
            </Link>
          );
        })}
        {canInstall && (
          <button
            onClick={install}
            className="relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] rounded-2xl transition-all duration-300 active:scale-95 text-orange-500"
          >
            <Download size={22} strokeWidth={2} className="relative z-10" />
            <span className="text-[11px] font-bold relative z-10 leading-none mt-0.5">Скачать</span>
          </button>
        )}
      </div>
    </nav>
    <InstallGuideModal type={guideType} onDismiss={dismissGuide} />
  );
};
