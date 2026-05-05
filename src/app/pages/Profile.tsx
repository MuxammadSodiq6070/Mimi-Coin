import { Settings, Copy, Wallet, History, ChevronRight, Diamond, Ticket, Package, Send } from "lucide-react";
import { useGameStore } from "../store/gameStore";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { api, UserSettings } from "../lib/api";

export function Profile() {
  const { username, avatar, balance, diamonds, tickets, level, inventory, id } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => undefined);
  }, []);

  const updateSettings = async (next: Partial<UserSettings>) => {
    setSettingsSaving(true);
    try {
      const updated = await api.updateSettings({ ...settings, ...next });
      setSettings(updated);
      toast.success("Settings saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success("ID copied!");
  };

  return (
    <div className="p-6 pt-12 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profile</h1>
        <button
          onClick={() => setShowSettings((value) => !value)}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>

      {showSettings && settings && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Settings</h2>
          <SettingToggle label="Sound" checked={settings.sound} disabled={settingsSaving} onChange={(sound) => updateSettings({ sound })} />
          <SettingToggle label="Notifications" checked={settings.notifications} disabled={settingsSaving} onChange={(notifications) => updateSettings({ notifications })} />
          <SettingToggle label="Public profile" checked={settings.profilePublic} disabled={settingsSaving} onChange={(profilePublic) => updateSettings({ profilePublic })} />
          <SettingToggle label="Leaderboard visible" checked={settings.leaderboardVisible} disabled={settingsSaving} onChange={(leaderboardVisible) => updateSettings({ leaderboardVisible })} />
          <label className="block mt-3 text-xs text-neutral-400">
            Language
            <select
              value={settings.language}
              disabled={settingsSaving}
              onChange={(event) => updateSettings({ language: event.target.value })}
              className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="en">English</option>
              <option value="ru">Russian</option>
              <option value="uz">Uzbek</option>
            </select>
          </label>
        </div>
      )}

      {/* Avatar and Info */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-[#D4AF37] blur-md rounded-full opacity-30" />
          <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-b from-[#DFB86C] via-[#D4AF37] to-transparent relative z-10">
            <div className="w-full h-full rounded-full border-4 border-black overflow-hidden bg-neutral-900 flex items-center justify-center text-3xl font-bold text-neutral-600">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                (username || "P").charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#D4AF37] border-2 border-black flex items-center justify-center z-20">
            <Send size={13} className="text-black" />
          </div>
          {/* Rank Badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-black to-neutral-900 border border-[#D4AF37]/50 px-3 py-1 rounded-full z-20 flex items-center gap-1 shadow-lg shadow-black">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">Level {level}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 group">
          <h2 className="text-xl font-bold text-white">{username}</h2>
          <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider border border-[#D4AF37]/30 rounded-full px-2 py-0.5">
            Telegram
          </span>
        </div>

        <div className="flex items-center gap-2 text-neutral-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
          <span className="text-xs font-mono">{id.slice(0, 12)}...</span>
          <button onClick={handleCopyId} className="hover:text-white transition-colors">
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="bg-gradient-to-br from-[#111] to-black border border-white/10 rounded-2xl p-5 mb-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex items-center gap-2 text-neutral-400 mb-3">
          <Wallet size={16} />
          <span className="text-sm font-medium">Total Assets</span>
        </div>

        {/* Currency breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Coins</div>
            <div className="text-lg font-bold text-white tabular-nums">{balance.toLocaleString()}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Diamond size={10} className="text-[#D4AF37]" />
              Gems
            </div>
            <div className="text-lg font-bold text-[#D4AF37] tabular-nums">{diamonds}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Ticket size={10} className="text-purple-400" />
              Tickets
            </div>
            <div className="text-lg font-bold text-purple-400 tabular-nums">{tickets}</div>
          </div>
        </div>
      </div>

      {/* Inventory */}
      {inventory && inventory.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-neutral-400 mb-3">
            <Package size={16} />
            <span className="text-sm font-medium">Inventory ({inventory.length})</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {inventory.slice(0, 6).map((item: any) => (
              <div
                key={item.id}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-2 text-center"
              >
                <div className="text-xs font-medium text-white mb-1">{item.name}</div>
                <div className="text-[10px] text-neutral-500">{item.type}</div>
              </div>
            ))}
          </div>
          {inventory.length > 6 && (
            <button className="w-full mt-2 text-xs text-neutral-400 hover:text-white transition-colors">
              View all ({inventory.length})
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 group-hover:text-[#D4AF37] transition-colors">
              <History size={16} />
            </div>
            <span className="text-sm font-medium text-neutral-200">Transaction History</span>
          </div>
          <ChevronRight size={18} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
        </button>
      </div>
    </div>
  );
}

function SettingToggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
      <span className="text-sm text-neutral-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[#D4AF37]"
      />
    </label>
  );
}
