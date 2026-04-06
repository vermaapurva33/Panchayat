import { getCandidateById } from "../data/gameData";

interface Props {
  forecast: {
    vote_shares: Record<string, number>;
    winner: string;
    margin: number;
  };
}

export default function ElectionForecast({ forecast }: Props) {
  const { vote_shares } = forecast;
  const sorted = Object.entries(vote_shares).sort(([, a], [, b]) => b - a);
  const leader = sorted[0];
  const leaderCandidate = getCandidateById(leader[0]);

  return (
    <div className="panel-section">
      {/* Section kicker */}
      <div className="desk-kicker">Poll Results</div>
      
      {/* Lead headline */}
      <div className="desk-headline">
        {leaderCandidate?.name || leader[0]} Leads With {leader[1].toFixed(1)}%
      </div>
      
      <div className="desk-subhead">
        Latest projections from all five constituencies
      </div>

      {/* Results table — classic newspaper tabular data */}
      <table className="desk-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Candidate</th>
            <th style={{ textAlign: "right" }}>Share</th>
            <th style={{ textAlign: "left", width: "45%" }}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([cid, share], i) => {
            const candidate = getCandidateById(cid);
            const color = candidate?.color ?? "#888";
            const name = candidate?.name ?? cid;
            const isLeader = i === 0;

            return (
              <tr key={cid} style={{ fontWeight: isLeader ? "700" : "400" }}>
                <td style={{ color: isLeader ? color : "var(--ink-medium)" }}>
                  {isLeader ? "* " : ""}{name.split(" ").slice(0, 2).join(" ")}
                </td>
                <td style={{ textAlign: "right", fontWeight: "700" }}>
                  {share.toFixed(1)}%
                </td>
                <td>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.max(3, share)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Editorial note */}
      <div className="desk-note">
        Margin of victory: {forecast.margin.toFixed(1)} percentage points
      </div>
    </div>
  );
}
