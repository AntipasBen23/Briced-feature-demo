import type { TranscriptChunk } from "@/lib/types";

function speakerPill(s: "REP" | "BUYER") {
  return s === "REP"
    ? "bg-[#5FE6D3]/15 text-[#5FE6D3] border-[#5FE6D3]/30"
    : "bg-white/10 text-white/80 border-white/20";
}

export default function TranscriptFeed({
  visible,
  activeIndex,
}: {
  visible: TranscriptChunk[];
  activeIndex: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">Live Transcript</div>
        <div className="text-xs text-white/55">Simulated stream</div>
      </div>

      <div className="mt-3 max-h-[340px] space-y-3 overflow-auto pr-2">
        {visible.map((c, i) => (
          <div
            key={`${c.t}-${i}`}
            className={`rounded-xl border border-white/10 bg-black/10 p-3 transition ${
              i === activeIndex ? "ring-2 ring-[#5FE6D3]/40" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${speakerPill(c.speaker)}`}>
                {c.speaker}
              </span>
              <span className="text-[11px] text-white/50">{c.t}s</span>
            </div>
            <div className="mt-2 text-sm text-white/85">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
