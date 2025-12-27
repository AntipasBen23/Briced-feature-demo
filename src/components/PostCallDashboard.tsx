import type { CallSummary, SignalColor } from "@/lib/types";

function colorDot(c: SignalColor) {
  if (c === "green") return "bg-emerald-400";
  if (c === "yellow") return "bg-yellow-300";
  return "bg-rose-400";
}

function outcomePill(outcome: CallSummary["outcome"]) {
  if (outcome === "Won") return "bg-emerald-400/15 text-emerald-200 border-emerald-400/30";
  if (outcome === "Lost") return "bg-rose-400/15 text-rose-200 border-rose-400/30";
  return "bg-yellow-300/15 text-yellow-200 border-yellow-300/30";
}

export default function PostCallDashboard({
  summary,
  onBack,
}: {
  summary: CallSummary;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-white/60">Post-call</div>
            <div className="text-lg font-semibold text-white/90">{summary.callName}</div>
            <div className="mt-1 text-xs text-white/50">
              Duration: {summary.durationSec}s • Started: {new Date(summary.startedAtISO).toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${outcomePill(summary.outcome)}`}>
              <span className="h-2 w-2 rounded-full bg-current opacity-90" />
              Outcome: {summary.outcome}
            </span>
            <button
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Back to Live
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TimelineCard summary={summary} />
        <NudgesCard summary={summary} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <KeyMomentsCard summary={summary} />
        <CoachingCard summary={summary} />
      </div>
    </div>
  );
}

function TimelineCard({ summary }: { summary: CallSummary }) {
  const max = Math.max(...summary.riskTimeline.map((p) => p.riskScore), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">Risk Timeline</div>
        <div className="text-xs text-white/55">higher = worse</div>
      </div>

      <div className="mt-4 flex h-28 items-end gap-1">
        {summary.riskTimeline.map((p, i) => (
          <div
            key={`${p.t}-${i}`}
            className="flex-1"
            title={`t=${p.t}s risk=${p.riskScore}`}
          >
            <div
              className={`w-full rounded-t-md ${colorDot(p.color)}`}
              style={{ height: `${Math.max(6, (p.riskScore / max) * 100)}%`, opacity: 0.85 }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Mini label="Final Risk" value={`${summary.final.riskScore}/100`} />
        <Mini label="Rep Talk" value={`${Math.round(summary.final.repTalkRatio * 100)}%`} />
        <Mini label="Objections" value={`${summary.final.objectionCount}`} />
      </div>
    </div>
  );
}

function NudgesCard({ summary }: { summary: CallSummary }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-sm font-semibold text-white/90">Nudges Fired</div>
      <div className="mt-3 space-y-2">
        {summary.nudges.length === 0 ? (
          <div className="text-sm text-white/60">No nudges were needed. (Nice.)</div>
        ) : (
          summary.nudges.slice(0, 6).map((n) => (
            <div key={n.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">{n.title}</div>
                <div className="text-xs text-white/50">@ {n.t}s</div>
              </div>
              <div className="mt-1 text-sm text-white/70">{n.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KeyMomentsCard({ summary }: { summary: CallSummary }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-sm font-semibold text-white/90">Key Moments</div>
      <div className="mt-3 space-y-2">
        {summary.keyMoments.map((k, idx) => (
          <div key={`${k.t}-${idx}`} className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${colorDot(k.color)}`} />
                <div className="text-sm font-semibold text-white/85">{k.title}</div>
              </div>
              <div className="text-xs text-white/50">@ {k.t}s</div>
            </div>
            <div className="mt-1 text-sm text-white/70">{k.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachingCard({ summary }: { summary: CallSummary }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-sm font-semibold text-white/90">Coaching Attribution</div>
      <div className="mt-3 space-y-2">
        {summary.coaching.map((c, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-sm font-semibold text-[#5FE6D3]">{c.skill}</div>
            <div className="mt-1 text-sm text-white/70">
              <span className="text-white/60">Observation:</span> {c.observation}
            </div>
            <div className="mt-1 text-sm text-white/70">
              <span className="text-white/60">Fix:</span> {c.fix}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="mt-1 text-base font-semibold text-white/85">{value}</div>
    </div>
  );
}
