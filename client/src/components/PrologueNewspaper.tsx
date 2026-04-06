import { useState, useEffect, useRef, useCallback } from "react";
import "../prologue.css";

interface PrologueNewspaperProps {
  onComplete: () => void;
}

// ── Typewriter Hook ─────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

// ── Stamp Component ─────────────────────────────────────────────────────────
function InkStamp({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="prologue-stamp"
      style={{ borderColor: color, color }}
    >
      {label}
    </div>
  );
}

// ── Redacted Text Component ──────────────────────────────────────────────────
function Redacted({ children }: { children: React.ReactNode }) {
  return <span className="prologue-redact">{children}</span>;
}

// ── Slide 0: Front Page ─────────────────────────────────────────────────────
function SlideFrontPage() {
  const { displayed } = useTypewriter(
    "FOUR CANDIDATES, ONE VILLAGE, EVERYTHING AT STAKE"
  );
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-kicker">SPECIAL ELECTION EVE EDITION · RAMPUR PANCHAYAT</div>
      <div className="prologue-banner-headline">{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-deck">
        A Traditionalist, a Technocrat, a Socialist, and a Capitalist enter the arena.
        Only one will lead Rampur Panchayat. Study them well — the election begins at dawn.
      </div>
      <div className="prologue-rule" />
      <div className="prologue-candidate-grid">
        {[
          { img: "/assets/dharma_rakshak.png", name: "Pt. Vedprakash Shastri", party: "Sanskriti Seva Dal", label: "TRADITIONALIST", color: "#b84420" },
          { img: "/assets/vikas_purush.png",   name: "Arjun Mehra",           party: "Digital Bharat Front", label: "TECHNO-POPULIST",  color: "#1a6e5e" },
          { img: "/assets/jan_neta.png",        name: "Comrade Meera Devi",   party: "Samta Shakti Morcha", label: "SOCIALIST",        color: "#8B0000" },
          { img: "/assets/mukti_devi.png",      name: "Nandini Krishnamurthy",party: "Swatantra Vikas Party",label: "LIBERTARIAN",     color: "#4a2d78" },
        ].map((c) => (
          <div key={c.name} className="prologue-candidate-card">
            <div className="prologue-candidate-img-wrap">
              <img src={c.img} alt={c.name} className="prologue-candidate-img" />
              <InkStamp label={c.label} color={c.color} />
            </div>
            <div className="prologue-candidate-name" style={{ color: c.color }}>{c.name}</div>
            <div className="prologue-candidate-party">{c.party}</div>
          </div>
        ))}
      </div>
      <div className="prologue-rule" />
      <div className="prologue-breaking-banner">
        BREAKING — 5 ROUNDS BEGIN AT DAWN · SHIELD ENFORCEMENT ACTIVE · ELECTION COMMISSION ON ALERT
      </div>
      <div className="prologue-classifieds">
        <span>CLASSIFIED: Rampur District Collectorate — Polling Booth Assignments Published, See Page 14</span>
        <span>WEATHER: Clear skies expected on Election Day. High 34°C. Voter turnout forecast: HIGH.</span>
      </div>
    </div>
  );
}

