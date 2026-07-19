import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10", className)} {...props} />;
}

type ButtonProps = {
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"button">, "children">;

export function Button({ href, variant = "primary", size = "md", children, className, ...props }: ButtonProps) {
  const styles = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-[var(--blue)] text-white shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:bg-[var(--blue-dark)]",
    variant === "secondary" && "border border-[var(--border)] bg-white text-[var(--navy)] hover:border-blue-300 hover:bg-blue-50",
    variant === "ghost" && "text-[var(--navy)] hover:bg-blue-50",
    size === "sm" && "min-h-10 px-4 text-sm",
    size === "md" && "min-h-12 px-6 text-sm",
    size === "lg" && "min-h-14 px-7 text-base",
    className,
  );
  if (href) return <Link href={href} className={styles}>{children}</Link>;
  return <button className={styles} {...props}>{children}</button>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-700", className)}>{children}</span>;
}

export function Card({ className, ...props }: ComponentProps<"article">) {
  return <article className={cn("rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function SectionHeading({ eyebrow, title, description, align = "start" }: { eyebrow?: string; title: string; description?: string; align?: "start" | "center" }) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--blue)]">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-bold tracking-[-0.035em] text-[var(--navy)] sm:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-pretty text-lg leading-8 text-[var(--muted)]">{description}</p>}
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--navy)]">
      {label}
      {children}
      {error && <span className="text-sm font-medium text-red-600" role="alert">{error}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
