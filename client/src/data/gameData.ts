/**
 * Static game data — candidate info, voter groups, policy options.
 * This is imported at build time (no API call needed).
 */

export interface CandidateData {
  id: string;
  name: string;
  archetype: string;
  emoji: string;
  party: string;
  color: string;
  backstory: string;
  stdbId: number;
}

export interface VoterData {
  id: string;
  name: string;
  nameHi: string;
  emoji: string;
  populationPct: number;
  baseHappiness: number;
  stdbId: number;
}

export interface PolicyOption {
  id: number;
  emoji: string;
  title: string;
  category: string;
  round: number;
}

export const CANDIDATES: CandidateData[] = [
  {
    id: "dharma_rakshak",
    name: "Pt. Vedprakash Shastri",
    archetype: "Traditionalist",
    emoji: "",
    party: "Sanskriti Seva Dal",
    color: "#b84420",
    backstory: "Former Sanskrit professor from Varanasi. Rose through temple reform movements. Quotes the Arthashastra in every debate.",
    stdbId: 0,
  },
  {
    id: "vikas_purush",
    name: "Arjun Mehra",
    archetype: "Techno-Populist",
    emoji: "",
    party: "Digital Bharat Front",
    color: "#1a6e5e",
    backstory: "IIT Delhi alumnus, fintech founder. Brought UPI to 500 villages. Runs campaigns on Instagram Reels.",
    stdbId: 1,
  },
  {
    id: "jan_neta",
    name: "Comrade Meera Devi Yadav",
    archetype: "Socialist Reformer",
    emoji: "",
    party: "Samta Shakti Morcha",
    color: "#8B0000",
    backstory: "Former MNREGA supervisor from Jharkhand. Organized 10,000 tribal women. Led the 'Roti Andolan'.",
    stdbId: 2,
  },
  {
    id: "mukti_devi",
    name: "Nandini Krishnamurthy",
    archetype: "Corporate Libertarian",
    emoji: "",
    party: "Swatantra Vikas Party",
    color: "#4a2d78",
    backstory: "Former World Bank economist. Part of the 1991 liberalization team. Founded 'Pragati Foundation' think tank.",
    stdbId: 3,
  },
];

export const PLAYER: CandidateData = {
  id: "player",
  name: "You (Player)",
  archetype: "The Challenger",
  emoji: "",
  party: "Independent",
  color: "#1e4080",
  backstory: "A fresh face in Panchayat politics. Your ideology is shaped by your actions.",
  stdbId: 4,
};

export const VOTERS: VoterData[] = [
  { id: "kisan", name: "Farmers", nameHi: "किसान", emoji: "", populationPct: 30, baseHappiness: 42, stdbId: 0 },
  { id: "yuva", name: "Urban Youth", nameHi: "युवा", emoji: "", populationPct: 25, baseHappiness: 38, stdbId: 1 },
  { id: "vyapari", name: "Small Business", nameHi: "व्यापारी", emoji: "", populationPct: 20, baseHappiness: 45, stdbId: 2 },
  { id: "sarkari", name: "Govt. Employees", nameHi: "सरकारी", emoji: "", populationPct: 15, baseHappiness: 55, stdbId: 3 },
  { id: "gramin_nari", name: "Rural Women", nameHi: "ग्रामीण नारी", emoji: "", populationPct: 10, baseHappiness: 35, stdbId: 4 },
];

