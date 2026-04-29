import { api } from "@/lib/api";
import MatchArchiveCard from "@/components/archive/MatchArchiveCard";

export default async function ArchivePage() {
  const matches = await api.matches();
  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Past Matches</h1>
        <p className="text-zinc-500 text-sm mb-8">IPL 2026 season</p>
        {matches.length === 0 ? (
          <p className="text-zinc-600">No matches recorded yet this season.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map((m) => (
              <MatchArchiveCard key={m.date} match={m} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
