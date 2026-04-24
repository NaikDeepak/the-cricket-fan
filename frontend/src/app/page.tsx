// frontend/src/app/page.tsx
import { api } from "@/lib/api";
import MatchHero from "@/components/hero/MatchHero";
import PlayerBattle from "@/components/battle/PlayerBattle";
import TriviaCard from "@/components/trivia/TriviaCard";
import PredictionCard from "@/components/prediction/PredictionCard";
import SectionCounter from "@/components/ui/SectionCounter";

export default async function Page() {
  const [story, battle, trivia, prediction] = await Promise.all([
    api.story(),
    api.battle("Rohit Sharma", "Ravindra Jadeja"),
    api.trivia(),
    api.prediction(),
  ]);

  return (
    <main
      style={{
        "--team-a": story.team_a.color,
        "--team-b": story.team_b.color,
      } as React.CSSProperties}
    >
      <SectionCounter total={4} />
      <MatchHero data={story} />
      <PlayerBattle data={battle} teamA={story.team_a} teamB={story.team_b} />
      <TriviaCard data={trivia} />
      <PredictionCard data={prediction} />
    </main>
  );
}
