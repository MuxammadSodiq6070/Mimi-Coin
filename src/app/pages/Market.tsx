import { Diamond, Ticket, Loader2, Plus, Clock, RefreshCw, ArrowLeftRight, Wallet } from "lucide-react";
import { useGameStore } from "../store/gameStore";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";

type Tab = "auctions" | "trades";

export function Market() {
  const { balance, diamonds, tickets, id, refreshUserData } = useGameStore();
  const [tab, setTab] = useState<Tab>("auctions");

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Marketplace</h1>
          <p className="text-sm text-neutral-400">Trade and earn.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Balance</div>
          <div className="flex items-center gap-1.5 justify-end">
            <Wallet size={14} className="text-[#D4AF37]" />
            <span className="text-lg font-bold text-white tabular-nums">{balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setTab("auctions")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            tab === "auctions"
              ? "bg-[#D4AF37] text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Auctions
        </button>
        <button
          onClick={() => setTab("trades")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            tab === "trades"
              ? "bg-[#D4AF37] text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <ArrowLeftRight size={14} />
            P2P Trading
          </div>
        </button>
      </div>

      {tab === "auctions" && <AuctionsTab userId={id} balance={balance} refreshUserData={refreshUserData} />}
      {tab === "trades" && <TradesTab userId={id} balance={balance} diamonds={diamonds} tickets={tickets} refreshUserData={refreshUserData} />}
    </div>
  );
}

function AuctionsTab({ userId, balance, refreshUserData }: { userId: string; balance: number; refreshUserData: () => Promise<void> }) {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadAuctions = async () => {
    setLoading(true);
    try {
      const data = await api.getAuctions();
      setAuctions(data);
    } catch (error) {
      toast.error("Failed to load auctions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctions();
    const interval = setInterval(loadAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = async (auctionId: string) => {
    if (!userId) return;
    setBuying(auctionId);
    try {
      await api.buyAuction(userId, auctionId);
      await refreshUserData();
      await loadAuctions();
      toast.success("Item purchased!");
    } catch (error: any) {
      toast.error(error.message || "Failed to purchase");
    } finally {
      setBuying(null);
    }
  };

  const getTimeRemaining = (endsAt: number) => {
    const remaining = endsAt - Date.now();
    if (remaining < 0) return "Expired";
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={loadAuctions}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#DFB86C] text-black text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Create Auction
        </button>
      </div>

      {showCreate && <CreateAuctionForm userId={userId} onClose={() => setShowCreate(false)} onCreated={loadAuctions} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">No active auctions</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {auctions.map((auction) => {
            const isBuying = buying === auction.id;
            const canAfford = balance >= auction.price;

            return (
              <div
                key={auction.id}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:border-[#D4AF37]/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center text-xs">
                    {auction.sellerAvatar ? (
                      <img src={auction.sellerAvatar} alt={auction.sellerName} className="w-full h-full object-cover" />
                    ) : (
                      auction.sellerName.charAt(0)
                    )}
                  </div>
                  <span className="text-xs text-neutral-400 truncate">{auction.sellerName}</span>
                </div>

                <h3 className="text-sm font-medium text-white mb-1">{auction.itemName}</h3>
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-3">{auction.itemType}</div>

                <div className="flex items-center gap-1 mb-2">
                  <Clock size={12} className="text-neutral-500" />
                  <span className="text-xs text-neutral-400">{getTimeRemaining(auction.endsAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wallet size={12} className={canAfford ? "text-[#D4AF37]" : "text-red-500"} />
                    <span className={`text-sm font-semibold ${canAfford ? "text-[#D4AF37]" : "text-red-500"}`}>
                      {auction.price.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleBuy(auction.id)}
                    disabled={isBuying || !canAfford || auction.sellerId === userId}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      auction.sellerId === userId
                        ? "bg-white/5 text-neutral-500 cursor-not-allowed"
                        : !canAfford
                        ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                        : "bg-white/5 hover:bg-[#D4AF37] text-white hover:text-black"
                    }`}
                  >
                    {isBuying ? <Loader2 size={12} className="animate-spin" /> : auction.sellerId === userId ? "Yours" : "Buy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateAuctionForm({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!itemName || !price) {
      toast.error("Fill in all fields");
      return;
    }

    setCreating(true);
    try {
      await api.createAuction(userId, itemName, itemType || "Item", parseInt(price), 3600000);
      toast.success("Auction created!");
      onCreated();
      onClose();
    } catch (error) {
      toast.error("Failed to create auction");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white/10 border border-white/10 rounded-xl p-4 mb-4 backdrop-blur-md">
      <h3 className="text-sm font-semibold text-white mb-3">Create Auction</h3>
      <input
        type="text"
        placeholder="Item name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-2 outline-none focus:border-[#D4AF37]/50"
      />
      <input
        type="text"
        placeholder="Type (optional)"
        value={itemType}
        onChange={(e) => setItemType(e.target.value)}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-2 outline-none focus:border-[#D4AF37]/50"
      />
      <input
        type="number"
        placeholder="Price (coins)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-3 outline-none focus:border-[#D4AF37]/50"
      />
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex-1 bg-[#D4AF37] hover:bg-[#DFB86C] text-black text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create"}
        </button>
        <button
          onClick={onClose}
          className="px-4 bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TradesTab({ userId, balance, diamonds, tickets, refreshUserData }: any) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const data = await api.getTrades();
      setTrades(data);
    } catch (error) {
      toast.error("Failed to load trades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const handleAccept = async (tradeId: string) => {
    if (!userId) return;
    setAccepting(tradeId);
    try {
      await api.acceptTrade(userId, tradeId);
      await refreshUserData();
      await loadTrades();
      toast.success("Trade completed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete trade");
    } finally {
      setAccepting(null);
    }
  };

  const getCurrencyIcon = (type: string) => {
    if (type === "diamonds") return <Diamond size={12} className="text-[#D4AF37]" />;
    if (type === "tickets") return <Ticket size={12} className="text-purple-400" />;
    return <Wallet size={12} className="text-white" />;
  };

  const canAfford = (trade: any) => {
    if (trade.requestType === "coins") return balance >= trade.requestAmount;
    if (trade.requestType === "diamonds") return diamonds >= trade.requestAmount;
    if (trade.requestType === "tickets") return tickets >= trade.requestAmount;
    return false;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={loadTrades}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#DFB86C] text-black text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Create Trade
        </button>
      </div>

      {showCreate && <CreateTradeForm userId={userId} balance={balance} diamonds={diamonds} tickets={tickets} onClose={() => setShowCreate(false)} onCreated={loadTrades} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">No active trades</div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => {
            const isAccepting = accepting === trade.id;
            const affordable = canAfford(trade);

            return (
              <div
                key={trade.id}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-[#D4AF37]/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center text-xs">
                    {trade.creatorAvatar ? (
                      <img src={trade.creatorAvatar} alt={trade.creatorName} className="w-full h-full object-cover" />
                    ) : (
                      trade.creatorName.charAt(0)
                    )}
                  </div>
                  <span className="text-xs text-neutral-400">{trade.creatorName}</span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-neutral-400">Offering</span>
                    <div className="flex items-center gap-1">
                      {getCurrencyIcon(trade.offerType)}
                      <span className="text-sm font-semibold text-white">{trade.offerAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <ArrowLeftRight size={16} className="text-neutral-600" />

                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-neutral-400">Wants</span>
                    <div className="flex items-center gap-1">
                      {getCurrencyIcon(trade.requestType)}
                      <span className="text-sm font-semibold text-white">{trade.requestAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleAccept(trade.id)}
                  disabled={isAccepting || !affordable || trade.creatorId === userId}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    trade.creatorId === userId
                      ? "bg-white/5 text-neutral-500 cursor-not-allowed"
                      : !affordable
                      ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                      : "bg-white/5 hover:bg-[#D4AF37] text-white hover:text-black"
                  }`}
                >
                  {isAccepting ? (
                    <Loader2 size={14} className="animate-spin mx-auto" />
                  ) : trade.creatorId === userId ? (
                    "Your Trade"
                  ) : !affordable ? (
                    "Insufficient Funds"
                  ) : (
                    "Accept Trade"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTradeForm({ userId, balance, diamonds, tickets, onClose, onCreated }: any) {
  const [offerType, setOfferType] = useState<"coins" | "diamonds" | "tickets">("coins");
  const [offerAmount, setOfferAmount] = useState("");
  const [requestType, setRequestType] = useState<"coins" | "diamonds" | "tickets">("diamonds");
  const [requestAmount, setRequestAmount] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!offerAmount || !requestAmount) {
      toast.error("Fill in all fields");
      return;
    }

    const offerNum = parseInt(offerAmount);
    if (offerType === "coins" && balance < offerNum) {
      toast.error("Insufficient coins");
      return;
    } else if (offerType === "diamonds" && diamonds < offerNum) {
      toast.error("Insufficient diamonds");
      return;
    } else if (offerType === "tickets" && tickets < offerNum) {
      toast.error("Insufficient tickets");
      return;
    }

    setCreating(true);
    try {
      await api.createTrade(userId, offerType, offerNum, requestType, parseInt(requestAmount));
      toast.success("Trade created!");
      onCreated();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create trade");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white/10 border border-white/10 rounded-xl p-4 mb-4 backdrop-blur-md">
      <h3 className="text-sm font-semibold text-white mb-3">Create Trade</h3>

      <div className="mb-3">
        <label className="text-xs text-neutral-400 mb-1 block">You offer</label>
        <div className="flex gap-2">
          <select
            value={offerType}
            onChange={(e) => setOfferType(e.target.value as any)}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
          >
            <option value="coins">Coins</option>
            <option value="diamonds">Diamonds</option>
            <option value="tickets">Tickets</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/50"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-neutral-400 mb-1 block">You want</label>
        <div className="flex gap-2">
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as any)}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
          >
            <option value="coins">Coins</option>
            <option value="diamonds">Diamonds</option>
            <option value="tickets">Tickets</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={requestAmount}
            onChange={(e) => setRequestAmount(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/50"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex-1 bg-[#D4AF37] hover:bg-[#DFB86C] text-black text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create"}
        </button>
        <button
          onClick={onClose}
          className="px-4 bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
