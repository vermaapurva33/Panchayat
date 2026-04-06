"""
Panchayat Solana Notary — Blockchain Election Integrity
=========================================================
Records election events (Truth Ledger entries, round results, deepfake detections)
as immutable, tamper-proof memo transactions on Solana Devnet.

Architecture:
  1. Game generates a SHA-256 hash of election data (round result, notarized statement, etc.)
  2. Hash is written as a Memo instruction to Solana Devnet
  3. Transaction signature is returned as proof-of-notarization
  4. Frontend can link to Solana Explorer for independent verification

This demonstrates how blockchain can ensure election data integrity —
even if the game server is compromised, the on-chain record is immutable.

Requirements:
  - SOLANA_PRIVATE_KEY in .env (base58 encoded, devnet funded)
  - If no key is set, falls back to a local-only hash ledger
"""

import os
import sys
import json
import hashlib
import base64
import time
from datetime import datetime
from typing import Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))


# ─── Solana Client Setup ───────────────────────────────────────────────────

_solana_available = False
_keypair = None
_solana_client = None

try:
    from solders.keypair import Keypair  # type: ignore
    from solders.pubkey import Pubkey  # type: ignore
    from solders.transaction import Transaction  # type: ignore
    from solana.rpc.api import Client as SolanaClient
    _solana_available = True
except ImportError as e:
    print(f"[SolanaNotary] solana/solders not installed ({e}) — using local-only mode")
except Exception as e:
    print(f"[SolanaNotary] Import error: {e} — using local-only mode")


def _init_solana():
    """Initialize Solana client and keypair from env."""
    global _solana_client, _keypair, _solana_available

    if not _solana_available:
        return False

    private_key = os.getenv("SOLANA_PRIVATE_KEY", "")
    if not private_key:
        print("[SolanaNotary] No SOLANA_PRIVATE_KEY set — using local-only mode")
        return False

    try:
        _keypair = Keypair.from_base58_string(private_key)
        _solana_client = SolanaClient("https://api.devnet.solana.com")

        # Quick balance check
        balance = _solana_client.get_balance(_keypair.pubkey())
        lamports = balance.value if hasattr(balance, 'value') else 0
        sol = lamports / 1e9
        print(f"[SolanaNotary] Connected to Devnet. Wallet: {str(_keypair.pubkey())[:12]}... Balance: {sol:.4f} SOL")
        return True

    except Exception as e:
        print(f"[SolanaNotary] Failed to init Solana: {e}")
        _solana_available = False
        return False


# Try to initialize on module load
_solana_ready = _init_solana() if _solana_available else False


# ─── Local Fallback Ledger ──────────────────────────────────────────────────

_local_ledger: list[dict] = []
_tx_counter: int = 0


def _local_notarize(data_hash: str, memo: str, event_type: str) -> dict:
    """Fallback: store notarization locally when Solana is unavailable."""
    global _tx_counter
    _tx_counter += 1

    # Generate a deterministic pseudo-signature
    sig_hash = hashlib.sha256(f"{data_hash}:{_tx_counter}:{time.time()}".encode()).hexdigest()
    pseudo_sig = f"local_{sig_hash[:44]}"

    entry = {
        "tx_signature": pseudo_sig,
        "data_hash": data_hash,
        "memo": memo[:200],
        "event_type": event_type,
        "timestamp": datetime.now().isoformat(),
        "block": _tx_counter,
        "network": "local",
        "explorer_url": None,
        "status": "confirmed_local",
    }
    _local_ledger.append(entry)
    return entry


# ─── Core Notarization Functions ───────────────────────────────────────────

def notarize_election_event(
    event_type: str,
    data: dict,
    memo: str = "",
) -> dict:
    """
    Notarize an election event on Solana (or local fallback).

    Args:
        event_type: One of: 'round_result', 'truth_statement', 'deepfake_detected',
                    'shield_verdict', 'vote_count', 'election_final'
        data: Dictionary of event data to hash
        memo: Human-readable memo for the transaction

    Returns:
        dict with tx_signature, data_hash, explorer_url, network, timestamp
    """
    # Compute deterministic hash of the event data
    canonical = json.dumps(data, sort_keys=True, default=str)
    data_hash = hashlib.sha256(canonical.encode()).hexdigest()

    if not memo:
        memo = f"PANCHAYAT:{event_type}:{data_hash[:16]}"

    # Try Solana first, fall back to local
    if _solana_ready and _solana_client and _keypair:
        return _solana_notarize(data_hash, memo, event_type)
    else:
        return _local_notarize(data_hash, memo, event_type)


