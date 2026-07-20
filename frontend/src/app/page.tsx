import { api } from "@/lib/api";
import MatchHero from "@/components/hero/MatchHero";
import ExploreQuicklinks from "@/components/explorer/ExploreQuicklinks";
import PlayerBattle from "@/components/battle/PlayerBattle";
import TriviaCard from "@/components/trivia/TriviaCard";
import PredictionCard from "@/components/prediction/PredictionCard";
import SectionCounter from "@/components/ui/SectionCounter";

export default async function Page() {
  let story;
  try {
    story = await api.story();
  } catch (error) {
    console.error("Failed to fetch story:", error);
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-500/10 rounded-xl border border-red-500/20">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Service Unavailable</h1>
          <p className="text-gray-400">The Cricket Fan is warming up. Please check back in a moment.</p>
        </div>
      </main>
    );
  }

  const [battleRes, triviaRes, predictionRes] = await Promise.allSettled([
    story.featured_batsman && story.featured_bowler 
      ? api.battle(story.featured_batsman, story.featured_bowler)
      : Promise.reject("No battle available"),
    api.trivia(),
    api.prediction(),
  ]);

  const battle = battleRes.status === "fulfilled" ? battleRes.value : null;
  const trivia = triviaRes.status === "fulfilled" ? triviaRes.value : null;
  const prediction = predictionRes.status === "fulfilled" ? predictionRes.value : null;

  return (
    <main
      style={{
        "--team-a": story.team_a.color,
        "--team-b": story.team_b.color,
      } as React.CSSProperties}
    >
      <SectionCounter total={4} />
      <MatchHero data={story} />
      <ExploreQuicklinks data={story} />
      {battle && <PlayerBattle data={battle} />}
      {trivia && <TriviaCard data={trivia} />}
      {prediction && <PredictionCard data={prediction} />}
      {(!battle || !trivia || !prediction) && (
        <div className="p-4 text-center text-sm text-gray-500 italic">
          Some insights are currently being calculated...
        </div>
      )}
    </main>
  );
}
