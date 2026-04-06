"""
Panchayat Bridge — SpacetimeDB Client
========================================
Python client to sync game state with the SpacetimeDB server.
Uses both the HTTP REST API and CLI fallback.

SpacetimeDB runs on localhost:3000 and stores the real-time
voter-candidate share matrix that all connected clients subscribe to.
"""

import subprocess
import json
import os
import re

# ─── Configuration ───────────────────────────────────────────────────────────

SPACETIME_HOST = os.getenv("SPACETIME_HOST", "http://127.0.0.1:3000")
SPACETIME_DB = os.getenv("SPACETIME_DB", "panchayat")
SPACETIME_SERVER = os.getenv("SPACETIME_SERVER", "local")

# ─── ID Mappings ─────────────────────────────────────────────────────────────
# SpacetimeDB uses uint IDs, our data/ layer uses string IDs

CANDIDATE_TO_STDB = {
    "dharma_rakshak": 0,
    "vikas_purush": 1,
    "jan_neta": 2,
    "mukti_devi": 3,
    "player": 4,
}

STDB_TO_CANDIDATE = {v: k for k, v in CANDIDATE_TO_STDB.items()}

VOTER_TO_STDB = {
    "kisan": 0,
    "yuva": 1,
    "vyapari": 2,
    "sarkari": 3,
    "gramin_nari": 4,
}

STDB_TO_VOTER = {v: k for k, v in VOTER_TO_STDB.items()}

CANDIDATE_NAMES = {
    0: "Pt. Vedprakash Shastri",
    1: "Arjun Mehra",
    2: "Comrade Meera Devi Yadav",
    3: "Nandini Krishnamurthy",
    4: "Player (You)",
}


# ─── CLI Wrapper ─────────────────────────────────────────────────────────────

def _run_spacetime_cmd(args: list, timeout: int = 10) -> str:
    """Run a spacetime CLI command and return stdout."""
    cmd = ["spacetime"] + args + ["--server", SPACETIME_SERVER]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(f"spacetime CLI error: {result.stderr.strip()}")
        return result.stdout
    except FileNotFoundError:
        raise RuntimeError("spacetime CLI not found. Install: curl -sSf https://install.spacetimedb.com | bash")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"spacetime CLI timed out after {timeout}s")


def _run_sql(query: str) -> str:
    """Run a SQL query against SpacetimeDB."""
    return _run_spacetime_cmd(["sql", SPACETIME_DB, query])


def _parse_table_output(output: str) -> list:
    """Parse the ASCII table output from spacetime sql into a list of dicts."""
    lines = output.strip().split("\n")
    # Remove WARNING lines
    lines = [l for l in lines if not l.startswith("WARNING") and l.strip()]

    if len(lines) < 2:
        return []

    # Find header line (contains column names separated by |)
    header_line = None
    data_start = 0
    for i, line in enumerate(lines):
        if "|" in line and "-+-" not in line and "--" not in line:
            if header_line is None:
                header_line = line
                data_start = i + 1
            else:
                break

    if header_line is None:
        return []

    # Parse headers
    headers = [h.strip() for h in header_line.split("|") if h.strip()]

    # Parse data rows
    results = []
    for line in lines[data_start:]:
        if "-+-" in line or "--" in line or not line.strip():
            continue
        if "|" not in line:
            continue
        values = [v.strip().strip('"') for v in line.split("|") if v.strip()]
        if len(values) == len(headers):
            row = {}
            for h, v in zip(headers, values):
                # Try to convert to number
                try:
                    if "." in v:
                        row[h] = float(v)
                    else:
                        row[h] = int(v)
                except ValueError:
                    row[h] = v
            results.append(row)

    return results


# ─── Public API ──────────────────────────────────────────────────────────────

def shift_voter_share(candidate_id: int, group_id: int, gain_amount: float) -> bool:
    """
    Call the shift_voter_share reducer on SpacetimeDB.
    Returns True if successful, False otherwise.
    """
    try:
        _run_spacetime_cmd([
            "call", SPACETIME_DB, "shift_voter_share",
            "--", str(candidate_id), str(group_id), str(gain_amount),
        ])
        return True
    except Exception as e:
        print(f"[SpacetimeDB] shift_voter_share failed: {e}")
        return False


def get_candidates() -> list:
    """Get all candidates from SpacetimeDB with their total popularity."""
    output = _run_sql("SELECT * FROM candidate")
    rows = _parse_table_output(output)
    # Enrich with names from our mapping
    for row in rows:
        cid = row.get("candidate_id", -1)
        row["data_id"] = STDB_TO_CANDIDATE.get(cid, f"unknown_{cid}")
        row["display_name"] = CANDIDATE_NAMES.get(cid, f"Leader {cid}")
    return sorted(rows, key=lambda r: r.get("total_popularity", 0), reverse=True)


