import Link from "next/link";
import { MatchSummary } from "@/lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function MatchArchiveCard({ match }: { match: MatchSummary }) {
  return (
    <Link href={`/match/${match.date}`} className="block group">
      <div className="flex items-center gap-4 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-4 group-hover:border-zinc-600 transition-colors">
        <span className="text-zinc-500 text-sm w-28 shrink-0">{formatDate(match.date)}</span>
        <div className="flex items-center gap-2 font-bold text-white shrink-0">
          <span style={{ color: match.team_a.primary_color }}>{match.team_a.short_name}</span>
          <span className="text-zinc-600 text-xs">vs</span>
          <span style={{ color: match.team_b.primary_color }}>{match.team_b.short_name}</span>
        </div>
        <span className="text-zinc-500 text-sm hidden sm:block shrink-0">{match.venue}</span>
        <div className="ml-auto text-right min-w-0">
          {match.headline ? (
            <span className="text-zinc-300 text-sm line-clamp-1">{match.headline}</span>
          ) : (
            <span className="text-zinc-700 text-sm">—</span>
          )}
        </div>
      </div>
    </Link>
  );
}
