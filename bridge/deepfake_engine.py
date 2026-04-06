"""
Panchayat Deepfake Engine — Voice Clone Attacks
=================================================
Simulates real-world election deepfake attacks using voice cloning.

Architecture:
  1. Attacker picks a target + fake quote template
  2. ElevenLabs generates audio using TARGET's voice ID (voice cloning)
  3. Audio hash (SHA-256) computed as "watermark"
  4. Truth Ledger checked: if target has notarized statements, auto-debunk
  5. Detection probability roll: Shield may catch it
  6. If undetected: massive voter sentiment shift on target demographics
  7. If detected: backfires on deployer

This mirrors the real-world problem of AI voice deepfakes in Indian elections.
"""

import os
import hashlib
import random
import time
from typing import Optional
from datetime import datetime

# Solana integration for on-chain notarization
try:
    from bridge.solana_notary import (
        notarize_truth_statement as _solana_notarize_truth,
        notarize_deepfake_detection as _solana_notarize_deepfake,
        is_solana_connected,
    )
    _HAS_SOLANA = True
except ImportError:
    _HAS_SOLANA = False

# ─── Deepfake Templates ────────────────────────────────────────────────────
# Pre-crafted fake quotes for each candidate, targeting specific demographics.
# These are things the candidate would NEVER say — designed to damage them.

DEEPFAKE_TEMPLATES: dict[str, list[dict]] = {
    "dharma_rakshak": [
        {
            "id": "df_dr_1",
            "label": "Anti-MSP Leak",
            "fake_quote": "MSP was a mistake. Farmers should learn to compete in the open market like everyone else.",
            "target_demos": ["kisan"],
            "impact": -12,
            "detection_base": 0.40,
        },
        {
            "id": "df_dr_2",
            "label": "Secret Atheism",
            "fake_quote": "These ancient texts are just stories for the uneducated. I only use religion for votes.",
            "target_demos": ["sarkari", "kisan"],
            "impact": -10,
            "detection_base": 0.35,
        },
        {
            "id": "df_dr_3",
            "label": "Anti-Village",
            "fake_quote": "This village is a lost cause. I already have a flat in Delhi waiting for me after the election.",
            "target_demos": ["kisan", "yuva"],
            "impact": -14,
            "detection_base": 0.45,
        },
    ],
    "vikas_purush": [
        {
            "id": "df_vp_1",
            "label": "Data Sale Confession",
            "fake_quote": "The 5G project is just a front. The real money is in selling voter data to corporations.",
            "target_demos": ["yuva", "vyapari"],
            "impact": -13,
            "detection_base": 0.40,
        },
        {
            "id": "df_vp_2",
            "label": "Anti-Poor Rant",
            "fake_quote": "Why should I waste bandwidth on villages that can barely afford electricity?",
            "target_demos": ["kisan", "sarkari"],
            "impact": -11,
            "detection_base": 0.35,
        },
        {
            "id": "df_vp_3",
            "label": "Foreign Agent",
            "fake_quote": "My real investors are foreign tech companies. They told me what to promise.",
            "target_demos": ["vyapari", "sarkari"],
            "impact": -12,
            "detection_base": 0.45,
        },
    ],
    "jan_neta": [
        {
            "id": "df_jn_1",
            "label": "Fund Diversion",
            "fake_quote": "Half the MNREGA money goes to my party workers. That is how we survive.",
            "target_demos": ["kisan", "sarkari"],
            "impact": -14,
            "detection_base": 0.40,
        },
        {
            "id": "df_jn_2",
            "label": "Anti-Business",
            "fake_quote": "Every shop owner is a thief in disguise. We will crush them with inspections.",
            "target_demos": ["vyapari"],
            "impact": -11,
            "detection_base": 0.35,
        },
        {
            "id": "df_jn_3",
            "label": "Elitist Slip",
            "fake_quote": "These poor people are tools. I use their misery for my political career.",
            "target_demos": ["kisan", "yuva", "sarkari"],
            "impact": -15,
            "detection_base": 0.50,
        },
    ],
    "mukti_devi": [
        {
            "id": "df_md_1",
            "label": "Anti-Tradition Rant",
            "fake_quote": "All traditions are chains. Every temple and festival should be shut down.",
            "target_demos": ["kisan", "sarkari"],
            "impact": -13,
            "detection_base": 0.40,
        },
        {
            "id": "df_md_2",
            "label": "Foreign Funding",
            "fake_quote": "My NGO gets funds from abroad. They write my speeches for me.",
            "target_demos": ["vyapari", "sarkari"],
            "impact": -11,
            "detection_base": 0.35,
        },
        {
            "id": "df_md_3",
            "label": "Anti-Male Bias",
            "fake_quote": "Men should have no say in policy. I will ensure only women make decisions.",
            "target_demos": ["kisan", "vyapari"],
            "impact": -10,
            "detection_base": 0.40,
        },
    ],
    "player": [
        {
            "id": "df_pl_1",
            "label": "Outsider Confession",
            "fake_quote": "I have no idea how a Panchayat works. I just wanted the power and the title.",
            "target_demos": ["kisan", "sarkari", "yuva"],
            "impact": -14,
            "detection_base": 0.40,
        },
        {
            "id": "df_pl_2",
            "label": "Bribery Tape",
            "fake_quote": "Just tell the voters what they want to hear. We will figure out the money later.",
            "target_demos": ["vyapari", "kisan"],
            "impact": -12,
            "detection_base": 0.35,
        },
        {
            "id": "df_pl_3",
            "label": "Exit Plan",
            "fake_quote": "This Panchayat is just a stepping stone. I will leave for the city after winning.",
            "target_demos": ["kisan", "yuva", "sarkari"],
            "impact": -13,
            "detection_base": 0.45,
        },
    ],
}


