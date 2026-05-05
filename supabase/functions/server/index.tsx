import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-fd08abf5/health", (c) => {
  return c.json({ status: "ok" });
});

app.use("/make-server-fd08abf5/*", async (c, next) => {
  try {
    const telegramUser = await verifyTelegramRequest(c.req.header("X-Telegram-Init-Data") || "");
    c.set("telegramUser", telegramUser);
    await next();
  } catch (err: any) {
    return c.json({ error: err.message || "Invalid Telegram session" }, 401);
  }
});

const getVerifiedTelegramUser = (c: any) => c.get("telegramUser");
const getVerifiedUserId = (c: any) => String(getVerifiedTelegramUser(c).id);
const AUTH_MAX_AGE_SECONDS = Number(Deno.env.get("TELEGRAM_AUTH_MAX_AGE_SECONDS") || 600);
const AUCTION_FEE_RATE = Number(Deno.env.get("AUCTION_FEE_RATE") || 0.05);
const TRADE_FEE_RATE = Number(Deno.env.get("TRADE_FEE_RATE") || 0.02);
const MAX_TAPS_PER_REQUEST = 30;
const MAX_TAPS_PER_MINUTE = 360;
const TAP_REWARD_BASE = 10;
const ENERGY_REGEN_PER_SECOND = 3;

