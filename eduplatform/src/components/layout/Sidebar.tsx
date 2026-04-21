import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, MessageSquare, User as UserIcon, LogOut, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { TIER_LABELS } from '../../constants';
import { InstallPWAButton } from '../ui/InstallPWA';

export const Sidebar = () => {
  const location = useLocation();
  const { logout, tier, user } = useAuth();
  const navigate = useNavigate();
  const menuItems = [
    { path: '/', icon: Home, label: 'Дашборд' },
    { path: '/learn', icon: BookOpen, label: 'Материалы' },
    { path: '/chat', icon: MessageSquare, label: 'AI (Скоро)' },
    { path: '/profile', icon: UserIcon, label: 'Личный кабинет' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 xl:w-80 h-screen fixed left-0 top-0 bg-zinc-950 border-r border-white/5 p-5 lg:p-7">
      <div className="mb-10 lg:mb-12">
        <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-white italic">SCA</h1>
        <p className="text-zinc-500 text-[11px] uppercase tracking-[0.2em] font-bold mt-1">Swimming Coaches</p>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-2 inline-block",
          tier === 'premium' ? "bg-orange-500/20 text-orange-400" :
          tier === 'free' ? "bg-green-500/20 text-green-400" :
          "bg-zinc-700 text-zinc-400"
        )}>
          {TIER_LABELS[tier]}
        </span>
      </div>
      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item: any) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3.5 rounded-2xl transition-all duration-200 group",
                isActive ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="font-bold text-[15px] lg:text-base truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {user?.is_admin ? (
        <Link
          to="/admin"
          className={cn(
            "flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3 rounded-2xl transition-all duration-200 mb-2",
            location.pathname === '/admin' ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
          )}
        >
          <Shield size={20} className="shrink-0" />
          <span className="font-bold text-[15px] lg:text-base truncate">Админка</span>
        </Link>
      ) : null}
      <div className="px-4 lg:px-5 pb-3">
          <InstallPWAButton />
        </div>
      <div className="pt-5 border-t border-white/5">
        {tier === 'guest' ? (
          <button
            onClick={() => navigate('/auth')}
            className="flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3.5 w-full text-orange-500 hover:text-orange-400 transition-colors rounded-2xl hover:bg-white/5"
          >
            <UserIcon size={20} className="shrink-0" />
            <span className="font-bold text-[15px] lg:text-base truncate">Войти</span>
          </button>
        ) : (
          <button
            onClick={logout}
            className="flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3.5 w-full text-zinc-500 hover:text-red-400 transition-colors rounded-2xl hover:bg-white/5"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="font-bold text-[15px] lg:text-base truncate">Выйти</span>
          </button>
        )}
      </div>
    </aside>
  );
};