# --- Truth Ledger (Local Hash Store) -------------------------------------------
# Stores SHA-256 hashes of legitimate statements for deepfake defense verification.

_truth_ledger: dict[str, list[dict]] = {}
# Tracks active deepfakes in the current game
_active_deepfakes: list[dict] = []
_deepfake_counter: int = 0


def _compute_statement_hash(candidate_id: str, statement: str, round_num: int) -> str:
    """Compute SHA-256 hash of a legitimate statement — the 'watermark'."""
    payload = f"{candidate_id}::{statement}::{round_num}"
    return hashlib.sha256(payload.encode()).hexdigest()


def notarize_statement(candidate_id: str, statement: str, round_num: int) -> dict:
    """Register a legitimate statement on the Truth Ledger.
    If Solana is connected, also writes to Solana Devnet."""
    stmt_hash = _compute_statement_hash(candidate_id, statement, round_num)

    # Try Solana notarization first
    tx_signature = f"local_{stmt_hash[:16]}"
    explorer_url = None
    network = "local"

    if _HAS_SOLANA:
        try:
            solana_result = _solana_notarize_truth(candidate_id, statement, round_num)
            tx_signature = solana_result.get("tx_signature", tx_signature)
            explorer_url = solana_result.get("explorer_url")
            network = solana_result.get("network", "local")
        except Exception as e:
            print(f"[TruthLedger] Solana notarization failed: {e}")

    entry = {
        "candidate_id": candidate_id,
        "statement": statement[:100],
        "round": round_num,
        "hash": stmt_hash,
        "timestamp": datetime.now().isoformat(),
        "tx_signature": tx_signature,
        "explorer_url": explorer_url,
        "network": network,
    }

    if candidate_id not in _truth_ledger:
        _truth_ledger[candidate_id] = []
    _truth_ledger[candidate_id].append(entry)

    print(f"[TruthLedger] Notarized: {candidate_id} round {round_num} → {tx_signature[:20]}... ({network})")
    return entry


def get_credibility_score(candidate_id: str) -> float:
    """Credibility = percentage of rounds notarized (max 100)."""
    entries = _truth_ledger.get(candidate_id, [])
    # Max 5 rounds, each notarization = 20% credibility
    return min(100.0, len(entries) * 20.0)


def get_truth_ledger(candidate_id: str) -> list[dict]:
    """Return all Truth Ledger entries for a candidate."""
    return _truth_ledger.get(candidate_id, [])


def has_notarized_defense(target_id: str) -> bool:
    """Check if target has ANY notarized statements — passive deepfake defense."""
    return len(_truth_ledger.get(target_id, [])) > 0


# ─── Deepfake Deployment ──────────────────────────────────────────────────

def get_deepfake_options(target_id: str) -> list[dict]:
    """Get available deepfake templates for a target."""
    templates = DEEPFAKE_TEMPLATES.get(target_id, [])
    return [
        {
            "id": t["id"],
            "label": t["label"],
            "fake_quote": t["fake_quote"],
            "target_demos": t["target_demos"],
            "impact_range": f"-{abs(t['impact'])} to -{abs(t['impact']) - 3}",
            "detection_risk": int(t["detection_base"] * 100),
        }
        for t in templates
    ]


