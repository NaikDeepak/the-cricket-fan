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
      className={`inline-flex items-center rounded-full bg-[#e8e8ed]/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 ${sizeClasses} ${className}`}
      style={{
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
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
            className={`relative z-10 flex items-center justify-center gap-1.5 font-medium rounded-full transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30 ${itemPadding} ${
              isSelected
                ? "text-black dark:text-white font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={`active-pill-${name}`}
                className="absolute inset-0 rounded-full bg-white dark:bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] border border-black/5 dark:border-white/10 -z-10"
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
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/10 text-zinc-600 dark:bg-white/15 dark:text-zinc-300"
                }`}
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
