"use client";

import { motion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  name = "segmented-control",
}: SegmentedControlProps<T>) {
  const isReduced = prefersReducedMotion();

  const sizeClasses = {
    sm: "p-0.5 text-xs",
    md: "p-1 text-[13px]",
    lg: "p-1.5 text-sm",
  }[size];

  const itemPadding = {
    sm: "px-2.5 py-1",
    md: "px-3.5 py-1.5",
    lg: "px-5 py-2",
  }[size];

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`inline-flex items-center rounded-lg bg-[rgba(0,0,0,0.06)] dark:bg-zinc-800/80 backdrop-blur-md border border-[var(--border)] ${sizeClasses} ${className}`}
      style={{
        borderRadius: "var(--radius-sm)",
      }}
    >
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 font-medium transition-colors select-none outline-none ${itemPadding} ${
              isSelected
                ? "text-black dark:text-white font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            style={{
              borderRadius: "var(--radius-xs)",
            }}
          >
            {isSelected && (
              <motion.div
                layoutId={`active-pill-${name}`}
                className="absolute inset-0 bg-white dark:bg-zinc-900 shadow-sm border border-[var(--border)] -z-10"
                style={{
                  borderRadius: "var(--radius-xs)",
                }}
                transition={
                  isReduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 450, damping: 35 }
                }
              />
            )}
            {option.icon && <span className="text-current opacity-80">{option.icon}</span>}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold ${
                  isSelected
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/10 text-zinc-600 dark:bg-white/15 dark:text-zinc-300"
                }`}
                style={{
                  borderRadius: "var(--radius-xs)",
                }}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
