import { useState } from "react";

interface Policy {
  id: number;
  category: string;
  title: string;
  emoji: string;
}

interface Props {
  options: Policy[];
  onSelect: (action: string) => void;
  onClose: () => void;
}

// Generate a filler description for each policy to fill the newspaper column
function generateDescription(title: string): string {
  return `This landmark proposal — "${title}" — has emerged as one of the most debated policy positions in this election cycle. Experts on both sides of the aisle weigh in with strong opinions. Proponents argue it could fundamentally reshape the socioeconomic landscape of the Panchayat, while critics urge caution, citing implementation costs and potential unintended consequences for rural stakeholders. The electorate watches closely as the campaign trail heats up.`;
}

export default function ManifestoPopup({ options, onSelect, onClose }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const total = options.length;
  const policy = options[currentSlide];

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const categoryLabel = policy.category.replace(/_/g, " ").toUpperCase();

  return (
    <div className="manifesto-overlay" onClick={onClose}>
      <div
        className="manifesto-newspaper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Newspaper Masthead */}
        <div className="news-masthead">
          <div className="news-masthead-title">The Panchayat Times</div>
          <div className="news-masthead-sub">
            Manifesto Special Edition
          </div>
          <div className="news-masthead-info">
            <span>{dateStr}</span>
            <span>Policy Bureau</span>
            <span>Vol. I</span>
          </div>
        </div>

        {/* Slide Navigator */}
        <div className="slide-nav">
          <button
            className="slide-nav-btn"
            onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
            disabled={currentSlide === 0}
          >
            Prev
          </button>
          <span className="slide-nav-indicator">
            {currentSlide + 1} of {total}
          </span>
          <button
            className="slide-nav-btn"
            onClick={() => setCurrentSlide((p) => Math.min(total - 1, p + 1))}
            disabled={currentSlide === total - 1}
          >
            Next
          </button>
        </div>

        {/* Slide Content */}
        <div className="slide-content">
          <div className="slide-category-title">{categoryLabel}</div>
          <h2 className="slide-headline">{policy.title}</h2>
          <div className="slide-description">
            {generateDescription(policy.title)}
          </div>
          <button
            className="slide-select-btn"
            onClick={() => onSelect(policy.title)}
          >
            Adopt This Policy
          </button>
        </div>

        {/* Footer */}
        <div className="news-footer">
          <button className="news-close-btn" onClick={onClose}>
            Close Edition
          </button>
        </div>
      </div>
    </div>
  );
}
