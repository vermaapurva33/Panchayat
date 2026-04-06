interface Props {
  name: string;
  text: string;
  color: string;
  onClose: () => void;
}

export default function SpeechBubble({ name, text, color, onClose }: Props) {
  return (
    <div className="dialogue-box">
      <button className="dialogue-close" onClick={onClose}>✖</button>
      <div className="dialogue-name" style={{ color }}>{name}</div>
      <div className="dialogue-text">"{text}"</div>
    </div>
  );
}
