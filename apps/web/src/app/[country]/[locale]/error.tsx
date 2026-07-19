"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error", error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-5 py-20 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-black uppercase tracking-widest text-red-600">Something went wrong</p>
        <h1 className="mt-4 text-4xl font-bold text-[var(--navy)]">The page could not be displayed.</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">Your information has not been cleared. Try loading this part of the site again.</p>
        <button onClick={reset} className="mt-7 min-h-12 rounded-full bg-blue-600 px-6 font-bold text-white">Try again</button>
      </div>
    </div>
  );
}
