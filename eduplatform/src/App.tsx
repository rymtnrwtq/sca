import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { MobileInstallBanner } from './components/ui/MobileInstallBanner';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Auth } from './pages/Auth';
import { Learn } from './pages/Learn';
import { WatchVideo } from './pages/WatchVideo';
import { HistoryPage } from './pages/HistoryPage';
import { BookmarksPage } from './pages/BookmarksPage';
import { Chat } from './pages/Chat';
import { Profile } from './pages/Profile';
import { Offline } from './pages/Offline';
import { AdminPage } from './pages/AdminPage';
import { LiveBroadcast } from './pages/LiveBroadcast';
import { SubscriptionPage } from './pages/SubscriptionPage';

function AppInner() {
  const { isLoading } = useAuth();

  useEffect(() => {
    const scriptId = 'kinescope-iframe-api';
    if (document.getElementById(scriptId)) return;
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://player.kinescope.io/latest/iframe.player.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-orange-500/30">
      <Sidebar />
      <main className="md:ml-64 lg:ml-72 xl:ml-80 min-h-screen">
        <div className="w-full px-4 sm:px-6 lg:px-10 pt-6 md:pt-14 pb-0 md:pb-10">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/watch/:videoId" element={<WatchVideo />} />
              <Route path="/live" element={<LiveBroadcast />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/bookmarks" element={<BookmarksPage />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/offline" element={<Offline />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/subscription/return" element={<SubscriptionPage />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      <MobileInstallBanner />
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}