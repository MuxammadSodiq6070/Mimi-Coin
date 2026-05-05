import { CheckCircle2, CircleDashed, Diamond, Ticket, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { toast } from "sonner";

export function Missions() {
  const { id, refreshUserData } = useGameStore();
  const [missions, setMissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const loadMissions = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getMissions(id);
      setMissions(data);
    } catch (error) {
      console.error("Failed to load missions:", error);
      toast.error("Failed to load missions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, [id]);

  const handleClaim = async (missionId: string, missionType: "daily" | "weekly") => {
    if (!id) return;
    setClaiming(missionId);
    try {
      const result = await api.claimMission(id, missionId, missionType);
      setMissions(result.missions);
      await refreshUserData();
      toast.success("Reward claimed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to claim reward");
    } finally {
      setClaiming(null);
    }
  };

  const getCurrencyIcon = (type: string) => {
    if (type === "diamonds") return <Diamond size={12} className="text-[#D4AF37]" />;
    if (type === "tickets") return <Ticket size={12} className="text-purple-400" />;
    return null;
  };

  const allMissions = missions
    ? [...missions.daily.map((m: any) => ({ ...m, missionType: "daily" })), ...missions.weekly.map((m: any) => ({ ...m, missionType: "weekly" }))]
    : [];

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">Missions</h1>
        <button
          onClick={loadMissions}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-sm text-neutral-400 mb-8">Complete tasks to earn rewards.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {allMissions.map((mission: any) => {
            const progressPercent = (mission.progress / mission.total) * 100;
            const isComplete = mission.progress >= mission.total && !mission.completed;
            const isClaiming = claiming === mission.id;

            return (
              <div
                key={mission.id}
                className={`bg-white/[0.03] border backdrop-blur-md rounded-2xl p-4 transition-all duration-300 ${
                  mission.completed ? "border-[#D4AF37]/30" : "border-white/5"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-start flex-1">
                    {mission.completed ? (
                      <CheckCircle2 size={20} className="text-[#D4AF37] mt-0.5 shrink-0" />
                    ) : (
                      <CircleDashed size={20} className="text-neutral-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-medium ${mission.completed ? "text-white" : "text-neutral-200"}`}>
                          {mission.title}
                        </h3>
                        <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          mission.missionType === "daily" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {mission.missionType}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">{mission.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {getCurrencyIcon(mission.type)}
                      <span className="text-xs font-semibold text-[#D4AF37]">+{mission.reward.toLocaleString()}</span>
                    </div>
                    {isComplete && (
                      <button
                        onClick={() => handleClaim(mission.id, mission.missionType)}
                        disabled={isClaiming}
                        className="px-3 py-1 bg-[#D4AF37] hover:bg-[#DFB86C] text-black text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isClaiming ? <Loader2 size={12} className="animate-spin" /> : "Claim"}
                      </button>
                    )}
                  </div>
                </div>

                {!mission.completed && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-neutral-400 mb-1.5 font-medium">
                      <span>Progress</span>
                      <span>{mission.progress.toLocaleString()} / {mission.total.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-[#DFB86C] to-[#D4AF37] rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
