"""
Panchayat Shield Engine — ArmorIQ Intent Enforcement
=====================================================
The "Election Commission" of the Panchayat AI system.

Architecture:
  1. AI candidate (Claw) generates a political action plan
  2. Shield validates the action against the Election Code of Conduct
  3. If ArmorIQ SDK is available → uses cryptographic intent verification
  4. If not → uses local policy engine (mirrors ArmorIQ architecture)
  5. All decisions are logged to shield_audit_log.json

Satisfies hackathon requirements:
  - Structured intent model ✓
  - Policy-based runtime enforcement ✓
  - Logged & explained decisions ✓
  - At least 1 allowed + 1 blocked action ✓
"""

import os
import json
import time
import hashlib
import re
from typing import Optional
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ELECTION_CODE_PATH = os.path.join(PROJECT_ROOT, "data", "election_code.json")
AUDIT_LOG_PATH = os.path.join(PROJECT_ROOT, "data", "shield_audit_log.json")

# Load .env to pick up ARMORIQ_API_KEY
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# ─── Try loading ArmorIQ SDK (real enforcement) ────────────────────────────
ARMORIQ_AVAILABLE = False
armoriq_client = None

try:
    from armoriq_sdk import ArmorIQClient
    api_key = os.getenv("ARMORIQ_API_KEY", "")
    if api_key.startswith("ak_"):
        armoriq_client = ArmorIQClient(
            api_key=api_key,
            user_id="panchayat-game",
            agent_id="election-commission",
        )
        ARMORIQ_AVAILABLE = True
        print("[Shield] ArmorIQ SDK loaded — cryptographic enforcement ACTIVE")
    else:
        print("[Shield] ArmorIQ API key not configured — using local policy engine")
except ImportError:
    print("[Shield] ArmorIQ SDK not installed — using local policy engine")


# ─── Load Election Code of Conduct ─────────────────────────────────────────

def _load_election_code() -> dict:
    with open(ELECTION_CODE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


ELECTION_CODE = _load_election_code()
ALLOWED_TYPES = {a["type"] for a in ELECTION_CODE["allowed_actions"]}
BLOCKED_TYPES = {b["type"] for b in ELECTION_CODE["blocked_actions"]}


# ─── Structured Intent Schema ──────────────────────────────────────────────

class PoliticalIntent:
    """Structured intent model for a political action."""

    def __init__(
        self,
        candidate_id: str,
        action_type: str,
        target_id: str,
        narrative: str,
        reasoning: str,
        round_number: int,
    ):
        self.candidate_id = candidate_id
        self.action_type = action_type
        self.target_id = target_id
        self.narrative = narrative
        self.reasoning = reasoning
        self.round_number = round_number
        self.timestamp = datetime.now().isoformat()
        self.intent_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """Compute a deterministic hash of the intent for verification."""
        payload = f"{self.candidate_id}:{self.action_type}:{self.target_id}:{self.narrative}:{self.round_number}"
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "action_type": self.action_type,
            "target_id": self.target_id,
            "narrative": self.narrative,
            "reasoning": self.reasoning,
            "round_number": self.round_number,
            "timestamp": self.timestamp,
            "intent_hash": self.intent_hash,
        }


# ─── Shield Verdict ─────────────────────────────────────────────────────────

class ShieldVerdict:
    """Result of a Shield enforcement decision."""

    def __init__(
        self,
        allowed: bool,
        intent: PoliticalIntent,
        reason: str,
        policy_ref: str = "",
        enforcement_method: str = "local",
        intent_token: Optional[str] = None,
    ):
        self.allowed = allowed
        self.intent = intent
        self.reason = reason
        self.policy_ref = policy_ref
        self.enforcement_method = enforcement_method
        self.intent_token = intent_token
        self.verdict_time = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "verdict": "ALLOWED" if self.allowed else "BLOCKED",
            "intent": self.intent.to_dict(),
            "reason": self.reason,
            "policy_ref": self.policy_ref,
            "enforcement_method": self.enforcement_method,
            "intent_token": self.intent_token,
            "verdict_time": self.verdict_time,
        }


# ─── Content Analysis (Local Policy Engine) ────────────────────────────────