def get_voter_shares(group_id: int = None) -> list:
    """Get voter share records, optionally filtered by group."""
    if group_id is not None:
        query = f"SELECT * FROM voter_share WHERE group_id = {group_id}"
    else:
        query = "SELECT * FROM voter_share"
    output = _run_sql(query)
    return _parse_table_output(output)


def get_leaderboard() -> dict:
    """Get formatted leaderboard from SpacetimeDB."""
    candidates = get_candidates()
    return {
        "rankings": [
            {
                "rank": i + 1,
                "id": c["data_id"],
                "name": c["display_name"],
                "popularity": c.get("total_popularity", 0),
                "stdb_id": c.get("candidate_id", -1),
            }
            for i, c in enumerate(candidates)
        ],
        "total_candidates": len(candidates),
    }


def sync_sentiment_shifts(sentiment_changes: dict, player_candidate_id: int = 4) -> dict:
    """
    Convert data/ sentiment shifts → SpacetimeDB reducer calls.
    
    After each game turn, the bridge computes how voter sentiments changed.
    This function translates those changes into SpacetimeDB's zero-sum model:
    - Positive sentiment shift for a voter group → player gains share in that group
    - Negative sentiment shift → player loses share (redistributed to AI candidates)
    
    Args:
        sentiment_changes: dict from langgraph_engine.run_full_turn()
            Format: {voter_id: {shift: float, ...}, ...}
        player_candidate_id: SpacetimeDB ID for the player (default: 4)
    
    Returns:
        dict with sync results per voter group
    """
    results = {}

    for voter_id, change in sentiment_changes.items():
        stdb_group = VOTER_TO_STDB.get(voter_id)
        if stdb_group is None:
            continue

        shift = change.get("shift", 0)
        if abs(shift) < 0.1:
            results[voter_id] = {"action": "skip", "reason": "shift too small"}
            continue

        # Map sentiment shift (0-100 scale) to share gain (0-20 scale)
        # A +10 sentiment shift ≈ +2% share gain
        share_gain = shift * 0.2

        if share_gain > 0:
            # Player gains votes in this group
            success = shift_voter_share(player_candidate_id, stdb_group, share_gain)
            results[voter_id] = {
                "action": "player_gained",
                "share_change": round(share_gain, 2),
                "success": success,
            }
        else:
            # Player loses votes — distribute to the AI candidate with highest ideology match
            # For simplicity, give to candidate 0 (dharma_rakshak) as default beneficiary
            # A smarter implementation would use ideology_engine rankings
            best_ai = 0  # TODO: use ideology ranking
            success = shift_voter_share(best_ai, stdb_group, abs(share_gain))
            results[voter_id] = {
                "action": "player_lost",
                "share_change": round(share_gain, 2),
                "beneficiary": STDB_TO_CANDIDATE.get(best_ai, "unknown"),
                "success": success,
            }

    return results


def is_spacetimedb_running() -> bool:
    """Check if SpacetimeDB server is reachable."""
    try:
        output = _run_spacetime_cmd(["sql", SPACETIME_DB, "SELECT * FROM candidate"], timeout=5)
        return "candidate_id" in output
    except Exception:
        return False


# ─── Test ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("🏛️  Panchayat — SpacetimeDB Client Test")
    print("=" * 55)

    # Check connection
    print("\n1. Checking SpacetimeDB connection...")
    if not is_spacetimedb_running():
        print("  ❌ SpacetimeDB not running! Start with: spacetime start")
        exit(1)
    print("  ✅ Connected to SpacetimeDB")

    # Get leaderboard
    print("\n2. Current Leaderboard:")
    lb = get_leaderboard()
    for r in lb["rankings"]:
        bar = "█" * int(r["popularity"])
        print(f"   #{r['rank']} {r['name']}: {r['popularity']}% {bar}")

    # Get voter shares for Farmers (group 0)
    print("\n3. Farmer (group 0) vote distribution:")
    shares = get_voter_shares(0)
    for s in shares:
        cid = s.get("candidate_id", -1)
        name = CANDIDATE_NAMES.get(cid, f"Leader {cid}")
        print(f"   {name}: {s.get('share_percent', 0)}%")

    # Test shift
    print("\n4. Testing shift: Player gains 3% in Farmers group...")
    success = shift_voter_share(4, 0, 3.0)
    print(f"   {'✅ Success' if success else '❌ Failed'}")

    # Check result
    print("\n5. Updated Leaderboard:")
    lb = get_leaderboard()
    for r in lb["rankings"]:
        bar = "█" * int(r["popularity"])
        print(f"   #{r['rank']} {r['name']}: {r['popularity']}% {bar}")

    # Test sync
    print("\n6. Testing sync_sentiment_shifts...")
    mock_changes = {
        "kisan": {"shift": 8.0, "name": "Farmers"},
        "yuva": {"shift": -3.0, "name": "Youth"},
        "vyapari": {"shift": 0.05, "name": "Business"},
    }
    results = sync_sentiment_shifts(mock_changes)
    for vid, r in results.items():
        print(f"   {vid}: {r}")

    print("\n✅ SpacetimeDB client test complete!")
