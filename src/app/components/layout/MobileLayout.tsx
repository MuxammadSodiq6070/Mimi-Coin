import { Outlet, NavLink } from "react-router";
import { Trophy, Gamepad2, ShoppingBag, User, CloudOff, Loader2, Coins, Send, WifiOff, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { initTelegramWebApp, isTelegramMiniApp } from "../../lib/telegram";
import { api } from "../../lib/api";
import { toast } from "sonner";

export function MobileLayout() {
  const { 
    initializeUser, 
    regenerateEnergy, 
    syncTapsWithBackend, 
    refreshUserData,
    hasLoadedInitial, 
    isSyncing,
    syncError 
  } = useGameStore();

  const [isLoading, setIsLoading] = useState(!hasLoadedInitial);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isTelegramReady = isTelegramMiniApp();

  useEffect(() => initTelegramWebApp(), []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncTapsWithBackend().finally(() => refreshUserData());
    };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => {
      if (isTelegramReady) syncTapsWithBackend().finally(() => refreshUserData());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refreshUserData, syncTapsWithBackend, isTelegramReady]);

  // Load real backend data on app start
  useEffect(() => {
    if (!isTelegramReady) {
      setIsLoading(false);
      return;
    }

    async function loadData() {
      setIsLoading(true);
      await initializeUser();
      setIsLoading(false);
    }
    loadData();
  }, [initializeUser, isTelegramReady]);

  // Background Loop: Energy Regeneration (ticks every second)
  useEffect(() => {
    if (!isTelegramReady) return;
    const intervalId = setInterval(() => {
      regenerateEnergy();
    }, 1000);
    return () => clearInterval(intervalId);
  }, [regenerateEnergy, isTelegramReady]);

  // Background Loop: Sync taps to backend (ticks every 5 seconds)
  useEffect(() => {
    if (!isTelegramReady) return;
    const syncIntervalId = setInterval(() => {
      syncTapsWithBackend();
    }, 5000);

    // Periodically fetch full state to keep local energy in check
    const fullSyncId = setInterval(() => {
      initializeUser();
    }, 60000);

    return () => {
      clearInterval(syncIntervalId);
      clearInterval(fullSyncId);
    };
  }, [syncTapsWithBackend, initializeUser, isTelegramReady]);

  useEffect(() => {
    if (!isTelegramReady) return;

    const loadNotifications = async () => {
      try {
        const notifications = await api.getNotifications();
        notifications.forEach((notification) => toast(notification.title, {
          description: notification.message
        }));
      } catch {
        // Notification polling should never block gameplay.
      }
    };

    loadNotifications();
    const id = setInterval(loadNotifications, 30000);
    return () => clearInterval(id);
  }, [isTelegramReady]);

  return (
    <div className="telegram-app-shell flex justify-center bg-black text-neutral-100 font-sans selection:bg-[#D4AF37]/30" style={{ touchAction: 'manipulation' }}>
      <div className="w-full max-w-md bg-[var(--tg-bg-color,#050505)] telegram-app-frame relative shadow-2xl flex flex-col overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/5 rounded-[100%] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#D4AF37]/5 rounded-[100%] blur-[100px] pointer-events-none" />

        {/* Sync Status Overlay / Indicator */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 z-50 bg-amber-500/10 border border-amber-500/20 backdrop-blur-md rounded-xl p-3 flex items-center gap-3"
            >
              <WifiOff size={18} className="text-amber-300" />
              <p className="text-xs text-amber-100">Offline. Actions will retry when connection returns.</p>
            </motion.div>
          )}
          {syncError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 z-50 bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-xl p-3 flex items-center gap-3"
            >
              <CloudOff size={18} className="text-red-400" />
              <p className="text-xs text-red-200">{syncError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {isSyncing && <Loader2 size={16} className="text-neutral-500 animate-spin" />}
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 z-10 scrollbar-hide relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
            </div>
          ) : !isTelegramReady ? (
            <TelegramStartScreen />
          ) : (
            <Outlet />
          )}
        </main>

        {/* Bottom Navigation */}
        {isTelegramReady && (
        <div className="absolute bottom-0 left-0 w-full z-50">
          <div className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-2xl border-t border-white/5" style={{ maskImage: "linear-gradient(to top, black 50%, transparent)" }} />
          <nav className="relative flex justify-between items-center px-6 py-4 telegram-bottom-nav">
            <NavItem to="/ratings" icon={<Trophy size={22} />} label="Ratings" />
            <NavItem to="/" icon={<Gamepad2 size={22} />} label="Games" />
            <NavItem to="/tap" icon={<Coins size={22} />} label="Tap" />
            <NavItem to="/learn" icon={<BookOpen size={22} />} label="Learn" />
            <NavItem to="/market" icon={<ShoppingBag size={22} />} label="Market" />
            <NavItem to="/profile" icon={<User size={22} />} label="Profile" />
          </nav>
        </div>
        )}
      </div>
    </div>
  );
}

function TelegramStartScreen() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-6">
        <Send size={28} className="text-[#D4AF37]" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Launch in Telegram</h1>
      <p className="text-sm text-neutral-400 leading-6 max-w-xs">
        This game now signs players in with Telegram Mini App data. Open it from your bot so Telegram can provide a verified session.
      </p>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 transition-all duration-300 relative ${
          isActive ? "text-[#D4AF37]" : "text-neutral-500 hover:text-neutral-300"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute inset-0 bg-[#D4AF37]/20 blur-md rounded-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
            <div className="relative z-10">{icon}</div>
          </div>
          <span className="text-[10px] font-medium tracking-wider uppercase">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