# Patterns that indicate blocked content
COMMUNAL_PATTERNS = [
    r'\b(hindu|muslim|christian|sikh|jain|buddhist)\b.*\b(only|alone|deserve)\b',
    r'\b(caste|religion|community)\b.*\b(vote|power|right)\b.*\b(only|exclusively)\b',
    r'\b(our people|their people)\b',
    r'\b(anti-national|traitor)\b',
]

PERSONAL_ATTACK_PATTERNS = [
    r'\b(family|wife|husband|son|daughter|father|mother)\b.*\b(corrupt|criminal|thief)\b',
    r'\b(character|personal life|private)\b.*\b(questionable|immoral|disgrace)\b',
    r'\byour (entire )?family\b',
]

FABRICATION_PATTERNS = [
    r'\bsecretly\b.*\b(plan|plans|plotting)\b',
    r'\beveryone knows\b.*\b(corrupt|criminal|fraud)\b',
    r'\bsources say\b.*\b(illegal|criminal)\b',
    r'\bI have proof\b.*\b(but cannot show)\b',
]

INTIMIDATION_PATTERNS = [
    r'\bif you don.?t vote\b.*\b(consequence|suffer|lose|stop)\b',
    r'\bschemes will (stop|end|be cut)\b',
    r'\byou will regret\b',
    r'\bremember (who|what)\b.*\b(power|control)\b',
]

BRIBERY_PATTERNS = [
    r'\b(cash|money|rupees|rs)\b.*\b(every|each|per)\b.*\b(vote|voter|family)\b',
    r'\bfree (tv|laptop|phone|scooter)\b.*\b(vote|elect)\b',
    r'\b(gift|reward)\b.*\b(for voting|for support)\b',
]


def _check_patterns(text: str, patterns: list) -> bool:
    """Check if text matches any of the given regex patterns."""
    text_lower = text.lower()
    for pattern in patterns:
        if re.search(pattern, text_lower):
            return True
    return False


def _analyze_content(narrative: str) -> tuple[str, str, str]:
    """
    Analyze narrative content for policy violations.
    Returns (detected_violation_type, reason, policy_ref) or ("clean", "", "")
    """
    if _check_patterns(narrative, COMMUNAL_PATTERNS):
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == "communal_incitement")
        return "communal_incitement", info["block_reason"], "Section 125, Representation of the People Act"

    if _check_patterns(narrative, PERSONAL_ATTACK_PATTERNS):
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == "personal_attack")
        return "personal_attack", info["block_reason"], "Model Code of Conduct, Para 1(2)"

    if _check_patterns(narrative, FABRICATION_PATTERNS):
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == "fabricated_claim")
        return "fabricated_claim", info["block_reason"], "Section 171G, Indian Penal Code"

    if _check_patterns(narrative, INTIMIDATION_PATTERNS):
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == "voter_intimidation")
        return "voter_intimidation", info["block_reason"], "Section 171C, Indian Penal Code"

    if _check_patterns(narrative, BRIBERY_PATTERNS):
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == "bribery_promise")
        return "bribery_promise", info["block_reason"], "Section 171B, Indian Penal Code"

    return "clean", "", ""


# ─── Shield Validate (Main Entry Point) ─────────────────────────────────────

