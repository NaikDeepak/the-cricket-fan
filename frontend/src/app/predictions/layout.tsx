import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Prediction Track Record — The Cricket Fan",
  description:
    "Every prediction our model has made, when we made it, and what actually happened. No cherry-picking.",
  openGraph: {
    title: "Prediction Track Record — The Cricket Fan",
    description:
      "Every prediction our model has made, when we made it, and what actually happened.",
    type: "website",
  },
};

export default function PredictionsLayout({ children }: { children: ReactNode }) {
  return children;
}
