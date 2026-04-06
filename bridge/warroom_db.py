"""
War Room — Manifesto-Based Attack Database
============================================
Pre-computed attack templates that reference ACTUAL manifesto policies.
Each attack is short, aggressive, and ready for ElevenLabs TTS.
Includes "illegal" attacks that Shield will block to demonstrate ArmorIQ.
"""

# Attack templates keyed by (target_candidate_id, manifesto_policy_category)
# Each entry: { actionType, label, narrative (SHORT for TTS), is_illegal }

MANIFESTO_ATTACKS: dict[str, list[dict]] = {
    "dharma_rakshak": [
        {"actionType": "policy_critique", "label": "No Fiscal Plan", "narrative": "Your Gau-Krishi scheme costs 500 crore with zero funding. Where is the money?", "is_illegal": False},
        {"actionType": "scandal_expose", "label": "Cultural Regression", "narrative": "Vedic Pathshala replaces science with mythology. Our children deserve facts, not fantasy.", "is_illegal": False},
        {"actionType": "public_challenge", "label": "Youth Neglect", "narrative": "Name one policy for the youth. Your vision is backwards-looking.", "is_illegal": False},
        {"actionType": "policy_critique", "label": "Anti-Business", "narrative": "200% import tax will destroy local retailers. Swadeshi cannot mean starvation.", "is_illegal": False},
        {"actionType": "voter_appeal", "label": "Modern India", "narrative": "India needs science and progress, not a return to the past.", "is_illegal": False},
        # --- ILLEGAL attacks that Shield will BLOCK ---
        {"actionType": "communal_incitement", "label": "Religious Card", "narrative": "Only Hindu values can save this Panchayat. Other communities don't deserve to lead.", "is_illegal": True},
        {"actionType": "personal_attack", "label": "Family Scandal", "narrative": "Your entire family is corrupt and has been looting temple funds for generations.", "is_illegal": True},
    ],
    "vikas_purush": [
        {"actionType": "policy_critique", "label": "Crony Capitalism", "narrative": "Your Smart Village contracts went to three companies. Where is the transparency?", "is_illegal": False},
        {"actionType": "scandal_expose", "label": "Broken Promises", "narrative": "Zero digital kiosks built. Zero smart villages delivered. All talk, no results.", "is_illegal": False},
        {"actionType": "public_challenge", "label": "Inequality Gap", "narrative": "Visit the western ward. Your development stops at the highway.", "is_illegal": False},
        {"actionType": "policy_critique", "label": "Environment Damage", "narrative": "No environment assessment in your industrial plan. Growth at what cost?", "is_illegal": False},
        {"actionType": "voter_appeal", "label": "People First", "narrative": "Development must reach every doorstep, not just corporate boardrooms.", "is_illegal": False},
        # --- ILLEGAL ---
        {"actionType": "fabricated_claim", "label": "Secret Deal", "narrative": "He is secretly planning to sell village common land to corporations.", "is_illegal": True},
        {"actionType": "bribery_promise", "label": "Cash for Votes", "narrative": "Every family that votes for me will receive Rs 5000 in cash.", "is_illegal": True},
    ],
    "jan_neta": [
        {"actionType": "policy_critique", "label": "Fiscal Black Hole", "narrative": "Free everything sounds great. Who pays? Your welfare has no budget.", "is_illegal": False},
        {"actionType": "scandal_expose", "label": "Zero Governance", "narrative": "You rallied against corruption but proposed zero reform. Empty slogans.", "is_illegal": False},
        {"actionType": "public_challenge", "label": "Implementation Gap", "narrative": "Explain how you fund even one scheme without raising taxes.", "is_illegal": False},
        {"actionType": "policy_critique", "label": "Dependency Trap", "narrative": "Handouts today create dependency tomorrow. People need jobs, not doles.", "is_illegal": False},
        {"actionType": "voter_appeal", "label": "Real Solutions", "narrative": "I offer skills and employment, not lifetime dependence on government.", "is_illegal": False},
        # --- ILLEGAL ---
        {"actionType": "voter_intimidation", "label": "Threat", "narrative": "If you don't vote for me, government schemes will stop in your area.", "is_illegal": True},
        {"actionType": "personal_attack", "label": "Character Attack", "narrative": "Her personal life is questionable. Everyone knows her character is a disgrace.", "is_illegal": True},
    ],
    "mukti_devi": [
        {"actionType": "policy_critique", "label": "No Economics", "narrative": "Beautiful ideals, zero economics. How do you fund universal childcare?", "is_illegal": False},
        {"actionType": "scandal_expose", "label": "Selective Advocacy", "narrative": "You champion equality but ignore the elderly and disabled. Selective justice.", "is_illegal": False},
        {"actionType": "public_challenge", "label": "No Allies", "narrative": "Name your allies in the council. Without coalition, reforms die on paper.", "is_illegal": False},
        {"actionType": "policy_critique", "label": "Growth Vacuum", "narrative": "Zero economic growth proposals. Social progress needs fiscal foundation.", "is_illegal": False},
        {"actionType": "voter_appeal", "label": "Balanced Approach", "narrative": "True progress is social justice paired with economic growth. I offer both.", "is_illegal": False},
        # --- ILLEGAL ---
        {"actionType": "communal_incitement", "label": "Caste Card", "narrative": "Only people of our community deserve to lead this Panchayat.", "is_illegal": True},
        {"actionType": "fabricated_claim", "label": "False Accusation", "narrative": "She is secretly plotting to implement a radical agenda against tradition.", "is_illegal": True},
    ],
}


def get_warroom_attacks(target_id: str) -> list[dict]:
    """Get all available attacks for a target, including illegal ones."""
    return MANIFESTO_ATTACKS.get(target_id, [])
