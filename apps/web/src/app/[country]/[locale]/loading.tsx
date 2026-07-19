export default function Loading() {
  return (
    <div className="mx-auto min-h-[70dvh] max-w-7xl animate-pulse px-5 py-20" aria-label="Loading page">
      <div className="h-7 w-40 rounded-full bg-slate-200" />
      <div className="mt-7 h-16 max-w-3xl rounded-2xl bg-slate-200" />
      <div className="mt-4 h-6 max-w-2xl rounded bg-slate-100" />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-64 rounded-3xl bg-slate-100" />)}
      </div>
    </div>
  );
}
