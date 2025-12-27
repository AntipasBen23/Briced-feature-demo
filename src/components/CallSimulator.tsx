"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CallSummary, DemoCall, LiveMetrics, LiveSignal, Nudge, TranscriptChunk } from "@/lib/types";
import { computeLiveMetrics, computeLiveSignal, maybeCreateNudge, riskPointFromMetrics } from "@/lib/signalEngine";
import TranscriptFeed from "./TranscriptFeed";
import SignalStrip from "./SignalStrip";
import NudgeToast from "./NudgeToast";
import PostCallDashboard from "./PostCallDashboard";

const STORAGE_KEY = "briced_demo_call_history_v1";

type Mode = "live" | "post";

function pickOutcome(call: DemoCall): CallSummary["outcome"] {
  // If call already has an outcome, use it; otherwise infer from name
  if (call.outcome) return call.outcome;
  const n = call.name.toLowerCase();
  if (n.includes("win")) return "Won";
  if (n.includes("lost")) return "Lost";
  return "Pipeline";
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallSimulator({ calls }: { calls: DemoCall[] }) {
  const [selectedId, setSelectedId] = useState(calls[0]?.id ?? "");
  const selectedCall = useMemo(() => calls.find((c) => c.id === selectedId) ?? calls[0], [calls, selectedId]);

  const [mode, setMode] = useState<Mode>("live");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [elapsedSec, setElapsedSec] = useState(0);

  const [visible, setVisible] = useState<TranscriptChunk[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [metrics, setMetrics] = useState<LiveMetrics>(() => computeLiveMetrics(0, []));
  const [signal, setSignal] = useState<LiveSignal>(() => computeLiveSignal(metrics));

  const [nudge, setNudge] = useState<Nudge | null>(null);
  const lastNudgeAtRef = useRef<number | null>(null);

  const riskTimelineRef = useRef<ReturnType<typeof riskPointFromMetrics>[]>([]);
  const nudgesRef = useRef<Nudge[]>([]);

  // reset when call changes
  useEffect(() => {
    stopAndReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // playback ticker
  useEffect(() => {
    if (!playing) return;

    const tickMs = 500; // smooth UI
    const id = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + (tickMs / 1000) * speed;
        return Math.min(selectedCall.durationSec, Math.round(next));
      });
    }, tickMs);

    return () => window.clearInterval(id);
  }, [playing, speed, selectedCall.durationSec]);

  // when elapsed changes: reveal transcript and recompute metrics/signal/nudges
  useEffect(() => {
    const chunks = selectedCall.chunks;

    // reveal any chunks with t <= elapsed
    let idx = -1;
    const newVisible: TranscriptChunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].t <= elapsedSec) {
        newVisible.push(chunks[i]);
        idx = i;
      }
    }

    setVisible(newVisible);
    setActiveIndex(idx);

    const m = computeLiveMetrics(elapsedSec, newVisible);
    setMetrics(m);
    setSignal(computeLiveSignal(m));

    // sample risk timeline every ~6 seconds (lightweight)
    if (playing && elapsedSec % 6 === 0) {
      riskTimelineRef.current.push(riskPointFromMetrics(m));
      // keep bounded
      if (riskTimelineRef.current.length > 60) riskTimelineRef.current.shift();
    }

    const recent = idx >= 0 ? chunks[idx] : null;
    const maybe = maybeCreateNudge(m, lastNudgeAtRef.current, recent);
    if (maybe) {
      lastNudgeAtRef.current = m.elapsedSec;
      nudgesRef.current.push(maybe);
      setNudge(maybe);
    }

    // stop at end & generate post-call summary
    if (playing && elapsedSec >= selectedCall.durationSec) {
      setPlaying(false);
      const summary = buildSummary(selectedCall, m);
      saveToHistory(summary);
      setMode("post");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec]);

  function stopAndReset() {
    setMode("live");
    setPlaying(false);
    setElapsedSec(0);
    setVisible([]);
    setActiveIndex(-1);
    const m = computeLiveMetrics(0, []);
    setMetrics(m);
    setSignal(computeLiveSignal(m));
    setNudge(null);
    lastNudgeAtRef.current = null;
    riskTimelineRef.current = [];
    nudgesRef.current = [];
  }

  function buildSummary(call: DemoCall, finalMetrics: LiveMetrics): CallSummary {
    const riskTimeline = riskTimelineRef.current.length
      ? riskTimelineRef.current
      : [riskPointFromMetrics(finalMetrics)];

    const nudges = nudgesRef.current;

    const keyMoments: CallSummary["keyMoments"] = [];
    if (finalMetrics.pricingMentioned && finalMetrics.pricingFirstMentionSec !== null && finalMetrics.pricingFirstMentionSec < 75) {
      keyMoments.push({
        t: finalMetrics.pricingFirstMentionSec,
        title: "Pricing introduced early",
        detail: "Pricing came up before value was anchored; buyer resistance increased.",
        color: "red",
      });
    }
    if (finalMetrics.repTalkRatio > 0.62) {
      keyMoments.push({
        t: Math.min(60, finalMetrics.elapsedSec),
        title: "Rep talk-time high",
        detail: "Discovery becomes rep-led; buyer signals get missed. Aim for buyer-led questions.",
        color: finalMetrics.repTalkRatio > 0.7 ? "red" : "yellow",
      });
    }
    if (finalMetrics.objectionCount >= 3) {
      keyMoments.push({
        t: Math.min(120, finalMetrics.elapsedSec),
        title: "Objection pressure increased",
        detail: "Multiple pushbacks detected; use acknowledge → clarify → reframe pattern.",
        color: finalMetrics.objectionCount >= 5 ? "red" : "yellow",
      });
    }
    if (finalMetrics.intentScore >= 36) {
      keyMoments.push({
        t: Math.min(180, finalMetrics.elapsedSec),
        title: "Strong next-step intent",
        detail: "Pilot / scheduling language detected; lock next step with owners + date.",
        color: "green",
      });
    }

    // Coaching attribution (simple, persuasive)
    const coaching: CallSummary["coaching"] = [];
    coaching.push({
      skill: "Discovery Control",
      observation:
        finalMetrics.repTalkRatio > 0.62
          ? "Rep dominated talk-time; buyer signal extraction suffered."
          : "Talk-time stayed balanced; buyer signals were surfaced.",
      fix: "Ask narrower questions, pause, and reflect back impact. Target buyer talk-time > rep talk-time early.",
    });

    coaching.push({
      skill: "Objection Handling",
      observation:
        finalMetrics.objectionCount >= 3
          ? "Objection density increased; value framing drifted."
          : "Objections were low; framing stayed stable.",
      fix: "Use: acknowledge → clarify → reframe. End with: “What would make this a no-brainer?”",
    });

    coaching.push({
      skill: "Pricing Discipline",
      observation:
        finalMetrics.pricingMentioned && finalMetrics.pricingFirstMentionSec !== null && finalMetrics.pricingFirstMentionSec < 75
          ? "Pricing appeared before value was established."
          : "Pricing timing was controlled.",
      fix: "Delay pricing until pain + impact + urgency are clear. If asked early: give range + tie to value drivers.",
    });

    coaching.push({
      skill: "Decision Path",
      observation:
        call.chunks.some((c) => c.text.toLowerCase().includes("vp") || c.text.toLowerCase().includes("revops") || c.text.toLowerCase().includes("it"))
          ? "Decision stakeholders appeared; alignment is possible."
          : "Decision maker signals were weak; deal may stall.",
      fix: "Confirm: who signs off, steps, timeline, and security constraints before ending the call.",
    });

    return {
      callId: call.id,
      callName: call.name,
      startedAtISO: new Date().toISOString(),
      durationSec: call.durationSec,
      final: finalMetrics,
      riskTimeline,
      nudges,
      keyMoments: keyMoments.length ? keyMoments : [
        { t: 60, title: "Baseline stable", detail: "No major spikes detected in this simulation.", color: "green" }
      ],
      coaching,
      outcome: pickOutcome(call),
    };
  }

  function saveToHistory(summary: CallSummary) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const prev: CallSummary[] = raw ? JSON.parse(raw) : [];
      const next = [summary, ...prev].slice(0, 12);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function readHistory(): CallSummary[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CallSummary[]) : [];
    } catch {
      return [];
    }
  }

  const [history, setHistory] = useState<CallSummary[]>([]);
  useEffect(() => {
    setHistory(readHistory());
  }, [mode, selectedId]);

  const header = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs tracking-wide text-white/60">BRICED Feature Demo</div>
          <div className="mt-1 text-2xl font-semibold text-white/90">
            Live Signal Engine <span className="text-[#5FE6D3]">Simulation</span>
          </div>
          <div className="mt-1 max-w-2xl text-sm text-white/65">
            Frontend-only prototype that mimics real-time transcript streaming, deal health signals, micro-interventions, and post-call coaching attribution.
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="text-xs text-white/60">Scenario</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85 outline-none hover:bg-black/30 sm:w-[320px]"
              disabled={playing}
              aria-label="Select demo scenario"
            >
              {calls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (mode === "post") setMode("live");
                  setPlaying((p) => !p);
                }}
                className="rounded-xl bg-[#5FE6D3] px-4 py-2 text-sm font-semibold text-[#081A2C] hover:brightness-95 disabled:opacity-60"
                disabled={mode === "post"}
              >
                {playing ? "Pause" : "Start"}
              </button>

              <button
                onClick={stopAndReset}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Reset
              </button>

              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <SpeedBtn val={1} cur={speed} set={setSpeed} />
                <SpeedBtn val={1.5} cur={speed} set={setSpeed} />
                <SpeedBtn val={2} cur={speed} set={setSpeed} />
              </div>
            </div>
          </div>

          <div className="text-xs text-white/45">
            Time: <span className="text-white/70">{formatTime(elapsedSec)}</span> /{" "}
            <span className="text-white/60">{formatTime(selectedCall.durationSec)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/60">
        <span className="font-semibold text-white/80">{selectedCall.name}:</span>{" "}
        {selectedCall.description}
      </div>
    </div>
  );

  if (!selectedCall) return null;

  const lastSummary = history[0];

  return (
    <div className="space-y-4">
      {header}

      {mode === "live" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <SignalStrip metrics={metrics} signal={signal} />
            <HistoryCard history={history} />
          </div>
          <TranscriptFeed visible={visible} activeIndex={activeIndex} />
        </div>
      )}

      {mode === "post" && lastSummary && (
        <PostCallDashboard
          summary={lastSummary}
          onBack={() => {
            setMode("live");
            // keep transcript visible (feels like you can rewatch), but don’t autoplay
            setPlaying(false);
          }}
        />
      )}

      <NudgeToast
        nudge={nudge}
        onDismiss={() => setNudge(null)}
      />
    </div>
  );
}

