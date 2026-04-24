// frontend/src/lib/gsap.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };
export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const DURATION = { fast: 0.4, base: 0.6, slow: 0.8 };
export const STAGGER = 0.09;