// ── Slide 1: Dharma Rakshak ─────────────────────────────────────────────────
function SlideDharma() {
  const { displayed } = useTypewriter(
    "SACRED TRUST OR SACRED SCAM? SHASTRI'S DHARMA RAKSHA TRUST UNDER SCRUTINY"
  );
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-section-tag">POLITICS — EXCLUSIVE INVESTIGATION</div>
      <div className="prologue-stamp-corner">
        <InkStamp label="TRADITIONALIST" color="#b84420" />
      </div>
      <div className="prologue-main-headline" style={{ color: "#b84420" }}>{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-byline">By Our Political Correspondent · RTI Desk · Page 1</div>
      <div className="prologue-rule" />
      <div className="prologue-two-col">
        <div className="prologue-col">
          <p className="prologue-body-text">
            A Right to Information filing obtained by this newspaper reveals that <strong>₹2.3 crore</strong> donated
            to Pt. Vedprakash Shastri's "Dharma Raksha Trust" was withdrawn in cash over six months.
            Cross-referencing RTO records shows a luxury SUV — <em>valued at ₹18 lakh</em> — registered
            in the name of a close relative shortly after. Temple donor lists contain{" "}
            <Redacted>ghost entries across pages 4–9</Redacted>.
          </p>
          <p className="prologue-body-text">
            The Trust's stated purpose — restoring temples in rural Madhya Pradesh — matches
            zero verified disbursements in three years of filings. District auditors flagged
            the discrepancy in 2023 but their report was{" "}
            <Redacted>suppressed at the divisional level</Redacted>.
          </p>
          <div className="prologue-cont-ref">▶ RTI FILE #MP/2023/4451 · CONT. ON PAGE 7</div>
        </div>
        <div className="prologue-col">
          <div className="prologue-sidebar-box">
            <div className="prologue-sidebar-kicker">IDEOLOGICAL PROFILE</div>
            <p className="prologue-body-text">
              Shastri rose to prominence through the <em>Gau Seva Andolan</em> of the 1990s. 
              A former Sanskrit professor, he quotes the Arthashastra in every debate — yet critics 
              say his policies serve the temple economy, not the farmer.
            </p>
            <p className="prologue-body-text">
              <strong>Strategic Hint:</strong> His strength is with <em>Kisan</em> and <em>Sarkari</em> demographics. 
              Technology and youth-oriented policies cut deep.
            </p>
          </div>
          <div className="prologue-pull-quote">
            "These are fabricated documents by anti-Hindu forces trying to defame our dharmic mission."
            <span className="prologue-attribution">— Pt. Vedprakash Shastri, responding to RTI</span>
          </div>
        </div>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-footer-note">
        Dalit workers at Shastri's model gaushala report being forced to use separate utensils.
        Video evidence surfaced on social media. The candidate has not responded to our requests.{" "}
        <span className="prologue-cont-ref">CONT. PAGE 3 →</span>
      </div>
    </div>
  );
}

