"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import type { ReactNode } from "react";

/** Centralized homepage motion tokens — do not scatter random durations. */
export const motionTokens = {
  duration: {
    fast: 0.28,
    base: 0.45,
    slow: 0.7,
    decorative: 8,
  },
  ease: [0.22, 1, 0.36, 1] as const,
  stagger: 0.08,
  viewport: { once: true, amount: 0.2, margin: "0px 0px -8% 0px" },
} as const;

export function useMotionEnabled() {
  const reduced = useReducedMotion();
  // On SSR, useReducedMotion() is null — keep content visible (no opacity:0 flash).
  if (reduced == null) {
    return false;
  }
  return !reduced;
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  ...props
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      initial={enabled ? { opacity: 0, y: 18 } : false}
      whileInView={enabled ? { opacity: 1, y: 0 } : undefined}
      viewport={motionTokens.viewport}
      transition={{
        duration: enabled ? motionTokens.duration.base : 0,
        delay: enabled ? delay : 0,
        ease: motionTokens.ease,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      initial={enabled ? { opacity: 0 } : false}
      whileInView={enabled ? { opacity: 1 } : undefined}
      viewport={motionTokens.viewport}
      transition={{
        duration: enabled ? motionTokens.duration.base : 0,
        delay: enabled ? delay : 0,
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      initial={enabled ? "hidden" : false}
      whileInView={enabled ? "visible" : undefined}
      viewport={motionTokens.viewport}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: enabled ? motionTokens.stagger : 0,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: enabled ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: enabled ? motionTokens.duration.base : 0,
            ease: motionTokens.ease,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function TextLineReveal({
  text,
  className,
  as: Tag = "h1",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const enabled = useMotionEnabled();
  return (
    <Tag className={className}>
      <motion.span
        className="block"
        initial={enabled ? { opacity: 0, y: 16 } : false}
        animate={enabled ? { opacity: 1, y: 0 } : undefined}
        transition={{
          duration: enabled ? motionTokens.duration.base : 0,
          delay: enabled ? 0.12 : 0,
          ease: motionTokens.ease,
        }}
      >
        {text}
      </motion.span>
    </Tag>
  );
}

export function HoverLift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      whileHover={enabled ? { y: -4 } : undefined}
      transition={{ duration: motionTokens.duration.fast }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const enabled = useMotionEnabled();
  return (
    <motion.div
      className={className}
      initial={enabled ? { opacity: 0, scale: 0.96 } : false}
      whileInView={enabled ? { opacity: 1, scale: 1 } : undefined}
      viewport={motionTokens.viewport}
      transition={{
        duration: enabled ? motionTokens.duration.slow : 0,
        delay: enabled ? delay : 0,
        ease: motionTokens.ease,
      }}
    >
      {children}
    </motion.div>
  );
}
