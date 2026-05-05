import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../lib/api';
import { getTelegramDisplayName, getTelegramUser, isTelegramMiniApp } from '../lib/telegram';

// 1. Define the store state
interface GameState {
  // User Profile Data
  id: string;
  username: string;
  avatar: string | null;

  // Game Economy
  balance: number;
  diamonds: number;
  tickets: number;

  // Energy System
  energy: number;
  maxEnergy: number;

  // Progression
  level: number;
  multiplier: number;

  // Inventory
  inventory: any[];
  tapCycleProgress: number;
  tapCycleTarget: number;
  lastTapReward: any | null;

  // Meta
  lastTapTime: number;
  hasLoadedInitial: boolean;
  isSyncing: boolean;
  syncError: string | null;

  // Local pending taps (optimistic UI)
  pendingTaps: number;

  // Actions
  initializeUser: () => Promise<void>;
  tap: () => { amount: number; success: boolean };
  syncTapsWithBackend: () => Promise<void>;
  regenerateEnergy: () => Promise<void>;
  setUserData: (data: Partial<GameState>) => void;
  updateProfile: (username?: string, avatar?: string) => Promise<void>;
  buyItem: (cost: number) => boolean;
  refreshUserData: () => Promise<void>;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Default state before API load
      id: '',
      username: '',
      avatar: null,
      balance: 0,
      diamonds: 0,
      tickets: 0,
      energy: 1000,
      maxEnergy: 1000,
      level: 1,
      multiplier: 1,
      inventory: [],
      tapCycleProgress: 0,
      tapCycleTarget: 250,
      lastTapReward: null,
      lastTapTime: 0,
      hasLoadedInitial: false,
      isSyncing: false,
      syncError: null,
      pendingTaps: 0,
      
      initializeUser: async () => {
        try {
          const telegramUser = getTelegramUser();
          if (!telegramUser || !isTelegramMiniApp()) {
            set({
              id: '',
              hasLoadedInitial: false,
              syncError: "Open this game from Telegram to sign in."
            });
            return;
          }

          const id = String(telegramUser.id);
          const username = getTelegramDisplayName(telegramUser);
          const avatar = telegramUser.photo_url || null;

          set({ id, username, avatar });
          const userData = await api.getUser(id, username, avatar);
          set({
            ...userData,
            hasLoadedInitial: true,
            syncError: null,
            pendingTaps: 0
          });
        } catch (error: any) {
          console.error("Initialization error:", error);
          set({ syncError: "Failed to connect to server." });
        }
      },

      // Core mechanics: Tap
      tap: () => {
        const now = Date.now();
        const { energy, tapCycleProgress, tapCycleTarget, lastTapTime, pendingTaps } = get();
        
        // If syncing or error, might still allow tap but let's just let them tap
        // unless sync error is critical. We will allow optimistic taps.
        
        // 1. Anti-spam protection (limit to max ~20 taps per second -> 50ms interval)
        if (now - lastTapTime < 50) {
          return { amount: 0, success: false }; // Too fast
        }

        // 2. Check energy
        if (energy < 1) {
          return { amount: 0, success: false }; // Out of energy
        }

        // Taps now build server-validated cycle progress; rewards only settle after 200-300 taps.
        set({
          energy: energy - 1,
          tapCycleProgress: Math.min(tapCycleTarget, tapCycleProgress + 1),
          lastTapTime: now,
          pendingTaps: pendingTaps + 1
        });
        
        return { amount: 1, success: true };
      },
      
      syncTapsWithBackend: async () => {
        const { id, pendingTaps, isSyncing } = get();
        if (pendingTaps === 0 || isSyncing || !id) return;
        
        set({ isSyncing: true, syncError: null });
        try {
          // We send the count of taps to the backend
          const tapsToSend = pendingTaps;
          
          // Optimistically reset pending taps before network call so we can collect more while in flight
          set({ pendingTaps: get().pendingTaps - tapsToSend });
          
          const userData = await api.syncTaps(id, tapsToSend);
          
          // Update local state with authoritative server state
          // (Adding back any new pending taps that happened during the request)
          set((state) => ({
            ...userData,
            tapCycleProgress: Math.min((userData.tapCycleProgress || 0) + state.pendingTaps, userData.tapCycleTarget || 250),
            energy: Math.max(0, userData.energy - state.pendingTaps),
            level: userData.level,
            multiplier: userData.multiplier,
            maxEnergy: userData.maxEnergy,
            isSyncing: false,
            syncError: null
          }));
        } catch (error: any) {
          console.error("Sync error:", error);
          set((state) => ({ 
            isSyncing: false, 
            pendingTaps: state.pendingTaps + tapsToSend,
            syncError: error.message || "Network error while syncing taps."
          }));
        }
      },

      // Background progression: Regenerate Energy (Local Optimistic)
      regenerateEnergy: async () => {
        set((state) => {
          if (state.energy < state.maxEnergy) {
            // Restore 3 energy per tick optimistically
            return { energy: Math.min(state.maxEnergy, state.energy + 3) };
          }
          return state; // No change
        });
      },

      // Utilities
      setUserData: (data) => set((state) => ({ ...state, ...data, hasLoadedInitial: true })),

      updateProfile: async (username?: string, avatar?: string) => {
        const telegramUser = getTelegramUser();
        const id = telegramUser ? String(telegramUser.id) : get().id;
        try {
          set({ isSyncing: true });
          const userData = await api.updateProfile(
            id,
            username ?? (telegramUser ? getTelegramDisplayName(telegramUser) : undefined),
            avatar ?? telegramUser?.photo_url
          );
          set({
            username: userData.username,
            avatar: userData.avatar,
            isSyncing: false,
            syncError: null
          });
        } catch (error: any) {
          console.error("Profile update error:", error);
          set({ isSyncing: false, syncError: "Failed to update profile." });
        }
      },

      refreshUserData: async () => {
        const telegramUser = getTelegramUser();
        const { id } = get();
        const username = telegramUser ? getTelegramDisplayName(telegramUser) : get().username;
        const avatar = telegramUser?.photo_url || get().avatar;
        try {
          const userData = await api.getUser(id, username, avatar);
          set({
            ...userData,
            syncError: null
          });
        } catch (error: any) {
          console.error("Refresh error:", error);
          set({ syncError: "Failed to refresh user data." });
        }
      },

      buyItem: (cost) => {
        const { balance, id } = get();
        if (balance >= cost) {
          // Optimistically subtract
          set({ balance: balance - cost });
          // Fire and forget backend sync
          api.spend(id, cost).catch(err => {
            console.error("Failed to spend on server:", err);
            // If failed, revert the optimistic update
            set({ balance: get().balance + cost });
          });
          return true;
        }
        return false;
      }
    }),
    {
      name: 'premium-game-storage', // key in localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        id: state.id, 
        username: state.username, 
        avatar: state.avatar 
      }), // only persist ID and basic profile locally, rest comes from server
    }
  )
);
