"""
Panchayat Bridge — FastAPI REST Server (v3 — Streaming)
=========================================================
Real-time streaming game: each candidate takes their turn one-by-one.
Events stream to the frontend via Server-Sent Events (SSE).

Flow per round:
  1. Player announces manifesto   → event streamed
  2. Each AI reacts (Gemini)      → events streamed one-by-one
  3. Each AI announces manifesto  → events streamed one-by-one
  4. Voter sentiments update live → events after each action
  5. Round complete               → final event

Run: uvicorn bridge.api_server:app --port 8000 --reload
"""

import os
import sys
import json
import time
import random

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from bridge.langgraph_engine import GameState, run_candidate_reaction, RATE_LIMIT_DELAY
from bridge.ai_prompts import get_candidate_info, get_all_candidate_ids
from bridge.shield_engine import validate_political_action, PoliticalIntent, get_audit_log, clear_audit_log
from bridge.claw_agent import generate_political_action, build_player_action
from bridge.warroom_db import get_warroom_attacks
from bridge.deepfake_engine import (
    deploy_deepfake, debunk_deepfake, notarize_statement,
    get_deepfake_options, get_truth_ledger, get_credibility_score,
    get_active_deepfakes, get_deepfakes_against, reset_deepfake_state,
)
from bridge.solana_notary import (
    notarize_round_result, notarize_final_result,
    notarize_shield_verdict, get_notary_ledger, get_notary_stats,
    is_solana_connected, reset_notary,
)
from data.voter_profiles import VOTER_PROFILES
from data.ideology_engine import (
    load_manifestos,
    compute_ideology_distance, compute_policy_impact,
    get_candidate_ideologies, simulate_election_result
)

