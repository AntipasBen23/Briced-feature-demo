import type { Nudge } from "@/lib/types";

function sevClasses(sev: Nudge["severity"]) {
  if (sev === "low") return "border-white/15 bg-white/5";
  if (sev === "med") return "border-yellow-300/30 bg-yellow-300/10";
  return "border-rose-400/30 bg-rose-400/10";
}

export default function NudgeToast({
  nudge,
  onDismiss,
}: {
  nudge: Nudge | null;
  onDismiss: () => void;
}) {
  if (!nudge) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[92vw]">
      <div className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${sevClasses(nudge.severity)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">BRICED Live Nudge</div>
            <div className="mt-1 text-sm font-semibold text-white/90">{nudge.title}</div>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
        <div className="mt-2 text-sm text-white/80">{nudge.message}</div>
      </div>
    </div>
  );
}
