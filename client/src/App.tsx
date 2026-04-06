import { useState, useCallback, useRef, useEffect } from "react";
import { VOTERS, CANDIDATES, PLAYER } from "./data/gameData";
import { streamRound, resetGame, checkApiHealth, playerAttack } from "./api/bridge";
import type { GameEvent, ElectionForecast } from "./api/bridge";

import VoterSentimentPanel from "./components/VoterSentimentPanel";
import ElectionForecastPanel from "./components/ElectionForecast";
import GameScene from "./components/GameScene";
import ActionFeed from "./components/ActionFeed";
import type { ActionEntry } from "./components/ActionFeed";
import AttackPopup from "./components/AttackPopup";
import DeepfakePopup from "./components/DeepfakePopup";
import PrologueNewspaper from "./components/PrologueNewspaper";
import "./App.css";

interface VoterSentiment {
  id: string;
  happiness: number;
  shift: number;
  narrative: string;
}

const MAX_ROUNDS = 5;

// Unified queue item: either a reaction speech or an attack dispatch
type QueueItem =
  | { kind: "reaction"; candidate: string; name: string; reaction: string; audio_base64?: string }
  | { kind: "attack"; entry: ActionEntry; audio_base64?: string }
  | { kind: "warroom_prompt" }
  | { kind: "ground_report"; data: { insights: string[]; player_momentum: string; threat_level: string; tip: string; } }
  | { kind: "round_complete"; event: any };

