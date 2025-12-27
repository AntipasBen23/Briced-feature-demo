import type { LiveMetrics, LiveSignal, Nudge, RiskPoint, TranscriptChunk, SignalColor } from "./types";

const OBJECTION_TERMS = [
  "why", "concern", "accurate", "wrong", "hate", "clutter", "too late",
  "not ready", "security", "implementation", "weeks", "busy", "can't", "cannot",
  "compared", "vs", "risk",
];

const PRICING_TERMS = ["price", "pricing", "budget", "cost", "per seat", "seat", "contract"];

const INTENT_TERMS = ["pilot", "next step", "let’s do", "let's do", "schedule", "align", "worth", "priority", "move forward"];

const DECISION_TERMS = ["approve", "vp", "revops", "it", "decision", "security", "procurement"];

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function includesAny(text: string, terms: string[]): boolean {
  const t = text.toLowerCase();
  return terms.some((x) => t.includes(x));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function signalColorFromRisk(riskScore: number): SignalColor {
  if (riskScore >= 70) return "red";
  if (riskScore >= 40) return "yellow";
  return "green";
}

function stageFromTranscript(pricingMentioned: boolean, elapsedSec: number): LiveMetrics["stage"] {
  if (pricingMentioned) return "Pricing";
  if (elapsedSec < 80) return "Discovery";
  if (elapsedSec < 160) return "Demo";
  return "Close";
}

export function computeLiveMetrics(
  elapsedSec: number,
  seenChunks: TranscriptChunk[]
): LiveMetrics {
  let repWords = 0;
  let buyerWords = 0;

  let objectionCount = 0;
  let pricingMentioned = false;
  let pricingFirstMentionSec: number | null = null;
  let intentHits = 0;
  let decisionHits = 0;

  for (const c of seenChunks) {
    const w = countWords(c.text);
    if (c.speaker === "REP") repWords += w;
    else buyerWords += w;

    const lower = c.text.toLowerCase();
    if (includesAny(lower, OBJECTION_TERMS)) objectionCount += 1;

    if (includesAny(lower, PRICING_TERMS)) {
      if (!pricingMentioned) pricingFirstMentionSec = c.t;
      pricingMentioned = true;
    }

    if (includesAny(lower, INTENT_TERMS)) intentHits += 1;
    if (includesAny(lower, DECISION_TERMS)) decisionHits += 1;
  }

  const totalWords = repWords + buyerWords;
  const repTalkRatio = totalWords === 0 ? 0.5 : repWords / totalWords;

  // Risk: high rep talk, objections, early pricing, missing decision clarity later
  let riskScore = 0;

  // Talk-time penalty (sales is usually better when buyer talks more in discovery)
  if (repTalkRatio > 0.62) riskScore += (repTalkRatio - 0.62) * 120; // up to ~45

  // Objection density penalty
  riskScore += clamp(objectionCount * 6, 0, 35);

  // Pricing too early penalty
  if (pricingMentioned && pricingFirstMentionSec !== null && pricingFirstMentionSec < 75) {
    riskScore += 25;
  }

  // If late in call and decision process still fuzzy, add risk
  if (elapsedSec > 140 && decisionHits === 0) {
    riskScore += 15;
  }

  // Intent reduces risk a bit
  const intentScore = clamp(intentHits * 18, 0, 100);
  riskScore -= clamp(intentHits * 8, 0, 18);

  riskScore = clamp(Math.round(riskScore), 0, 100);

  return {
    elapsedSec,
    repWords,
    buyerWords,
    repTalkRatio,
    objectionCount,
    pricingMentioned,
    pricingFirstMentionSec,
    intentScore,
    riskScore,
    stage: stageFromTranscript(pricingMentioned, elapsedSec),
  };
}

export function computeLiveSignal(m: LiveMetrics): LiveSignal {
  const color = signalColorFromRisk(m.riskScore);

  const label =
    color === "green" ? "Healthy" : color === "yellow" ? "At Risk" : "Slipping";

  let hint = "Keep it calm. Stay buyer-led.";
  if (color === "yellow") {
    hint = "A risk is emerging—tighten discovery and confirm next steps.";
  }
  if (color === "red") {
    hint = "Momentum is dropping—reframe value and regain control.";
  }

  // Stage-based hint overrides
  if (m.stage === "Discovery" && m.repTalkRatio > 0.62) {
    hint = "Discovery: you’re talking too much—ask a narrow question, then pause.";
  }
  if (m.pricingMentioned && m.pricingFirstMentionSec !== null && m.pricingFirstMentionSec < 75) {
    hint = "Pricing came early—anchor value before discussing budget.";
  }

  return { color, label, hint };
}

export function maybeCreateNudge(
  m: LiveMetrics,
  lastNudgeAtSec: number | null,
  recentChunk: TranscriptChunk | null
): Nudge | null {
  // cooldown
  if (lastNudgeAtSec !== null && m.elapsedSec - lastNudgeAtSec < 18) return null;

  const lc = recentChunk?.text.toLowerCase() ?? "";

  // 1) Pricing too early
  if (m.pricingMentioned && m.pricingFirstMentionSec !== null && m.pricingFirstMentionSec < 75 && m.elapsedSec - m.pricingFirstMentionSec < 20) {
    return {
      id: `nudge_pricing_${m.elapsedSec}`,
      t: m.elapsedSec,
      severity: "high",
      title: "Pricing too early",
      message: "Pause pricing. Re-anchor value: confirm pain → impact → why change now.",
    };
  }

  // 2) Talk-time imbalance in discovery
  if (m.stage === "Discovery" && m.repTalkRatio > 0.62 && m.elapsedSec > 25) {
    return {
      id: `nudge_talk_${m.elapsedSec}`,
      t: m.elapsedSec,
      severity: "med",
      title: "Buyer-led discovery",
      message: "Ask one tight question and stop. Aim buyer talk-time > rep talk-time.",
    };
  }

  // 3) Objection detected
  if (includesAny(lc, ["why do you ask", "not ready", "compared", "vs", "hate", "wrong"])) {
    return {
      id: `nudge_obj_${m.elapsedSec}`,
      t: m.elapsedSec,
      severity: "high",
      title: "Handle the objection cleanly",
      message: "Acknowledge → clarify → reframe. Then ask: “What would make this a no-brainer?”",
    };
  }

  // 4) Missing decision process late
  if (m.elapsedSec > 130 && !includesAny(lc, ["vp", "revops", "it", "approve", "decision"]) && m.riskScore >= 45) {
    return {
      id: `nudge_dec_${m.elapsedSec}`,
      t: m.elapsedSec,
      severity: "med",
      title: "Decision path",
      message: "Confirm the decision process now: who signs off + what steps + timeline.",
    };
  }

  // 5) If risk is red, generic rescue nudge
  if (m.riskScore >= 75) {
    return {
      id: `nudge_red_${m.elapsedSec}`,
      t: m.elapsedSec,
      severity: "high",
      title: "Rescue the call",
      message: "Summarize value in one sentence, ask a high-signal question, then propose a pilot next step.",
    };
  }

  return null;
}

export function riskPointFromMetrics(m: LiveMetrics): RiskPoint {
  return {
    t: m.elapsedSec,
    riskScore: m.riskScore,
    color: signalColorFromRisk(m.riskScore),
  };
}
