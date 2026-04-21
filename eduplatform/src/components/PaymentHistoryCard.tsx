import React, { useEffect, useState } from 'react';
import { Receipt, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface Payment {
  id: number;
  event_name: string;
  subscription_name: string;
  channel_name: string | null;
  amount: number | null;    // kopecks
  currency: string | null;
  period: string | null;
  expires_at: string | null;
  paid_at: string | null;
  source: string;
}

const labelForEvent = (e: string): { text: string; color: string; Icon: any } => {
  switch (e) {
    case 'new_subscription': return { text: 'Новая подписка', color: 'text-green-400', Icon: CheckCircle2 };
    case 'renewed_subscription': return { text: 'Продление', color: 'text-green-400', Icon: RefreshCw };
    case 'cancelled_subscription': return { text: 'Отмена', color: 'text-red-400', Icon: XCircle };
    case 'init_payment': return { text: 'Оплата', color: 'text-green-400', Icon: CheckCircle2 };
    case 'recurrent_payment': return { text: 'Регулярный платёж', color: 'text-green-400', Icon: RefreshCw };
    default: return { text: e || 'Событие', color: 'text-zinc-400', Icon: CheckCircle2 };
  }
};

const formatAmount = (kopecks: number | null, currency: string | null) => {
  if (kopecks == null) return '—';
  const v = kopecks / 100;
  const cur = (currency || 'rub').toUpperCase();
  return `${v.toLocaleString('ru', { minimumFractionDigits: 0 })} ${cur}`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const PaymentHistoryCard = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/me/tribute-payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Не удалось загрузить');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Receipt size={18} className="text-orange-500" /> История платежей
        </h3>
        <button onClick={load} className="text-zinc-500 hover:text-white text-xs">Обновить</button>
      </div>

      {loading && <p className="text-zinc-500 text-sm text-center py-6">Загрузка…</p>}
      {error && <p className="text-red-400 text-sm text-center py-6">{error}</p>}
      {!loading && !error && payments.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-6">
          Платежей не найдено. Привяжите Telegram, чтобы подтянуть историю подписок Tribute.
        </p>
      )}

      <div className="space-y-2">
        {payments.map(p => {
          const { text, color, Icon } = labelForEvent(p.event_name);
          return (
            <div key={p.id} className="p-3 bg-white/5 rounded-2xl">
              <div className="flex items-start gap-3">
                <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold truncate">{p.subscription_name}</p>
                  <p className="text-zinc-500 text-xs truncate">{p.channel_name || '—'}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                    <span className={color}>{text}</span>
                    <span className="text-zinc-400">{formatAmount(p.amount, p.currency)}</span>
                    {p.period && <span className="text-zinc-600">{p.period}</span>}
                  </div>
                  <p className="text-zinc-600 text-xs mt-1">{formatDate(p.paid_at)}</p>
                  {p.expires_at && (
                    <p className="text-zinc-500 text-xs">до {formatDate(p.expires_at)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