function App() {
  const [showPrologue, setShowPrologue] = useState(true);

  // ═══ PERSISTENT BGM ═══
  // Lives at App level so it survives prologue → game transition
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmStartedRef = useRef(false);

  // Initialize BGM audio element once
  useEffect(() => {
    const audio = new Audio("/assets/bgm.mp3");
    audio.loop = true;
    audio.volume = 0; // Start silent, fade in on first click
    audio.preload = "auto";
    bgmRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Start BGM on first user interaction (browser autoplay policy)
  useEffect(() => {
    const startBGM = () => {
      if (bgmStartedRef.current || !bgmRef.current) return;
      bgmStartedRef.current = true;
      const audio = bgmRef.current;
      audio.volume = 0;
      audio.play().then(() => {
        // Fade in to 50% over 800ms
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol = Math.min(vol + 0.05, 0.5);
          audio.volume = vol;
          if (vol >= 0.5) clearInterval(fadeIn);
        }, 50);
      }).catch(() => { /* autoplay blocked, user will interact again */ });
    };

    document.addEventListener("click", startBGM, { once: false });
    document.addEventListener("keydown", startBGM, { once: false });

    return () => {
      document.removeEventListener("click", startBGM);
      document.removeEventListener("keydown", startBGM);
    };
  }, []);

  // Fade BGM volume when transitioning prologue → game
  const handlePrologueComplete = useCallback(() => {
    setShowPrologue(false);

    // Fade from 50% → 10% over 1.5 seconds
    if (bgmRef.current) {
      const audio = bgmRef.current;
      const startVol = audio.volume;
      const targetVol = 0.10;
      const steps = 30; // 30 steps × 50ms = 1500ms
      const decrement = (startVol - targetVol) / steps;
      let step = 0;
      const fadeDown = setInterval(() => {
        step++;
        audio.volume = Math.max(targetVol, startVol - decrement * step);
        if (step >= steps) {
          audio.volume = targetVol;
          clearInterval(fadeDown);
        }
      }, 50);
    }
  }, []);
  const [round, setRound] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const [sentiments, setSentiments] = useState<Record<string, number>>(
    Object.fromEntries(VOTERS.map((v) => [v.id, v.baseHappiness]))
  );
  const [forecast, setForecast] = useState<ElectionForecast>({
    vote_shares: { dharma_rakshak: 20, vikas_purush: 20, jan_neta: 20, mukti_devi: 20, player: 20 },
    winner: "Tie",
    margin: 0,
  });

  const [thinkingCandidates, setThinkingCandidates] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, { name: string; reaction: string }>>({});
  const [aiPicks, setAiPicks] = useState<Record<string, string>>({});
  const [activeAnnouncer, setActiveAnnouncer] = useState<string | null>(null);

  const [showManifesto, setShowManifesto] = useState(false);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [politicalActions, setPoliticalActions] = useState<ActionEntry[]>([]);
  const [latestAction, setLatestAction] = useState<ActionEntry | null>(null);
  const [showAttackPopup, setShowAttackPopup] = useState(false);
  const [attackUsedThisRound, setAttackUsedThisRound] = useState(false);
  const [groundReport, setGroundReport] = useState<{
    insights: string[]; player_momentum: string; threat_level: string; tip: string;
  } | null>(null);

  const [showDeepfakePopup, setShowDeepfakePopup] = useState(false);

  // ═══ UNIFIED PRESENTATION QUEUE ═══
  // Strict sequential playback. Only ONE audio plays at a time.
  const queueRef = useRef<QueueItem[]>([]);
  const isShowingRef = useRef(false);
  const isAudioPlayingRef = useRef(false); // MUTEX: true while audio is playing
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up: stop current audio, cancel timers
  const stopCurrentPlayback = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.onended = null; // Remove callback first
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch { /* ignore */ }
      currentAudioRef.current = null;
    }
    isAudioPlayingRef.current = false;
  }, []);

  // Play audio and return ONLY when it finishes (or fallback timeout)
  const playAudioAndWait = useCallback((base64: string, fallbackMs: number): Promise<void> => {
    return new Promise((resolve) => {
      if (!base64) {
        // No audio — wait a short beat then resolve
        setTimeout(resolve, 1500);
        return;
      }
      try {
        const audio = new Audio("data:audio/mp3;base64," + base64);
        currentAudioRef.current = audio;
        isAudioPlayingRef.current = true;

        let resolved = false;
        const done = () => {
          if (resolved) return; // Prevent double-resolve
          resolved = true;
          isAudioPlayingRef.current = false;
          if (autoTimerRef.current) {
            clearTimeout(autoTimerRef.current);
            autoTimerRef.current = null;
          }
          resolve();
        };

        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);

        // Fallback timer — only fires if audio.onended never does
        autoTimerRef.current = setTimeout(done, fallbackMs);
      } catch {
        isAudioPlayingRef.current = false;
        setTimeout(resolve, 1500);
      }
    });
  }, []);

  const showNextInQueue = useCallback(async () => {
    // GUARD: if we're already playing audio, don't interrupt
    if (isAudioPlayingRef.current) return;

    if (queueRef.current.length === 0) {
      isShowingRef.current = false;
      setActiveDialog(null);
      setLatestAction(null);
      setLoadingStatus("");
      return;
    }

    isShowingRef.current = true;
    const next = queueRef.current.shift()!;

    // Stop any leftover audio/timers
    stopCurrentPlayback();

    if (next.kind === "reaction") {
      setLatestAction(null);
      setReactions((prev) => ({
        ...prev,
        [next.candidate]: { name: next.name, reaction: next.reaction },
      }));
      setActiveAnnouncer(next.candidate);
      setActiveDialog(next.candidate);
      setLoadingStatus(`${next.name.split(" ")[0]} is speaking...`);

      // Wait for audio to FULLY finish before advancing
      await playAudioAndWait(next.audio_base64 || "", 8000);
      showNextInQueue();

    } else if (next.kind === "attack") {
      setActiveDialog(null);
      setPoliticalActions((prev) => [...prev, next.entry]);
      setLatestAction(next.entry);
      setLoadingStatus(
        `${next.entry.candidateName.split(" ")[0]} ${next.entry.verdict === "BLOCKED" ? "BLOCKED by Shield" : "attacks"} ${next.entry.targetName.split(" ")[0]}`
      );

      // Wait for audio to FULLY finish before advancing
      await playAudioAndWait(next.audio_base64 || "", 6000);
      showNextInQueue();

    } else if (next.kind === "ground_report") {
      setActiveDialog(null);
      setLatestAction(null);
      setGroundReport(next.data);
      // Wait for user or immediately continue?
      // Since Ground Report is an overlay that user must click "DISMISS" on, 
      // we can just pop it open and immediately trigger showNextInQueue
      // so the next item (warroom_prompt) can run silently behind it.
      showNextInQueue();
    } else if (next.kind === "round_complete") {
      const event = next.event;
      setRound(event.round);
      setSentiments(event.sentiments);
      setForecast(event.forecast);
      setActiveAnnouncer(null);
      setThinkingCandidates(new Set());

      if (!event.is_game_over) {
        queueRef.current.push({ kind: "warroom_prompt" });
      } else {
        setGameOver(true);
        setWinner(event.winner);
      }
      showNextInQueue();
    } else if (next.kind === "warroom_prompt") {
      // Round finished — clear state, let user manually pick actions
      setActiveDialog(null);
      setLatestAction(null);
      setLoadingStatus("Round complete — choose your next action");
      isShowingRef.current = false;
    }
  }, [stopCurrentPlayback, playAudioAndWait]);

  const handleDismissDialog = useCallback(() => {
    stopCurrentPlayback();
    showNextInQueue();
  }, [stopCurrentPlayback, showNextInQueue]);

  useState(() => {
    checkApiHealth().then(setApiOnline);
  });

  const handlePolicySelect = useCallback(async (action: string) => {
    setIsLoading(true);
    setActiveDialog(null);
    setReactions({});
    setAiPicks({});
    setThinkingCandidates(new Set());
    setAttackUsedThisRound(false);
    setGroundReport(null);

    try {
      await streamRound(action, (event: GameEvent) => {
        switch (event.type) {
          case "announce":
            setActiveAnnouncer(event.candidate);
            if (event.candidate === "player") {
              setLoadingStatus("You announced: " + event.policy.slice(0, 40) + "...");
            } else {
              setAiPicks((prev) => ({ ...prev, [event.candidate]: event.policy }));
              setLoadingStatus(
                (CANDIDATES.find((c) => c.id === event.candidate)?.name.split(" ")[0] || event.candidate) +
                " announces: " + event.policy.slice(0, 30) + "..."
              );
            }
            break;

          case "thinking":
            setThinkingCandidates((prev) => new Set(prev).add(event.candidate));
            setLoadingStatus(
              (CANDIDATES.find((c) => c.id === event.candidate)?.name.split(" ")[0] || "AI") +
              " is composing a response..."
            );
            break;

          case "reaction":
            setThinkingCandidates((prev) => {
              const next = new Set(prev);
              next.delete(event.candidate);
              return next;
            });
            // Queue reaction — will be shown sequentially
            queueRef.current.push({
              kind: "reaction",
              candidate: event.candidate,
              name: event.name,
              reaction: event.reaction,
              audio_base64: event.audio_base64,
            });
            if (!isShowingRef.current) {
              showNextInQueue();
            }
            break;

          case "sentiment_update":
            setSentiments(event.sentiments);
            setForecast(event.forecast);
            break;

          case "political_action": {
            const actionEntry: ActionEntry = {
              candidate: event.candidate,
              candidateName: event.candidate_name,
              actionType: event.action_type,
              target: event.target,
              targetName: event.target_name,
              narrative: event.narrative,
              verdict: "ALLOWED",
              reason: event.shield_reason,
              intentHash: event.intent_hash,
            };
            // Queue attack — will be shown AFTER all reactions
            queueRef.current.push({
              kind: "attack",
              entry: actionEntry,
              audio_base64: event.audio_base64,
            });
            if (!isShowingRef.current) {
              showNextInQueue();
            }
            break;
          }

          case "action_blocked": {
            const blockedEntry: ActionEntry = {
              candidate: event.candidate,
              candidateName: event.candidate_name,
              actionType: event.action_type,
              target: event.target,
              targetName: event.target_name || "Unknown",
              narrative: event.narrative,
              verdict: "BLOCKED",
              reason: event.shield_reason,
              policyRef: event.policy_ref,
              intentHash: event.intent_hash,
            };
            // Queue blocked action — shown sequentially
            queueRef.current.push({
              kind: "attack",
              entry: blockedEntry,
              audio_base64: "",
            });
            if (!isShowingRef.current) {
              showNextInQueue();
            }
            break;
          }

          case "ground_report":
            queueRef.current.push({
              kind: "ground_report",
              data: {
                insights: event.insights || [],
                player_momentum: event.player_momentum || "",
                threat_level: event.threat_level || "",
                tip: event.tip || "",
              }
            });
            if (!isShowingRef.current) showNextInQueue();
            break;

          case "round_complete":
            queueRef.current.push({ kind: "round_complete", event });
            if (!isShowingRef.current) showNextInQueue();
            break;
        }
      });
    } catch (err) {
      console.error(err);
      setLoadingStatus("Connection error.");
    } finally {
      setIsLoading(false);
    }
  }, [showNextInQueue]);

  const handleResetGame = useCallback(async () => {
    await resetGame();
    setRound(0);
    setGameOver(false);
    setWinner(null);
    setReactions({});
    setAiPicks({});
    setForecast({
      vote_shares: { dharma_rakshak: 20, vikas_purush: 20, jan_neta: 20, mukti_devi: 20, player: 20 },
      winner: "Tie", margin: 0,
    });
    setSentiments(Object.fromEntries(VOTERS.map((v) => [v.id, v.baseHappiness])));
    setActiveDialog(null);
    setShowManifesto(false);
    setActiveAnnouncer(null);
    setThinkingCandidates(new Set());
    setPoliticalActions([]);
    setLatestAction(null);
    setShowAttackPopup(false);
    setAttackUsedThisRound(false);
    queueRef.current = [];
    isShowingRef.current = false;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    if (latestActionTimerRef.current) clearTimeout(latestActionTimerRef.current);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  const handlePlayerAttack = useCallback(async (actionType: string, targetId: string, narrative: string) => {
    try {
      const result = await playerAttack(actionType, targetId, narrative);
      if (result.status === "allowed" && result.forecast && result.sentiments) {
        setForecast(result.forecast);
        setSentiments(result.sentiments);
      }
      const targetCandidate = CANDIDATES.find(c => c.id === targetId);
      const actionEntry: ActionEntry = {
        candidate: "player",
        candidateName: "You (Player)",
        actionType,
        target: targetId,
        targetName: targetCandidate?.name || targetId,
        narrative,
        verdict: result.shield_verdict as "ALLOWED" | "BLOCKED",
        reason: result.shield_reason,
        policyRef: result.policy_ref,
        intentHash: result.intent_hash,
      };
      setPoliticalActions((prev) => [...prev, actionEntry]);
      setLatestAction(actionEntry);
      setAttackUsedThisRound(true);

      // Play player attack audio
      if (result.audio_base64) {
        try {
          const audio = new Audio("data:audio/mp3;base64," + result.audio_base64);
          audio.play().catch(() => { });
        } catch { /* skip */ }
      }

      // Clear flash after 4s
      if (latestActionTimerRef.current) clearTimeout(latestActionTimerRef.current);
      latestActionTimerRef.current = setTimeout(() => setLatestAction(null), 4000);
    } catch (err) {
      console.error("Attack failed:", err);
    }
  }, []);

  const voterSentimentData: VoterSentiment[] = VOTERS.map((v) => ({
    id: v.id,
    happiness: sentiments[v.id] ?? v.baseHappiness,
    shift: 0,
    narrative: "",
  }));

  const getWinnerInfo = () => {
    if (!winner) return null;
    if (winner === "player") return PLAYER;
    return CANDIDATES.find((c) => c.id === winner) || null;
  };

  return (
    <>
      {showPrologue && (
        <PrologueNewspaper onComplete={handlePrologueComplete} />
      )}
    <div className="game-layout">
      {/* ═══ Game Over Overlay ═══ */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <div className="game-over-headline">Election Extra!</div>
            <div
              className="game-over-winner"
              style={{
                color: winner === "player" ? "var(--player)" : getWinnerInfo()?.color || "var(--ink)",
              }}
            >
              {winner === "player" ? "You Win" : `${getWinnerInfo()?.name || winner} Wins`}
            </div>
            <div className="game-over-sub">
              {winner === "player"
                ? "The electorate has spoken. You are their chosen representative."
                : "A formidable campaign prevails. Better luck next election."}
            </div>
            <div className="game-over-standings">
              {Object.entries(forecast.vote_shares)
                .sort(([, a], [, b]) => b - a)
                .map(([cid, share]) => {
                  const c = cid === "player" ? PLAYER : CANDIDATES.find((x) => x.id === cid);
                  return (
                    <div
                      key={cid}
                      className="game-over-row"
                      style={{
                        fontWeight: cid === winner ? "900" : "400",
                        color: cid === winner ? (c?.color || "var(--ink)") : "var(--ink-light)",
                      }}
                    >
                      <span>{c?.name || cid}{cid === winner ? " *" : ""}</span>
                      <span>{share.toFixed(1)}%</span>
                    </div>
                  );
                })}
            </div>
            <button className="rpg-btn" onClick={handleResetGame}>
              New Election
            </button>
          </div>
        </div>
      )}

      {showAttackPopup && (
        <AttackPopup
          onAttack={(at, tid, narr) => {
            handlePlayerAttack(at, tid, narr);
            setShowAttackPopup(false);
          }}
          onClose={() => setShowAttackPopup(false)}
          politicalActions={politicalActions}
          forecast={forecast}
          round={round}
        />
      )}

      {/* ═══ Deepfake Popup (Separate Media Lab) ═══ */}
      {showDeepfakePopup && (
        <DeepfakePopup
          round={round}
          forecast={forecast}
          onClose={() => setShowDeepfakePopup(false)}
          onSentimentUpdate={(newSentiments, newForecast) => {
            setSentiments(newSentiments);
            setForecast(newForecast);
          }}
        />
      )}

      {/* ═══ LEFT: The Front Page ═══ */}
      <GameScene
        showManifesto={showManifesto}
        onCloseManifesto={() => setShowManifesto(false)}
        onSelectAction={handlePolicySelect}
        activeDialog={activeDialog}
        onOpenDialog={setActiveDialog}
        onDismissDialog={handleDismissDialog}
        reactions={reactions}
        aiPicks={aiPicks}
        thinkingCandidates={thinkingCandidates}
        activeAnnouncer={activeAnnouncer}
        round={round}
        maxRounds={MAX_ROUNDS}
        latestAction={latestAction}
        forecast={forecast}
      />

      {/* ═══ GROUND REPORT — Player Intelligence Brief ═══ */}
      {groundReport && !showManifesto && !showAttackPopup && !showDeepfakePopup && (
        <div className="ground-report-overlay" onClick={() => setGroundReport(null)}>
          <div className="ground-report-card" onClick={(e) => e.stopPropagation()}>
            <div className="ground-report-header">
              <span className="ground-report-tag">INTELLIGENCE BRIEF</span>
              <span className="ground-report-momentum">{groundReport.player_momentum}</span>
            </div>
            <div className="ground-report-threat">{groundReport.threat_level}</div>
            <ul className="ground-report-insights">
              {groundReport.insights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
            <div className="ground-report-tip">
              <strong>STRATEGY:</strong> {groundReport.tip}
            </div>
            <button className="ground-report-dismiss" onClick={() => setGroundReport(null)}>
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* ═══ RIGHT: Live Desk ═══ */}
      <aside className="ui-panel">
        <div className="sidebar-header">
          <h2>Live Desk</h2>
          <div className="edition-line">Breaking Coverage</div>
        </div>

        <ElectionForecastPanel forecast={forecast} />

        <div className="section-ornament">- - -</div>

        <VoterSentimentPanel voters={VOTERS} sentiments={voterSentimentData} />

        {/* Candidate Position Dispatches */}
        {Object.keys(aiPicks).length > 0 && (
          <>
            <div className="section-ornament">- - -</div>
            <div className="panel-section">
              <div className="desk-kicker">Breaking</div>
              <div className="desk-headline" style={{ fontSize: "16px" }}>
                Candidates Declare Positions
              </div>
              {Object.entries(aiPicks).map(([cid, policy]) => {
                const c = CANDIDATES.find((x) => x.id === cid);
                return (
                  <div key={cid} className="desk-brief">
                    <div className="desk-brief-name" style={{ color: c?.color || "#888" }}>
                      {c?.name.split(" ").slice(0, 2).join(" ") || cid}
                    </div>
                    <div className="desk-brief-policy">
                      "{policy}"
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Political Action Feed */}
        {politicalActions.length > 0 && (
          <>
            <div className="section-ornament">- - -</div>
            <ActionFeed actions={politicalActions} />
          </>
        )}

        {/* Action Buttons */}
        <div className="panel-section" style={{ marginTop: "auto" }}>
          {isLoading && (
            <div className="loading-ticker">
              {loadingStatus}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="rpg-btn"
              onClick={() => setShowManifesto(true)}
              disabled={isLoading || apiOnline === false || gameOver}
              style={{ flex: 1 }}
            >
              Manifesto
            </button>
            <button
              className="rpg-btn attack-btn"
              onClick={() => setShowAttackPopup(true)}
              disabled={isLoading || apiOnline === false || gameOver || round === 0 || attackUsedThisRound}
              style={{ flex: 1 }}
            >
              {attackUsedThisRound ? "Attacked" : "War Room"}
            </button>
          </div>
          <button
            className="rpg-btn df-action-btn"
            onClick={() => setShowDeepfakePopup(true)}
            disabled={isLoading || apiOnline === false || gameOver || round === 0}
            style={{ marginTop: "6px", width: "100%" }}
          >
            Media Lab
          </button>
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-body)",
              fontSize: "9px",
              color: "var(--ink-faded)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            <span>Round {round} / {MAX_ROUNDS}</span>
            <span>{apiOnline ? "Connected" : "Offline"}</span>
          </div>
        </div>
      </aside>
    </div>
    </>
  );
}

export default App;
