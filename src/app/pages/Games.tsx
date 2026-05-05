import { Dices, Loader2, Ticket, Diamond, Wallet, Sparkles } from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { api } from "../lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

type GameType = "spin" | "lottery";

export function Games() {
  const { id, tickets, balance, diamonds, refreshUserData } = useGameStore();
  const [activeGame, setActiveGame] = useState<GameType | null>(null);

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Games</h1>
          <p className="text-sm text-neutral-400">Try your luck!</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-end gap-1">
            <Ticket size={10} className="text-purple-400" />
            Tickets
          </div>
          <div className="text-lg font-bold text-purple-400 tabular-nums">{tickets}</div>
        </div>
      </div>

      {!activeGame ? (
        <div className="grid grid-cols-1 gap-4">
          <GameCard
            icon={<Sparkles size={24} className="text-[#D4AF37]" />}
            title="Spin Wheel"
            desc="Spin the wheel to win coins or diamonds"
            cost={1}
            onClick={() => setActiveGame("spin")}
            tickets={tickets}
          />
          <GameCard
            icon={<Dices size={24} className="text-purple-400" />}
            title="Lottery"
            desc="Pick 3 numbers and win big prizes"
            cost={2}
            onClick={() => setActiveGame("lottery")}
            tickets={tickets}
          />
        </div>
      ) : (
        <div>
          <button
            onClick={() => setActiveGame(null)}
            className="mb-4 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            ← Back to Games
          </button>
          {activeGame === "spin" && <SpinGame userId={id} refreshUserData={refreshUserData} />}
          {activeGame === "lottery" && <LotteryGame userId={id} refreshUserData={refreshUserData} />}
        </div>
      )}
    </div>
  );
}

function GameCard({ icon, title, desc, cost, onClick, tickets }: any) {
  const canPlay = tickets >= cost;

  return (
    <div
      onClick={canPlay ? onClick : undefined}
      className={`bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden ${
        canPlay ? "cursor-pointer hover:border-[#D4AF37]/40" : "opacity-50 cursor-not-allowed"
      } transition-all group`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-[#D4AF37]/10 transition-all" />

      <div className="flex items-start gap-4 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          <p className="text-xs text-neutral-400 mb-3">{desc}</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-full">
              <Ticket size={12} className="text-purple-400" />
              <span className="text-sm font-semibold text-purple-400">{cost}</span>
            </div>
            {!canPlay && <span className="text-xs text-red-400">Not enough tickets</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpinGame({ userId, refreshUserData }: any) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rotation, setRotation] = useState(0);

  const handleSpin = async () => {
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    try {
      const data = await api.playSpin(userId);

      // Animate spin
      const spins = 3 + Math.random() * 2;
      const finalRotation = rotation + (360 * spins);
      setRotation(finalRotation);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setResult(data.reward);
      await refreshUserData();

      if (data.reward.amount > 0) {
        toast.success(`You won ${data.reward.amount} ${data.reward.type}!`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to spin");
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-8">
        <motion.div
          className="w-64 h-64 rounded-full bg-gradient-to-br from-[#DFB86C] to-[#8A6D3B] flex items-center justify-center relative"
          style={{
            rotate: rotation,
            boxShadow: "inset 0 4px 20px rgba(0,0,0,0.6), 0 10px 40px rgba(0,0,0,0.5)"
          }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          {/* Wheel segments */}
          {[50, 200, 500, 5, 20].map((value, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-start justify-center pt-8"
              style={{ transform: `rotate(${i * 72}deg)` }}
            >
              <div className="text-xs font-bold text-black">{value}</div>
            </div>
          ))}

          <div className="absolute inset-8 rounded-full bg-black/60 flex items-center justify-center">
            <Sparkles size={32} className="text-[#D4AF37]" />
          </div>
        </motion.div>

        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-transparent border-t-red-500 z-10" />
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className="px-8 py-3 bg-gradient-to-r from-[#DFB86C] to-[#B38D45] text-black font-bold rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
      >
        {spinning ? (
          <div className="flex items-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Spinning...
          </div>
        ) : (
          "Spin Now (1 Ticket)"
        )}
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {result.type === "diamonds" ? (
                <Diamond size={20} className="text-[#D4AF37]" />
              ) : (
                <Wallet size={20} className="text-white" />
              )}
              <span className="text-2xl font-bold text-white">+{result.amount}</span>
            </div>
            <p className="text-xs text-neutral-400 capitalize">{result.type}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LotteryGame({ userId, refreshUserData }: any) {
  const [numbers, setNumbers] = useState<number[]>([5, 5, 5]);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleNumberChange = (index: number, delta: number) => {
    const newNumbers = [...numbers];
    newNumbers[index] = (newNumbers[index] + delta + 10) % 10;
    setNumbers(newNumbers);
  };

  const handlePlay = async () => {
    if (playing) return;

    setPlaying(true);
    setResult(null);

    try {
      const data = await api.playLottery(userId, numbers);
      setResult(data);
      await refreshUserData();

      if (data.reward.matches === 3) {
        toast.success("🎉 JACKPOT! All 3 numbers match!");
      } else if (data.reward.matches === 2) {
        toast.success("Great! 2 numbers match!");
      } else if (data.reward.matches === 1) {
        toast.success("Nice! 1 number matches!");
      } else {
        toast.error("No matches this time");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to play");
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8">
        <h3 className="text-sm text-neutral-400 mb-4 text-center">Pick your numbers (0-9)</h3>
        <div className="flex gap-4">
          {numbers.map((num, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleNumberChange(i, 1)}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                ▲
              </button>
              <div className="w-16 h-20 rounded-xl bg-gradient-to-br from-[#DFB86C] to-[#8A6D3B] flex items-center justify-center text-3xl font-bold text-black shadow-lg">
                {num}
              </div>
              <button
                onClick={() => handleNumberChange(i, -1)}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                ▼
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handlePlay}
        disabled={playing}
        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
      >
        {playing ? (
          <div className="flex items-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Playing...
          </div>
        ) : (
          "Play Now (2 Tickets)"
        )}
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 w-full max-w-sm"
          >
            <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-3">
              <p className="text-xs text-neutral-400 mb-2 text-center">Winning Numbers</p>
              <div className="flex gap-2 justify-center">
                {result.winningNumbers.map((num: number, i: number) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-lg flex items-center justify-center text-2xl font-bold ${
                      num === numbers[i]
                        ? "bg-green-500 text-black"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {result.reward.amount > 0 && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {result.reward.type === "diamonds" ? (
                    <Diamond size={20} className="text-[#D4AF37]" />
                  ) : (
                    <Wallet size={20} className="text-white" />
                  )}
                  <span className="text-2xl font-bold text-white">+{result.reward.amount}</span>
                </div>
                <p className="text-xs text-neutral-400 capitalize">
                  {result.reward.matches} match{result.reward.matches !== 1 && "es"} - {result.reward.type}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