app = FastAPI(title="Panchayat API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ───────────────────────────────────────────────────────────────

MAX_ROUNDS = 5
AI_CANDIDATE_IDS = ["dharma_rakshak", "vikas_purush", "jan_neta", "mukti_devi"]
ALL_CANDIDATE_IDS = AI_CANDIDATE_IDS + ["player"]

# ─── Game State ──────────────────────────────────────────────────────────────

game_state = GameState()
current_round = 0
used_policies = {cid: [] for cid in AI_CANDIDATE_IDS}
# Per-candidate score modifiers from political attacks
candidate_boosts: dict[str, float] = {cid: 0.0 for cid in AI_CANDIDATE_IDS + ["player"]}
# Track momentum: last round's vote share change for player
player_momentum: float = 0.0
last_player_share: float = 20.0


class RoundRequest(BaseModel):
    player_policy: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def ai_pick_policy(candidate_id: str) -> dict:
    """AI picks best policy from their manifesto using ideology scoring."""
    manifestos = load_manifestos()
    policies = manifestos.get(candidate_id, {}).get("policies", [])
    if not policies:
        return {"title": "No policy", "id": "none", "ideology_impact": {}}

    available = [p for p in policies if p["id"] not in used_policies.get(candidate_id, [])]
    if not available:
        available = policies

    best_policy, best_score = None, -999
    for policy in available:
        score = 0
        impact = policy.get("ideology_impact", {})
        for vid, vp in VOTER_PROFILES.items():
            result = compute_policy_impact(impact, vp.ideology_alignment, vp.issue_weights, policy.get("category", ""))
            score += result["sentiment_shift"] * (vp.population_pct / 100.0)
        if score > best_score:
            best_score = score
            best_policy = policy

    if not best_policy:
        best_policy = random.choice(available)

    used_policies.setdefault(candidate_id, []).append(best_policy["id"])
    return best_policy


def apply_policy_shifts(policy: dict, candidate_id: str) -> dict:
    """Apply policy impact to voter sentiments. Returns shifts dict."""
    impact = policy.get("ideology_impact", {})
    if not impact:
        return {}

    shifts = {}
    for vid, vp in VOTER_PROFILES.items():
        result = compute_policy_impact(impact, vp.ideology_alignment, vp.issue_weights, policy.get("category", ""))
        shift = result["sentiment_shift"]
        old_val = game_state.voter_sentiments.get(vid, vp.base_happiness)
        new_val = max(0, min(100, old_val + shift))
        game_state.voter_sentiments[vid] = new_val
        shifts[vid] = {"old": round(old_val, 1), "new": round(new_val, 1), "shift": round(shift, 1)}
    return shifts


def compute_forecast() -> dict:
    """Compute current election forecast with per-candidate attack boosts.
    Player gets a small 'underdog independent' bonus + momentum from previous rounds."""
    global player_momentum
    candidate_ideologies = get_candidate_ideologies()
    voter_sentiments_matrix = {}
    for vid, vp in VOTER_PROFILES.items():
        happiness = game_state.voter_sentiments.get(vid, vp.base_happiness)
        per_c = {}
        for cid in ALL_CANDIDATE_IDS:
            if cid == "player":
                # Small underdog bonus (+3) + momentum carry
                base = happiness + 3.0 + max(0, player_momentum)
            else:
                alignment = compute_ideology_distance(vp.ideology_alignment, candidate_ideologies.get(cid, {}))
                base = happiness * alignment
            # Apply per-candidate attack modifiers
            boost = candidate_boosts.get(cid, 0.0)
            per_c[cid] = max(5, min(95, base + boost))
        voter_sentiments_matrix[vid] = per_c

    voter_pops = {vid: vp.population_pct for vid, vp in VOTER_PROFILES.items()}
    return simulate_election_result(voter_sentiments_matrix, voter_pops)


def sse_event(data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"data: {json.dumps(data)}\n\n"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/candidates")
def get_candidates():
    candidates = []
    for cid in get_all_candidate_ids():
        info = get_candidate_info(cid)
        candidates.append({
            "id": cid, "name": info["name"], "archetype": info["archetype"],
            "emoji": info["emoji"], "party_name": info["party_name"],
            "backstory": info.get("backstory", ""),
            "color": {"dharma_rakshak": "#FF6B35", "vikas_purush": "#2EC4B6",
                      "jan_neta": "#E63946", "mukti_devi": "#9B5DE5"}.get(cid, "#FFB347"),
        })
    return {"candidates": candidates}


@app.get("/api/voters")
def get_voters():
    voters = []
    for vid, vp in VOTER_PROFILES.items():
        voters.append({
            "id": vid, "name": vp.name_en, "name_hi": vp.name_hi,
            "emoji": vp.emoji, "population_pct": vp.population_pct,
            "base_happiness": vp.base_happiness,
            "current_happiness": game_state.voter_sentiments.get(vid, vp.base_happiness),
        })
    return {"voters": voters}


@app.get("/api/state")
def get_state():
    return {
        "round": current_round, "max_rounds": MAX_ROUNDS,
        "is_game_over": current_round >= MAX_ROUNDS,
        "voter_sentiments": game_state.voter_sentiments,
        "candidate_scores": game_state.candidate_scores,
    }


@app.post("/api/round/stream")
async def stream_round(req: RoundRequest):
    """
    Stream a full round as Server-Sent Events.
    Batches 2 AI reactions in parallel for speed.
    Strategic cross-attacks (2-3 per round, not all 4).
    Includes ground report for player intelligence.
    """
    global current_round, player_momentum, last_player_share

    if current_round >= MAX_ROUNDS:
        return {"error": "Game over!", "is_game_over": True}

    current_round += 1

    def generate():
        global player_momentum, last_player_share
        from concurrent.futures import ThreadPoolExecutor
        from bridge.audio_engine import generate_speech_base64

        # ══════════════════════════════════════════════════════════
        # PHASE 1: Player announces manifesto
        # ══════════════════════════════════════════════════════════
        yield sse_event({
            "type": "announce",
            "candidate": "player",
            "policy": req.player_policy,
        })

        # ══════════════════════════════════════════════════════════
        # PHASE 2: AI reacts — sequential, 1 at a time (safe for 15 RPM)
        # ══════════════════════════════════════════════════════════
        for cid in AI_CANDIDATE_IDS:
            yield sse_event({"type": "thinking", "candidate": cid})

            try:
                reaction = run_candidate_reaction(cid, req.player_policy)
            except Exception as e:
                reaction = f"[No response]"
                print(f"[Round] Reaction error for {cid}: {e}")

            reaction = _strip_voice_adjectives(reaction)
            info = get_candidate_info(cid)
            audio_b64 = generate_speech_base64(cid, reaction)

            yield sse_event({
                "type": "reaction",
                "candidate": cid,
                "name": info["name"],
                "reaction": reaction,
                "audio_base64": audio_b64,
            })

            # Rate limit delay between each candidate
            time.sleep(RATE_LIMIT_DELAY)

        # Apply player's policy impact to sentiments
        player_shifts = _estimate_player_policy_impact(req.player_policy)
        forecast = compute_forecast()

        yield sse_event({
            "type": "sentiment_update",
            "source": "player",
            "shifts": player_shifts,
            "forecast": forecast,
            "sentiments": dict(game_state.voter_sentiments),
        })

        # Keep track of policies enacted this round for Claw Agent context
        current_policies_text = {"player": req.player_policy}

        # ══════════════════════════════════════════════════════════
        # PHASE 3: Each AI takes their turn (pick + apply)
        # ══════════════════════════════════════════════════════════
        for cid in AI_CANDIDATE_IDS:
            policy = ai_pick_policy(cid)
            info = get_candidate_info(cid)
            current_policies_text[cid] = policy["title"]

            yield sse_event({
                "type": "announce",
                "candidate": cid,
                "policy": policy["title"],
                "description": policy.get("description", ""),
            })

            shifts = apply_policy_shifts(policy, cid)
            forecast = compute_forecast()

            yield sse_event({
                "type": "sentiment_update",
                "source": cid,
                "shifts": shifts,
                "forecast": forecast,
                "sentiments": dict(game_state.voter_sentiments),
            })

            time.sleep(0.3)

        # ══════════════════════════════════════════════════════════
        # PHASE 3.5: Strategic Cross-Attacks (2-3 per round, not all 4)
        # ══════════════════════════════════════════════════════════
        current_forecast = compute_forecast()
        vote_shares = current_forecast.get("vote_shares", {})
        sorted_by_share = sorted(vote_shares.items(), key=lambda x: x[1], reverse=True)

        # Strategic targeting: pick 2-3 attackers based on position
        attackers = _pick_strategic_attackers(sorted_by_share, current_round)

        for cid, _ in attackers:
            # Use Groq to reason about the game state and generate an intent + shield verdict
            intent, verdict = generate_political_action(
                candidate_id=cid,
                round_number=current_round,
                max_rounds=MAX_ROUNDS,
                vote_shares=vote_shares,
                ai_picks=current_policies_text,
                voter_sentiments=game_state.voter_sentiments,
                all_candidates=ALL_CANDIDATE_IDS,
            )

            target_id = intent.target_id
            if target_id not in ALL_CANDIDATE_IDS:
                target_id = "player"  # Fallback just in case LLM hallucinates

            audio_b64 = generate_speech_base64(cid, intent.narrative)
            target_name = get_candidate_info(target_id)["name"] if target_id != "player" else "You (Player)"

            if verdict.allowed:
                _apply_action_impact(cid, target_id, intent.action_type)
                yield sse_event({
                    "type": "political_action",
                    "candidate": cid,
                    "candidate_name": get_candidate_info(cid)["name"],
                    "action_type": intent.action_type,
                    "target": target_id,
                    "target_name": target_name,
                    "narrative": intent.narrative,
                    "reasoning": intent.reasoning,
                    "shield_verdict": "ALLOWED",
                    "shield_reason": verdict.reason,
                    "intent_hash": intent.intent_hash,
                    "audio_base64": audio_b64,
                })
            else:
                yield sse_event({
                    "type": "action_blocked",
                    "candidate": cid,
                    "candidate_name": get_candidate_info(cid)["name"],
                    "action_type": intent.action_type,
                    "target": target_id,
                    "narrative": intent.narrative,
                    "shield_verdict": "BLOCKED",
                    "shield_reason": verdict.reason,
                    "policy_ref": verdict.policy_ref,
                    "intent_hash": intent.intent_hash,
                    "audio_base64": "",
                })

            time.sleep(0.15)

        # ══════════════════════════════════════════════════════════
        # PHASE 3.75: Ground Report — Player Intelligence
        # ══════════════════════════════════════════════════════════
        forecast_after_actions = compute_forecast()
        new_share = forecast_after_actions.get("vote_shares", {}).get("player", 20.0)
        share_change = new_share - last_player_share
        player_momentum = share_change  # Carry momentum to next round
        last_player_share = new_share

        ground_report = _build_ground_report(
            game_state.voter_sentiments, forecast_after_actions,
            player_shifts, share_change, current_round
        )

        yield sse_event({
            "type": "sentiment_update",
            "source": "actions_phase",
            "forecast": forecast_after_actions,
            "sentiments": dict(game_state.voter_sentiments),
        })

        yield sse_event({
            "type": "ground_report",
            "insights": ground_report["insights"],
            "player_momentum": f"{'+' if share_change >= 0 else ''}{share_change:.1f}% this round",
            "threat_level": ground_report["threat_level"],
            "tip": ground_report["tip"],
        })

        # ══════════════════════════════════════════════════════════
        # PHASE 4: Round complete
        # ══════════════════════════════════════════════════════════
        is_over = current_round >= MAX_ROUNDS
        final_forecast = compute_forecast()

        # Notarize round result on-chain (Solana / local)
        try:
            notarize_round_result(current_round, final_forecast["vote_shares"], final_forecast["winner"])
        except Exception as e:
            print(f"[Notary] Round notarization failed: {e}")

        # If game is over, notarize the final result on-chain
        if is_over:
            try:
                notarize_final_result(final_forecast["vote_shares"], final_forecast["winner"], MAX_ROUNDS)
            except Exception as e:
                print(f"[Notary] Final result notarization failed: {e}")

        yield sse_event({
            "type": "round_complete",
            "round": current_round,
            "max_rounds": MAX_ROUNDS,
            "is_game_over": is_over,
            "winner": final_forecast["winner"] if is_over else None,
            "forecast": final_forecast,
            "sentiments": dict(game_state.voter_sentiments),
        })

    return StreamingResponse(generate(), media_type="text/event-stream")


def _estimate_player_policy_impact(policy_text: str) -> dict:
    """Estimate voter impact from player's free-text policy with rich keyword detection."""
    text = policy_text.lower()
    impact = {}

    keywords = {
        # Agriculture
        "msp": {"economy": -5, "welfare": 18, "cultural_identity": 5},
        "farm": {"economy": -5, "welfare": 18, "environment": 5},
        "crop": {"welfare": 12, "environment": 5},
        "irrigation": {"welfare": 15, "environment": 10},
        "agri": {"welfare": 15, "economy": -3},
        "organic": {"environment": 15, "welfare": 10},
        "cold storage": {"economy": 10, "welfare": 8},
        # Technology
        "5g": {"technology": 20, "economy": 12, "welfare": 5},
        "digital": {"technology": 15, "governance_reform": 10},
        "blockchain": {"technology": 15, "governance_reform": 18},
        "ai ": {"technology": 18, "economy": 10},
        "drone": {"technology": 15, "welfare": 5},
        "app": {"technology": 12, "governance_reform": 8},
        "internet": {"technology": 15, "social_progress": 8},
        # Economy
        "startup": {"technology": 15, "economy": 20},
        "gst": {"economy": 18, "governance_reform": 10},
        "tax": {"economy": 12, "governance_reform": 5},
        "loan": {"economy": 10, "welfare": 12},
        "business": {"economy": 15},
        "export": {"economy": 15},
        "industry": {"economy": 15, "technology": 5},
        "sez": {"economy": 20, "welfare": -5},
        "privatiz": {"economy": 15, "welfare": -10},
        # Welfare
        "health": {"welfare": 20, "social_progress": 12},
        "hospital": {"welfare": 18, "social_progress": 8},
        "mnrega": {"welfare": 22, "economy": -8, "social_progress": 10},
        "free": {"welfare": 15, "economy": -8},
        "ration": {"welfare": 18, "social_progress": 5},
        "pension": {"welfare": 18, "social_progress": 5},
        "ubi": {"welfare": 22, "economy": -12, "social_progress": 15},
        "subsid": {"welfare": 15, "economy": -8},
        # Education
        "education": {"social_progress": 18, "technology": 5, "welfare": 10},
        "school": {"social_progress": 15, "welfare": 10},
        "coaching": {"social_progress": 12, "welfare": 8},
        "skill": {"social_progress": 12, "economy": 8},
        # Social
        "women": {"social_progress": 20, "welfare": 10},
        "safety": {"social_progress": 15, "defense": 8},
        "reservation": {"social_progress": 18, "welfare": 8, "economy": -5},
        "shg": {"social_progress": 15, "welfare": 12},
        # Environment
        "solar": {"environment": 18, "technology": 10},
        "electric": {"environment": 15, "technology": 12},
        "green": {"environment": 18, "social_progress": 5},
        "tree": {"environment": 15},
        "water": {"environment": 12, "welfare": 10},
        "plastic": {"environment": 15},
        # Governance
        "transparen": {"governance_reform": 18, "social_progress": 8},
        "corrupt": {"governance_reform": 20, "social_progress": 10},
        "reform": {"governance_reform": 12, "social_progress": 8},
        "e-govern": {"governance_reform": 15, "technology": 10},
        # Defense
        "defense": {"defense": 20, "economy": 5},
        "security": {"defense": 15, "social_progress": 5},
        "army": {"defense": 18},
        # Culture
        "heritage": {"cultural_identity": 18, "social_progress": 5},
        "temple": {"cultural_identity": 15},
        "culture": {"cultural_identity": 15, "social_progress": 5},
    }

    matched_count = 0
    for keyword, axes in keywords.items():
        if keyword in text:
            matched_count += 1
            for axis, value in axes.items():
                impact[axis] = impact.get(axis, 0) + value

    # Combo bonus: multiple keywords = stronger policy signal
    if matched_count >= 3:
        for axis in impact:
            impact[axis] = int(impact[axis] * 1.3)
    elif matched_count >= 2:
        for axis in impact:
            impact[axis] = int(impact[axis] * 1.15)

    # Better fallback for unrecognized policies
    if not impact:
        impact = {"welfare": 8, "social_progress": 8, "governance_reform": 5}

    shifts = {}
    for vid, vp in VOTER_PROFILES.items():
        result = compute_policy_impact(impact, vp.ideology_alignment, vp.issue_weights, "general")
        shift = result["sentiment_shift"]
        old_val = game_state.voter_sentiments.get(vid, vp.base_happiness)
        new_val = max(0, min(100, old_val + shift))
        game_state.voter_sentiments[vid] = new_val
        shifts[vid] = {"old": round(old_val, 1), "new": round(new_val, 1), "shift": round(shift, 1)}
    return shifts


def _strip_voice_adjectives(text: str) -> str:
    """Strip voice/stage directions from the start of AI responses."""
    import re
    cleaned = re.sub(r'^\s*[\*\(][^\*\)]*[\*\)]\s*', '', text)
    cleaned = re.sub(r'^(Speaking|With|In a|Adjusting|Clearing|Leaning|Standing|Raising|Lowering|Pausing|Smiling|Nodding|Sighing)[^,\.]*[,\.]\s*', '', cleaned)
    return cleaned.strip() or text


def _apply_action_impact(actor_id: str, target_id: str, action_type: str):
    """Apply a political action's impact. NEUTRAL multipliers — player skill decides."""
    global candidate_boosts
    impact_map = {
        "policy_critique": {"actor": 2.5, "target": -4.0},
        "alliance_proposal": {"actor": 3.0, "target": 1.5},
        "public_challenge": {"actor": 3.0, "target": -3.5},
        "scandal_expose": {"actor": 2.0, "target": -6.0},
        "voter_appeal": {"actor": 5.0, "target": -0.5},
    }
    impact = impact_map.get(action_type, {"actor": 1.5, "target": -2.0})

    # NEUTRAL: all candidates play on equal footing
    actor_gain = impact["actor"] * random.uniform(0.8, 1.2)
    candidate_boosts[actor_id] = candidate_boosts.get(actor_id, 0.0) + actor_gain

    target_loss = impact["target"] * random.uniform(0.8, 1.2)
    candidate_boosts[target_id] = candidate_boosts.get(target_id, 0.0) + target_loss

    print(f"[Impact] {actor_id} +{actor_gain:.1f} | {target_id} {target_loss:.1f}")


def _pick_strategic_attackers(sorted_by_share: list, round_num: int) -> list:
    """Pick 2-3 strategic attacker/target pairs instead of all 4 every round.
    Makes cross-questions feel dynamic and less mechanical."""
    attackers = []
    ai_in_ranking = [(cid, share) for cid, share in sorted_by_share if cid in AI_CANDIDATE_IDS]

    if len(ai_in_ranking) < 2:
        return []

    # 2nd place attacks 1st place (competitive challenge)
    leader_id = sorted_by_share[0][0]
    challenger = ai_in_ranking[0] if ai_in_ranking[0][0] != leader_id else ai_in_ranking[1]
    attackers.append((challenger[0], leader_id))

    # 3rd or 4th place targets the player (desperation/relevance move)
    if len(ai_in_ranking) >= 2:
        desperate = ai_in_ranking[-1]
        attackers.append((desperate[0], "player"))

    # In later rounds (3+), add a 3rd attacker for intensity
    if round_num >= 3 and len(ai_in_ranking) >= 3:
        mid = ai_in_ranking[1]
        # Attack whoever is ideologically closest (steal voters)
        target = leader_id if mid[0] != leader_id else sorted_by_share[1][0]
        attackers.append((mid[0], target))

    return attackers


def _build_ground_report(voter_sentiments: dict, forecast: dict, shifts: dict,
                        share_change: float, round_num: int) -> dict:
    """Build actionable intelligence for the player."""
    insights = []
    vote_shares = forecast.get("vote_shares", {})

    # Which demographics moved most?
    for vid, data in shifts.items():
        if isinstance(data, dict):
            shift_val = data.get("shift", 0)
            vp = VOTER_PROFILES.get(vid)
            if vp and abs(shift_val) >= 3:
                direction = "rose" if shift_val > 0 else "fell"
                insights.append(f"{vp.name_en} sentiment {direction} {abs(shift_val):.0f} pts")

    # Who's leading?
    sorted_shares = sorted(vote_shares.items(), key=lambda x: x[1], reverse=True)
    leader_id, leader_share = sorted_shares[0]
    player_share = vote_shares.get("player", 0)

    if leader_id == "player":
        insights.append("You are in the LEAD! Defend your position.")
    else:
        leader_name = get_candidate_info(leader_id)["name"] if leader_id != "player" else "You"
        gap = leader_share - player_share
        insights.append(f"{leader_name.split(' ')[0]} leads by {gap:.1f}% — close the gap!")

    # Find vulnerable candidate (lowest share among AI)
    ai_shares = [(cid, share) for cid, share in sorted_shares if cid in AI_CANDIDATE_IDS]
    if ai_shares:
        weakest = ai_shares[-1]
        weakest_name = get_candidate_info(weakest[0])["name"]
        insights.append(f"{weakest_name.split(' ')[0]} is vulnerable at {weakest[1]:.1f}% — attack now")

    # Find unaddressed voter group (lowest sentiment)
    lowest_group = min(voter_sentiments.items(), key=lambda x: x[1])
    vp = VOTER_PROFILES.get(lowest_group[0])
    if vp:
        top_issue = list(vp.issue_weights.keys())[0].replace('_', ' ').title()
        insights.append(f"{vp.name_en} are unhappy ({lowest_group[1]:.0f}/100) — address {top_issue}")

    # Strategic tip based on round
    tips = {
        1: "Early rounds shape perception. Build trust with welfare policies.",
        2: "Economy policies are high-risk, high-reward. Choose wisely.",
        3: "Mid-game: attack opponents' weaknesses in the War Room.",
        4: "Late game: shore up your base. Don't spread too thin.",
        5: "Final round: go big or go home. Every vote counts.",
    }
    tip = tips.get(round_num, "Play strategically.")

    # Threat level
    if player_share >= leader_share:
        threat = "You're winning! Maintain pressure."
    elif leader_share - player_share < 5:
        threat = f"Tight race! {leader_share - player_share:.1f}% gap — one good move wins it."
    elif leader_share - player_share < 10:
        threat = f"Behind by {leader_share - player_share:.1f}% — use War Room attacks aggressively."
    else:
        threat = f"Danger zone: {leader_share - player_share:.1f}% behind — need a big swing."

    return {"insights": insights[:5], "threat_level": threat, "tip": tip}


# ─── Player Attack Endpoint ──────────────────────────────────────────────────

class PlayerAttackRequest(BaseModel):
    action_type: str
    target_id: str
    narrative: str


@app.post("/api/attack")
def player_attack(req: PlayerAttackRequest):
    """
    Player launches a political attack.
    Goes through the SAME Shield enforcement as AI candidates.
    """
    intent, verdict = build_player_action(
        action_type=req.action_type,
        target_id=req.target_id,
        narrative=req.narrative,
        round_number=current_round,
    )

    if verdict.allowed:
        _apply_action_impact("player", req.target_id, req.action_type)
        # Generate TTS for player's attack
        from bridge.audio_engine import generate_speech_base64 as gen_atk_audio
        audio_b64 = gen_atk_audio("vikas_purush", req.narrative)  # Use a neutral voice for player
        forecast = compute_forecast()
        return {
            "status": "allowed",
            "shield_verdict": "ALLOWED",
            "shield_reason": verdict.reason,
            "intent_hash": intent.intent_hash,
            "forecast": forecast,
            "sentiments": dict(game_state.voter_sentiments),
            "audio_base64": audio_b64,
        }
    else:
        return {
            "status": "blocked",
            "shield_verdict": "BLOCKED",
            "shield_reason": verdict.reason,
            "policy_ref": verdict.policy_ref,
            "intent_hash": intent.intent_hash,
        }


# ─── War Room API ────────────────────────────────────────────────────────────

@app.get("/api/warroom/{target_id}")
def get_warroom(target_id: str):
    """Return all available attacks for a target, including illegal ones."""
    attacks = get_warroom_attacks(target_id)
    info = get_candidate_info(target_id) if target_id != "player" else {"name": "Player"}
    vote_shares = compute_forecast().get("vote_shares", {})
    return {
        "target": target_id,
        "target_name": info.get("name", target_id),
        "vote_share": vote_shares.get(target_id, 0),
        "attacks": attacks,
    }


# ─── Shield Audit Log ────────────────────────────────────────────────────────

@app.get("/api/shield/audit")
def get_shield_audit():
    """Return the full Shield audit trail for display."""
    return {"audit_log": get_audit_log()}


@app.post("/api/reset")
def reset_game():
    global game_state, current_round, used_policies, candidate_boosts, player_momentum, last_player_share
    game_state = GameState()
    current_round = 0
    used_policies = {cid: [] for cid in AI_CANDIDATE_IDS}
    candidate_boosts = {cid: 0.0 for cid in ALL_CANDIDATE_IDS}
    player_momentum = 0.0
    last_player_share = 20.0
    reset_deepfake_state()
    clear_audit_log()
    reset_notary()
    return {"status": "reset", "round": 0}


# Legacy endpoints
@app.post("/api/round")
def play_round_legacy(req: RoundRequest):
    """Non-streaming fallback."""
    return {"error": "Use /api/round/stream for streaming"}

# ─── Deepfake Endpoints ─────────────────────────────────────────────────────

class DeepfakeDeployRequest(BaseModel):
    target_id: str
    template_id: str

class NotarizeRequest(BaseModel):
    statement: str

class DebunkRequest(BaseModel):
    clip_id: str


@app.get("/api/deepfake/options/{target_id}")
def api_deepfake_options(target_id: str):
    """Get available deepfake voice templates for a target."""
    options = get_deepfake_options(target_id)
    target_name = get_candidate_info(target_id)["name"] if target_id != "player" else "Player"
    return {"target": target_id, "target_name": target_name, "options": options}


@app.post("/api/deepfake/deploy")
def api_deepfake_deploy(req: DeepfakeDeployRequest):
    """Player deploys a voice deepfake against a target."""
    global candidate_boosts

    result = deploy_deepfake(
        deployer_id="player",
        target_id=req.target_id,
        template_id=req.template_id,
        round_num=current_round,
        generate_audio=True,
    )

    # Apply voter impact based on result
    if result["status"] == "success":
        # Deepfake succeeded — damage target demographics
        impact = result.get("impact", -10)
        target_demos = result.get("target_demos", [])
        for vid, vp in VOTER_PROFILES.items():
            if vid in target_demos:
                old_val = game_state.voter_sentiments.get(vid, vp.base_happiness)
                new_val = max(0, min(100, old_val + impact))
                game_state.voter_sentiments[vid] = new_val
        # Also penalize target's boost
        candidate_boosts[req.target_id] = candidate_boosts.get(req.target_id, 0.0) + impact * 0.5

    elif result["status"] == "detected":
        # Backfire on player
        penalty = result.get("deployer_penalty", -12)
        for vid, vp in VOTER_PROFILES.items():
            old_val = game_state.voter_sentiments.get(vid, vp.base_happiness)
            new_val = max(0, min(100, old_val + penalty * 0.6))
            game_state.voter_sentiments[vid] = new_val
        candidate_boosts["player"] = candidate_boosts.get("player", 0.0) + penalty

    elif result["status"] == "auto_debunked":
        # Backfire + target gets bonus
        penalty = result.get("deployer_penalty", -15)
        candidate_boosts["player"] = candidate_boosts.get("player", 0.0) + penalty
        bonus = result.get("target_bonus", 5)
        candidate_boosts[req.target_id] = candidate_boosts.get(req.target_id, 0.0) + bonus

    result["forecast"] = compute_forecast()
    result["sentiments"] = dict(game_state.voter_sentiments)
    return result


@app.post("/api/deepfake/debunk")
def api_deepfake_debunk(req: DebunkRequest):
    """Player debunks an active deepfake."""
    global candidate_boosts

    result = debunk_deepfake(debunker_id="player", clip_id=req.clip_id)

    if result["status"] == "debunked":
        # Bonus for player
        bonus = result.get("debunker_bonus", 10)
        candidate_boosts["player"] = candidate_boosts.get("player", 0.0) + bonus
        # Penalty for deployer
        deployer = result.get("deployer", "")
        penalty = result.get("deployer_penalty", -15)
        if deployer in candidate_boosts:
            candidate_boosts[deployer] = candidate_boosts.get(deployer, 0.0) + penalty

    result["forecast"] = compute_forecast()
    result["sentiments"] = dict(game_state.voter_sentiments)
    return result


@app.post("/api/truth/notarize")
def api_truth_notarize(req: NotarizeRequest):
    """Player notarizes a statement on the Truth Ledger."""
    global candidate_boosts

    entry = notarize_statement("player", req.statement, current_round)
    credibility = get_credibility_score("player")

    # Credibility bonus: +3 to player's boost
    candidate_boosts["player"] = candidate_boosts.get("player", 0.0) + 3.0

    return {
        "status": "notarized",
        "entry": entry,
        "credibility": credibility,
        "forecast": compute_forecast(),
        "sentiments": dict(game_state.voter_sentiments),
    }


@app.get("/api/truth/ledger/{candidate_id}")
def api_truth_ledger(candidate_id: str):
    """Get truth ledger entries for a candidate."""
    return {
        "candidate_id": candidate_id,
        "entries": get_truth_ledger(candidate_id),
        "credibility": get_credibility_score(candidate_id),
    }


@app.get("/api/deepfake/active")
def api_deepfake_active():
    """Get all active deepfakes and those targeting the player."""
    return {
        "all": get_active_deepfakes(),
        "against_player": get_deepfakes_against("player"),
    }


# ─── Solana Notary Endpoints ───────────────────────────────────────────────

@app.get("/api/notary/ledger")
def api_notary_ledger():
    """Get the full on-chain notarization ledger."""
    return {
        "entries": get_notary_ledger(),
        "stats": get_notary_stats(),
    }


@app.get("/api/notary/stats")
def api_notary_stats():
    """Get notary statistics and Solana connection status."""
    return get_notary_stats()


@app.get("/api/notary/status")
def api_notary_status():
    """Check if Solana Devnet is connected."""
    return {
        "solana_connected": is_solana_connected(),
        "network": "devnet" if is_solana_connected() else "local",
    }


# ─── Static Files & SPA Routing ──────────────────────────────────────────────

client_dist = os.path.join(PROJECT_ROOT, "client", "dist")

if os.path.isdir(client_dist):
    # Mount assets directly
    assets_dir = os.path.join(client_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Ignore API routes, let them 404 naturally if unbounded
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        
        # Check if requesting a direct file
        file_path = os.path.join(client_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to index.html for SPA routing
        return FileResponse(os.path.join(client_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    print("Panchayat API v3 (Streaming + Claw & Shield + Deepfake Engine) on http://localhost:8000")
    uvicorn.run("bridge.api_server:app", host="0.0.0.0", port=8000, reload=True)
