import React from 'react';
import { X } from 'lucide-react';

export const Offline = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-black">
    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 mb-6">
      <X size={40} />
    </div>
    <h1 className="text-2xl font-bold text-white mb-2">Нет сети</h1>
    <p className="text-zinc-500">Проверьте подключение к интернету, чтобы продолжить обучение.</p>
  </div>
);
