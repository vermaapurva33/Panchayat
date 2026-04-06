import type { VoterData } from "../data/gameData";

interface VoterSentiment {
  id: string;
  happiness: number;
  shift: number;
  narrative: string;
}

interface Props {
  voters: VoterData[];
  sentiments: VoterSentiment[];
}

function getSentimentColor(happiness: number): string {
  if (happiness >= 60) return "var(--success)";
  if (happiness >= 40) return "var(--warning)";
  return "var(--danger)";
}

function getSentimentLabel(happiness: number): string {
  if (happiness >= 70) return "Jubilant";
  if (happiness >= 55) return "Favourable";
  if (happiness >= 40) return "Restless";
  if (happiness >= 25) return "Discontent";
  return "Agitated";
}

function getMoodReportLine(voter: VoterData, happiness: number): string {
  const label = getSentimentLabel(happiness);
  const name = voter.name;
  if (happiness >= 60) return `${name} express strong approval of the current policy direction, with sentiment at ${happiness.toFixed(0)}%.`;
  if (happiness >= 40) return `${name} remain cautious. Mood sits at ${happiness.toFixed(0)}% — a constituency to watch closely.`;
  return `${name} grow increasingly dissatisfied. Approval has dipped to ${happiness.toFixed(0)}%, raising alarm among strategists.`;
}

export default function VoterSentimentPanel({ voters, sentiments }: Props) {
  // Find the most volatile voter group
  const voterData = voters.map((voter) => {
    const sentiment = sentiments.find((s) => s.id === voter.id);
    const happiness = sentiment?.happiness ?? voter.baseHappiness;
    return { voter, happiness };
  });

  // Sort: most unhappy first (they're the "headline")
  const sorted = [...voterData].sort((a, b) => a.happiness - b.happiness);
  const headlineVoter = sorted[0];

  return (
    <div className="panel-section">
      {/* Section kicker */}
      <div className="desk-kicker">Ground Report</div>
      
      {/* Dynamic editorial headline based on most volatile group */}
      <div className="desk-headline" style={{ fontSize: "16px" }}>
        {headlineVoter.voter.name}: "{getSentimentLabel(headlineVoter.happiness)}"
      </div>

      {/* Mood dispatch — written like a journalist's field report */}
      <div className="desk-body">
        {voterData.map(({ voter, happiness }) => {
          const color = getSentimentColor(happiness);
          const label = getSentimentLabel(happiness);
          return (
            <div key={voter.id} className="desk-dispatch">
              <div className="desk-dispatch-header">
                <span className="desk-dispatch-name">{voter.name}</span>
                <span className="desk-dispatch-tag" style={{ color }}>{label}</span>
              </div>
              <div className="desk-dispatch-bar">
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${happiness}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className="desk-dispatch-text">
                {getMoodReportLine(voter, happiness)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
