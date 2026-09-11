import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared sticky page header with the UCL brand mark, an optional back link,
 * a gradient title and an optional right-hand slot. Server component — uses
 * CSS entrance animations so it can be rendered directly from server pages.
 */
export function PageHeader({
  title,
  back,
  right,
  subtitle,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="card-surface sticky top-0 z-30 flex items-center justify-between gap-4 border-x-0 border-t-0 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition hover:border-ucl-cyan hover:text-ucl-cyan"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
          </Link>
        )}
        <Starball />
        <div className="min-w-0 animate-[rise_0.45s_cubic-bezier(0.16,1,0.3,1)_both]">
          <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
            <span className="text-brand">{title}</span>
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0 text-sm text-muted">{right}</div>}
    </header>
  );
}

/** The Champions League "starball" mark, drawn as an SVG so it scales cleanly. */
export function Starball({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} shrink-0 drop-shadow-[0_0_6px_rgba(0,225,255,0.4)]`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="starball-g" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="60%" stopColor="#00e1ff" />
          <stop offset="100%" stopColor="#1e5bff" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#starball-g)" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = 30;
        const cx = 50 + Math.cos(a) * r;
        const cy = 50 + Math.sin(a) * r;
        return <Star key={i} cx={cx} cy={cy} size={7} />;
      })}
      <Star cx={50} cy={50} size={9} />
    </svg>
  );
}

function Star({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return `${cx + Math.cos(a) * size},${cy + Math.sin(a) * size}`;
  }).join(" ");
  return <polygon points={pts} fill="#0a1a4a" opacity="0.85" />;
}
