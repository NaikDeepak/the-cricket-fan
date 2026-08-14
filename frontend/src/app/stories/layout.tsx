import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "The Vault — The Cricket Fan",
  description:
    "Verified cricket folklore: historic comebacks, records, and legendary moments. 100% real, sourced stories.",
  openGraph: {
    title: "The Vault — The Cricket Fan",
    description:
      "Verified cricket folklore: historic comebacks, records, and legendary moments.",
    type: "website",
  },
};

export default function StoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
