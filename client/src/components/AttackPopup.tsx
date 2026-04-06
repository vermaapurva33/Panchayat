import { useState, useEffect } from "react";
import { CANDIDATES } from "../data/gameData";
import { getWarroomAttacks, type WarroomAttack } from "../api/bridge";
import type { ActionEntry } from "./ActionFeed";

interface Props {
  onAttack: (actionType: string, targetId: string, narrative: string) => void;
  onClose: () => void;
  politicalActions: ActionEntry[];
  forecast: { vote_shares: Record<string, number> };
  round: number;
}

export default function AttackPopup({
  onAttack,
  onClose,
  politicalActions,
  forecast,
  round,
}: Props) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedAttack, setSelectedAttack] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attacks, setAttacks] = useState<WarroomAttack[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch attacks from API when target changes
  useEffect(() => {
    if (!selectedTarget) {
      setAttacks([]);
      return;
    }
    setLoading(true);
    getWarroomAttacks(selectedTarget)
      .then((data) => setAttacks(data.attacks))
      .catch(() => setAttacks([]))
      .finally(() => setLoading(false));
  }, [selectedTarget]);

  const handleSubmit = () => {
    if (!selectedTarget || selectedAttack === null || !attacks[selectedAttack]) return;
    const atk = attacks[selectedAttack];
    setSubmitted(true);
    onAttack(atk.actionType, selectedTarget, atk.narrative);
  };

  const getCandidateIntel = (cid: string) => {
    const share = forecast.vote_shares[cid] || 0;
    const actionsAgainstPlayer = politicalActions.filter((a) => a.candidate === cid && a.target === "player");
    return { share, actionsAgainstPlayer };
  };

  const targetCandidate = selectedTarget
    ? CANDIDATES.find((c) => c.id === selectedTarget)
    : null;

  return (
    <div className="attack-overlay">
      <div className="attack-popup">
        {/* Masthead */}
        <div className="attack-masthead">
          <div className="attack-masthead-title">War Room</div>
          <div className="attack-masthead-sub">
            Round {round} — Choose ONE strategic attack
          </div>
          <button className="attack-close-btn" onClick={onClose}>
            Dismiss
          </button>
        </div>

        <div className="attack-columns">
          {/* LEFT: Target Selection */}
          <div className="attack-col-targets">
            <div className="attack-section-title">Select Target</div>
            {CANDIDATES.map((c) => {
              const intel = getCandidateIntel(c.id);
              const isSelected = selectedTarget === c.id;
              return (
                <div
                  key={c.id}
                  className={`target-card ${isSelected ? "target-selected" : ""}`}
                  onClick={() => {
                    setSelectedTarget(c.id);
                    setSelectedAttack(null);
                    setSubmitted(false);
                  }}
                >
                  <div className="target-card-header">
                    <div className="target-avatar" style={{ backgroundImage: `url('/assets/${c.id}.png')` }} />
                    <div className="target-info">
                      <div className="target-name" style={{ color: c.color }}>
                        {c.name.split(" ").slice(0, 2).join(" ")}
                      </div>
                      <div className="target-party">{c.party}</div>
                    </div>
                    <div className="target-share" style={{ color: c.color }}>
                      {intel.share.toFixed(1)}%
                    </div>
                  </div>
                  {intel.actionsAgainstPlayer.length > 0 && (
                    <div className="intel-row intel-hostile" style={{ marginTop: "4px" }}>
                      <span className="intel-label">Attacked You:</span>
                      <span className="intel-value">{intel.actionsAgainstPlayer.length}x</span>
                    </div>
                  )}
                  <div className="target-threat">
                    {intel.share >= 25 ? "HIGH THREAT" : intel.share >= 20 ? "MODERATE" : "LOW THREAT"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Attack Templates */}
          <div className="attack-col-action">
            {selectedTarget && targetCandidate ? (
              <>
                <div className="attack-section-title">
                  Attack {targetCandidate.name.split(" ").slice(0, 2).join(" ")}
                </div>

                {loading ? (
                  <div className="attack-placeholder">
                    <div className="attack-placeholder-text">Loading intelligence...</div>
                  </div>
                ) : (
                  <div className="attack-template-list">
                    {attacks.map((atk, i) => (
                      <div
                        key={i}
                        className={`attack-template-card ${selectedAttack === i ? "template-selected" : ""} ${atk.is_illegal ? "template-illegal" : ""}`}
                        onClick={() => {
                          setSelectedAttack(i);
                          setSubmitted(false);
                        }}
                      >
                        <div className="template-header">
                          <span className="template-type">{atk.actionType.replace(/_/g, " ")}</span>
                          {atk.is_illegal && <span className="template-illegal-badge">OUT OF CODE</span>}
                          <span className="template-label">{atk.label}</span>
                        </div>
                        <div className="template-narrative">
                          "{atk.narrative}"
                        </div>
                        {atk.is_illegal && (
                          <div className="template-warning">
                            Shield will flag this — ArmorIQ enforcement demo
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedAttack !== null && (
                  <button
                    className="attack-submit-btn"
                    onClick={handleSubmit}
                    disabled={submitted}
                  >
                    {submitted
                      ? "Submitted to Shield..."
                      : attacks[selectedAttack]?.is_illegal
                        ? "Test Shield Enforcement"
                        : "Launch Attack"}
                  </button>
                )}
              </>
            ) : (
              <div className="attack-placeholder">
                <div className="attack-placeholder-text">
                  Select a target to see available attack strategies.
                  Includes illegal attacks to demonstrate ArmorIQ Shield enforcement.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
