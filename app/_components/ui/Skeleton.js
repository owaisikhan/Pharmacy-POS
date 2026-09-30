"use client";

// Ported from PMC-Hospital src/components/ui/skeleton.tsx.
// Copy to app/_components/ui/Skeleton.js. Needs the `motion` package.

import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";

// A placeholder block with a highlight sweeping across it.
//
// The sweep is a gradient translated by motion inside an overflow-hidden box,
// rather than an animated background-position: transform is composited on the
// GPU, so a page full of these does not repaint on every frame.
//
// `delay` staggers the sweep. Staggering rows makes a list read as one surface
// filling in, rather than a grid of things flashing independently.
export function Skeleton({ className, delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <span aria-hidden className={clsx("relative block overflow-hidden rounded-md bg-[var(--color-surface-2)]", className)}>
      {/* Always rendered, never conditional: the server cannot know the
          viewer's motion preference, so dropping the element on the client
          causes a hydration mismatch. Under reduced motion it stays parked
          off to the left, clipped, leaving the plain block. */}
      <motion.span
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--color-text)_10%,transparent)] to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: reduceMotion ? "-100%" : "100%" }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 1.3, ease: "linear", repeat: Infinity, repeatDelay: 0.25, delay }
        }
      />
    </span>
  );
}

// A placeholder bar sitting in a box of the real text's line height.
//
// The bar is shorter than the line so it reads as text rather than a slab,
// but the box around it is the exact height the real line will occupy.
// Sizing the bars alone leaves rows short, and the page jumps when the data
// lands: the one thing a skeleton exists to prevent.
//
// Line heights: h-7 for text-xl/text-lg, h-6 for text-base, h-5 for text-sm.
export function SkeletonLine({ line, bar, width, delay = 0, align = "left" }) {
  return (
    <span className={clsx("flex items-center", line, align === "right" && "justify-end")}>
      <Skeleton className={clsx(bar, width)} delay={delay} />
    </span>
  );
}