function SpeedBtn({
  val,
  cur,
  set,
}: {
  val: 1 | 1.5 | 2;
  cur: 1 | 1.5 | 2;
  set: (v: 1 | 1.5 | 2) => void;
}) {
  const active = cur === val;
  return (
    <button
      onClick={() => set(val)}
      className={`rounded-lg px-2 py-1 text-xs ${
        active
          ? "bg-[#5FE6D3] text-[#081A2C] font-semibold"
          : "text-white/70 hover:bg-white/10"
      }`}
      aria-label={`Set speed ${val}x`}
    >
      {val}x
    </button>
  );
}

function HistoryCard({ history }: { history: CallSummary[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">Recent Runs</div>
        <div className="text-xs text-white/55">localStorage</div>
      </div>

      <div className="mt-3 space-y-2">
        {history.length === 0 ? (
          <div className="text-sm text-white/60">
            Run a scenario to generate a post-call report.
          </div>
        ) : (
          history.slice(0, 5).map((h, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/85">{h.callName}</div>
                <div className="text-xs text-white/50">{new Date(h.startedAtISO).toLocaleTimeString()}</div>
              </div>
              <div className="mt-1 text-xs text-white/60">
                Outcome: <span className="text-white/80">{h.outcome}</span> • Final Risk:{" "}
                <span className="text-white/80">{h.final.riskScore}/100</span> • Rep Talk:{" "}
                <span className="text-white/80">{Math.round(h.final.repTalkRatio * 100)}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
