import CallSimulator from "@/components/CallSimulator";
import { DEMO_CALLS } from "@/lib/demoCalls";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#061425] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[900px] -translate-x-1/2 rounded-full bg-[#5FE6D3]/10 blur-3xl" />
        <div className="absolute top-48 right-[-180px] h-72 w-72 rounded-full bg-[#5FE6D3]/8 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-160px] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10">
        <CallSimulator calls={DEMO_CALLS} />
      </div>
    </main>
  );
}
