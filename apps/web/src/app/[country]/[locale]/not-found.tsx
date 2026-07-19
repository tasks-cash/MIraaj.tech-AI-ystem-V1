import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--soft)] px-5 py-20 text-center">
      <div className="max-w-xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">404</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[var(--navy)] sm:text-6xl">This page could not be found.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted)]">The market, language or page may be unavailable. Return to the global website to continue.</p>
        <Link href="/global/en" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-blue-600 px-6 font-bold text-white">Go to MIRAAJ.TECH</Link>
      </div>
    </main>
  );
}
