import { Trophy, Medal, Crown, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, LeaderboardUser } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export function Ratings() {
  const { id: myUserId } = useGameStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data);
    } catch (err: any) {
      console.error("Failed to load leaderboard", err);
      setError("Could not load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30">
          <Trophy size={20} className="text-[#D4AF37]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Ratings</h1>
          <p className="text-xs text-neutral-400">Global Leaderboard</p>
        </div>
        <button 
          onClick={loadLeaderboard}
          disabled={loading}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-3">
        {loading && leaderboard.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button 
              onClick={loadLeaderboard}
              className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          leaderboard.map((user) => {
            const isTop3 = user.rank <= 3;
            const isMe = user.id === myUserId;
            
            return (
              <div
                key={user.id}
              className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md transition-all ${
                isMe
                  ? "bg-[#D4AF37]/10 border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                  : isTop3
                  ? "bg-white/[0.04] border-white/10"
                  : "bg-white/[0.02] border-transparent"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 text-center font-bold ${
                  user.rank === 1 ? "text-[#FFD700]" : 
                  user.rank === 2 ? "text-[#C0C0C0]" : 
                  user.rank === 3 ? "text-[#CD7F32]" : "text-neutral-500"
                }`}>
                  {user.rank === 1 ? <Crown size={20} className="mx-auto" /> : 
                   user.rank === 2 || user.rank === 3 ? <Medal size={20} className="mx-auto" /> : 
                   `#${user.rank}`}
                </div>
                
                <div className="relative">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-xs font-bold text-neutral-400">
                      {(user.name || "P").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isTop3 && (
                     <div className={`absolute -inset-1 rounded-full border border-dashed animate-[spin_10s_linear_infinite] ${
                       user.rank === 1 ? "border-[#FFD700]" : user.rank === 2 ? "border-[#C0C0C0]" : "border-[#CD7F32]"
                     }`} />
                  )}
                </div>

                <div>
                  <h3 className={`text-sm font-semibold ${isMe ? "text-[#D4AF37]" : "text-white"}`}>
                    {user.name} {isMe && "(You)"}
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-sm font-bold tabular-nums tracking-tight ${isTop3 ? "text-white" : "text-neutral-300"}`}>
                  {user.score.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
