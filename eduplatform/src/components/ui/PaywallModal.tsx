import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Crown, Lock } from 'lucide-react';
import { UserTier } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export const PaywallModal = ({
  isOpen,
  onClose,
  requiredTier,
}: {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: UserTier;
}) => {
  const navigate = useNavigate();
  const { tier } = useAuth();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            className="bg-zinc-900 border border-white/10 rounded-[32px] p-8 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-orange-500/10 rounded-[24px] flex items-center justify-center text-orange-500 mx-auto mb-6">
                {tier === 'guest' ? <UserIcon size={40} /> : <Lock size={40} />}
              </div>
              {tier === 'guest' ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2">Видео закрыто</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Зарегистрируйтесь и оформите подписку, чтобы смотреть видео
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2">Нужна подписка</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Оформите подписку, чтобы открыть все видео и курсы
                  </p>
                </>
              )}
            </div>

            <div className="space-y-3">
              {tier === 'guest' ? (
                <>
                  <button
                    onClick={() => { navigate('/auth'); onClose(); }}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg transition-all hover:bg-zinc-100"
                  >
                    Зарегистрироваться
                  </button>
                  <button
                    onClick={() => { navigate('/auth'); onClose(); }}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    <Crown size={20} />
                    Войти
                  </button>
                </>
              ) : (
                <a
                  href="https://web.tribute.tg/s/kCa"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  <Crown size={20} />
                  Оформить подписку
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 text-zinc-500 hover:text-white transition-colors text-sm"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
