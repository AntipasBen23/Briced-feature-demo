import type { LiveMetrics, LiveSignal } from "@/lib/types";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function colorClasses(color: LiveSignal["color"]) {
  if (color === "green") return "bg-emerald-400/15 text-emerald-200 border-emerald-400/30";
  if (color === "yellow") return "bg-yellow-300/15 text-yellow-200 border-yellow-300/30";
  return "bg-rose-400/15 text-rose-200 border-rose-400/30";
}

export default function SignalStrip({
  metrics,
  signal,
}: {
  metrics: LiveMetrics;
  signal: LiveSignal;
}) {
  const repRatio = metrics.repTalkRatio;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${colorClasses(signal.color)}`}>
          <span className="h-2 w-2 rounded-full bg-current opacity-90" />
          <span className="font-semibold">{signal.label}</span>
          <span className="opacity-80">• {metrics.stage}</span>
        </div>

        <div className="text-xs text-white/70">
          Elapsed: <span className="text-white/90">{metrics.elapsedSec}s</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rep talk-time" value={pct(repRatio)} sub="(aim ~45–55%)" />
        <Stat label="Objections" value={`${metrics.objectionCount}`} sub="density matters" />
        <Stat
          label="Pricing"
          value={metrics.pricingMentioned ? "Mentioned" : "Not yet"}
          sub={metrics.pricingFirstMentionSec ? `@ ${metrics.pricingFirstMentionSec}s` : "value first"}
        />
        <Stat label="Intent" value={`${metrics.intentScore}/100`} sub="next-step cues" />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/85">
        <span className="font-semibold text-[#5FE6D3]">Live Hint:</span>{" "}
        <span className="text-white/80">{signal.hint}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white/90">{value}</div>
      <div className="text-[11px] text-white/45">{sub}</div>
    </div>
  );
}
