import { Bot, Check, CreditCard, Play, Workflow } from "lucide-react";

export function ProductEcosystem() {
  return (
    <div className="relative mx-auto aspect-[1.05] w-full max-w-[620px]" aria-label="Product ecosystem showing web, mobile, AI, payments, automation and video">
      <div className="absolute inset-[10%_2%_8%_8%] rounded-[2rem] border border-blue-200 bg-gradient-to-br from-white via-blue-50 to-cyan-100 p-4 shadow-[0_30px_80px_rgba(23,107,255,.18)] sm:p-6">
        <div className="flex items-center gap-2 border-b border-blue-100 pb-4">
          <span className="size-2.5 rounded-full bg-red-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" />
          <span className="ms-4 h-7 flex-1 rounded-lg bg-white" />
        </div>
        <div className="grid h-[76%] grid-cols-[.75fr_1.25fr] gap-4 pt-5">
          <div className="rounded-2xl bg-[var(--navy)] p-4 text-white">
            <div className="mb-8 size-9 rounded-xl bg-blue-500" />
            <div className="space-y-3">{[70, 92, 58, 80].map((width) => <div key={width} className="h-2 rounded-full bg-white/20" style={{ width: `${width}%` }} />)}</div>
          </div>
          <div className="grid content-start gap-4">
            <div className="h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-400 p-4"><div className="h-2 w-1/2 rounded bg-white/50" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded-2xl bg-white p-3 shadow-sm"><div className="h-2 w-2/3 rounded bg-blue-200" /></div><div className="h-20 rounded-2xl bg-white p-3 shadow-sm"><div className="h-2 w-1/2 rounded bg-cyan-200" /></div></div>
          </div>
        </div>
      </div>
      <div className="mock-float absolute bottom-[2%] start-[1%] w-[28%] rounded-[1.7rem] border-[5px] border-slate-900 bg-white p-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-8 rounded bg-slate-300" />
        <div className="aspect-[.62] rounded-xl bg-gradient-to-b from-blue-50 to-white p-3"><div className="h-14 rounded-xl bg-blue-600" /><div className="mt-3 h-2 w-3/4 rounded bg-slate-200" /><div className="mt-2 h-2 w-1/2 rounded bg-slate-200" /></div>
      </div>
      <div className="mock-float-slow absolute top-[2%] end-[1%] w-[42%] rounded-2xl border border-violet-200 bg-white p-4 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-violet-700"><Bot className="size-4" />AI assistant</div>
        <div className="mt-3 rounded-xl bg-slate-100 p-3 text-[10px] text-slate-500">How can we simplify this workflow?</div>
        <div className="mt-2 ms-5 rounded-xl bg-blue-600 p-3 text-[10px] text-white">I found three safe automation steps.</div>
      </div>
      <div className="mock-float absolute bottom-[11%] end-0 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 shadow-xl">
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CreditCard className="size-4" /></span>
        <span><strong className="block text-xs text-slate-800">Payment approved</strong><small className="text-[10px] text-slate-500">Secure checkout</small></span>
        <Check className="size-4 text-emerald-600" />
      </div>
      <div className="absolute top-[38%] -start-[2%] grid gap-2 rounded-2xl border border-blue-100 bg-white p-3 shadow-lg">
        <span className="flex items-center gap-2 text-[10px] font-bold"><Workflow className="size-4 text-blue-600" />Automation</span>
        <span className="h-1.5 w-20 rounded bg-gradient-to-r from-blue-500 to-cyan-400" />
      </div>
      <div className="absolute bottom-[1%] start-[37%] flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-bold text-white shadow-lg"><Play className="size-3 fill-white" />Video timeline</div>
    </div>
  );
}
