import { useState } from "react";
import { CANDIDATES } from "../data/gameData";

interface Props {
  onAttack: (actionType: string, targetId: string, narrative: string) => void;
  disabled: boolean;
  lastResult: {
    verdict: "ALLOWED" | "BLOCKED";
    reason: string;
  } | null;
}

const ACTION_TYPES = [
  { id: "policy_critique", label: "Policy Critique", desc: "Criticize an opponent's policy with facts" },
  { id: "public_challenge", label: "Public Challenge", desc: "Challenge an opponent to defend their position" },
  { id: "alliance_proposal", label: "Alliance Proposal", desc: "Propose collaboration on shared ground" },
  { id: "scandal_expose", label: "Scandal Expose", desc: "Expose contradictions in their record" },
  { id: "voter_appeal", label: "Voter Appeal", desc: "Appeal directly to the electorate" },
];

export default function PlayerAttackPanel({ onAttack, disabled, lastResult }: Props) {
  const [selectedAction, setSelectedAction] = useState("policy_critique");
  const [targetId, setTargetId] = useState(CANDIDATES[0]?.id || "dharma_rakshak");
  const [narrative, setNarrative] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    if (!narrative.trim()) return;
    onAttack(selectedAction, targetId, narrative.trim());
    setNarrative("");
  };

  return (
    <div className="panel-section">
      <button
        className="rpg-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{ marginBottom: isOpen ? "12px" : "0" }}
      >
        {isOpen ? "Close Attack Panel" : "Launch Attack"}
      </button>

      {isOpen && (
        <div className="attack-panel">
          {/* Action Type */}
          <div className="attack-field">
            <label className="attack-label">Action Type</label>
            <select
              className="attack-select"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
            >
              {ACTION_TYPES.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.label}
                </option>
              ))}
            </select>
            <div className="attack-desc">
              {ACTION_TYPES.find((a) => a.id === selectedAction)?.desc}
            </div>
          </div>

          {/* Target */}
          <div className="attack-field">
            <label className="attack-label">Target</label>
            <select
              className="attack-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {CANDIDATES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Narrative */}
          <div className="attack-field">
            <label className="attack-label">Your Statement</label>
            <textarea
              className="attack-textarea"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Write your political statement..."
              rows={3}
            />
          </div>

          <button
            className="rpg-btn"
            onClick={handleSubmit}
            disabled={!narrative.trim() || disabled}
            style={{ background: "var(--accent-red)", borderColor: "var(--accent-red)" }}
          >
            Submit to Shield
          </button>

          {/* Last result */}
          {lastResult && (
            <div className={`attack-result ${lastResult.verdict === "BLOCKED" ? "result-blocked" : "result-allowed"}`}>
              <span className="attack-result-label">{lastResult.verdict}</span>
              <span className="attack-result-reason">{lastResult.reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
