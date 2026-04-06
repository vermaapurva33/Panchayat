/**
 * REST + SSE API client for the Panchayat game.
 * v3: Real-time streaming via Server-Sent Events.
 */

const API_BASE = "/api";

// ─── Event Types from SSE Stream ────────────────────────────────────────────

export interface AnnounceEvent {
  type: "announce";
  candidate: string;
  policy: string;
  description?: string;
}

export interface ThinkingEvent {
  type: "thinking";
  candidate: string;
}

export interface ReactionEvent {
  type: "reaction";
  candidate: string;
  name: string;
  reaction: string;
  audio_base64?: string;
}

export interface SentimentUpdateEvent {
  type: "sentiment_update";
  source: string;
  shifts: Record<string, { old: number; new: number; shift: number }>;
  forecast: ElectionForecast;
  sentiments: Record<string, number>;
}

export interface RoundCompleteEvent {
  type: "round_complete";
  round: number;
  max_rounds: number;
  is_game_over: boolean;
  winner: string | null;
  forecast: ElectionForecast;
  sentiments: Record<string, number>;
}

export interface PoliticalActionEvent {
  type: "political_action";
  candidate: string;
  candidate_name: string;
  action_type: string;
  target: string;
  target_name: string;
  narrative: string;
  reasoning: string;
  shield_verdict: "ALLOWED";
  shield_reason: string;
  intent_hash: string;
  audio_base64?: string;
}

export interface ActionBlockedEvent {
  type: "action_blocked";
  candidate: string;
  candidate_name: string;
  action_type: string;
  target: string;
  target_name?: string;
  narrative: string;
  shield_verdict: "BLOCKED";
  shield_reason: string;
  policy_ref: string;
  intent_hash: string;
  audio_base64?: string;
}

export interface GroundReportEvent {
  type: "ground_report";
  insights: string[];
  player_momentum: string;
  threat_level: string;
  tip: string;
}

export type GameEvent =
  | AnnounceEvent
  | ThinkingEvent
  | ReactionEvent
  | SentimentUpdateEvent
  | RoundCompleteEvent
  | PoliticalActionEvent
  | ActionBlockedEvent
  | GroundReportEvent;

export interface ElectionForecast {
  vote_shares: Record<string, number>;
  winner: string;
  margin: number;
}

// ─── Streaming Round ────────────────────────────────────────────────────────

export async function streamRound(
  playerPolicy: string,
  onEvent: (event: GameEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/round/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_policy: playerPolicy }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent(data as GameEvent);
        } catch {
          // Skip malformed events
        }
      }
    }
  }
}

// ─── Simple REST Endpoints ──────────────────────────────────────────────────

export async function getGameState() {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function resetGame(): Promise<void> {
  await fetch(`${API_BASE}/reset`, { method: "POST" });
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/state`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Player Attack ──────────────────────────────────────────────────────────

export async function playerAttack(
  actionType: string,
  targetId: string,
  narrative: string,
): Promise<{
  status: string;
  shield_verdict: string;
  shield_reason: string;
  policy_ref?: string;
  intent_hash: string;
  forecast?: ElectionForecast;
  sentiments?: Record<string, number>;
  audio_base64?: string;
}> {
  const res = await fetch(`${API_BASE}/attack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_type: actionType,
      target_id: targetId,
      narrative: narrative,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── War Room API ──────────────────────────────────────────────────────────

export interface WarroomAttack {
  actionType: string;
  label: string;
  narrative: string;
  is_illegal: boolean;
}

export async function getWarroomAttacks(targetId: string): Promise<{
  target: string;
  target_name: string;
  vote_share: number;
  attacks: WarroomAttack[];
}> {
  const res = await fetch(`${API_BASE}/warroom/${targetId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Shield Audit Log ───────────────────────────────────────────────────────

export async function getShieldAudit(): Promise<{ audit_log: any[] }> {
  const res = await fetch(`${API_BASE}/shield/audit`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Deepfake / Voice Clone APIs ────────────────────────────────────────────

export interface DeepfakeOption {
  id: string;
  label: string;
  fake_quote: string;
  target_demos: string[];
  impact_range: string;
  detection_risk: number;
}

export interface DeepfakeResult {
  status: "success" | "detected" | "auto_debunked" | "debunked" | "error";
  clip_id?: string;
  deployer?: string;
  target?: string;
  fake_quote?: string;
  label?: string;
  audio_base64?: string;
  audio_hash?: string;
  reason?: string;
  impact?: number;
  deployer_penalty?: number;
  target_bonus?: number;
  detection_probability?: string;
  forecast?: ElectionForecast;
  sentiments?: Record<string, number>;
}

export interface TruthLedgerEntry {
  candidate_id: string;
  statement: string;
  round: number;
  hash: string;
  timestamp: string;
  tx_signature: string;
  explorer_url?: string;
  network?: string;
}

export interface ActiveDeepfake {
  clip_id: string;
  deployer: string;
  target: string;
  fake_quote: string;
  label: string;
  status: string;
  round: number;
}

export async function getDeepfakeOptions(targetId: string): Promise<{
  target: string;
  target_name: string;
  options: DeepfakeOption[];
}> {
  const res = await fetch(`${API_BASE}/deepfake/options/${targetId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deployDeepfake(targetId: string, templateId: string): Promise<DeepfakeResult> {
  const res = await fetch(`${API_BASE}/deepfake/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_id: targetId, template_id: templateId }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function debunkDeepfake(clipId: string): Promise<DeepfakeResult> {
  const res = await fetch(`${API_BASE}/deepfake/debunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clip_id: clipId }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function notarizeTruth(statement: string): Promise<{
  status: string;
  entry: TruthLedgerEntry;
  credibility: number;
  forecast: ElectionForecast;
  sentiments: Record<string, number>;
}> {
  const res = await fetch(`${API_BASE}/truth/notarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getTruthLedger(candidateId: string): Promise<{
  candidate_id: string;
  entries: TruthLedgerEntry[];
  credibility: number;
}> {
  const res = await fetch(`${API_BASE}/truth/ledger/${candidateId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getActiveDeepfakes(): Promise<{
  all: ActiveDeepfake[];
  against_player: ActiveDeepfake[];
}> {
  const res = await fetch(`${API_BASE}/deepfake/active`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Solana Notary APIs ─────────────────────────────────────────────────────

export interface NotaryEntry {
  tx_signature: string;
  data_hash: string;
  memo: string;
  event_type: string;
  timestamp: string;
  network: string;
  explorer_url?: string;
  status: string;
}

export async function getNotaryLedger(): Promise<{
  entries: NotaryEntry[];
  stats: { total_entries: number; network: string; wallet: string | null };
}> {
  const res = await fetch(`${API_BASE}/notary/ledger`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getNotaryStatus(): Promise<{
  solana_connected: boolean;
  network: string;
}> {
  const res = await fetch(`${API_BASE}/notary/status`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
