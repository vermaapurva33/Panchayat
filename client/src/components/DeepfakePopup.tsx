import { useState, useEffect } from "react";
import { CANDIDATES } from "../data/gameData";
import {
  getDeepfakeOptions, deployDeepfake, debunkDeepfake,
  notarizeTruth, getTruthLedger, getActiveDeepfakes,
  type DeepfakeOption, type DeepfakeResult,
  type TruthLedgerEntry, type ActiveDeepfake,
  type ElectionForecast,
} from "../api/bridge";

interface Props {
  round: number;
  forecast: { vote_shares: Record<string, number> };
  onClose: () => void;
  onSentimentUpdate?: (sentiments: Record<string, number>, forecast: ElectionForecast) => void;
}

type DeepfakeTab = "voice_clone" | "truth_ledger";

export default function DeepfakePopup({ round, forecast, onClose, onSentimentUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<DeepfakeTab>("voice_clone");

  // ═══ VOICE CLONE STATE ═══
  const [dfTarget, setDfTarget] = useState<string | null>(null);
  const [dfOptions, setDfOptions] = useState<DeepfakeOption[]>([]);
  const [dfLoading, setDfLoading] = useState(false);
  const [dfSelected, setDfSelected] = useState<number | null>(null);
  const [dfResult, setDfResult] = useState<DeepfakeResult | null>(null);
  const [dfDeploying, setDfDeploying] = useState(false);

  // ═══ TRUTH LEDGER STATE ═══
  const [ledgerEntries, setLedgerEntries] = useState<TruthLedgerEntry[]>([]);
  const [credibility, setCredibility] = useState(0);
  const [notarizing, setNotarizing] = useState(false);
  const [notarizeResult, setNotarizeResult] = useState<string | null>(null);
  const [deepfakesAgainst, setDeepfakesAgainst] = useState<ActiveDeepfake[]>([]);
  const [debunking, setDebunking] = useState<string | null>(null);

  // Fetch deepfake options
  useEffect(() => {
    if (!dfTarget || activeTab !== "voice_clone") return;
    setDfLoading(true);
    getDeepfakeOptions(dfTarget)
      .then((data) => setDfOptions(data.options))
      .catch(() => setDfOptions([]))
      .finally(() => setDfLoading(false));
  }, [dfTarget, activeTab]);

  // Fetch truth ledger
  useEffect(() => {
    if (activeTab !== "truth_ledger") return;
    getTruthLedger("player")
      .then((data) => {
        setLedgerEntries(data.entries);
        setCredibility(data.credibility);
      })
      .catch(() => {});
    getActiveDeepfakes()
      .then((data) => setDeepfakesAgainst(data.against_player))
      .catch(() => {});
  }, [activeTab]);

  const handleDeepfakeDeploy = async () => {
    if (!dfTarget || dfSelected === null || !dfOptions[dfSelected]) return;
    setDfDeploying(true);
    try {
      const result = await deployDeepfake(dfTarget, dfOptions[dfSelected].id);
      setDfResult(result);
      if (result.forecast && result.sentiments) {
        onSentimentUpdate?.(result.sentiments, result.forecast);
      }
      // Play fake audio on success
      if (result.status === "success" && result.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${result.audio_base64}`);
        audio.volume = 0.7;
        audio.play().catch(() => {});
      }
    } catch {
      setDfResult({ status: "error", reason: "Failed to deploy deepfake" });
    }
    setDfDeploying(false);
  };

  const handleNotarize = async () => {
    setNotarizing(true);
    try {
      const result = await notarizeTruth(`Round ${round} manifesto notarization`);
      setNotarizeResult("Statement notarized on Truth Ledger");
      setCredibility(result.credibility);
      setLedgerEntries((prev) => [...prev, result.entry]);
      if (result.forecast && result.sentiments) {
        onSentimentUpdate?.(result.sentiments, result.forecast);
      }
    } catch {
      setNotarizeResult("Notarization failed");
    }
    setNotarizing(false);
  };

  const handleDebunk = async (clipId: string) => {
    setDebunking(clipId);
    try {
      const result = await debunkDeepfake(clipId);
      if (result.status === "debunked") {
        setDeepfakesAgainst((prev) => prev.filter((d) => d.clip_id !== clipId));
        if (result.forecast && result.sentiments) {
          onSentimentUpdate?.(result.sentiments, result.forecast);
        }
      }
    } catch {}
    setDebunking(null);
  };

  return (
    <div className="attack-overlay">
      <div className="attack-popup deepfake-popup">
        {/* Masthead */}
        <div className="attack-masthead df-masthead">
          <div className="attack-masthead-title">MEDIA LAB</div>
          <div className="attack-masthead-sub">
            Voice Cloning & Truth Verification — Round {round}
          </div>
          <button className="attack-close-btn" onClick={onClose}>
            Dismiss
          </button>
        </div>

        {/* Tabs */}
        <div className="warroom-tabs">
          <button
            className={`warroom-tab ${activeTab === "voice_clone" ? "warroom-tab-active df-tab-active" : ""}`}
            onClick={() => setActiveTab("voice_clone")}
          >
            VOICE CLONE
          </button>
          <button
            className={`warroom-tab ${activeTab === "truth_ledger" ? "warroom-tab-active truth-tab-active" : ""}`}
            onClick={() => setActiveTab("truth_ledger")}
          >
            TRUTH LEDGER
          </button>
        </div>

        {/* ═══ VOICE CLONE TAB ═══ */}
        {activeTab === "voice_clone" && (
          <div className="attack-columns">
            <div className="attack-col-targets">
              <div className="attack-section-title">Clone Target Voice</div>
              {CANDIDATES.map((c) => {
                const share = forecast.vote_shares[c.id] || 0;
                const isSelected = dfTarget === c.id;
                return (
                  <div
                    key={c.id}
                    className={`target-card ${isSelected ? "target-selected" : ""}`}
                    onClick={() => {
                      setDfTarget(c.id);
                      setDfSelected(null);
                      setDfResult(null);
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
                        {share.toFixed(1)}%
                      </div>
                    </div>
                    <div className="target-threat df-risk-label">VOICE CLONE TARGET</div>
                  </div>
                );
              })}
            </div>

            <div className="attack-col-action">
              {dfTarget ? (
                <>
                  <div className="attack-section-title">Fabricated Voice Clips</div>
                  <div className="df-warning-banner">
                    HIGH RISK: Shield may detect synthetic audio via watermark analysis.
                    If caught, YOU lose voter trust.
                  </div>

                  {dfLoading ? (
                    <div className="attack-placeholder">
                      <div className="attack-placeholder-text">Scanning voice patterns...</div>
                    </div>
                  ) : (
                    <div className="attack-template-list">
                      {dfOptions.map((opt, i) => (
                        <div
                          key={opt.id}
                          className={`attack-template-card df-template ${dfSelected === i ? "template-selected" : ""}`}
                          onClick={() => {
                            setDfSelected(i);
                            setDfResult(null);
                          }}
                        >
                          <div className="template-header">
                            <span className="template-type df-type-badge">VOICE CLONE</span>
                            <span className="template-label">{opt.label}</span>
                          </div>
                          <div className="template-narrative df-quote">"{opt.fake_quote}"</div>
                          <div className="df-meta-row">
                            <span className="df-meta-item">
                              Detection Risk:
                              <span className={`df-risk ${opt.detection_risk >= 45 ? "df-risk-high" : opt.detection_risk >= 35 ? "df-risk-mid" : "df-risk-low"}`}>
                                {" "}{opt.detection_risk}%
                              </span>
                            </span>
                            <span className="df-meta-item">
                              Impact: <span className="df-impact">{opt.impact_range}</span>
                            </span>
                            <span className="df-meta-item">
                              Targets: {opt.target_demos.join(", ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {dfResult && (
                    <div className={`df-result df-result-${dfResult.status}`}>
                      <div className="df-result-status">
                        {dfResult.status === "success" && "DEEPFAKE DEPLOYED SUCCESSFULLY"}
                        {dfResult.status === "detected" && "DETECTED — BACKFIRE ON YOU"}
                        {dfResult.status === "auto_debunked" && "AUTO-DEBUNKED — TRUTH LEDGER CAUGHT IT"}
                        {dfResult.status === "error" && "ERROR"}
                      </div>
                      <div className="df-result-reason">{dfResult.reason}</div>
                    </div>
                  )}

                  {dfSelected !== null && !dfResult && (
                    <button
                      className="attack-submit-btn df-deploy-btn"
                      onClick={handleDeepfakeDeploy}
                      disabled={dfDeploying}
                    >
                      {dfDeploying ? "Generating Voice Clone..." : "Deploy Deepfake"}
                    </button>
                  )}
                </>
              ) : (
                <div className="attack-placeholder">
                  <div className="attack-placeholder-text">
                    Select a target to clone their voice.
                    Generate a fabricated audio clip of them saying something they never said.
                    High risk — Shield watermark analysis may detect the synthetic audio.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TRUTH LEDGER TAB ═══ */}
        {activeTab === "truth_ledger" && (
          <div className="truth-ledger-content">
            <div className="truth-cred-section">
              <div className="truth-cred-header">
                <div className="truth-cred-label">YOUR CREDIBILITY</div>
                <div className="truth-cred-value">{credibility.toFixed(0)}%</div>
              </div>
              <div className="truth-cred-bar">
                <div className="truth-cred-fill" style={{ width: `${credibility}%` }} />
              </div>
              <div className="truth-cred-hint">
                Each notarization adds 20% credibility and provides passive defense against deepfakes targeting you.
              </div>
              <button
                className="truth-notarize-btn"
                onClick={handleNotarize}
                disabled={notarizing}
              >
                {notarizing ? "Notarizing..." : "NOTARIZE THIS ROUND"}
              </button>
              {notarizeResult && (
                <div className="truth-notarize-result">{notarizeResult}</div>
              )}
            </div>

            {ledgerEntries.length > 0 && (
              <div className="truth-entries-section">
                <div className="attack-section-title">Verified Statements</div>
                {ledgerEntries.map((entry, i) => (
                  <div key={i} className="truth-entry">
                    <div className="truth-entry-round">R{entry.round}</div>
                    <div className="truth-entry-statement">{entry.statement}</div>
                    <div className="truth-entry-hash">
                      {entry.network === "devnet" ? (
                        <a
                          href={entry.explorer_url || `https://explorer.solana.com/tx/${entry.tx_signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--ink)", textDecoration: "underline" }}
                        >
                          {entry.tx_signature.slice(0, 16)}... [DEVNET]
                        </a>
                      ) : (
                        <span>{entry.tx_signature.slice(0, 20)}... [LOCAL]</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deepfakesAgainst.length > 0 && (
              <div className="truth-threats-section">
                <div className="attack-section-title df-threats-title">Active Deepfakes Against You</div>
                {deepfakesAgainst.map((df) => (
                  <div key={df.clip_id} className="df-threat-card">
                    <div className="df-threat-label">{df.label}</div>
                    <div className="df-threat-quote">"{df.fake_quote}"</div>
                    <div className="df-threat-meta">Deployed by: {df.deployer} | Round {df.round}</div>
                    <button
                      className="df-debunk-btn"
                      onClick={() => handleDebunk(df.clip_id)}
                      disabled={debunking === df.clip_id}
                    >
                      {debunking === df.clip_id ? "Analyzing audio..." : "DEBUNK THIS FAKE"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {deepfakesAgainst.length === 0 && ledgerEntries.length === 0 && (
              <div className="attack-placeholder" style={{ marginTop: "16px" }}>
                <div className="attack-placeholder-text">
                  No deepfakes detected against you yet.
                  Notarize your statements to build credibility and gain passive deepfake defense.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
