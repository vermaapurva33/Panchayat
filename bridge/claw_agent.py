"""
Panchayat Claw Agent — Autonomous Political Strategy
=====================================================
The "Claw" (autonomous reasoning) layer.

Each AI candidate has a strategy agent that:
1. Analyzes the current game state (voter sentiments, opponent positions)
2. Reasons about the best political action to take
3. Outputs a STRUCTURED action plan (PoliticalIntent)
4. The plan is then validated by Shield BEFORE execution

This is the clean separation between Reasoning (here) and Enforcement (shield_engine.py).
"""

import os
import sys
import json
import time
import random
from typing import Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from bridge.ai_prompts import get_candidate_info
from bridge.shield_engine import PoliticalIntent, validate_political_action, ShieldVerdict

# Rate limit
RATE_LIMIT_DELAY = 2


def _get_llm():
    """Get the Groq LLM instance."""
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return ChatGroq(
        model=model,
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
        max_tokens=500,
    )


# ─── Strategy Prompt Template ──────────────────────────────────────────────

STRATEGY_PROMPT = """You are {name}, a political strategist for the "{party}" party.

CURRENT GAME STATE:
- Round: {round_number} of {max_rounds}
- Your vote share: {own_share}%
- Your recent manifesto: {own_policy}

OPPONENTS:
{opponents_info}

VOTER SENTIMENTS:
{voter_sentiments}

YOUR PERSONALITY: {archetype}
YOUR IDEOLOGY: {ideology_summary}

AVAILABLE ACTION TYPES (pick exactly ONE):
1. policy_critique — Factually critique an opponent's policy weakness
2. alliance_proposal — Propose an alliance with another candidate on shared ground
3. public_challenge — Challenge an opponent to defend their position
4. scandal_expose — Expose contradictions in an opponent's statements
5. voter_appeal — Make a direct emotional appeal to a voter group

RULES:
- You MUST stay in character
- You MUST target ONE specific opponent (by their candidate_id)
- You MUST provide a 1-2 sentence narrative in your character's voice
- Do NOT use hateful, communal, or personal attacks — they will be BLOCKED

Respond in this EXACT JSON format (no markdown, no extra text):
{{
  "action_type": "policy_critique",
  "target_id": "opponent_candidate_id",
  "narrative": "Your in-character political statement",
  "reasoning": "Brief strategic reasoning for this choice"
}}"""


# ─── Generate Political Action ─────────────────────────────────────────────

def generate_political_action(
    candidate_id: str,
    round_number: int,
    max_rounds: int,
    vote_shares: dict,
    ai_picks: dict,
    voter_sentiments: dict,
    all_candidates: list,
) -> tuple[PoliticalIntent, ShieldVerdict]:
    """
    CLAW: Generate an autonomous political action for an AI candidate.
    
    Returns both the intent AND the shield verdict.
    The caller should only execute the action if verdict.allowed is True.
    """
    candidate_info = get_candidate_info(candidate_id)
    own_share = vote_shares.get(candidate_id, 20.0)
    own_policy = ai_picks.get(candidate_id, "No policy announced yet")

    # Build opponent info
    opponents = []
    for cid in all_candidates:
        if cid == candidate_id:
            continue
        try:
            opp_info = get_candidate_info(cid)
            opp_name = opp_info.get("name", cid)
        except ValueError:
            opp_name = cid
        opp_share = vote_shares.get(cid, 20.0)
        opp_policy = ai_picks.get(cid, "Unknown")
        opponents.append(f"  - {cid} ({opp_name}): {opp_share:.1f}% vote share, policy: \"{opp_policy}\"")

    opponents_text = "\n".join(opponents)

    # Build voter sentiment text
    voter_lines = []
    for vid, happiness in voter_sentiments.items():
        label = "Jubilant" if happiness >= 70 else "Favourable" if happiness >= 55 else "Restless" if happiness >= 40 else "Discontent" if happiness >= 25 else "Agitated"
        voter_lines.append(f"  - {vid}: {happiness:.0f}% ({label})")
    voters_text = "\n".join(voter_lines)

    prompt = STRATEGY_PROMPT.format(
        name=candidate_info.get("name", candidate_id),
        party=candidate_info.get("party", "Independent"),
        round_number=round_number,
        max_rounds=max_rounds,
        own_share=f"{own_share:.1f}",
        own_policy=own_policy,
        opponents_info=opponents_text,
        voter_sentiments=voters_text,
        archetype=candidate_info.get("archetype", "Politician"),
        ideology_summary=candidate_info.get("backstory", ""),
    )

    try:
        llm = _get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Parse JSON from response (handle markdown code blocks)
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        action_data = json.loads(raw)

        intent = PoliticalIntent(
            candidate_id=candidate_id,
            action_type=action_data.get("action_type", "policy_critique"),
            target_id=action_data.get("target_id", "player"),
            narrative=action_data.get("narrative", "No comment."),
            reasoning=action_data.get("reasoning", "Strategic decision."),
            round_number=round_number,
        )

    except Exception as e:
        print(f"[Claw] Error generating action for {candidate_id}: {e}")
        # Fallback: generate a safe default action
        intent = _generate_fallback_action(candidate_id, round_number, vote_shares, all_candidates)

    # ── SHIELD VALIDATION ──
    # This is the critical separation: Claw reasoned, now Shield decides
    verdict = validate_political_action(intent)

    return intent, verdict


def _generate_fallback_action(
    candidate_id: str,
    round_number: int,
    vote_shares: dict,
    all_candidates: list,
) -> PoliticalIntent:
    """Generate a safe fallback action when LLM fails."""
    # Target the current leader (if not self)
    sorted_candidates = sorted(
        [(cid, share) for cid, share in vote_shares.items() if cid != candidate_id],
        key=lambda x: x[1],
        reverse=True,
    )
    target = sorted_candidates[0][0] if sorted_candidates else "player"

    fallback_narratives = [
        (
            "policy_critique",
            f"I question the fiscal viability of my opponent's proposals. The numbers simply do not add up.",
            "Targeting the leader to close the gap.",
        ),
        (
            "public_challenge",
            f"I challenge my esteemed opponent to a public debate on their economic policy.",
            "Forcing the leader to defend their position publicly.",
        ),
        (
            "voter_appeal",
            f"I appeal to the people of this Panchayat — your trust is my greatest asset.",
            "Building direct voter connection when other strategies are unavailable.",
        ),
    ]

    action_type, narrative, reasoning = random.choice(fallback_narratives)

    return PoliticalIntent(
        candidate_id=candidate_id,
        action_type=action_type,
        target_id=target,
        narrative=narrative,
        reasoning=reasoning,
        round_number=round_number,
    )


# ─── Player Action Builder ─────────────────────────────────────────────────

def build_player_action(
    action_type: str,
    target_id: str,
    narrative: str,
    round_number: int,
) -> tuple[PoliticalIntent, ShieldVerdict]:
    """
    Build and validate a player's political action.
    Same Shield enforcement as AI candidates — no shortcuts.
    """
    intent = PoliticalIntent(
        candidate_id="player",
        action_type=action_type,
        target_id=target_id,
        narrative=narrative,
        reasoning="Player-initiated action",
        round_number=round_number,
    )

    verdict = validate_political_action(intent)
    return intent, verdict
