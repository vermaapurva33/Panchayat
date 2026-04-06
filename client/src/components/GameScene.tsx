import { CANDIDATES, PLAYER } from "../data/gameData";
import ManifestoPopup from "./ManifestoPopup";
import { getPoliciesForRound } from "../data/gameData";
import type { ActionEntry } from "./ActionFeed";

interface Props {
  showManifesto: boolean;
  onCloseManifesto: () => void;
  onSelectAction: (action: string) => void;
  activeDialog: string | null;
  onOpenDialog: (cid: string | null) => void;
  onDismissDialog: () => void;
  reactions: Record<string, { name: string; reaction: string }>;
  aiPicks: Record<string, string>;
  thinkingCandidates: Set<string>;
  activeAnnouncer: string | null;
  round: number;
  maxRounds: number;
  latestAction: ActionEntry | null;
  forecast: { vote_shares: Record<string, number> };
}

export default function GameScene({
  showManifesto,
  onCloseManifesto,
  onSelectAction,
  activeDialog,
  onOpenDialog,
  onDismissDialog,
  reactions,
  aiPicks,
  thinkingCandidates,
  activeAnnouncer,
  round,
  maxRounds,
  latestAction,
  forecast,
}: Props) {
  const spriteOrder = ["dharma_rakshak", "vikas_purush", "jan_neta", "mukti_devi", "player"];
  const totalCharacters = spriteOrder.length;
  const radius = 200;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="game-environment">
      {/* ─── Newspaper Masthead ─── */}
      <div className="newspaper-masthead">
        <div className="masthead-title">The Daily Panchayat</div>
        <div className="masthead-subtitle">
          All the Policy That's Fit to Debate
        </div>
        <div className="masthead-rule">
          <span>{dateStr}</span>
          <span>Round {round} of {maxRounds}</span>
          <span>Panchayat, India</span>
        </div>
      </div>

      {/* Parliament watermark */}
      <div className="parliament-bg" />

      {/* ─── Attack Flash Banner ─── */}
      {latestAction && (
        <div className={`attack-flash ${latestAction.verdict === "BLOCKED" ? "attack-flash-blocked" : "attack-flash-allowed"}`}>
          <span className="attack-flash-stamp">
            {latestAction.verdict === "BLOCKED" ? "BLOCKED" : "ATTACK"}
          </span>
          <span className="attack-flash-text">
            {latestAction.candidateName.split(" ")[0]}
            {" \u2192 "}
            {latestAction.targetName.split(" ")[0]}
            {": "}
            {latestAction.narrative.length > 60 ? latestAction.narrative.slice(0, 60) + "..." : latestAction.narrative}
          </span>
        </div>
      )}

      {/* ─── Static Circle Arena ─── */}
      <div className="orbit-container">
        {spriteOrder.map((cid, index) => {
          const candidate =
            cid === "player"
              ? PLAYER
              : CANDIDATES.find((c) => c.id === cid);
          if (!candidate) return null;

          const hasReaction = !!reactions[cid];
          const isThinking = thinkingCandidates.has(cid);
          const isActive = activeAnnouncer === cid || activeDialog === cid;
          const aiPick = aiPicks[cid];
          const voteShare = forecast.vote_shares[cid] || 0;

          // Is this character being attacked right now?
          const isBeingAttacked = latestAction?.target === cid && latestAction?.verdict === "ALLOWED";
          const isAttacking = latestAction?.candidate === cid && latestAction?.verdict === "ALLOWED";

          // Static circle position
          const angleDeg = (360 / totalCharacters) * index - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const xPos = 50 + (radius / 5) * Math.cos(angleRad);
          const yPos = 50 + (radius / 5) * Math.sin(angleRad);

          return (
            <div
              key={cid}
              className={`character-sprite-wrapper${isActive ? " active" : ""}${hasReaction ? " has-reaction" : ""}${isBeingAttacked ? " under-attack" : ""}${isAttacking ? " attacking" : ""}`}
              style={{
                top: `${yPos}%`,
                left: `${xPos}%`,
                transform: `translate(-50%, -50%)${isActive ? " scale(1.2)" : ""}`,
                zIndex: isActive ? 50 : isAttacking ? 40 : 3,
              }}
              onClick={() => {
                if (hasReaction) onOpenDialog(cid);
              }}
            >
              {/* Thinking indicator */}
              {isThinking && !hasReaction && (
                <div className="thinking-icon">composing...</div>
              )}

              {/* Free-floating caricature */}
              <div
                className="character-sprite"
                style={{
                  backgroundImage: `url('/assets/${cid}.png')`,
                }}
              />

              {/* Name */}
              <div className="character-nameplate">
                {candidate.name.split(" ").slice(0, 2).join(" ")}
              </div>

              {/* Vote share badge */}
              <div className="vote-badge" style={{
                color: voteShare >= 25 ? "var(--accent-red)" : "var(--ink-faded)",
                fontWeight: voteShare >= 25 ? "900" : "400",
              }}>
                {voteShare.toFixed(1)}%
              </div>

              {/* Manifesto label */}
              {aiPick && (
                <div className="ai-pick-label">
                  {aiPick.length > 32 ? aiPick.slice(0, 32) + "..." : aiPick}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Speech Bubble — Newspaper Editorial ─── */}
      {activeDialog && reactions[activeDialog] && (() => {
        const candidate = CANDIDATES.find(c => c.id === activeDialog);
        return (
          <div className="speech-bubble">
            <div className="desk-kicker">Opinion Column</div>
            <div className="desk-headline" style={{ fontSize: "18px", marginBottom: "4px" }}>
              {reactions[activeDialog].name}
            </div>
            <div style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: "10px",
              color: "var(--ink-faded)",
              marginBottom: "12px",
              paddingBottom: "8px",
              borderBottom: "1px solid var(--rule-thin)",
              letterSpacing: "0.5px",
            }}>
              {candidate?.party || "Independent"} — Correspondent
            </div>
            <div className="speech-bubble-text">
              {reactions[activeDialog].reaction}
            </div>
            <button
              className="speech-bubble-close"
              onClick={onDismissDialog}
            >
              Next
            </button>
          </div>
        );
      })()}

      {/* ─── Manifesto Newspaper (Slide Edition) ─── */}
      {showManifesto && (
        <ManifestoPopup
          options={getPoliciesForRound(round + 1)}
          onSelect={(action) => {
            onCloseManifesto();
            onSelectAction(action);
          }}
          onClose={onCloseManifesto}
        />
      )}
    </div>
  );
}
