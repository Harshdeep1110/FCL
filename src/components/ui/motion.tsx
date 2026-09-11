"use client";

/**
 * Small shared Framer Motion primitives so pages don't each re-declare the
 * same entrance/hover choreography. Everything here is a client component;
 * import into leaves that need motion, keep server components server.
 */

import { animate, motion, type Variants } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

/** Fade + rise a block into view on mount. */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

/** Wrap a list of <StaggerItem> to reveal them one after another. */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
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
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/** A button/div that gently lifts on hover and depresses on tap. */
export function Pressable({
  children,
  className,
  onClick,
  disabled,
  as = "button",
  title,
  ariaLabel,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  as?: "button" | "div";
  title?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
}) {
  const common = {
    whileHover: disabled ? undefined : { y: -2, scale: 1.015 },
    whileTap: disabled ? undefined : { scale: 0.97 },
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
    className,
  };
  if (as === "div") {
    return (
      <motion.div {...common} title={title} aria-label={ariaLabel}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.button
      {...common}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </motion.button>
  );
}

/** Count-up number. Animates from its previous value whenever `value` changes. */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prev.current;
    prev.current = value;
    const controls = animate(from, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = v.toFixed(decimals) + suffix;
      },
    });
    return () => controls.stop();
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals) + suffix}
    </span>
  );
}
