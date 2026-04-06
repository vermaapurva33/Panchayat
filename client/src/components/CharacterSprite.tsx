import type { CandidateData } from "../data/gameData";

interface Props {
  candidate: CandidateData;
  isThinking?: boolean;
  isAnnouncing?: boolean;
  hasMessage?: boolean;
  aiPick?: string;
  spriteIndex: number;
  onClickMessage?: () => void;
}

export default function CharacterSprite({
  candidate,
  isThinking,
  isAnnouncing,
  hasMessage,
  aiPick,
  spriteIndex,
  onClickMessage,
}: Props) {
  const bgPositionX = `${spriteIndex * 25}%`;

  return (
    <div
      className={`character-sprite-wrapper ${isAnnouncing ? "announcing" : ""}`}
      onClick={hasMessage ? onClickMessage : undefined}
    >
      {/* Icons above character */}
      {isThinking && !hasMessage && (
        <div className="thinking-icon">...</div>
      )}
      {hasMessage && !isThinking && (
        <div className="message-icon" title="Click to read reaction" />
      )}

      {/* The Sprite */}
      <div
        className={`character-sprite ${isThinking ? "thinking" : ""} ${candidate.id === "player" ? "character-glow" : ""} ${isAnnouncing ? "announcing-glow" : ""}`}
        style={{
          backgroundImage: "url('/assets/sprites.png')",
          backgroundPosition: `${bgPositionX} top`,
          backgroundSize: "500% 100%",
          color: candidate.color,
        }}
      />

      {/* Name plate */}
      <div className="character-nameplate" style={{ borderColor: candidate.color }}>
        {candidate.name.split(" ")[0]}
      </div>

      {/* AI pick label */}
      {aiPick && (
        <div className="ai-pick-label" style={{ borderColor: candidate.color, color: candidate.color }}>
          {aiPick}
        </div>
      )}
    </div>
  );
}
