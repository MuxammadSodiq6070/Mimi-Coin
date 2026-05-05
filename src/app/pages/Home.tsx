import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Diamond, Wallet, Zap, Ticket } from "lucide-react";
import { useGameStore } from "../store/gameStore";
import { toast } from "sonner";

export function Home() {
  const { balance, diamonds, tickets, energy, maxEnergy, tapCycleProgress, tapCycleTarget, lastTapReward, tap, isSyncing } = useGameStore();
  const [clicks, setClicks] = useState<{ id: number; x: number; y: number; amount: number }[]>([]);

  useEffect(() => {
    if (lastTapReward) {
      toast.success(`Tap cycle reward: +${lastTapReward.amount} ${lastTapReward.type}`);
    }
  }, [lastTapReward]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isSyncing) return;

    // Determine click position for floating text
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    // Try to tap via Store logic
    const { amount, success } = tap();
    
    // If anti-spam caught it or no energy, don't show visual feedback
    if (!success) return;

    const id = Date.now() + Math.random();
    setClicks((prev) => [...prev, { id, x, y, amount }]);

    // Remove the floating text after animation
    setTimeout(() => {
      setClicks((prev) => prev.filter((click) => click.id !== id));
    }, 1000);
  };

  const energyPercent = (energy / maxEnergy) * 100;
  const cyclePercent = tapCycleTarget ? (tapCycleProgress / tapCycleTarget) * 100 : 0;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-100px)] p-6 pt-12">
      {/* Stats Panel */}
      <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 mb-8 shadow-lg shadow-black/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#DFB86C] to-[#B38D45] flex items-center justify-center text-black">
            <Wallet size={20} className="fill-black" />
          </div>
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider">Balance</p>
            <p className="text-xl font-bold text-white tabular-nums tracking-tight">
              {balance.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 flex-1 justify-center">
            <Diamond size={12} className="text-[#D4AF37] fill-[#D4AF37]/20" />
            <span className="text-sm font-medium text-[#D4AF37]">{diamonds.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 flex-1 justify-center">
            <Ticket size={12} className="text-purple-400" />
            <span className="text-sm font-medium text-purple-400">{tickets.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Energy Bar */}
      <div className="mb-6 flex flex-col items-center max-w-[200px] mx-auto w-full">
        <div className="flex items-center gap-1.5 text-neutral-400 mb-2">
          <Zap size={14} className={energy < 100 ? "text-red-400" : "text-[#D4AF37]"} />
          <span className="text-xs font-medium uppercase tracking-wider tabular-nums">
            {energy} / {maxEnergy}
          </span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${energy < 100 ? 'bg-red-500' : 'bg-gradient-to-r from-[#DFB86C] to-[#D4AF37]'}`}
            style={{ width: `${energyPercent}%` }}
          />
        </div>
      </div>

      <div className="mb-2 max-w-[260px] mx-auto w-full">
        <div className="flex justify-between text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
          <span>Reward cycle</span>
          <span>{tapCycleProgress} / {tapCycleTarget}</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#8A6D3B] via-[#D4AF37] to-[#F6D37A] rounded-full transition-all duration-300"
            style={{ width: `${cyclePercent}%` }}
          />
        </div>
        <p className="text-[10px] text-neutral-500 text-center mt-2">
          Taps build progress. Rewards settle server-side every 200-300 taps.
        </p>
      </div>

      {/* Main Coin Area */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="relative">
          {/* Subtle glowing halo */}
          <div className="absolute inset-0 bg-[#D4AF37]/20 blur-[60px] rounded-full scale-150 pointer-events-none animate-pulse duration-3000" />
          
          <motion.div
            className={`w-64 h-64 md:w-72 md:h-72 rounded-full relative select-none touch-manipulation transition-all duration-300 ${
              isSyncing ? "opacity-80 scale-95 cursor-not-allowed" : "cursor-pointer"
            }`}
            whileTap={!isSyncing ? { scale: 0.95 } : undefined}
            onClick={handleTap}
            onTouchStart={handleTap}
            style={{
              background: "linear-gradient(135deg, #DFB86C 0%, #D4AF37 50%, #8A6D3B 100%)",
              boxShadow: "inset 0 4px 10px rgba(255,255,255,0.4), inset 0 -10px 20px rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.2)",
            }}
          >
            {/* Inner Ring */}
            <div className="absolute inset-2 rounded-full border border-white/20" />
            <div className="absolute inset-[15px] rounded-full bg-gradient-to-br from-[#8A6D3B] to-[#D4AF37] flex items-center justify-center shadow-inner">
               <div className="absolute inset-1 rounded-full border-2 border-[#D4AF37]/50" />
               <span className="text-6xl font-black text-black/80 tracking-tighter" style={{ textShadow: "0 2px 10px rgba(255,255,255,0.3)" }}>
                 G
               </span>
            </div>
            
            {/* Glare effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-white/40 pointer-events-none" style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }} />
          </motion.div>
        </div>
      </div>

      {/* Floating Clicks */}
      <AnimatePresence>
        {clicks.map((click) => (
          <motion.div
            key={click.id}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed text-3xl font-bold text-[#D4AF37] pointer-events-none z-50 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]"
            style={{ left: click.x - 20, top: click.y - 20 }}
          >
            +{click.amount} tap
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