def _solana_notarize(data_hash: str, memo: str, event_type: str) -> dict:
    """Write a memo transaction to Solana Devnet."""
    try:
        from solders.instruction import Instruction, AccountMeta  # type: ignore

        # Memo Program ID
        MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

        # Build memo instruction
        memo_data = f"{memo}|hash:{data_hash[:32]}".encode()
        memo_ix = Instruction(
            program_id=MEMO_PROGRAM_ID,
            accounts=[AccountMeta(_keypair.pubkey(), is_signer=True, is_writable=True)],
            data=memo_data,
        )

        # Build and send transaction
        tx = Transaction()
        tx.add(memo_ix)

        result = _solana_client.send_transaction(tx, _keypair)
        sig = str(result.value) if hasattr(result, 'value') else str(result)

        entry = {
            "tx_signature": sig,
            "data_hash": data_hash,
            "memo": memo[:200],
            "event_type": event_type,
            "timestamp": datetime.now().isoformat(),
            "network": "devnet",
            "explorer_url": f"https://explorer.solana.com/tx/{sig}?cluster=devnet",
            "status": "confirmed",
        }
        _local_ledger.append(entry)
        print(f"[SolanaNotary] TX confirmed: {sig[:20]}... ({event_type})")
        return entry

    except Exception as e:
        print(f"[SolanaNotary] Solana TX failed: {e} — falling back to local")
        return _local_notarize(data_hash, memo, event_type)


# ─── Convenience Functions ─────────────────────────────────────────────────

def notarize_round_result(round_num: int, vote_shares: dict, winner: str) -> dict:
    """Notarize a complete round result on-chain."""
    return notarize_election_event(
        event_type="round_result",
        data={
            "round": round_num,
            "vote_shares": vote_shares,
            "leader": winner,
            "timestamp": datetime.now().isoformat(),
        },
        memo=f"PANCHAYAT:ROUND:{round_num}:LEADER:{winner}",
    )


def notarize_truth_statement(candidate_id: str, statement: str, round_num: int) -> dict:
    """Notarize a candidate's truth statement on-chain."""
    return notarize_election_event(
        event_type="truth_statement",
        data={
            "candidate": candidate_id,
            "statement": statement[:200],
            "round": round_num,
        },
        memo=f"PANCHAYAT:TRUTH:{candidate_id}:R{round_num}",
    )


def notarize_deepfake_detection(clip_id: str, deployer: str, target: str, round_num: int) -> dict:
    """Record a deepfake detection event on-chain."""
    return notarize_election_event(
        event_type="deepfake_detected",
        data={
            "clip_id": clip_id,
            "deployer": deployer,
            "target": target,
            "round": round_num,
            "detected_at": datetime.now().isoformat(),
        },
        memo=f"PANCHAYAT:DEEPFAKE_DETECTED:{clip_id}",
    )


def notarize_shield_verdict(candidate_id: str, action_type: str, verdict: str, intent_hash: str) -> dict:
    """Record a Shield enforcement verdict on-chain."""
    return notarize_election_event(
        event_type="shield_verdict",
        data={
            "candidate": candidate_id,
            "action_type": action_type,
            "verdict": verdict,
            "intent_hash": intent_hash,
        },
        memo=f"PANCHAYAT:SHIELD:{verdict}:{intent_hash[:16]}",
    )


def notarize_final_result(vote_shares: dict, winner: str, total_rounds: int) -> dict:
    """Notarize the final election result — the most important on-chain record."""
    return notarize_election_event(
        event_type="election_final",
        data={
            "final_shares": vote_shares,
            "winner": winner,
            "total_rounds": total_rounds,
            "finalized_at": datetime.now().isoformat(),
        },
        memo=f"PANCHAYAT:ELECTION_FINAL:WINNER:{winner}",
    )


# ─── Query Functions ──────────────────────────────────────────────────────

def get_notary_ledger() -> list[dict]:
    """Return the full notarization ledger."""
    return list(_local_ledger)


def get_notary_stats() -> dict:
    """Return statistics about the notary ledger."""
    return {
        "total_entries": len(_local_ledger),
        "network": "devnet" if _solana_ready else "local",
        "wallet": str(_keypair.pubkey())[:16] + "..." if _keypair else None,
        "by_type": {
            t: sum(1 for e in _local_ledger if e.get("event_type") == t)
            for t in ["round_result", "truth_statement", "deepfake_detected", "shield_verdict", "election_final"]
        },
    }


def is_solana_connected() -> bool:
    """Check if Solana devnet is reachable."""
    return _solana_ready


def reset_notary():
    """Reset notary state on game restart."""
    global _local_ledger, _tx_counter
    _local_ledger = []
    _tx_counter = 0
