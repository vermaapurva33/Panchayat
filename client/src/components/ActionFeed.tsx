interface ActionEntry {
  candidate: string;
  candidateName: string;
  actionType: string;
  target: string;
  targetName: string;
  narrative: string;
  verdict: "ALLOWED" | "BLOCKED";
  reason: string;
  policyRef?: string;
  intentHash: string;
}

interface Props {
  actions: ActionEntry[];
}

function formatActionType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type { ActionEntry };

export default function ActionFeed({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <div className="panel-section">
      <div className="desk-kicker">Political Actions</div>
      <div className="desk-headline" style={{ fontSize: "16px" }}>
        Campaign Dispatches
      </div>

      <div className="action-feed">
        {actions.map((action, i) => (
          <div
            key={i}
            className={`action-card ${action.verdict === "BLOCKED" ? "action-card-blocked" : "action-card-allowed"}`}
          >
            {/* Verdict stamp */}
            <div className={`action-stamp ${action.verdict === "BLOCKED" ? "stamp-blocked" : "stamp-allowed"}`}>
              {action.verdict === "BLOCKED" ? "EC NOTICE" : "APPROVED"}
            </div>

            {/* Action header */}
            <div className="action-header">
              <span className="action-actor">{action.candidateName.split(" ").slice(0, 2).join(" ")}</span>
              <span className="action-arrow">{" \u2192 "}</span>
              <span className="action-target">{action.targetName.split(" ").slice(0, 2).join(" ")}</span>
            </div>

            {/* Action type */}
            <div className="action-type-label">
              {formatActionType(action.actionType)}
            </div>

            {/* Narrative */}
            <div className="action-narrative">
              "{action.narrative}"
            </div>

            {/* Shield reasoning */}
            <div className="action-shield-reason">
              {action.verdict === "BLOCKED" ? (
                <>
                  <span className="shield-label">Shield:</span> {action.reason}
                  {action.policyRef && (
                    <div className="shield-policy-ref">Ref: {action.policyRef}</div>
                  )}
                </>
              ) : (
                <>
                  <span className="shield-label">Verified:</span> {action.reason.slice(0, 80)}
                </>
              )}
            </div>

            {/* Intent hash */}
            <div className="action-hash">
              #{action.intentHash}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
