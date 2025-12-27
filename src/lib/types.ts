export type Speaker = "REP" | "BUYER";

export type TranscriptChunk = {
  t: number; // seconds from call start
  speaker: Speaker;
  text: string;
};

export type DemoCall = {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  chunks: TranscriptChunk[];
  outcome?: "Won" | "Lost" | "Pipeline";
};

export type LiveMetrics = {
  elapsedSec: number;
  repWords: number;
  buyerWords: number;
  repTalkRatio: number; // 0..1
  objectionCount: number;
  pricingMentioned: boolean;
  pricingFirstMentionSec: number | null;
  intentScore: number; // 0..100
  riskScore: number; // 0..100 (higher = worse)
  stage: "Discovery" | "Demo" | "Pricing" | "Close";
};

export type SignalColor = "green" | "yellow" | "red";

export type LiveSignal = {
  color: SignalColor;
  label: string;
  hint: string;
};

export type Nudge = {
  id: string;
  t: number;
  severity: "low" | "med" | "high";
  title: string;
  message: string;
};

export type RiskPoint = {
  t: number;
  riskScore: number;
  color: SignalColor;
};

export type CallSummary = {
  callId: string;
  callName: string;
  startedAtISO: string;
  durationSec: number;
  final: LiveMetrics;
  riskTimeline: RiskPoint[];
  nudges: Nudge[];
  keyMoments: Array<{ t: number; title: string; detail: string; color: SignalColor }>;
  coaching: Array<{ skill: string; observation: string; fix: string }>;
  outcome: "Won" | "Lost" | "Pipeline";
};
