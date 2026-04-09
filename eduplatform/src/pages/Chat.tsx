import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Loader2, Bot, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Как улучшить технику кроля?',
  'Какие упражнения подходят для начинающих?',
  'Как составить план тренировок?',
  'Расскажи о технике брасса',
];

export const Chat = () => {
  const { tier } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (tier === 'guest') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-24 h-24 bg-zinc-800 rounded-[32px] flex items-center justify-center text-zinc-600 mb-8">
          <MessageSquare size={48} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-3 italic tracking-tighter">AI Ассистент SCA</h1>
        <p className="text-zinc-500 max-w-xs mx-auto mb-8">
          Зарегистрируйтесь бесплатно, чтобы получить доступ к персональному AI-тютору по плаванию
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20"
        >
          Войти бесплатно
        </button>
      </motion.div>
    );
  }

  const sendMessage = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setInput('');
    if (inputRef.current) { inputRef.current.style.height = '20px'; }
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          history: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
        }),
      });

      if (!res.ok) throw new Error('Ошибка сервера');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', text: data.reply }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', text: 'Произошла ошибка. Попробуйте ещё раз.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100dvh-9rem)] md:h-[calc(100dvh-6rem)] max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
        <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center">
          <Bot size={20} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">AI Ассистент SCA</h1>
          <p className="text-xs text-zinc-500">Персональный тютор по плаванию на базе Gemini</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-zinc-500 font-bold">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-20 h-20 bg-orange-500/10 rounded-[28px] flex items-center justify-center">
              <Bot size={36} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white mb-2">Привет! Я AI-ассистент SCA</h2>
              <p className="text-zinc-500 text-sm max-w-xs">
                Задай любой вопрос о технике плавания, тренировках или подготовке спортсменов
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left px-4 py-3 bg-zinc-900 border border-white/[0.06] rounded-2xl text-xs sm:text-sm text-zinc-300 hover:border-orange-500/30 hover:text-white transition-all leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-orange-500" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === 'user'
                    ? "bg-orange-500 text-white rounded-tr-sm"
                    : "bg-zinc-900 text-zinc-100 border border-white/[0.06] rounded-tl-sm"
                )}
              >
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 mt-1">
                  <User size={16} className="text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Bot size={16} className="text-orange-500" />
            </div>
            <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 size={16} className="text-orange-500 animate-spin" />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-white/[0.06]">
        <div className="flex gap-3 items-center bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-orange-500/40 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Задай вопрос по плаванию..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 resize-none outline-none disabled:opacity-50 leading-5"
            style={{ height: '20px', maxHeight: '128px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-9 h-9 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
        <p className="hidden sm:block text-center text-zinc-600 text-xs mt-2">Enter — отправить · Shift+Enter — новая строка</p>
      </div>
    </motion.div>
  );
};
