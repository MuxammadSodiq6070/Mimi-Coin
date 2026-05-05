import { BookOpen, CheckCircle2, CircleDashed, Diamond, Ticket, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api, LearningModule } from "../lib/api";
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

export function LearnAndEarn() {
  const { refreshUserData } = useGameStore();
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<LearningModule | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    try {
      const data = await api.getLearningModules();
      setModules(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load learning modules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  const completeModule = async () => {
    if (!activeModule || !response.trim()) return;
    setSubmitting(true);
    try {
      const result = await api.completeLearningModule(activeModule.id, response);
      toast.success(`Learning reward claimed: +${result.reward.coins} coins`);
      setResponse("");
      setActiveModule(null);
      await refreshUserData();
      await loadModules();
    } catch (error: any) {
      toast.error(error.message || "Could not complete module");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = {
    beginner: modules.filter((module) => module.difficulty === "beginner"),
    medium: modules.filter((module) => module.difficulty === "medium"),
    advanced: modules.filter((module) => module.difficulty === "advanced"),
  };

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Learn & Earn</h1>
          <p className="text-sm text-neutral-400 mt-1">Complete real learning quests for premium rewards.</p>
        </div>
        <button
          onClick={loadModules}
          disabled={loading}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
        </div>
      ) : modules.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-white mb-2">No learning modules yet</h2>
          <p className="text-sm text-neutral-400">
            Admin-created modules will appear here when published.
          </p>
        </div>
      ) : (
        <div className="space-y-7 mt-8">
          {(["beginner", "medium", "advanced"] as const).map((difficulty) => (
            grouped[difficulty].length > 0 && (
              <section key={difficulty}>
                <h2 className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] mb-3">{difficulty}</h2>
                <div className="space-y-4">
                  {grouped[difficulty].map((module) => (
                    <button
                      key={module.id}
                      onClick={() => !module.completed && setActiveModule(module)}
                      disabled={module.completed}
                      className="w-full text-left rounded-3xl border border-white/10 bg-white/[0.035] overflow-hidden active:scale-[0.99] transition disabled:opacity-70"
                    >
                      <div className="aspect-[16/10] bg-black/40 overflow-hidden">
                        <img src={module.imageUrl} alt={module.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-base font-bold text-white">{module.title}</h3>
                          {module.completed ? (
                            <span className="text-[10px] uppercase tracking-wider text-green-300 border border-green-400/20 bg-green-500/10 px-2 py-1 rounded-full">Done</span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 rounded-full">Quest</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 leading-5 mb-3">{module.instruction}</p>
                        <div className="flex gap-2">
                          <RewardPill icon={<Wallet size={12} />} value={module.reward.coins} />
                          {module.reward.diamonds > 0 && <RewardPill icon={<Diamond size={12} />} value={module.reward.diamonds} />}
                          {module.reward.tickets > 0 && <RewardPill icon={<Ticket size={12} />} value={module.reward.tickets} />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}

      {activeModule && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex items-end justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/20 bg-[#070707] p-4 shadow-2xl">
            <img src={activeModule.imageUrl} alt={activeModule.title} className="w-full aspect-video object-cover rounded-2xl mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">{activeModule.title}</h2>
            <p className="text-sm text-neutral-400 leading-6 mb-4">{activeModule.instruction}</p>
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Write your answer based on the instruction..."
              className="w-full min-h-28 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#D4AF37]/50"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={completeModule}
                disabled={submitting || !response.trim()}
                className="flex-1 rounded-xl bg-[#D4AF37] py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Complete Task"}
              </button>
              <button
                onClick={() => setActiveModule(null)}
                className="px-4 rounded-xl bg-white/5 text-sm font-medium text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-full px-3 py-1 text-[#D4AF37] text-xs font-semibold">
      {icon}
      +{value.toLocaleString()}
    </div>
  );
}