def deploy_deepfake(
    deployer_id: str,
    target_id: str,
    template_id: str,
    round_num: int,
    generate_audio: bool = True,
) -> dict:
    """
    Deploy a voice deepfake attack.

    Flow:
    1. Find template → generate audio using target's voice
    2. Check Truth Ledger for auto-debunk
    3. Roll detection probability
    4. Return result with audio + impact
    """
    global _deepfake_counter

    # Find the template
    templates = DEEPFAKE_TEMPLATES.get(target_id, [])
    template = next((t for t in templates if t["id"] == template_id), None)
    if not template:
        return {"status": "error", "reason": "Invalid deepfake template"}

    _deepfake_counter += 1
    clip_id = f"clip_{_deepfake_counter}"

    # Generate fake audio using TARGET's voice
    audio_b64 = ""
    if generate_audio:
        try:
            from bridge.audio_engine import generate_speech_base64
            audio_b64 = generate_speech_base64(target_id, template["fake_quote"])
        except Exception as e:
            print(f"[Deepfake] Audio generation failed: {e}")

    # Compute audio "watermark" hash
    audio_hash = hashlib.sha256(
        f"{target_id}:{template['fake_quote']}:{round_num}".encode()
    ).hexdigest()

    # ── Check 1: Truth Ledger auto-debunk ──
    if has_notarized_defense(target_id):
        credibility = get_credibility_score(target_id)
        auto_debunk_chance = min(0.85, credibility / 100.0)

        if random.random() < auto_debunk_chance:
            result = {
                "status": "auto_debunked",
                "clip_id": clip_id,
                "deployer": deployer_id,
                "target": target_id,
                "fake_quote": template["fake_quote"],
                "label": template["label"],
                "audio_base64": audio_b64,
                "audio_hash": audio_hash,
                "reason": f"Truth Ledger verification: {target_id} has {len(_truth_ledger[target_id])} notarized statements. Audio watermark mismatch detected.",
                "deployer_penalty": -15,
                "target_bonus": 5,
            }
            _active_deepfakes.append({**result, "round": round_num})
            return result

    # ── Check 2: Shield detection probability ──
    # Detection gets better each round: base + 10% per round
    detection_prob = min(0.90, template["detection_base"] + 0.10 * round_num)

    if random.random() < detection_prob:
        result = {
            "status": "detected",
            "clip_id": clip_id,
            "deployer": deployer_id,
            "target": target_id,
            "fake_quote": template["fake_quote"],
            "label": template["label"],
            "audio_base64": "",  # Don't serve detected deepfake audio
            "audio_hash": audio_hash,
            "detection_probability": f"{detection_prob:.0%}",
            "reason": f"High-frequency watermark analysis detected synthetic audio patterns. Detection confidence: {detection_prob:.0%}",
            "deployer_penalty": -12,
        }
        _active_deepfakes.append({**result, "round": round_num})
        return result

    # ── Undetected: deepfake succeeds ──
    result = {
        "status": "success",
        "clip_id": clip_id,
        "deployer": deployer_id,
        "target": target_id,
        "fake_quote": template["fake_quote"],
        "label": template["label"],
        "audio_base64": audio_b64,
        "audio_hash": audio_hash,
        "target_demos": template["target_demos"],
        "impact": template["impact"],
        "reason": "Deepfake deployed successfully. Audio passed watermark analysis.",
    }
    _active_deepfakes.append({**result, "round": round_num})
    return result


def debunk_deepfake(debunker_id: str, clip_id: str) -> dict:
    """Manually debunk an active deepfake."""
    clip = next((d for d in _active_deepfakes if d.get("clip_id") == clip_id), None)
    if not clip:
        return {"status": "error", "reason": "Deepfake clip not found"}

    if clip.get("status") != "success":
        return {"status": "error", "reason": "This clip was already detected/debunked"}

    # Mark as debunked
    clip["status"] = "debunked"
    clip["debunked_by"] = debunker_id

    deployer = clip.get("deployer", "unknown")
    return {
        "status": "debunked",
        "clip_id": clip_id,
        "deployer": deployer,
        "target": clip.get("target"),
        "fake_quote": clip.get("fake_quote"),
        "debunker_bonus": 10,
        "deployer_penalty": -15,
        "reason": f"Voice analysis confirmed synthetic audio. {deployer} exposed as deepfake deployer.",
    }


def get_active_deepfakes() -> list[dict]:
    """Get all active (undetected) deepfakes still in play."""
    return [
        {
            "clip_id": d.get("clip_id"),
            "deployer": d.get("deployer"),
            "target": d.get("target"),
            "fake_quote": d.get("fake_quote"),
            "label": d.get("label"),
            "status": d.get("status"),
            "round": d.get("round"),
        }
        for d in _active_deepfakes
    ]


def get_deepfakes_against(target_id: str) -> list[dict]:
    """Get active undetected deepfakes targeting a specific candidate."""
    return [
        {
            "clip_id": d.get("clip_id"),
            "deployer": d.get("deployer"),
            "fake_quote": d.get("fake_quote"),
            "label": d.get("label"),
            "status": d.get("status"),
            "round": d.get("round"),
        }
        for d in _active_deepfakes
        if d.get("target") == target_id and d.get("status") == "success"
    ]


def reset_deepfake_state():
    """Reset all deepfake state on game reset."""
    global _truth_ledger, _active_deepfakes, _deepfake_counter
    _truth_ledger = {}
    _active_deepfakes = []
    _deepfake_counter = 0