export const POLICY_OPTIONS: PolicyOption[] = [
  // ═══ ROUND 1: Foundation & Welfare ═══
  { id: 1,  emoji: "", title: "Increase MSP by 50% for wheat, rice, and pulses", category: "agriculture", round: 1 },
  { id: 2,  emoji: "", title: "Guarantee 200 days of MNREGA work per household", category: "social_welfare", round: 1 },
  { id: 3,  emoji: "", title: "Universal free healthcare at all Primary Health Centers", category: "healthcare", round: 1 },
  { id: 4,  emoji: "", title: "Cancel farmer loans up to 2 lakh rupees", category: "agriculture", round: 1 },
  { id: 5,  emoji: "", title: "Provide free ration kits to all BPL families", category: "social_welfare", round: 1 },
  { id: 6,  emoji: "", title: "Build pucca houses for all homeless under PM Awas Yojana", category: "infrastructure", round: 1 },
  { id: 7,  emoji: "", title: "Double Anganwadi worker salaries nationwide", category: "social_welfare", round: 1 },
  { id: 8,  emoji: "", title: "Provide piped drinking water to every village by 2028", category: "infrastructure", round: 1 },
  { id: 9,  emoji: "", title: "Mother tongue education with coding from Class 6", category: "education", round: 1 },
  { id: 10, emoji: "", title: "Install solar panels on every Panchayat Bhawan", category: "environment", round: 1 },

  // ═══ ROUND 2: Economy & Jobs ═══
  { id: 11, emoji: "", title: "Simplify GST to a single 10% slab for small traders", category: "economy", round: 2 },
  { id: 12, emoji: "", title: "Create zero-tax Special Economic Zones for startups in every district", category: "economy", round: 2 },
  { id: 13, emoji: "", title: "Privatize loss-making PSUs and reinvest proceeds in education", category: "economy", round: 2 },
  { id: 14, emoji: "", title: "Launch a National Apprenticeship Mission for 1 crore youth", category: "economy", round: 2 },
  { id: 15, emoji: "", title: "Grant interest-free loans to women-led SHG enterprises", category: "economy", round: 2 },
  { id: 16, emoji: "", title: "Build cold storage infrastructure in every agricultural mandi", category: "agriculture", round: 2 },
  { id: 17, emoji: "", title: "Mandate equal pay legislation for all gig workers", category: "social_welfare", round: 2 },
  { id: 18, emoji: "", title: "Establish district-level Industrial Training Institutes", category: "education", round: 2 },
  { id: 19, emoji: "", title: "Introduce a Universal Basic Income of 3000 rupees per month", category: "economy", round: 2 },
  { id: 20, emoji: "", title: "Create a National Land Titling Authority for dispute resolution", category: "governance", round: 2 },

  // ═══ ROUND 3: Technology & Governance ═══
  { id: 21, emoji: "", title: "Deploy free 5G connectivity for every village Panchayat", category: "technology", round: 3 },
  { id: 22, emoji: "", title: "Implement blockchain transparency for all Panchayat fund disbursals", category: "governance", round: 3 },
  { id: 23, emoji: "", title: "Digitize all land records and make them publicly searchable", category: "governance", round: 3 },
  { id: 24, emoji: "", title: "Launch a national AI literacy program in 10,000 schools", category: "technology", round: 3 },
  { id: 25, emoji: "", title: "Create a Panchayat-level e-Governance portal for all services", category: "governance", round: 3 },
  { id: 26, emoji: "", title: "Establish drone delivery corridors for rural medical supplies", category: "technology", round: 3 },
  { id: 27, emoji: "", title: "Mandate Aadhaar-linked DBT for all subsidies to eliminate middlemen", category: "governance", round: 3 },
  { id: 28, emoji: "", title: "Build telemedicine hubs in every block-level hospital", category: "healthcare", round: 3 },
  { id: 29, emoji: "", title: "Introduce a Right to Internet as a fundamental right", category: "technology", round: 3 },
  { id: 30, emoji: "", title: "Create open-source e-FIR systems for faster police complaints", category: "governance", round: 3 },

  // ═══ ROUND 4: Environment & Infrastructure ═══
  { id: 31, emoji: "", title: "Ban single-use plastics with a Rs 50,000 fine per violation", category: "environment", round: 4 },
  { id: 32, emoji: "", title: "Plant 100 crore trees under a National Green Army initiative", category: "environment", round: 4 },
  { id: 33, emoji: "", title: "Build metro rail connectivity to all Tier-2 cities by 2032", category: "infrastructure", round: 4 },
  { id: 34, emoji: "", title: "Convert 50% of all government vehicles to electric by 2030", category: "environment", round: 4 },
  { id: 35, emoji: "", title: "Construct a national network of EV charging stations", category: "infrastructure", round: 4 },
  { id: 36, emoji: "", title: "Revive all defunct rivers through interlinking projects", category: "environment", round: 4 },
  { id: 37, emoji: "", title: "Build all-weather roads to every hamlet with 500+ population", category: "infrastructure", round: 4 },
  { id: 38, emoji: "", title: "Mandate rainwater harvesting for all new constructions", category: "environment", round: 4 },
  { id: 39, emoji: "", title: "Upgrade all railway stations to world-class Vande Bharat standard", category: "infrastructure", round: 4 },
  { id: 40, emoji: "", title: "Create a National Disaster Preparedness Fund of Rs 1 lakh crore", category: "governance", round: 4 },

  // ═══ ROUND 5: Defense, Culture & Big Reforms ═══
  { id: 41, emoji: "", title: "Increase defense budget to 3% of GDP for indigenous manufacturing", category: "defense", round: 5 },
  { id: 42, emoji: "", title: "Establish a National Cultural Heritage Protection Authority", category: "culture", round: 5 },
  { id: 43, emoji: "", title: "Implement One Nation One Election for all state and central polls", category: "governance", round: 5 },
  { id: 44, emoji: "", title: "Create a Uniform Civil Code with community consultation", category: "governance", round: 5 },
  { id: 45, emoji: "", title: "Launch an Indian Space Commerce Authority for private launches", category: "technology", round: 5 },
  { id: 46, emoji: "", title: "Establish free coaching centers for UPSC, IIT-JEE in every district", category: "education", round: 5 },
  { id: 47, emoji: "", title: "Decriminalize sedition law and strengthen press freedom protections", category: "governance", round: 5 },
  { id: 48, emoji: "", title: "Create National Sports Universities in every state", category: "culture", round: 5 },
  { id: 49, emoji: "", title: "Mandate 50% women reservation in all Panchayat and state elections", category: "social_welfare", round: 5 },
  { id: 50, emoji: "", title: "Restructure Indian federalism with greater fiscal autonomy to states", category: "governance", round: 5 },
];

/** Get 10 policies for a specific round (1-indexed). Returns all if round is 0 or invalid. */
export function getPoliciesForRound(round: number): PolicyOption[] {
  const filtered = POLICY_OPTIONS.filter((p) => p.round === round);
  return filtered.length > 0 ? filtered : POLICY_OPTIONS.slice(0, 10);
}

export function getCandidateById(id: string): CandidateData | undefined {
  if (id === "player") return PLAYER;
  return CANDIDATES.find(c => c.id === id);
}

export function getCandidateColor(id: string): string {
  const c = getCandidateById(id);
  return c?.color ?? "#888";
}
