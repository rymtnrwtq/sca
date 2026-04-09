import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, Check, Zap, Clock, CreditCard, Trash2, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface Plan {
  id: string;
  label: string;
  amount: number;
  days: number;
}

interface SubscriptionInfo {
  tier: string;
  subscription_expires_at: string | null;
  has_payment_method: boolean;
  trial_used: boolean;
  auto_renew: boolean;
}

interface Payment {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  '1month': '1 месяц',
  '6months': '6 месяцев',
  '1year': '1 год',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  succeeded: { label: 'Оплачен', color: 'text-green-400' },
  pending:   { label: 'В обработке', color: 'text-yellow-400' },
  cancelled: { label: 'Отменён', color: 'text-zinc-500' },
};

export const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, tier, refreshUser } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true);
  const [paying, setPaying] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const token = () => localStorage.getItem('auth_token');

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, histRes] = await Promise.all([
        fetch('/api/subscription/plans', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/subscription/history', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (plansRes.ok) {
        const d = await plansRes.json();
        setPlans(d.plans || []);
        setSubInfo(d.current);
      }
      if (histRes.ok) {
        const d = await histRes.json();
        setPayments(d.payments || []);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle return from YooKassa
  useEffect(() => {
    const paymentId = searchParams.get('payment_id');
    if (!paymentId) { load(); return; }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/subscription/payment/${paymentId}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (data.status === 'succeeded') {
          setMessage({ type: 'ok', text: 'Подписка успешно активирована!' });
          await refreshUser();
        } else if (data.status === 'cancelled') {
          setMessage({ type: 'err', text: 'Платёж отменён.' });
        } else {
          setMessage({ type: 'err', text: 'Платёж ещё обрабатывается, проверьте позже.' });
        }
      } catch {
        setMessage({ type: 'err', text: 'Ошибка проверки платежа.' });
      }
      navigate('/subscription', { replace: true });
      load();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      const res = await fetch('/api/subscription/trial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'ok', text: 'Пробный период на 24 часа активирован!' });
        await refreshUser();
        load();
      } else {
        setMessage({ type: 'err', text: data.message });
      }
    } finally {
      setTrialLoading(false);
    }
  };

  const handlePay = async (planId: string) => {
    setPaying(true);
    setMessage(null);
    try {
      const res = await fetch('/api/subscription/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ plan: planId, save_card: saveCard }),
      });
      const data = await res.json();
      if (data.success && data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        setMessage({ type: 'err', text: data.message ?? 'Ошибка создания платежа' });
        setPaying(false);
      }
    } catch {
      setMessage({ type: 'err', text: 'Ошибка сети' });
      setPaying(false);
    }
  };

  const handleDetach = async () => {
    if (!confirm('Отвязать карту? Автоматическое продление будет отключено.')) return;
    setDetachLoading(true);
    try {
      const res = await fetch('/api/subscription/payment-method', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'ok', text: 'Карта отвязана. Подписка истечёт в конце периода.' });
        await refreshUser();
        load();
      }
    } finally {
      setDetachLoading(false);
    }
  };

  if (tier === 'guest') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Crown size={48} className="text-zinc-700 mb-6" />
        <h1 className="text-xl font-bold text-white mb-2">Войдите в аккаунт</h1>
        <p className="text-zinc-500 mb-6 text-sm">Чтобы оформить подписку, нужно авторизоваться</p>
        <button onClick={() => navigate('/auth')} className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all">
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const isActive = tier === 'premium' && subInfo?.subscription_expires_at
    ? new Date(subInfo.subscription_expires_at) > new Date()
    : false;

  const formatExpiry = (iso: string) => {
    const date = new Date(iso);
    const diffMs = date.getTime() - Date.now();
    const diffHours = Math.ceil(diffMs / 3600_000);
    const diffDays = Math.floor(diffMs / 86400_000);
    const dateStr = date.toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    if (diffMs <= 0) return `Истекла ${dateStr}`;
    if (diffHours <= 48) return `Осталось ${diffHours} ч. · до ${dateStr}`;
    return `Осталось ${diffDays} дн. · до ${dateStr}`;
  };

  const perMonth: Record<string, string> = {
    '1month':  '1200 ₽/мес',
    '6months': '983 ₽/мес',
    '1year':   '825 ₽/мес',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Подписка</h1>
          <p className="text-zinc-500 text-sm">SCA Premium — полный доступ</p>
        </div>
      </div>

      {/* Message banner */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl border",
              message.type === 'ok'
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            {message.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current status */}
          <div className={cn(
            "p-5 rounded-3xl border",
            isActive
              ? "bg-orange-500/10 border-orange-500/20"
              : "bg-zinc-900 border-white/5"
          )}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isActive ? "bg-orange-500" : "bg-zinc-800")}>
                  <Crown size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold">{isActive ? 'Premium активна' : 'Бесплатный тариф'}</p>
                  {isActive && subInfo?.subscription_expires_at && (
                    <p className="text-zinc-400 text-sm">
                      {formatExpiry(subInfo.subscription_expires_at)}
                    </p>
                  )}
                  {!isActive && <p className="text-zinc-500 text-sm">Оформите подписку для полного доступа</p>}
                </div>
              </div>
              {isActive && subInfo?.auto_renew && (
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-full border border-green-500/20 flex items-center gap-1.5">
                  <RefreshCw size={11} /> Автопродление
                </span>
              )}
            </div>

            {isActive && subInfo?.has_payment_method && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <CreditCard size={16} />
                  <span>Карта привязана · автопродление включено</span>
                </div>
                <button
                  onClick={handleDetach}
                  disabled={detachLoading}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors font-medium disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {detachLoading ? '...' : 'Отвязать'}
                </button>
              </div>
            )}
          </div>

          {/* Free trial */}
          {!isActive && !subInfo?.trial_used && payments.length === 0 && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900 border border-orange-500/20 p-5 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Zap size={22} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">1 день бесплатно</h3>
                  <p className="text-zinc-500 text-sm mt-1">Полный доступ на 24 часа — без карты и без оплаты</p>
                  <button
                    onClick={handleTrial}
                    disabled={trialLoading}
                    className="mt-4 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {trialLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    Попробовать бесплатно
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plans */}
          <div className="space-y-3">
            <h2 className="text-white font-bold text-lg px-1">Выберите тариф</h2>
            {plans.map(plan => {
              const isSelected = selectedPlan === plan.id;
              const isBest = plan.id === '6months';
              return (
                <motion.button
                  key={plan.id}
                  onClick={() => setSelectedPlan(isSelected ? null : plan.id)}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full text-left p-5 rounded-3xl border transition-all",
                    isSelected
                      ? "bg-orange-500/10 border-orange-500/40 shadow-lg shadow-orange-500/10"
                      : "bg-zinc-900 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      isSelected ? "bg-orange-500 border-orange-500" : "border-zinc-600"
                    )}>
                      {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-lg">{plan.label}</span>
                          {isBest && (
                            <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                              Выгоднее всего
                            </span>
                          )}
                        </div>
                        <span className="text-white font-black text-xl ml-3 shrink-0">{plan.amount.toLocaleString('ru')} ₽</span>
                      </div>
                      <p className="text-zinc-500 text-sm mt-0.5">{perMonth[plan.id]}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Payment options */}
          {selectedPlan && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-white/5 p-5 rounded-3xl space-y-4"
            >
              <h3 className="text-white font-bold">Оплата</h3>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setSaveCard(v => !v)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                    saveCard ? "bg-orange-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                    saveCard ? "left-7" : "left-1"
                  )} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Сохранить карту для автопродления</p>
                  <p className="text-zinc-600 text-xs">Следующий платёж спишется автоматически</p>
                </div>
              </label>

              <ul className="text-xs text-zinc-600 space-y-1 px-1">
                <li className="flex items-center gap-2"><Check size={11} className="text-zinc-500" /> Оплата через ЮKassa</li>
                <li className="flex items-center gap-2"><Check size={11} className="text-zinc-500" /> Мы не храним данные карты</li>
                {saveCard && <li className="flex items-center gap-2"><Check size={11} className="text-zinc-500" /> Отвязать карту можно в любой момент</li>}
              </ul>

              <button
                onClick={() => handlePay(selectedPlan)}
                disabled={paying}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paying ? (
                  <><Loader2 size={20} className="animate-spin" /> Переход к оплате...</>
                ) : (
                  <><CreditCard size={18} /> Оплатить {PLAN_LABELS[selectedPlan] ?? ''}</>
                )}
              </button>
            </motion.div>
          )}

          {/* Features */}
          <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
            <h3 className="text-white font-bold mb-4">Что входит в Premium</h3>
            <ul className="space-y-2.5">
              {[
                'Полный доступ ко всем семинарам без ограничений',
                'Прямые эфиры SCA',
                'Материалы и мастер-классы',
                'Иностранные конференции',
              ].map(f => (
                <li key={f} className="flex items-center gap-3 text-zinc-300 text-sm">
                  <CheckCircle2 size={16} className="text-orange-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
              <h3 className="text-white font-bold mb-4">История платежей</h3>
              <div className="space-y-2">
                {payments.map(p => {
                  const s = STATUS_LABELS[p.status] ?? { label: p.status, color: 'text-zinc-500' };
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{PLAN_LABELS[p.plan] ?? p.plan}</p>
                        <p className="text-zinc-600 text-xs">{new Date(p.created_at).toLocaleDateString('ru')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">{p.amount.toLocaleString('ru')} {p.currency}</p>
                        <p className={cn("text-xs", s.color)}>{s.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