const mutationResult = async (c: any, scope: string, handler: () => Promise<any>) => {
  const userId = getVerifiedUserId(c);
  const idempotencyKey = c.req.header("Idempotency-Key");
  if (!idempotencyKey) return c.json({ error: "Missing idempotency key" }, 409);

  const key = `idempotency:${scope}:${userId}:${idempotencyKey}`;
  const existing = await kv.get(key);
  if (existing?.status === "completed") return c.json(existing.response);

  const inserted = await kv.insertOnce(key, {
    status: "processing",
    userId,
    scope,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  if (!inserted) return c.json({ error: "Request is already being processed" }, 409);

  const response = await handler();
  await kv.set(key, {
    status: "completed",
    userId,
    scope,
    response,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });
  return c.json(response);
};

const withLocks = async <T,>(lockIds: string[], handler: () => Promise<T>): Promise<T> => {
  const acquired: string[] = [];
  const sortedLockIds = [...new Set(lockIds)].sort();

  try {
    for (const lockId of sortedLockIds) {
      await acquireLock(lockId);
      acquired.push(lockId);
    }
    return await handler();
  } finally {
    await Promise.all(acquired.map((lockId) => kv.del(`lock:${lockId}`).catch(() => undefined)));
  }
};

const acquireLock = async (lockId: string) => {
  const key = `lock:${lockId}`;
  const now = Date.now();
  const lock = await kv.get(key);
  if (lock?.expiresAt && lock.expiresAt < now) await kv.del(key);

  const inserted = await kv.insertOnce(key, {
    createdAt: now,
    expiresAt: now + 10_000
  });
  if (!inserted) throw new Error("Resource is busy. Please retry.");
};

const assertPositiveInteger = (value: any, name: string, max = 1_000_000) => {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0 || numberValue > max) {
    throw new Error(`Invalid ${name}`);
  }
  return numberValue;
};

const applyEnergyRegen = (user: any, now = Date.now()) => {
  const timePassed = now - (user.lastEnergyRegen || user.lastTapTime || now);
  const energyToRecover = Math.floor(timePassed / 1000) * ENERGY_REGEN_PER_SECOND;
  if (energyToRecover > 0) {
    user.energy = Math.min(user.maxEnergy, user.energy + energyToRecover);
    user.lastEnergyRegen = now;
  }
};

const updateProgression = (user: any) => {
  user.lifetimeEarnings = user.lifetimeEarnings || user.balance || 0;
  const level = Math.max(1, Math.floor(Math.sqrt(user.lifetimeEarnings / 1000)) + 1);
  user.level = level;
  user.maxEnergy = 1000 + (level - 1) * 25;
  user.multiplier = Math.min(5, 1 + Math.floor((level - 1) / 5) * 0.25);
};

const addNotification = async (userId: string, notification: any) => {
  const key = `notifications:${userId}`;
  const notifications = (await kv.get(key)) || [];
  notifications.unshift({
    id: `notification_${Date.now()}_${crypto.randomUUID()}`,
    read: false,
    createdAt: Date.now(),
    ...notification
  });
  await kv.set(key, notifications.slice(0, 50));
};

const getTelegramDisplayName = (user: any) => {
  if (user.username) return `@${user.username}`;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || `Player_${user.id}`;
};

const syncTelegramProfile = (user: any, telegramUser: any) => {
  user.username = getTelegramDisplayName(telegramUser);
  user.avatar = telegramUser.photo_url || null;
  user.telegram = {
    id: telegramUser.id,
    username: telegramUser.username || null,
    firstName: telegramUser.first_name || null,
    lastName: telegramUser.last_name || null,
    languageCode: telegramUser.language_code || null,
    photoUrl: telegramUser.photo_url || null,
    lastSyncedAt: Date.now()
  };
};

async function verifyTelegramRequest(initData: string) {
  if (!initData) throw new Error("Missing Telegram init data");

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("BOT_TOKEN");
  if (!botToken) throw new Error("Telegram bot token is not configured");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Missing Telegram hash");

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();
  const webAppDataKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secretKeyBytes = await crypto.subtle.sign("HMAC", webAppDataKey, encoder.encode(botToken));
  const secretKey = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(dataCheckString));
  const calculatedHash = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (!timingSafeEqual(calculatedHash, receivedHash)) {
    throw new Error("Invalid Telegram signature");
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || (Date.now() / 1000) - authDate > AUTH_MAX_AGE_SECONDS) {
    throw new Error("Telegram session expired");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Missing Telegram user");

  return JSON.parse(rawUser);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

app.post("/make-server-fd08abf5/user", async (c) => {
  try {
    const telegramUser = getVerifiedTelegramUser(c);
    const id = getVerifiedUserId(c);

    const userKey = `user:${id}`;
    let user = await kv.get(userKey);

    if (!user) {
      user = {
        id,
        username: getTelegramDisplayName(telegramUser),
        avatar: telegramUser.photo_url || null,
        balance: 0,
        diamonds: 100, // Starting diamonds
        tickets: 10, // Starting tickets for games
        energy: 1000,
        maxEnergy: 1000,
        level: 1,
        multiplier: 1,
        lastTapTime: 0,
        inventory: [], // { id, name, type, rarity, acquiredAt }
        createdAt: Date.now()
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (user.dailyResetDate !== today) {
      user.dailyResetDate = today;
      user.dailyTapCount = 0;
      user.dailyRewardClaimed = false;
    }
    syncTelegramProfile(user, telegramUser);
    updateProgression(user);
    await kv.set(userKey, user);
    return c.json(user);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-fd08abf5/tap", async (c) => {
  try {
    const { count } = await c.req.json();
    const id = getVerifiedUserId(c);
    const requestedCount = assertPositiveInteger(count, "tap count", MAX_TAPS_PER_REQUEST);

    return c.json(await withLocks([`user:${id}`], async () => {
      const userKey = `user:${id}`;
      const user = await kv.get(userKey);

      if (!user) throw new Error("User not found");
      if (user.blockedUntil && user.blockedUntil > Date.now()) {
        throw new Error("Tap cooldown active. Please wait and try again.");
      }

      const now = Date.now();
      applyEnergyRegen(user, now);

      const tapWindowStartedAt = user.tapWindowStartedAt || now;
      if (now - tapWindowStartedAt >= 60_000) {
        user.tapWindowStartedAt = now;
        user.tapWindowCount = 0;
      } else {
        user.tapWindowStartedAt = tapWindowStartedAt;
      }

      user.tapWindowCount = (user.tapWindowCount || 0) + requestedCount;
      if (user.tapWindowCount > MAX_TAPS_PER_MINUTE) {
        user.blockedUntil = now + 5 * 60_000;
        await kv.set(userKey, user);
        throw new Error("Suspicious tap frequency detected. Temporary cooldown applied.");
      }

      const tapCount = Math.min(requestedCount, user.energy);
      if (tapCount > 0) {
        const dailyTapCount = user.dailyTapCount || 0;
        const diminishingFactor = dailyTapCount > 5000 ? 0.25 : dailyTapCount > 2000 ? 0.5 : dailyTapCount > 1000 ? 0.75 : 1;
        const reward = Math.floor(tapCount * TAP_REWARD_BASE * user.multiplier * diminishingFactor);
        user.balance += reward;
        user.lifetimeEarnings = (user.lifetimeEarnings || 0) + reward;
        user.energy -= tapCount;
        user.tapCount = (user.tapCount || 0) + tapCount;
        user.dailyTapCount = dailyTapCount + tapCount;
        user.lastTapTime = now;
        updateProgression(user);
        await kv.set(userKey, user);
      }

      return user;
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, err.message === "User not found" ? 404 : 400);
  }
});

app.get("/make-server-fd08abf5/leaderboard", async (c) => {
  try {
    const users = await kv.getByPrefix("user:");
    const sorted = users
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .map((u, index) => ({
        rank: index + 1,
        id: u.id,
        name: u.username,
        score: u.balance,
        avatar: u.avatar
      }))
      .slice(0, 100); // top 100

    return c.json(sorted);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-fd08abf5/energy/regen", async (c) => {
  try {
    const id = getVerifiedUserId(c);

    const userKey = `user:${id}`;
    const user = await kv.get(userKey);

    if (!user) return c.json({ error: "User not found" }, 404);

    const now = Date.now();
    const timePassed = now - (user.lastEnergyRegen || user.lastTapTime || now);
    const energyToRecover = Math.floor(timePassed / 1000) * 3;
    
    if (energyToRecover > 0) {
      user.energy = Math.min(user.maxEnergy, user.energy + energyToRecover);
      user.lastEnergyRegen = now;
      await kv.set(userKey, user);
    }
    
    return c.json(user);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-fd08abf5/spend", async (c) => {
  try {
    const { amount } = await c.req.json();
    const id = getVerifiedUserId(c);
    const spendAmount = assertPositiveInteger(amount, "amount");

    return mutationResult(c, "spend", async () => withLocks([`user:${id}`], async () => {
      const userKey = `user:${id}`;
      const user = await kv.get(userKey);

      if (!user) throw new Error("User not found");
      if (user.balance < spendAmount) throw new Error("Insufficient balance");

      user.balance -= spendAmount;
      await kv.set(userKey, user);

      return user;
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// Update profile (username/avatar)
app.post("/make-server-fd08abf5/profile/update", async (c) => {
  try {
    const telegramUser = getVerifiedTelegramUser(c);
    const id = getVerifiedUserId(c);

    const userKey = `user:${id}`;
    const user = await kv.get(userKey);
    if (!user) return c.json({ error: "User not found" }, 404);

    syncTelegramProfile(user, telegramUser);

    await kv.set(userKey, user);
    return c.json(user);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.get("/make-server-fd08abf5/notifications", async (c) => {
  try {
    const userId = getVerifiedUserId(c);
    const notifications = (await kv.get(`notifications:${userId}`)) || [];
    const unread = notifications.filter((notification: any) => !notification.read).slice(0, 10);
    if (unread.length > 0) {
      await kv.set(`notifications:${userId}`, notifications.map((notification: any) => ({
        ...notification,
        read: true
      })));
    }
    return c.json(unread);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.get("/make-server-fd08abf5/settings", async (c) => {
  try {
    const userId = getVerifiedUserId(c);
    const settings = await kv.get(`settings:${userId}`);
    return c.json(settings || {
      sound: true,
      notifications: true,
      language: "en",
      profilePublic: true,
      leaderboardVisible: true
    });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-fd08abf5/settings", async (c) => {
  try {
    const userId = getVerifiedUserId(c);
    const body = await c.req.json();
    const current = await kv.get(`settings:${userId}`) || {};
    const settings = {
      sound: Boolean(body.sound ?? current.sound ?? true),
      notifications: Boolean(body.notifications ?? current.notifications ?? true),
      language: String(body.language || current.language || "en").slice(0, 8),
      profilePublic: Boolean(body.profilePublic ?? current.profilePublic ?? true),
      leaderboardVisible: Boolean(body.leaderboardVisible ?? current.leaderboardVisible ?? true),
      updatedAt: Date.now()
    };
    await kv.set(`settings:${userId}`, settings);
    return c.json(settings);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Auctions - List all active auctions
app.get("/make-server-fd08abf5/auctions", async (c) => {
  try {
    const auctions = await kv.getByPrefix("auction:");
    const now = Date.now();

    // Filter out expired auctions
    const activeAuctions = auctions.filter((a: any) => (a.status || "active") === "active" && a.endsAt > now);

    // Enrich with seller info
    const enriched = await Promise.all(
      activeAuctions.map(async (auction: any) => {
        const seller = await kv.get(`user:${auction.sellerId}`);
        return {
          ...auction,
          sellerName: seller?.username || "Unknown",
          sellerAvatar: seller?.avatar || null
        };
      })
    );

    return c.json(enriched.sort((a, b) => a.endsAt - b.endsAt));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Create auction
app.post("/make-server-fd08abf5/auctions/create", async (c) => {
  try {
    const { itemName, itemType, price, duration, rarity } = await c.req.json();
    const userId = getVerifiedUserId(c);
    const listingPrice = assertPositiveInteger(price, "price");
    const safeName = String(itemName || "").trim().slice(0, 60);
    if (!safeName) return c.json({ error: "Missing parameters" }, 400);

    return mutationResult(c, "auction-create", async () => {
      const auctionId = `auction_${Date.now()}_${crypto.randomUUID()}`;
      const auction = {
        id: auctionId,
        sellerId: userId,
        itemName: safeName,
        itemType: String(itemType || "Item").trim().slice(0, 40),
        rarity: String(rarity || "Common").trim().slice(0, 30),
        price: listingPrice,
        feeRate: AUCTION_FEE_RATE,
        status: "active",
        endsAt: Date.now() + Math.min(Number(duration || 3600000), 7 * 24 * 60 * 60 * 1000),
        createdAt: Date.now()
      };

      await kv.set(`auction:${auctionId}`, auction);
      return auction;
    });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// Buy from auction
app.post("/make-server-fd08abf5/auctions/buy", async (c) => {
  try {
    const { auctionId } = await c.req.json();
    const userId = getVerifiedUserId(c);
    if (!auctionId) return c.json({ error: "Missing parameters" }, 400);

    return mutationResult(c, "auction-buy", async () => {
      const auction = await kv.get(`auction:${auctionId}`);
      if (!auction) throw new Error("Auction not found");

      return withLocks([`auction:${auctionId}`, `user:${userId}`, `user:${auction.sellerId}`], async () => {
        const lockedAuction = await kv.get(`auction:${auctionId}`);
        if (!lockedAuction || lockedAuction.status !== "active") throw new Error("Auction not available");
        if (lockedAuction.endsAt < Date.now()) {
          lockedAuction.status = "expired";
          await kv.set(`auction:${auctionId}`, lockedAuction);
          throw new Error("Auction expired");
        }
        if (lockedAuction.sellerId === userId) throw new Error("Cannot buy your own auction");

        const buyer = await kv.get(`user:${userId}`);
        const seller = await kv.get(`user:${lockedAuction.sellerId}`);

        if (!buyer || !seller) throw new Error("User not found");
        if (buyer.balance < lockedAuction.price) throw new Error("Insufficient balance");

        const fee = Math.floor(lockedAuction.price * (lockedAuction.feeRate ?? AUCTION_FEE_RATE));
        buyer.balance -= lockedAuction.price;
        seller.balance += lockedAuction.price - fee;

        const item = {
          id: `item_${Date.now()}_${crypto.randomUUID()}`,
          name: lockedAuction.itemName,
          type: lockedAuction.itemType,
          rarity: lockedAuction.rarity || "Common",
          acquiredAt: Date.now()
        };
        buyer.inventory = buyer.inventory || [];
        buyer.inventory.push(item);

        lockedAuction.status = "sold";
        lockedAuction.buyerId = userId;
        lockedAuction.soldAt = Date.now();
        lockedAuction.fee = fee;

        await kv.set(`user:${userId}`, buyer);
        await kv.set(`user:${lockedAuction.sellerId}`, seller);
        await kv.set(`auction:${auctionId}`, lockedAuction);
        await addNotification(lockedAuction.sellerId, {
          type: "auction_sold",
          title: "Item sold",
          message: `${lockedAuction.itemName} sold for ${lockedAuction.price.toLocaleString()} coins.`
        });

        return { buyer, seller, item, auction: lockedAuction };
      });
    });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// Missions - Get user missions
app.get("/make-server-fd08abf5/missions/:userId", async (c) => {
  try {
    const userId = getVerifiedUserId(c);
    const missionsKey = `missions:${userId}`;
    let missions = await kv.get(missionsKey);

    const today = new Date().toISOString().slice(0, 10);

    // Initialize or reset missions if needed
    if (!missions || missions.lastReset !== today) {
      const user = await kv.get(`user:${userId}`);
      const tapCount = user?.tapCount || 0;

      missions = {
        lastReset: today,
        daily: [
          { id: "daily_login", title: "Daily Login", desc: "Log in today", progress: 1, total: 1, reward: 500, type: "coins", completed: false },
          { id: "daily_tap", title: "Tap 100 times", desc: "Tap the coin 100 times today", progress: 0, total: 100, reward: 1000, type: "coins", completed: false },
          { id: "daily_energy", title: "Full Energy", desc: "Reach max energy", progress: 0, total: 1, reward: 2, type: "diamonds", completed: false }
        ],
        weekly: [
          { id: "weekly_tap", title: "Tap Master", desc: "Tap 10,000 times this week", progress: Math.min(tapCount, 10000), total: 10000, reward: 5000, type: "coins", completed: tapCount >= 10000 },
          { id: "weekly_auction", title: "Trader", desc: "Buy 3 items from auction", progress: 0, total: 3, reward: 10, type: "tickets", completed: false }
        ]
      };
      await kv.set(missionsKey, missions);
    }

    return c.json(missions);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Claim mission reward
app.post("/make-server-fd08abf5/missions/claim", async (c) => {
  try {
    const { missionId, missionType } = await c.req.json();
    const userId = getVerifiedUserId(c);
    if (!missionId) return c.json({ error: "Missing parameters" }, 400);

    return mutationResult(c, "mission-claim", async () => withLocks([`user:${userId}`, `missions:${userId}`], async () => {
      const missionsKey = `missions:${userId}`;
      const missions = await kv.get(missionsKey);
      if (!missions) throw new Error("Missions not found");

      const missionList = missionType === "daily" ? missions.daily : missions.weekly;
      const mission = missionList.find((m: any) => m.id === missionId);

      if (!mission) throw new Error("Mission not found");
      if (mission.completed) throw new Error("Already claimed");
      if (mission.progress < mission.total) throw new Error("Mission not complete");

      const user = await kv.get(`user:${userId}`);
      if (!user) throw new Error("User not found");

      mission.completed = true;
      if (mission.type === "coins") {
        user.balance += mission.reward;
        user.lifetimeEarnings = (user.lifetimeEarnings || 0) + mission.reward;
      } else if (mission.type === "diamonds") user.diamonds += mission.reward;
      else if (mission.type === "tickets") user.tickets = (user.tickets || 0) + mission.reward;
      updateProgression(user);

      await kv.set(missionsKey, missions);
      await kv.set(`user:${userId}`, user);

      return { user, missions };
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// Update mission progress
app.post("/make-server-fd08abf5/missions/progress", async (c) => {
  try {
    const { missionId, missionType, progress } = await c.req.json();
    const userId = getVerifiedUserId(c);
    if (!missionId) return c.json({ error: "Missing parameters" }, 400);

    const missionsKey = `missions:${userId}`;
    const missions = await kv.get(missionsKey);
    if (!missions) return c.json({ error: "Missions not found" }, 404);

    const missionList = missionType === "daily" ? missions.daily : missions.weekly;
    const mission = missionList.find((m: any) => m.id === missionId);

    if (mission && !mission.completed) {
      mission.progress = Math.min(progress, mission.total);
    }

    await kv.set(missionsKey, missions);
    return c.json(missions);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Games - Spin Wheel
app.post("/make-server-fd08abf5/games/spin", async (c) => {
  try {
    const userId = getVerifiedUserId(c);

    return mutationResult(c, "game-spin", async () => withLocks([`user:${userId}`], async () => {
      const user = await kv.get(`user:${userId}`);
      if (!user) throw new Error("User not found");

      const ticketCost = 1;
      if ((user.tickets || 0) < ticketCost) throw new Error("Insufficient tickets");

      user.tickets -= ticketCost;

      const rand = Math.random();
      let reward = { type: "coins", amount: 0 };

      if (rand < 0.4) reward = { type: "coins", amount: 50 };
      else if (rand < 0.7) reward = { type: "coins", amount: 200 };
      else if (rand < 0.85) reward = { type: "coins", amount: 500 };
      else if (rand < 0.95) reward = { type: "diamonds", amount: 5 };
      else reward = { type: "diamonds", amount: 20 };

      if (reward.type === "coins") {
        user.balance += reward.amount;
        user.lifetimeEarnings = (user.lifetimeEarnings || 0) + reward.amount;
      } else if (reward.type === "diamonds") user.diamonds += reward.amount;
      updateProgression(user);

      await kv.set(`user:${userId}`, user);
      return { user, reward };
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// Games - Lottery
app.post("/make-server-fd08abf5/games/lottery", async (c) => {
  try {
    const { numbers } = await c.req.json();
    const userId = getVerifiedUserId(c);
    if (!numbers || numbers.length !== 3 || numbers.some((n: any) => !Number.isInteger(n) || n < 0 || n > 9)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    return mutationResult(c, "game-lottery", async () => withLocks([`user:${userId}`], async () => {
      const user = await kv.get(`user:${userId}`);
      if (!user) throw new Error("User not found");

      const ticketCost = 2;
      if ((user.tickets || 0) < ticketCost) throw new Error("Insufficient tickets");

      user.tickets -= ticketCost;
      const winningNumbers = [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10)
      ];

      let matches = 0;
      for (let i = 0; i < 3; i++) {
        if (numbers[i] === winningNumbers[i]) matches++;
      }

      let reward = { type: "coins", amount: 0, matches };
      if (matches === 3) reward = { type: "diamonds", amount: 100, matches };
      else if (matches === 2) reward = { type: "coins", amount: 2000, matches };
      else if (matches === 1) reward = { type: "coins", amount: 500, matches };

      if (reward.amount > 0) {
        if (reward.type === "coins") {
          user.balance += reward.amount;
          user.lifetimeEarnings = (user.lifetimeEarnings || 0) + reward.amount;
        } else if (reward.type === "diamonds") user.diamonds += reward.amount;
      }
      updateProgression(user);

      await kv.set(`user:${userId}`, user);
      return { user, reward, winningNumbers };
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// P2P Trade - Create offer
app.post("/make-server-fd08abf5/trades/create", async (c) => {
  try {
    const { offerType, offerAmount, requestType, requestAmount } = await c.req.json();
    const userId = getVerifiedUserId(c);
    const safeOfferAmount = assertPositiveInteger(offerAmount, "offer amount");
    const safeRequestAmount = assertPositiveInteger(requestAmount, "request amount");
    if (!["coins", "diamonds", "tickets"].includes(offerType) || !["coins", "diamonds", "tickets"].includes(requestType)) {
      return c.json({ error: "Invalid currency" }, 400);
    }

    return mutationResult(c, "trade-create", async () => withLocks([`user:${userId}`], async () => {
      const user = await kv.get(`user:${userId}`);
      if (!user) throw new Error("User not found");

      if (offerType === "coins" && user.balance < safeOfferAmount) throw new Error("Insufficient coins");
      if (offerType === "diamonds" && user.diamonds < safeOfferAmount) throw new Error("Insufficient diamonds");
      if (offerType === "tickets" && (user.tickets || 0) < safeOfferAmount) throw new Error("Insufficient tickets");

      const tradeId = `trade_${Date.now()}_${crypto.randomUUID()}`;
      const trade = {
        id: tradeId,
        creatorId: userId,
        offerType,
        offerAmount: safeOfferAmount,
        requestType,
        requestAmount: safeRequestAmount,
        feeRate: TRADE_FEE_RATE,
        status: "pending",
        createdAt: Date.now()
      };

      await kv.set(`trade:${tradeId}`, trade);
      return trade;
    }));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

// P2P Trade - List all open trades
app.get("/make-server-fd08abf5/trades", async (c) => {
  try {
    const trades = await kv.getByPrefix("trade:");
    const openTrades = trades.filter((t: any) => t.status === "open" || t.status === "pending");

    // Enrich with creator info
    const enriched = await Promise.all(
      openTrades.map(async (trade: any) => {
        const creator = await kv.get(`user:${trade.creatorId}`);
        return {
          ...trade,
          creatorName: creator?.username || "Unknown",
          creatorAvatar: creator?.avatar || null
        };
      })
    );

    return c.json(enriched.sort((a, b) => b.createdAt - a.createdAt));
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// P2P Trade - Accept trade
app.post("/make-server-fd08abf5/trades/accept", async (c) => {
  try {
    const { tradeId } = await c.req.json();
    const userId = getVerifiedUserId(c);
    if (!tradeId) return c.json({ error: "Missing parameters" }, 400);

    return mutationResult(c, "trade-accept", async () => {
      const trade = await kv.get(`trade:${tradeId}`);
      if (!trade) throw new Error("Trade not found");

      return withLocks([`trade:${tradeId}`, `user:${trade.creatorId}`, `user:${userId}`], async () => {
        const lockedTrade = await kv.get(`trade:${tradeId}`);
        if (!lockedTrade) throw new Error("Trade not found");
        if (!["open", "pending"].includes(lockedTrade.status)) throw new Error("Trade not available");
        if (lockedTrade.creatorId === userId) throw new Error("Cannot accept own trade");

        const creator = await kv.get(`user:${lockedTrade.creatorId}`);
        const acceptor = await kv.get(`user:${userId}`);
        if (!creator || !acceptor) throw new Error("User not found");

        if (lockedTrade.requestType === "coins" && acceptor.balance < lockedTrade.requestAmount) throw new Error("Insufficient coins");
        if (lockedTrade.requestType === "diamonds" && acceptor.diamonds < lockedTrade.requestAmount) throw new Error("Insufficient diamonds");
        if (lockedTrade.requestType === "tickets" && (acceptor.tickets || 0) < lockedTrade.requestAmount) throw new Error("Insufficient tickets");
        if (lockedTrade.offerType === "coins" && creator.balance < lockedTrade.offerAmount) throw new Error("Creator has insufficient coins");
        if (lockedTrade.offerType === "diamonds" && creator.diamonds < lockedTrade.offerAmount) throw new Error("Creator has insufficient diamonds");
        if (lockedTrade.offerType === "tickets" && (creator.tickets || 0) < lockedTrade.offerAmount) throw new Error("Creator has insufficient tickets");

        const fee = Math.floor(lockedTrade.requestType === "coins" ? lockedTrade.requestAmount * (lockedTrade.feeRate ?? TRADE_FEE_RATE) : 0);

        if (lockedTrade.offerType === "coins") creator.balance -= lockedTrade.offerAmount;
        else if (lockedTrade.offerType === "diamonds") creator.diamonds -= lockedTrade.offerAmount;
        else if (lockedTrade.offerType === "tickets") creator.tickets -= lockedTrade.offerAmount;

        if (lockedTrade.offerType === "coins") acceptor.balance += lockedTrade.offerAmount;
        else if (lockedTrade.offerType === "diamonds") acceptor.diamonds += lockedTrade.offerAmount;
        else if (lockedTrade.offerType === "tickets") acceptor.tickets = (acceptor.tickets || 0) + lockedTrade.offerAmount;

        if (lockedTrade.requestType === "coins") acceptor.balance -= lockedTrade.requestAmount;
        else if (lockedTrade.requestType === "diamonds") acceptor.diamonds -= lockedTrade.requestAmount;
        else if (lockedTrade.requestType === "tickets") acceptor.tickets -= lockedTrade.requestAmount;

        if (lockedTrade.requestType === "coins") creator.balance += lockedTrade.requestAmount - fee;
        else if (lockedTrade.requestType === "diamonds") creator.diamonds += lockedTrade.requestAmount;
        else if (lockedTrade.requestType === "tickets") creator.tickets = (creator.tickets || 0) + lockedTrade.requestAmount;

        lockedTrade.status = "accepted";
        lockedTrade.acceptedBy = userId;
        lockedTrade.completedAt = Date.now();
        lockedTrade.fee = fee;

        await kv.set(`user:${lockedTrade.creatorId}`, creator);
        await kv.set(`user:${userId}`, acceptor);
        await kv.set(`trade:${tradeId}`, lockedTrade);
        await addNotification(lockedTrade.creatorId, {
          type: "trade_accepted",
          title: "Trade accepted",
          message: "Your trade was accepted."
        });

        return { creator, acceptor, trade: lockedTrade };
      });
    });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 400);
  }
});

Deno.serve(app.fetch);