// ── Slide 2: Vikas Purush ───────────────────────────────────────────────────
function SlideVikas() {
  const { displayed } = useTypewriter(
    "THREE LAKH FARMERS' DATA: SOLD TO BEIJING? THE PAYGRAM SCANDAL"
  );
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-section-tag">TECHNOLOGY — SPECIAL INVESTIGATION</div>
      <div className="prologue-stamp-corner">
        <InkStamp label="TECHNO-POPULIST" color="#1a6e5e" />
      </div>
      <div className="prologue-main-headline" style={{ color: "#1a6e5e" }}>{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-byline">By Our Technology Correspondent · Data Desk · Page 1</div>
      <div className="prologue-rule" />
      <div className="prologue-two-col">
        <div className="prologue-col">
          <p className="prologue-body-text">
            A former senior engineer at <strong>PayGram</strong> — Arjun Mehra's fintech startup —
            has filed an affidavit with the RBI citing systematic transfer of rural financial data
            to servers identified as Beijing-based ad-tech infrastructure. The RBI issued a{" "}
            <Redacted>classified notice to PayGram's board</Redacted> in March 2024.
          </p>
          <p className="prologue-body-text">
            Server logs accessed by this newspaper show <strong>3,14,000 user records</strong> — 
            including UPI transaction histories of village-level accounts — transferred over 14 months.
            Mehra's campaign call this "a vendor-side issue, resolved in 48 hours."
          </p>
          <div className="prologue-redact-block">
            SERVER LOG EXCERPT [REDACTED ON LEGAL ORDERS — HIGH COURT ORDER #HC/2024/1187]
          </div>
        </div>
        <div className="prologue-col">
          <div className="prologue-sidebar-box">
            <div className="prologue-sidebar-kicker">GROUND REPORT</div>
            <p className="prologue-body-text">
              Our reporter waited <strong>4 hours</strong> at a village visit listed on Arjun Mehra's 
              campaign schedule. He arrived for 28 minutes. The "villagers" in the photos were later 
              identified as Digital Bharat Front party workers.
            </p>
            <p className="prologue-body-text">
              <strong>Strategic Hint:</strong> His natural allies are <em>Yuva</em> and <em>Vyapari</em>. 
              Rural demographics — especially Kisan and Gramin Nari — are deeply suspicious.
            </p>
          </div>
          <div className="prologue-pull-quote">
            "Think of governance as a platform. Citizens are the users."
            <span className="prologue-attribution">— Arjun Mehra, at an English-only Town Hall</span>
          </div>
        </div>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-footer-note">
        Three consecutive town halls conducted entirely in English. Viral clips show confused elderly 
        farmers while Mehra explained "blockchain governance" to an empty hall.{" "}
        <span className="prologue-cont-ref">CONT. PAGE 5 →</span>
      </div>
    </div>
  );
}

// ── Slide 3: Jan Neta ───────────────────────────────────────────────────────
function SlideJanNeta() {
  const { displayed } = useTypewriter(
    "ROTI ANDOLAN HERO OR ARSONIST? THE FIRE THAT SPLIT A DISTRICT"
  );
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-section-tag">LABOUR DESK — GROUND REPORT</div>
      <div className="prologue-stamp-corner">
        <InkStamp label="SOCIALIST REFORMER" color="#8B0000" />
      </div>
      <div className="prologue-main-headline" style={{ color: "#8B0000" }}>{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-byline">By Our Labour Correspondent · Jharkhand Bureau · Page 1</div>
      <div className="prologue-rule" />
      <div className="prologue-two-col">
        <div className="prologue-col">
          <p className="prologue-body-text">
            FIR #345/2022 names Comrade Meera Devi Yadav in connection with the{" "}
            <strong>Roti Andolan</strong> — during which 15 government vehicles were destroyed 
            and a Block Development Office was set ablaze. Three police constables were hospitalised.
          </p>
          <p className="prologue-body-text">
            CCTV footage from the district collectorate shows individuals in Samta Shakti Morcha 
            t-shirts leading the arson. The candidate has <Redacted>never formally disavowed</Redacted>{" "}
            the individuals charged, claiming "when the system is deaf, the people have a right to be heard."
          </p>
          <div className="prologue-cont-ref">▶ FIR DOCUMENT #345/2022 · CONT. ON PAGE 3</div>
        </div>
        <div className="prologue-col">
          <div className="prologue-sidebar-box">
            <div className="prologue-sidebar-kicker">THE NUMBERS DON'T ADD UP</div>
            <p className="prologue-body-text">
              An independent analysis by NIPFP economists shows Meera Devi's promises —
              MNREGA expansion, land redistribution, free healthcare — would cost{" "}
              <strong>₹4,700 crore</strong>.
            </p>
            <p className="prologue-body-text">
              The district's total annual budget: <strong>₹580 crore</strong>.
            </p>
            <p className="prologue-body-text">
              <strong>Strategic Hint:</strong> Devastating against Vyapari and Sarkari demographics. 
              Her Kisan and Gramin Nari base is loyal but narrow.
            </p>
          </div>
          <div className="prologue-pull-quote">
            "Zameen jotne wale ki — land belongs to those who till it."
            <span className="prologue-attribution">— Comrade Meera Devi Yadav</span>
          </div>
        </div>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-footer-note">
        After Meera Devi's rally threatening to "shut down every factory that doesn't share profits," 
        three planned investments were withdrawn from the district — textile, food processing, solar.{" "}
        <span className="prologue-cont-ref">CONT. PAGE 6 →</span>
      </div>
    </div>
  );
}

// ── Slide 4: Mukti Devi ─────────────────────────────────────────────────────
function SlideMuktiDevi() {
  const { displayed } = useTypewriter(
    "THE THINK TANK AND ITS DONORS: POLICY FOR SALE IN RAMPUR?"
  );
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-section-tag">BUSINESS & ECONOMY — INVESTIGATION</div>
      <div className="prologue-stamp-corner">
        <InkStamp label="CORPORATE LIBERTARIAN" color="#4a2d78" />
      </div>
      <div className="prologue-main-headline" style={{ color: "#4a2d78" }}>{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-byline">By Our Economics Correspondent · Finance Desk · Page 1</div>
      <div className="prologue-rule" />
      <div className="prologue-two-col">
        <div className="prologue-col">
          <p className="prologue-body-text">
            FCRA filings obtained under RTI reveal that Nandini Krishnamurthy's{" "}
            <strong>Pragati Foundation</strong> received ₹5 crore from Monsanto India,
            Reliance Retail, and Adani Ports — the precise companies that would benefit
            from her deregulation and privatisation agenda.
          </p>
          <p className="prologue-body-text">
            The donor list in Foundation Annual Report 2022–23:{" "}
            <Redacted>See Annexure C [CONFIDENTIAL — PENDING COURT ORDER]</Redacted>.
            Policy recommendations published six weeks after donations were received match 
            donor interests with{" "}
            <Redacted>statistical precision flagged by an internal auditor</Redacted>.
          </p>
          <div className="prologue-cont-ref">▶ FCRA FILING #F/2023/PRG · CONT. ON PAGE 8</div>
        </div>
        <div className="prologue-col">
          <div className="prologue-sidebar-box">
            <div className="prologue-sidebar-kicker">THE PAPER THAT HAUNTS HER</div>
            <p className="prologue-body-text">
              In 2019, Nandini authored an academic paper: <em>"Phase Out MSP Within 3 Years 
              and Replace with Market Discovery Prices."</em>
            </p>
            <p className="prologue-body-text">
              Farmer unions have photocopied it 10,000 times and pinned it at every mandal gate 
              in the district.
            </p>
            <p className="prologue-body-text">
              <strong>Strategic Hint:</strong> Catastrophic with Kisan (-25 pts). Strong with 
              Vyapari and Yuva. Her green card (surrendered 11 months ago) is an easy target.
            </p>
          </div>
          <div className="prologue-pull-quote">
            "Research funding is standard practice globally. Our recommendations are evidence-based."
            <span className="prologue-attribution">— Nandini Krishnamurthy, Pragati Foundation</span>
          </div>
        </div>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-footer-note">
        Krishnamurthy surrendered her American green card 11 months ago. Her children study 
        at a US university. Opposition calls her "Lutyens Delhi in Rampur clothes."{" "}
        <span className="prologue-cont-ref">CONT. PAGE 9 →</span>
      </div>
    </div>
  );
}

// ── Slide 5: Editorial ──────────────────────────────────────────────────────
function SlideEditorial() {
  const { displayed } = useTypewriter("THE SILENT FIFTH: WHO ARE YOU?");
  return (
    <div className="prologue-slide-inner">
      <div className="prologue-section-tag">THE EDITOR'S DESK — OPINION</div>
      <div className="prologue-main-headline">{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-byline">By The Editor · The Daily Panchayat · Election Eve</div>
      <div className="prologue-rule" />
      <div className="prologue-editorial-text">
        <p>
          Four known quantities enter this election. Each carries baggage. Each has a constituency.
          Each has a weakness that a shrewd opponent can exploit — and each has a base of voters
          who will follow them regardless of scandal.
        </p>
        <p>
          But there is a fifth name on the ballot. An independent. Unknown. Unencumbered by 
          a party machinery, unprotected by a donor network — and unburdened by history.
          <em> That candidate is you.</em>
        </p>
        <p>
          In five rounds, you will announce policies. They will react. They will attack.
          You will enter the War Room and decide how to strike back. Every action is logged.
          Every illegal move is caught. The Election Commission is watching.
        </p>
        <p>
          Study the dossiers. Know your enemies. Choose your manifesto wisely.
          In a Panchayat election, the margin between victory and disgrace is a single policy choice.
        </p>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-ideology-grid">
        <div className="prologue-ideology-title">CANDIDATE IDEOLOGY MATRIX — ECONOMY vs. WELFARE</div>
        <div className="prologue-matrix">
          {/* Quadrant labels */}
          <div className="prologue-matrix-label top-left">HIGH WELFARE · LOW MARKET</div>
          <div className="prologue-matrix-label top-right">HIGH WELFARE · HIGH MARKET</div>
          <div className="prologue-matrix-label bottom-left">LOW WELFARE · LOW MARKET</div>
          <div className="prologue-matrix-label bottom-right">LOW WELFARE · HIGH MARKET</div>
          {/* Candidates plotted: economy x=30/welfare y=45 → dharma; economy=75/welfare=35 → vikas; economy=15/welfare=95 → jan_neta; economy=95/welfare=10 → mukti */}
          <div className="prologue-matrix-dot" style={{ left: "25%", top: "20%", background: "#8B0000" }} title="Comrade Meera Devi — Jan Neta">M</div>
          <div className="prologue-matrix-dot" style={{ left: "28%", top: "55%", background: "#b84420" }} title="Pt. Vedprakash Shastri — Dharma Rakshak">V</div>
          <div className="prologue-matrix-dot" style={{ left: "72%", top: "35%", background: "#1a6e5e" }} title="Arjun Mehra — Vikas Purush">A</div>
          <div className="prologue-matrix-dot" style={{ left: "93%", top: "88%", background: "#4a2d78" }} title="Nandini Krishnamurthy — Mukti Devi">N</div>
          <div className="prologue-matrix-crosshair-h" />
          <div className="prologue-matrix-crosshair-v" />
        </div>
        <div className="prologue-matrix-axes">
          <span>← SOCIALIST</span>
          <span>ECONOMY AXIS</span>
          <span>FREE MARKET →</span>
        </div>
      </div>
    </div>
  );
}

// ── Slide 6: Election Morning ───────────────────────────────────────────────
function SlideElectionMorning({ onComplete }: { onComplete: () => void }) {
  const { displayed } = useTypewriter("POLLS OPEN IN RAMPUR — MAY THE BEST CANDIDATE WIN");
  return (
    <div className="prologue-slide-inner prologue-final-slide">
      <div className="prologue-section-tag">MORNING EXTRA — ELECTION DAY</div>
      <div className="prologue-banner-headline prologue-final-headline">{displayed}<span className="prologue-cursor">|</span></div>
      <div className="prologue-rule" />
      <div className="prologue-final-columns">
        <div className="prologue-final-col">
          <div className="prologue-sidebar-kicker">YOUR MISSION</div>
          <p className="prologue-body-text">
            You are the <strong>independent candidate</strong> of Rampur Panchayat.
            No party funds. No legacy. No safety net. Five rounds of policy debates,
            cross-candidate attacks, and War Room strikes.
          </p>
          <p className="prologue-body-text">
            Choose your manifesto from 50 real Indian policy proposals. Watch four AI politicians
            react — each in character, each with a voice. Then enter the War Room and choose
            your attack. The Shield watches everything.
          </p>
        </div>
        <div className="prologue-final-col">
          <div className="prologue-sidebar-kicker">THE RULES</div>
          <p className="prologue-body-text">
            PERMITTED — Policy critiques, public challenges, voter appeals — <strong>ALLOWED</strong>
          </p>
          <p className="prologue-body-text">
            PROHIBITED — Communal incitement, personal attacks, bribery — <strong>BLOCKED by Shield</strong>
          </p>
          <p className="prologue-body-text">
            Every action is logged to the audit trail. The Election Commission is watching.
            India's democracy is not a game — but today, it's yours to play.
          </p>
        </div>
      </div>
      <div className="prologue-rule" />
      <div className="prologue-begin-banner">
        <div className="prologue-begin-kicker">THE ELECTION IS NOW OPEN</div>
        <button className="prologue-begin-btn" onClick={onComplete}>
          BEGIN ELECTION
        </button>
        <div className="prologue-begin-sub">
          ArmorIQ Shield Active · 5 Rounds · Rampur Panchayat
        </div>
      </div>
    </div>
  );
}

// ── BGM Controller ──────────────────────────────────────────────────────────
function useBGM() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const start = useCallback(() => {
    if (audioRef.current) return;
    // Royalty-free newsroom/typewriter ambient track from Pixabay CDN
    const audio = new Audio(
      "https://cdn.pixabay.com/audio/2022/10/30/audio_adb89b0e2b.mp3"
    );
    audio.loop = true;
    audio.volume = 0.18;
    audio.play().catch(() => {/* autoplay blocked, user hasn't interacted */});
    audioRef.current = audio;
  }, []);

  const stop = useCallback((fadeDuration = 1500) => {
    const audio = audioRef.current;
    if (!audio) return;
    const startVol = audio.volume;
    const step = startVol / (fadeDuration / 50);
    const fade = setInterval(() => {
      if (audio.volume > step) {
        audio.volume -= step;
      } else {
        audio.pause();
        audio.currentTime = 0;
        clearInterval(fade);
        audioRef.current = null;
      }
    }, 50);
  }, []);

  return { start, stop };
}

// ── SLIDES CONFIG ────────────────────────────────────────────────────────────
const SLIDE_META = [
  { label: "Front Page",     section: "ELECTION EVE SPECIAL" },
  { label: "Dharma Rakshak", section: "POLITICS — INVESTIGATION" },
  { label: "Vikas Purush",   section: "TECHNOLOGY — REPORT" },
  { label: "Jan Neta",       section: "LABOUR DESK" },
  { label: "Mukti Devi",     section: "BUSINESS & ECONOMY" },
  { label: "Editorial",      section: "EDITOR'S DESK" },
  { label: "Election Day",   section: "MORNING EXTRA" },
];

// ── Main Prologue Component ─────────────────────────────────────────────────
export default function PrologueNewspaper({ onComplete }: PrologueNewspaperProps) {
  const [slide, setSlide] = useState(0);
  const { start: startBGM, stop: stopBGM } = useBGM();
  const totalSlides = SLIDE_META.length;

  // Start BGM on first user interaction
  const handleStart = useCallback(() => {
    startBGM();
  }, [startBGM]);

  // Navigate
  const goNext = () => {
    if (slide < totalSlides - 1) setSlide(slide + 1);
  };
  const goPrev = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  const handleComplete = () => {
    stopBGM(1500);
    setTimeout(onComplete, 1600);
  };

  const renderSlide = () => {
    switch (slide) {
      case 0: return <SlideFrontPage />;
      case 1: return <SlideDharma />;
      case 2: return <SlideVikas />;
      case 3: return <SlideJanNeta />;
      case 4: return <SlideMuktiDevi />;
      case 5: return <SlideEditorial />;
      case 6: return <SlideElectionMorning onComplete={handleComplete} />;
      default: return null;
    }
  };

  return (
    <div className="prologue-overlay" onClick={handleStart}>
      {/* Newspaper container */}
      <div className="prologue-newspaper">
        {/* Masthead */}
        <div className="prologue-masthead">
          <div className="prologue-masthead-top-rule" />
          <div className="prologue-masthead-title">The Daily Panchayat</div>
          <div className="prologue-masthead-sub">
            Established 1947 · "Truth, Policy & Democracy" · Rampur Special Edition
          </div>
          <div className="prologue-masthead-info">
            <span>VOL. LXXVIII · No. 142</span>
            <span>ELECTION EVE SPECIAL · 2026</span>
            <span>Price: ₹3.50</span>
          </div>
          <div className="prologue-masthead-bottom-rule" />
        </div>

        {/* Section nav bar */}
        <div className="prologue-section-nav">
          {SLIDE_META.map((m, i) => (
            <button
              key={i}
              className={`prologue-section-tab ${i === slide ? "active" : ""}`}
              onClick={() => { setSlide(i); handleStart(); }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Slide content */}
        <div className="prologue-content" key={slide}>
          {renderSlide()}
        </div>

        {/* Navigation footer */}
        <div className="prologue-nav-footer">
          <button
            className="prologue-nav-btn"
            onClick={() => { goPrev(); handleStart(); }}
            disabled={slide === 0}
          >
            ← Previous
          </button>

          {/* Dot tracker */}
          <div className="prologue-dots">
            {SLIDE_META.map((_, i) => (
              <div
                key={i}
                className={`prologue-dot ${i === slide ? "active" : ""}`}
                onClick={() => { setSlide(i); handleStart(); }}
              />
            ))}
          </div>

          <button
            className="prologue-nav-btn"
            onClick={() => { goNext(); handleStart(); }}
            disabled={slide === totalSlides - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
