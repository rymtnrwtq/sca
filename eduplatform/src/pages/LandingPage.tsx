import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Video, Users, Award, ChevronRight, Waves, Trophy, BookMarked, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const STATS = [
  { value: '25+', label: 'Стран участниц' },
  { value: '800+', label: 'Часов видеоматериалов' },
  { value: '1 000+', label: 'Тренеров на платформе' },
];

const FEATURES = [
  {
    icon: Video,
    title: '800+ часов видео',
    desc: 'Записи семинаров и эфиров от топовых тренеров и спортсменов со всего мира',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    icon: BookOpen,
    title: '500+ книг о плавании',
    desc: 'Лучшая подборка профессиональной литературы на русском языке',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: BookMarked,
    title: '400+ готовых тренировок',
    desc: 'Практические планы, которые уже работают у лучших специалистов',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: Users,
    title: 'Сообщество тренеров',
    desc: 'Обменивайтесь опытом, развивайтесь и вдохновляйте коллег',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
];

const FOR_WHOM = [
  { icon: Trophy, title: 'Тренеры', desc: 'Новые идеи для тренировок, поддержка сообщества и профессиональное развитие' },
  { icon: Award, title: 'Организации', desc: 'Растите уровень тренеров, повышайте результаты и статус клуба' },
  { icon: Waves, title: 'Спортсмены', desc: 'Узнайте, что делать после спорта и как получить максимум от карьеры' },
  { icon: Users, title: 'Родители', desc: 'Станьте уверены в тренере и поймите, как помочь ребёнку развиваться' },
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const { canInstall, install } = usePWAInstall();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-16 pb-28 md:pb-12"
    >
      {/* Hero */}
      <section className="relative pt-4">
        <div className="absolute -top-6 -left-10 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-orange-500 text-[11px] font-black uppercase tracking-[0.2em] mb-3">
            Swimming Coaches Association
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
            Единственные в плавании СНГ, кто помогает тренерам{' '}
            <span className="text-orange-500">думать головой</span>
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-2xl mb-8">
            Образовательная платформа для тренеров по плаванию, спортсменов и специалистов водных видов спорта. Обучение, сертификация, развитие — всё в одном месте.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/auth?tab=register')}
              className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-orange-500 hover:bg-orange-400 text-white font-black text-base rounded-2xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              Зарегистрироваться бесплатно
              <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-base rounded-2xl border border-white/5 hover:border-white/10 transition-all"
            >
              Уже есть аккаунт? Войти
            </button>
            {canInstall && (
              <button
                onClick={install}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-zinc-900 hover:bg-zinc-800 text-orange-500 hover:text-orange-400 font-bold text-base rounded-2xl border border-orange-500/20 hover:border-orange-500/40 transition-all"
              >
                <Download size={18} />
                Скачать приложение
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="bg-zinc-900/50 border border-white/5 rounded-[24px] p-3 sm:p-5 text-center">
              <p className="text-lg sm:text-3xl font-black text-white mb-1 whitespace-nowrap">{value}</p>
              <p className="text-zinc-500 text-[9px] sm:text-xs font-bold leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's inside */}
      <section>
        <h2 className="text-xl sm:text-2xl font-black text-white mb-1">Что вас ждёт</h2>
        <p className="text-zinc-500 text-sm mb-6">Библиотека материалов в постоянном доступе, новое каждую неделю</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="flex gap-4 p-4 sm:p-5 bg-zinc-900/40 border border-white/5 rounded-[24px] hover:border-white/10 transition-all">
              <div className={`w-11 h-11 ${bg} rounded-2xl flex items-center justify-center shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm mb-1">{title}</p>
                <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For whom */}
      <section>
        <h2 className="text-xl sm:text-2xl font-black text-white mb-1">Для кого</h2>
        <p className="text-zinc-500 text-sm mb-6">SCA объединяет всех, кто связан с плаванием</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FOR_WHOM.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 p-4 bg-zinc-900/30 border border-white/5 rounded-[20px]">
              <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                <Icon size={16} className="text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm">{title}</p>
                <p className="text-zinc-500 text-xs leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="relative">
        <div className="absolute inset-0 bg-orange-500/5 rounded-[32px] blur-xl pointer-events-none" />
        <div className="relative bg-gradient-to-br from-orange-500/10 to-zinc-900/80 border border-orange-500/20 rounded-[32px] p-6 sm:p-8 text-center">
          <p className="text-orange-500 text-[11px] font-black uppercase tracking-[0.2em] mb-3">Начните сегодня</p>
          <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Присоединяйтесь к SCA</h3>
          <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
            Уже более 4 000 тренеров из 25+ стран используют материалы SCA для профессионального роста
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="group inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-black text-base rounded-2xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Создать аккаунт
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>
    </motion.div>
  );
};
