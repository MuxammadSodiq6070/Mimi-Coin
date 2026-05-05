import { projectId, publicAnonKey } from "/utils/supabase/info";
import { getTelegramInitData } from "./telegram";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fd08abf5`;

const getHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${publicAnonKey}`,
  "X-Telegram-Init-Data": getTelegramInitData()
});

const getMutationHeaders = () => ({
  ...getHeaders(),
  "Idempotency-Key": crypto.randomUUID()
});

export interface UserData {
  id: string;
  username: string;
  balance: number;
  diamonds: number;
  tickets: number;
  energy: number;
  maxEnergy: number;
  level: number;
  multiplier: number;
  avatar: string | null;
  inventory: InventoryItem[];
  tapCycleProgress?: number;
  tapCycleTarget?: number;
  lastTapReward?: Reward | null;
  createdAt?: number;
}

export interface Reward {
  type: "coins" | "diamonds" | "tickets";
  amount: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  acquiredAt: number;
}

export interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  score: number;
  avatar: string | null;
  isMe?: boolean;
}

export interface Auction {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  itemName: string;
  itemType: string;
  price: number;
  endsAt: number;
  createdAt: number;
}

export interface Mission {
  id: string;
  title: string;
  desc: string;
  progress: number;
  total: number;
  reward: number;
  type: "coins" | "diamonds" | "tickets";
  completed: boolean;
}

export interface Missions {
  lastReset: string;
  daily: Mission[];
  weekly: Mission[];
}

export interface Trade {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  offerType: "coins" | "diamonds" | "tickets";
  offerAmount: number;
  requestType: "coins" | "diamonds" | "tickets";
  requestAmount: number;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "open" | "completed";
  createdAt: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: number;
}

export interface UserSettings {
  sound: boolean;
  notifications: boolean;
  language: string;
  profilePublic: boolean;
  leaderboardVisible: boolean;
}

export interface LearningModule {
  id: string;
  title: string;
  imageUrl: string;
  difficulty: "beginner" | "medium" | "advanced";
  instruction: string;
  reward: {
    coins: number;
    diamonds: number;
    tickets: number;
  };
  completed: boolean;
}

export const api = {
  // Fetch initial user data
  async getUser(id: string, username?: string, avatar?: string | null): Promise<UserData> {
    const res = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ id, username, avatar })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch user"));
    return res.json();
  },

  // Sync state to backend (taps)
  async syncTaps(id: string, count: number): Promise<UserData> {
    const res = await fetch(`${API_BASE}/tap`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ id, count, timestamp: Date.now() })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to sync taps"));
    return res.json();
  },

  // Trigger energy regeneration on backend
  async regenEnergy(id: string): Promise<UserData> {
    const res = await fetch(`${API_BASE}/energy/regen`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to regen energy"));
    return res.json();
  },

  // Spend coins on backend
  async spend(id: string, amount: number): Promise<UserData> {
    const res = await fetch(`${API_BASE}/spend`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ id, amount })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to spend coins"));
    return res.json();
  },

  // Fetch global leaderboard
  async getLeaderboard(): Promise<LeaderboardUser[]> {
    const res = await fetch(`${API_BASE}/leaderboard`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch leaderboard"));
    return res.json();
  },

  // Update profile
  async updateProfile(id: string, username?: string, avatar?: string): Promise<UserData> {
    const res = await fetch(`${API_BASE}/profile/update`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ id, username, avatar })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update profile"));
    return res.json();
  },

  async getNotifications(): Promise<AppNotification[]> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch notifications"));
    return res.json();
  },

  async getSettings(): Promise<UserSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch settings"));
    return res.json();
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update settings"));
    return res.json();
  },

  async getLearningModules(): Promise<LearningModule[]> {
    const res = await fetch(`${API_BASE}/learning/modules`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch learning modules"));
    return res.json();
  },

  async createLearningModule(adminToken: string, module: { title?: string; imageUrl: string; prompt: string; difficulty?: "beginner" | "medium" | "advanced" }): Promise<any> {
    const res = await fetch(`${API_BASE}/learning/modules`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        "X-Admin-Token": adminToken
      },
      body: JSON.stringify(module)
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create learning module"));
    return res.json();
  },

  async completeLearningModule(moduleId: string, response: string): Promise<any> {
    const res = await fetch(`${API_BASE}/learning/complete`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ moduleId, response })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to complete learning module"));
    return res.json();
  },

  // Auctions
  async getAuctions(): Promise<Auction[]> {
    const res = await fetch(`${API_BASE}/auctions`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch auctions"));
    return res.json();
  },

  async createAuction(userId: string, itemName: string, itemType: string, price: number, duration?: number): Promise<Auction> {
    const res = await fetch(`${API_BASE}/auctions/create`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, itemName, itemType, price, duration })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create auction"));
    return res.json();
  },

  async buyAuction(userId: string, auctionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auctions/buy`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, auctionId })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to buy auction");
    }
    return res.json();
  },

  // Missions
  async getMissions(userId: string): Promise<Missions> {
    const res = await fetch(`${API_BASE}/missions/${userId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch missions"));
    return res.json();
  },

  async claimMission(userId: string, missionId: string, missionType: "daily" | "weekly"): Promise<any> {
    const res = await fetch(`${API_BASE}/missions/claim`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, missionId, missionType })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to claim mission");
    }
    return res.json();
  },

  async updateMissionProgress(userId: string, missionId: string, missionType: "daily" | "weekly", progress: number): Promise<Missions> {
    const res = await fetch(`${API_BASE}/missions/progress`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, missionId, missionType, progress })
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update mission progress"));
    return res.json();
  },

  // Games
  async playSpin(userId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/games/spin`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to play spin");
    }
    return res.json();
  },

  async playLottery(userId: string, numbers: number[]): Promise<any> {
    const res = await fetch(`${API_BASE}/games/lottery`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, numbers })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to play lottery");
    }
    return res.json();
  },

  // P2P Trading
  async getTrades(): Promise<Trade[]> {
    const res = await fetch(`${API_BASE}/trades`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to fetch trades"));
    return res.json();
  },

  async createTrade(
    userId: string,
    offerType: "coins" | "diamonds" | "tickets",
    offerAmount: number,
    requestType: "coins" | "diamonds" | "tickets",
    requestAmount: number
  ): Promise<Trade> {
    const res = await fetch(`${API_BASE}/trades/create`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, offerType, offerAmount, requestType, requestAmount })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create trade");
    }
    return res.json();
  },

  async acceptTrade(userId: string, tradeId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/trades/accept`, {
      method: 'POST',
      headers: getMutationHeaders(),
      body: JSON.stringify({ userId, tradeId })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to accept trade");
    }
    return res.json();
  }
};

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const error = await res.json();
    return error.error || fallback;
  } catch {
    return fallback;
  }
}