def validate_political_action(intent: PoliticalIntent) -> ShieldVerdict:
    """
    Main validation function. Uses ArmorIQ if available, otherwise local engine.
    
    This is the SEPARATION between Reasoning (Claw) and Execution (Shield):
    - The Claw agent has already reasoned and produced an intent
    - Shield validates it BEFORE any game-state mutation
    """

    # ── Step 1: Check action type against structured intent model ──
    if intent.action_type in BLOCKED_TYPES:
        # Deterministically blocked by type
        info = next(b for b in ELECTION_CODE["blocked_actions"] if b["type"] == intent.action_type)
        verdict = ShieldVerdict(
            allowed=False,
            intent=intent,
            reason=f"Action type '{intent.action_type}' is categorically prohibited. {info['block_reason']}",
            policy_ref=info["block_reason"],
            enforcement_method="structured_intent_model",
        )
        _log_verdict(verdict)
        return verdict

    if intent.action_type not in ALLOWED_TYPES:
        # Unknown action type → fail-closed
        verdict = ShieldVerdict(
            allowed=False,
            intent=intent,
            reason=f"Unknown action type '{intent.action_type}'. Fail-closed: action blocked.",
            policy_ref="Enforcement Policy: fail_closed",
            enforcement_method="fail_closed",
        )
        _log_verdict(verdict)
        return verdict

    # ── Step 2: Content-level analysis (even allowed types can have bad content) ──
    violation_type, violation_reason, policy_ref = _analyze_content(intent.narrative)

    if violation_type != "clean":
        verdict = ShieldVerdict(
            allowed=False,
            intent=intent,
            reason=f"Content analysis detected '{violation_type}': {violation_reason}",
            policy_ref=policy_ref,
            enforcement_method="content_analysis",
        )
        _log_verdict(verdict)
        return verdict

    # ── Step 3: ArmorIQ verification (if available) ──
    if ARMORIQ_AVAILABLE and armoriq_client:
        try:
            verdict = _verify_with_armoriq(intent)
            _log_verdict(verdict)
            return verdict
        except Exception as e:
            print(f"[Shield] ArmorIQ verification failed, falling back to local: {e}")

    # ── Step 4: Local approval ──
    verdict = ShieldVerdict(
        allowed=True,
        intent=intent,
        reason=f"Action type '{intent.action_type}' is permitted under the Model Code of Conduct. Content analysis passed.",
        policy_ref="Model Code of Conduct — Allowed Actions",
        enforcement_method="local_policy_engine",
    )
    _log_verdict(verdict)
    return verdict


def _verify_with_armoriq(intent: PoliticalIntent) -> ShieldVerdict:
    """Use ArmorIQ SDK for cryptographic intent verification."""
    plan = {
        "goal": f"Political action by {intent.candidate_id}",
        "steps": [
            {
                "action": intent.action_type,
                "tool": "political_action_engine",
                "inputs": {
                    "target": intent.target_id,
                    "narrative": intent.narrative,
                    "round": intent.round_number,
                },
            }
        ],
    }

    # Capture plan and get intent token
    plan_capture = armoriq_client.capture_plan(
        llm="gemini",
        prompt=f"Candidate {intent.candidate_id} executing {intent.action_type} against {intent.target_id}",
        plan=plan,
    )
    token = armoriq_client.get_intent_token(plan_capture)

    # Invoke with verification
    result = armoriq_client.invoke(
        mcp_name="panchayat-election",
        action=intent.action_type,
        intent_token=token,
        inputs={
            "candidate": intent.candidate_id,
            "target": intent.target_id,
            "narrative": intent.narrative,
        },
    )

    allowed = result.get("status") != "blocked"
    return ShieldVerdict(
        allowed=allowed,
        intent=intent,
        reason=result.get("reason", "Verified by ArmorIQ"),
        policy_ref=result.get("policy_ref", "ArmorIQ Policy Engine"),
        enforcement_method="armoriq_sdk",
        intent_token=str(token),
    )


# ─── Audit Logging ──────────────────────────────────────────────────────────

def _log_verdict(verdict: ShieldVerdict):
    """Append verdict to the audit log file."""
    log_entry = verdict.to_dict()

    # Load existing log
    if os.path.exists(AUDIT_LOG_PATH):
        with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            try:
                audit_log = json.load(f)
            except json.JSONDecodeError:
                audit_log = []
    else:
        audit_log = []

    audit_log.append(log_entry)

    # Write back
    with open(AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(audit_log, f, indent=2, ensure_ascii=False)

    status = "ALLOWED" if verdict.allowed else "BLOCKED"
    print(f"[Shield] {status} | {verdict.intent.candidate_id} → {verdict.intent.action_type} → {verdict.intent.target_id} | {verdict.reason[:80]}")


def get_audit_log() -> list:
    """Return the full audit log."""
    if os.path.exists(AUDIT_LOG_PATH):
        with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def clear_audit_log():
    """Clear the audit log (on game reset)."""
    with open(AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump([], f)
