import { toDisplayValue } from "./data-loader.js";
import { formatMoney, formatNumber, prettifyColumn } from "./analysis.js";
import { escapeHtml } from "./charts.js";

const STARTUGOTCHI_MAX_TURNS = 10;

const STARTUGOTCHI_PETS = {
  early: {
    label: "Seedling",
    emoji: "🌱",
    clusterLabel: "Early-stage funding",
    description: "Young, hopeful, and still finding its roots.",
  },
  venture: {
    label: "Venture Rocket",
    emoji: "🚀",
    clusterLabel: "Venture capital",
    description: "Fast, ambitious, and carrying a lot of pressure.",
  },
  debt: {
    label: "Cashflow Turtle",
    emoji: "🐢",
    clusterLabel: "Debt financing",
    description: "Careful, steady, and good at staying balanced.",
  },
  equity: {
    label: "Equity Shark",
    emoji: "🦈",
    clusterLabel: "Private equity",
    description: "Focused, mature, and always looking for efficiency.",
  },
};

const STARTUGOTCHI_FIELD_CONFIG = [
  { key: "name", label: "Startup name" },
  { key: "fundingProfile", label: "Funding type or cluster" },
  { key: "market", label: "Market" },
  { key: "country", label: "Country" },
  { key: "date", label: "Date" },
  { key: "status", label: "Status" },
  { key: "stage", label: "Funding stage" },
  { key: "level", label: "Level" },
  { key: "rounds", label: "Funding rounds" },
  { key: "total", label: "Funding total" },
];

const STARTUGOTCHI_ACTIONS = [
  { key: "money", label: "💸 Add Money", effect: "+Cash / +Stress" },
  { key: "team", label: "👥 Build Team", effect: "+Health / -Cash" },
  { key: "attention", label: "📣 Get Attention", effect: "+Popularity / +Stress" },
  { key: "organized", label: "📊 Get Organized", effect: "+Focus / -Stress" },
  { key: "launch", label: "🚀 Launch Something", effect: "High risk" },
];

const STARTUGOTCHI_TINY_EVENTS = [
  { key: "customer_win", message: "Customer win 🎉", delta: { Health: 10 }, tone: "good" },
  { key: "unexpected_buzz", message: "Unexpected buzz 📣", delta: { Popularity: 12 }, tone: "good" },
  { key: "investor_call", message: "Investor call went well 💸", delta: { Cash: 10 }, tone: "good" },
  { key: "calm_week", message: "Calm week 🧘", delta: { Stress: -12 }, tone: "good" },
  { key: "clear_roadmap", message: "Clear roadmap 🎯", delta: { Focus: 10 }, tone: "good" },
  { key: "budget_surprise", message: "Budget surprise 💸", delta: { Cash: -12 }, tone: "spicy" },
  { key: "team_chaos", message: "Team chaos 🌀", delta: { Focus: -12 }, tone: "spicy" },
  { key: "competitor_launch", message: "Competitor launch 👀", delta: { Popularity: -10 }, tone: "spicy" },
  { key: "stress_spike", message: "Stress spike ⚠️", delta: { Stress: 12 }, tone: "spicy" },
  { key: "bug_storm", message: "Bug storm 🐛", delta: { Health: -12 }, tone: "spicy" },
];

const STARTUGOTCHI_MISSIONS = [
  { key: "survive", label: "Survive", test: (stats, turn) => turn >= STARTUGOTCHI_MAX_TURNS },
  { key: "cash", label: "Cash 65+", test: (stats) => stats.Cash >= 65 },
  { key: "popularity", label: "Popularity 75+", test: (stats) => stats.Popularity >= 75 },
  { key: "focus", label: "Focus 70+", test: (stats) => stats.Focus >= 70 },
  { key: "calm", label: "Calm", test: (stats) => stats.Stress <= 45 },
  {
    key: "balanced",
    label: "Balanced",
    test: (stats) => stats.Health >= 55 && stats.Cash >= 55 && stats.Popularity >= 55 && stats.Focus >= 55 && stats.Stress <= 65,
  },
];

const STARTUGOTCHI_SPECIAL_EVENTS = [
  {
    key: "investor_offer",
    icon: "💸",
    title: "Investor Offer",
    situation: "An investor offers money, but wants fast growth.",
    choices: [
      { key: "accept", label: "Accept", preview: "Risky · +Cash / +Stress", delta: { Cash: 25, Popularity: 8, Stress: 18, Focus: -8 }, message: "Investor money accepted. Expectations rose. 💸" },
      {
        key: "negotiate",
        label: "Negotiate",
        preview: "Chance · +Cash / +Focus",
        chance: (stats) => 40 + 0.25 * stats.Focus + 0.2 * stats.Popularity - 0.15 * stats.Stress,
        success: { Cash: 18, Focus: 8, Stress: 5 },
        failure: { Stress: 12, Popularity: -5 },
        successMessage: "Negotiation worked. Cash up, focus intact. 💸",
        failureMessage: "Negotiation dragged. Momentum cooled. 💸",
      },
      { key: "independent", label: "Stay independent", preview: "Safe · +Focus / -Stress", delta: { Focus: 12, Stress: -10, Popularity: -5 }, message: "Stayed independent. Focus restored. 🎯" },
    ],
  },
  {
    key: "pr_moment",
    icon: "📣",
    title: "PR Moment",
    situation: "A journalist wants to write about your startup.",
    choices: [
      { key: "big", label: "Go big", preview: "Risky · +Popularity / +Stress", delta: { Popularity: 25, Stress: 18, Focus: -10 }, message: "PR moment landed. Visibility up. 📣" },
      { key: "modest", label: "Keep modest", preview: "Safe · +Popularity / +Focus", delta: { Popularity: 12, Focus: 8, Stress: 5 }, message: "Modest PR worked. Clean signal. 📣" },
      { key: "skip", label: "Skip it", preview: "Quiet · -Stress / -Popularity", delta: { Stress: -10, Popularity: -8 }, message: "Skipped PR. Calm up, buzz down. 📣" },
    ],
  },
  {
    key: "team_conflict",
    icon: "👥",
    title: "Team Conflict",
    situation: "The team is split on what to build next.",
    choices: [
      { key: "meeting", label: "Strategy meeting", preview: "Safe · +Focus / -Stress", delta: { Focus: 18, Stress: -12, Cash: -5 }, message: "Team conflict cooled down. Focus restored. 🎯" },
      {
        key: "loudest",
        label: "Loudest idea",
        preview: "Risky · big swing",
        chance: (stats) => 35 + 0.25 * stats.Popularity + 0.15 * stats.Health - 0.2 * stats.Stress,
        success: { Popularity: 18, Health: 8, Stress: 8 },
        failure: { Health: -15, Stress: 18, Focus: -10 },
        successMessage: "The loud idea worked. Somehow. 👥",
        failureMessage: "The loud idea was just loud. 👥",
      },
      { key: "reset", label: "Reset priorities", preview: "Safe · +Focus / -Popularity", delta: { Focus: 15, Stress: -8, Popularity: -8 }, message: "Priorities reset. Less noise. 🎯" },
    ],
  },
  {
    key: "cash_crunch",
    icon: "⚠️",
    title: "Cash Crunch",
    situation: "Costs arrived earlier than expected.",
    choices: [
      { key: "cut", label: "Cut spending", preview: "Safe · +Cash / -Popularity", delta: { Cash: 15, Focus: 10, Popularity: -10, Stress: -5 }, message: "Cash crunch handled. Runway safer. ⚠️" },
      {
        key: "raise",
        label: "Raise quickly",
        preview: "Chance · +Cash / +Stress",
        chance: (stats) => 35 + 0.3 * stats.Popularity + 0.15 * stats.Health - 0.25 * stats.Stress,
        success: { Cash: 25, Stress: 12 },
        failure: { Stress: 18, Health: -8 },
        successMessage: "Fast raise worked. Runway up. 💸",
        failureMessage: "Fast raise failed. Stress up. ⚠️",
      },
      {
        key: "keep",
        label: "Keep going",
        preview: "High risk · no cost",
        chance: (stats) => 25 + 0.25 * stats.Health + 0.15 * stats.Focus - 0.2 * stats.Stress,
        success: { Health: 5, Popularity: 5 },
        failure: { Health: -20, Cash: -10, Stress: 15 },
        successMessage: "Kept going and survived. Barely. ⚠️",
        failureMessage: "Cash crunch bit hard. ⚠️",
      },
    ],
  },
  {
    key: "product_breaks",
    icon: "🐛",
    title: "Product Breaks",
    situation: "Something broke right after launch.",
    choices: [
      { key: "fix", label: "Fix now", preview: "Safe · +Health / -Cash", delta: { Health: 18, Focus: 8, Cash: -12, Stress: -5 }, message: "Bug fixed. Everyone exhaled. 🐛" },
      { key: "public", label: "Go public", preview: "Risky · +Popularity / +Stress", delta: { Popularity: 12, Stress: 15, Health: -5 }, message: "Public update helped, but pressure rose. 🐛" },
      {
        key: "minor",
        label: "Call it minor",
        preview: "High risk · avoid cost",
        chance: (stats) => 20 + 0.2 * stats.Popularity + 0.15 * stats.Health - 0.25 * stats.Stress,
        success: { Stress: -5, Cash: 5 },
        failure: { Health: -25, Popularity: -10, Stress: 20 },
        successMessage: "It really was minor. Lucky break. 🐛",
        failureMessage: "It was not minor. At all. 🐛",
      },
    ],
  },
  {
    key: "competitor_move",
    icon: "👀",
    title: "Competitor Move",
    situation: "A competitor launched something similar.",
    choices: [
      { key: "differentiate", label: "Differentiate", preview: "Safe · +Focus / +Popularity", delta: { Focus: 15, Popularity: 10, Stress: 5 }, message: "Competitor pressure managed. 👀" },
      {
        key: "rush",
        label: "Rush response",
        preview: "Risky · +Popularity / +Stress",
        chance: (stats) => 30 + 0.25 * stats.Focus + 0.2 * stats.Health - 0.2 * stats.Stress,
        success: { Popularity: 20, Stress: 12 },
        failure: { Health: -15, Focus: -10, Stress: 18 },
        successMessage: "Rush response landed. Visibility up. 👀",
        failureMessage: "Rush response got messy. 👀",
      },
      { key: "calm", label: "Stay calm", preview: "Safe · -Stress / +Focus", delta: { Stress: -12, Focus: 10, Popularity: -5 }, message: "Stayed calm. Strategy improved. 👀" },
    ],
  },
];

const STARTUGOTCHI_MESSAGES = {
  money: [
    "Fresh money arrived. The runway looks safer. 💸",
    "A small funding boost landed. Everyone breathed a little easier.",
    "Cash increased. The startup called it a growth moment.",
    "The budget looks healthier today. Big LinkedIn energy. 🚀",
    "More cash, slightly less panic.",
  ],
  team: [
    "A new teammate joined. The startup feels stronger.",
    "The team grew. So did the to-do list.",
    "More hands, more ideas, more meetings.",
    "Team energy is up. The calendar is under pressure.",
    "Someone useful joined at exactly the right time. Strong move. 👏",
  ],
  attention: [
    "People noticed your startup today.",
    "A bit of traction appeared. That felt good.",
    "Visibility increased. Stress also requested a meeting.",
    "Small buzz, big feelings. 📣",
    "Someone said 'momentum' and everyone nodded.",
  ],
  organized: [
    "The plan is clearer now.",
    "The roadmap looks less scary today.",
    "A tidy spreadsheet brought peace to the room.",
    "Focus increased. Chaos stepped back.",
    "Efficiency? Maybe. A calmer startup? Definitely.",
  ],
  launchSuccess: [
    "The launch went well. People liked it.",
    "A little momentum appeared. 🚀",
    "Users understood the product. Beautiful.",
    "The product worked better than expected.",
    "Strong signal. The startup looks proud today.",
  ],
  launchMixed: [
    "The launch was messy, but useful.",
    "People noticed, but so did the bugs.",
    "The team called it a learning moment.",
    "Progress happened. Not gracefully, but it happened.",
    "Some traction appeared. So did three new problems.",
  ],
  launchFailure: [
    "The launch did not go as planned.",
    "Reality asked difficult questions.",
    "A bug had a big day.",
    "The product needs another try.",
    "The startup learned something the hard way.",
  ],
};

const startugotchi_state = {
  startugotchi_mode_active: false,
  startugotchi_selected_startup: null,
  startugotchi_stats: null,
  startugotchi_turn: 0,
  startugotchi_game_log: [],
  startugotchi_game_status: "idle",
  startugotchi_column_mapping: {},
  startugotchi_stat_sources: {},
  startugotchi_pet: null,
  startugotchi_result: null,
  startugotchi_last_action: null,
  startugotchi_last_event: null,
  startugotchi_badges: [],
  startugotchi_special_used: false,
  startugotchi_mission: null,
  startugotchi_latest_event: null,
  startugotchi_latest_headline: "",
  startugotchi_active_event: null,
  startugotchi_dataset_signature: null,
};

const startugotchi_context = {
  container: null,
  model: null,
  rows: [],
  headers: [],
};

export function startugotchi_render(model) {
  const container = document.getElementById("startugotchiGame");
  if (!container) return;

  startugotchi_context.container = container;
  startugotchi_context.model = model;
  startugotchi_prepare_context(model);
  document.body.classList.toggle("startugotchi-mode-active", startugotchi_state.startugotchi_mode_active);

  if (!startugotchi_context.rows.length) {
    container.innerHTML = `
      <article class="startugotchi-empty">
        <h3>No startup rows available</h3>
        <p>Startugotchi needs the already-loaded clustered dataset before it can hatch a startup.</p>
      </article>
    `;
    return;
  }

  if (!startugotchi_state.startugotchi_mode_active) {
    container.innerHTML = startugotchi_render_entry();
    startugotchi_attach_handlers();
    return;
  }

  container.innerHTML = `
    <div class="startugotchi-mode-shell">
      ${startugotchi_render_mode_topbar()}
      ${startugotchi_state.startugotchi_selected_startup ? startugotchi_render_active_game() : startugotchi_render_hatch_screen()}
    </div>
  `;

  startugotchi_attach_handlers();
}

export function startugotchi_detect_columns(model) {
  const headers = startugotchi_headers(model);
  const clusterColumn = model?.clusterResult?.clusterColumn;
  return {
    name: startugotchi_find_column(headers, ["name", "company", "company_name", "startup", "organization", "org_name"]),
    fundingProfile: headers.includes(clusterColumn)
      ? clusterColumn
      : startugotchi_find_column(headers, [
        "funding_cluster",
        "cluster",
        "Cluster",
        "cluster_label",
        "funding_type",
        "funding_stage",
        "funding_category",
        "investment_type",
      ]),
    market: startugotchi_find_column(headers, ["market", "category", "category_list", "industry", "sector"]),
    country: startugotchi_find_column(headers, ["country", "country_code", "country_code_2", "country_name", "region"]),
    date: startugotchi_find_column(headers, ["last_funding_at", "last_funding_date", "first_funding_at", "founded_at", "date"]),
    status: startugotchi_find_column(headers, ["status", "company_status", "operating_status"]),
    stage: startugotchi_find_column(headers, ["funding_stage", "stage", "funding_round_type", "round_type"]),
    level: startugotchi_find_column(headers, ["stage_level", "level", "maturity_level"]),
    rounds: startugotchi_find_column(headers, ["funding_rounds", "rounds", "num_funding_rounds", "funding_round_count"]),
    total: startugotchi_find_column(headers, ["funding_total_usd", "funding_total", "total_funding", "total_funding_usd", "raised_amount_usd"]),
  };
}

export function startugotchi_map_pet(rawValue, row = {}, mapping = {}) {
  const value = String(rawValue ?? "").toLowerCase();
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (startugotchi_matches_any(compactValue, ["private equity", "buyout"]) || compactValue === "pe") {
    return STARTUGOTCHI_PETS.equity;
  }
  if (startugotchi_matches_any(compactValue, ["debt", "loan", "credit", "financing"])) {
    return STARTUGOTCHI_PETS.debt;
  }
  if (startugotchi_matches_any(compactValue, ["venture", "vc", "series a", "series b", "series c", "series d", "series e"])) {
    return STARTUGOTCHI_PETS.venture;
  }
  if (startugotchi_matches_any(compactValue, ["early", "seed", "pre-seed", "angel"])) {
    return STARTUGOTCHI_PETS.early;
  }

  if (startugotchi_is_cluster_column(mapping.fundingProfile)) {
    const numericCluster = Number.parseInt(compactValue, 10);
    if (numericCluster === 0) return STARTUGOTCHI_PETS.early;
    if (numericCluster === 1) return STARTUGOTCHI_PETS.debt;
    if (numericCluster === 2) return STARTUGOTCHI_PETS.equity;
    if (numericCluster === 3) return STARTUGOTCHI_PETS.venture;
  }

  const dominantSource = startugotchi_dominant_source(row);
  if (dominantSource === "private_equity") return STARTUGOTCHI_PETS.equity;
  if (dominantSource === "debt_financing") return STARTUGOTCHI_PETS.debt;
  if (dominantSource === "venture") return STARTUGOTCHI_PETS.venture;
  return STARTUGOTCHI_PETS.early;
}

export function startugotchi_parse_numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "nan" || raw === "n/a") return null;

  let multiplier = 1;
  if (/\bbillion\b/.test(raw)) multiplier = 1_000_000_000;
  else if (/\bmillion\b/.test(raw)) multiplier = 1_000_000;
  else if (/\bthousand\b/.test(raw)) multiplier = 1_000;

  let cleaned = raw
    .replace(/[,$€£¥₹]/g, "")
    .replace(/\s+/g, "")
    .replace(/percent|percentage|usd|eur|gbp|billion|million|thousand/g, "");

  const suffix = cleaned.match(/([kmb])$/i)?.[1]?.toLowerCase();
  if (suffix === "k") multiplier = 1_000;
  if (suffix === "m") multiplier = 1_000_000;
  if (suffix === "b") multiplier = 1_000_000_000;
  cleaned = cleaned.replace(/[kmb]$/i, "").replace(/%$/, "");

  const number = Number(cleaned.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number * multiplier : null;
}

export function startugotchi_normalize_percentile(value, rows, column) {
  const number = startugotchi_parse_numeric(value);
  if (!Number.isFinite(number) || !column) return null;
  const values = rows
    .map((row) => startugotchi_parse_numeric(row[column]))
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);
  if (values.length < 2) return 50;
  const lower = values.filter((item) => item < number).length;
  const equal = values.filter((item) => item === number).length;
  return startugotchi_clamp(((lower + equal * 0.5) / values.length) * 100);
}

function startugotchi_spread_percentile(value, min = 15, max = 95) {
  if (!Number.isFinite(value)) return null;
  const curved = Math.sign(value - 50) * Math.pow(Math.abs(value - 50) / 50, 0.72);
  return startugotchi_clamp((min + max) / 2 + curved * ((max - min) / 2));
}

export function startugotchi_calculate_stats(row, rows, mapping) {
  const fundingRaw = startugotchi_value(row, mapping.fundingProfile);
  const pet = startugotchi_map_pet(fundingRaw, row, mapping);
  const statusScores = startugotchi_status_scores(startugotchi_value(row, mapping.status));
  const stageScores = startugotchi_stage_scores(startugotchi_value(row, mapping.stage));
  const fundingScores = startugotchi_funding_profile_scores(pet);

  const totalPct = startugotchi_normalize_percentile(startugotchi_value(row, mapping.total), rows, mapping.total);
  const roundsPct = startugotchi_normalize_percentile(startugotchi_value(row, mapping.rounds), rows, mapping.rounds);
  const levelPct = startugotchi_normalize_percentile(startugotchi_value(row, mapping.level), rows, mapping.level);
  const datePct = startugotchi_normalize_date_percentile(startugotchi_value(row, mapping.date), rows, mapping.date);
  const marketPct = startugotchi_market_frequency_score(startugotchi_value(row, mapping.market), rows, mapping.market);
  const totalScore = startugotchi_spread_percentile(totalPct);
  const roundsScore = startugotchi_spread_percentile(roundsPct);
  const levelScore = startugotchi_spread_percentile(levelPct);
  const dateScore = startugotchi_spread_percentile(datePct, 25, 85);
  const marketScore = startugotchi_spread_percentile(marketPct, 35, 80);

  const signals = {
    Health: [
      startugotchi_signal(statusScores.health, 3, mapping.status),
      startugotchi_signal(levelScore, 1.8, mapping.level),
      startugotchi_signal(stageScores.maturity, 1.3, mapping.stage),
      startugotchi_signal(totalScore, 1.1, mapping.total),
      startugotchi_signal(roundsScore, 0.5, mapping.rounds),
    ],
    Cash: [
      startugotchi_signal(totalScore, 5, mapping.total),
      startugotchi_signal(levelScore, 1.2, mapping.level),
      startugotchi_signal(stageScores.cash, 1, mapping.stage),
      startugotchi_signal(fundingScores.cash, 1.3, mapping.fundingProfile),
    ],
    Popularity: [
      startugotchi_signal(roundsScore, 2.4, mapping.rounds),
      startugotchi_signal(totalScore, 1.5, mapping.total),
      startugotchi_signal(marketScore, 1, mapping.market),
      startugotchi_signal(dateScore, 0.7, mapping.date),
      startugotchi_signal(stageScores.popularity, 0.8, mapping.stage),
      startugotchi_signal(fundingScores.popularity, 0.7, mapping.fundingProfile),
    ],
    Focus: [
      startugotchi_signal(stageScores.focus, 2, mapping.stage),
      startugotchi_signal(statusScores.focus, 1, mapping.status),
      startugotchi_signal(fundingScores.focus, 1.8, mapping.fundingProfile),
      startugotchi_signal(levelScore, 1.5, mapping.level),
    ],
    Stress: [
      startugotchi_signal(stageScores.stress, 1.4, mapping.stage),
      startugotchi_signal(fundingScores.stress, 1.5, mapping.fundingProfile),
      startugotchi_signal(roundsScore, 1.3, mapping.rounds),
      startugotchi_signal(Number.isFinite(totalScore) ? 100 - totalScore : null, 1.2, mapping.total),
      startugotchi_signal(dateScore, 0.6, mapping.date),
      startugotchi_signal(statusScores.stress, 1.2, mapping.status),
      startugotchi_signal(totalScore > 85 && roundsScore > 70 ? Math.min(95, (totalScore + roundsScore) / 2) : null, 0.7, mapping.total),
    ],
  };

  const stats = Object.fromEntries(
    Object.entries(signals).map(([stat, items]) => [stat, Math.round(startugotchi_weighted_average(items))]),
  );
  return {
    pet,
    stats,
    explanations: startugotchi_explain_stats(stats, signals),
  };
}

export function startugotchi_explain_stats(stats, signals) {
  const explanationText = {
    Health: "Status, maturity, funding level, and funding activity were combined as simple durability signals.",
    Cash: "Funding total is the strongest signal, with level, stage, and funding profile used as smaller context clues.",
    Popularity: "Funding rounds, funding total, market frequency, recent activity, and stage are used as visibility signals.",
    Focus: "Stage, status, funding profile, and level are used as rough signals for structure and execution.",
    Stress: "Early or venture-style profiles, many rounds, low cash, recent activity, and difficult statuses increase pressure.",
  };

  return Object.fromEntries(
    Object.entries(stats).map(([stat, value]) => {
      const usedFields = startugotchi_used_fields(signals[stat]);
      return [
        stat,
        {
          value,
          usedFields,
          explanation: usedFields.length ? explanationText[stat] : "No useful dataset signal was available, so this stat started from a neutral value.",
        },
      ];
    }),
  );
}

export function startugotchi_calculate_mood(stats) {
  if (!stats) return "Doing okay";
  if (stats.Stress >= 85) return "Overwhelmed";
  if (stats.Health <= 25) return "Fragile";
  if (stats.Cash <= 25) return "Worried";
  if (stats.Popularity >= 75 && stats.Stress >= 70) return "Excited but tired";
  if (stats.Cash >= 75 && stats.Stress <= 40) return "Comfortable";
  if (stats.Focus >= 75 && stats.Stress <= 35) return "Calm";
  if (stats.Health >= 75 && stats.Popularity >= 70) return "Confident";
  return "Doing okay";
}

export function startugotchi_apply_action(action) {
  if (startugotchi_state.startugotchi_game_status !== "active") return;
  if (!startugotchi_state.startugotchi_stats) return;
  if (startugotchi_state.startugotchi_active_event) return;
  if (startugotchi_state.startugotchi_turn >= STARTUGOTCHI_MAX_TURNS) return;

  const stats = { ...startugotchi_state.startugotchi_stats };
  const beforeStats = { ...stats };
  const outcome = action === "special"
    ? startugotchi_resolve_special_move(stats)
    : startugotchi_resolve_action(action, stats);

  if (!outcome) return;
  if (action === "special") startugotchi_state.startugotchi_special_used = true;

  let event = null;
  let triggeredSpecial = null;
  if (action !== "special") {
    if (Math.random() < 0.25) {
      triggeredSpecial = startugotchi_pick(STARTUGOTCHI_SPECIAL_EVENTS);
    } else if (Math.random() < 0.2) {
      event = startugotchi_apply_random_event(stats);
    }
  }

  startugotchi_complete_turn({
    beforeStats,
    stats,
    message: outcome.message,
    event,
    tone: outcome.success ? "good" : "spicy",
    action,
  });

  if (triggeredSpecial && startugotchi_state.startugotchi_game_status === "active") {
    startugotchi_state.startugotchi_active_event = triggeredSpecial;
    startugotchi_state.startugotchi_latest_headline = `${triggeredSpecial.icon} ${triggeredSpecial.title}`;
  }
}

function startugotchi_apply_special_event_choice(choiceKey) {
  const event = startugotchi_state.startugotchi_active_event;
  if (!event || startugotchi_state.startugotchi_game_status !== "active") return;
  const choice = event.choices.find((item) => item.key === choiceKey);
  if (!choice) return;

  const stats = { ...startugotchi_state.startugotchi_stats };
  const beforeStats = { ...stats };
  const chance = choice.chance ? startugotchi_clamp_chance(choice.chance(stats)) : 100;
  const success = !choice.chance || Math.random() * 100 <= chance;
  const delta = choice.delta ?? (success ? choice.success : choice.failure);
  startugotchi_apply_delta(stats, delta);
  startugotchi_state.startugotchi_active_event = null;

  startugotchi_complete_turn({
    beforeStats,
    stats,
    message: success ? (choice.successMessage ?? choice.message) : (choice.failureMessage ?? choice.message),
    event: { message: event.title, tone: success ? "good" : "spicy" },
    tone: success ? "good" : "spicy",
    action: `event:${event.key}`,
  });
}

function startugotchi_resolve_action(action, stats) {
  const chance = startugotchi_action_chance(action, stats);
  const success = Math.random() * 100 <= chance;
  const delta = {};
  let message = "";

  if (action === "money") {
    Object.assign(delta, success
      ? { Cash: startugotchi_rand(20, 30), Health: startugotchi_rand(5, 10), Stress: startugotchi_rand(8, 18), Focus: -startugotchi_rand(0, 8) }
      : { Stress: 12, Popularity: -5 });
    message = success ? startugotchi_pick(["Fresh money arrived. Runway looks safer. 💸", "Funding boost landed. Big founder energy. 🚀"]) : "Funding call went cold. Stress went up. 💸";
  }

  if (action === "team") {
    Object.assign(delta, success
      ? { Health: startugotchi_rand(10, 18), Popularity: startugotchi_rand(5, 12), Cash: -startugotchi_rand(15, 25), Stress: startugotchi_rand(5, 15) }
      : { Cash: -10, Stress: 10 });
    message = success ? startugotchi_pick(["New teammate joined. Team energy up. 👥", "More hands, more meetings."]) : "The hire did not work out. Expensive lesson. 👥";
  }

  if (action === "attention") {
    Object.assign(delta, success
      ? { Popularity: startugotchi_rand(20, 30), Stress: startugotchi_rand(15, 25), Focus: -startugotchi_rand(8, 18) }
      : { Stress: 12, Focus: -8 });
    message = success ? startugotchi_pick(["Small buzz, big feelings. 📣", "Traction appeared. Stress followed."]) : "Campaign flopped. Awkward silence. 📣";
  }

  if (action === "organized") {
    Object.assign(delta, success
      ? { Focus: startugotchi_rand(20, 30), Stress: -startugotchi_rand(15, 25), Popularity: -startugotchi_rand(5, 12), Cash: -startugotchi_rand(0, 8) }
      : { Focus: -5, Stress: 8 });
    message = success ? startugotchi_pick(["Roadmap looks less scary. 🎯", "A spreadsheet brought peace."]) : "The plan got messier. Somehow. 📊";
  }

  if (action === "launch") {
    Object.assign(delta, success
      ? { Health: 15, Popularity: 25, Cash: 5, Stress: 8 }
      : { Health: -20, Stress: 25, Cash: -10 });
    message = success ? startugotchi_pick(["Launch landed. Strong signal. 🚀", "Users understood the product. Beautiful."]) : startugotchi_pick(["Launch broke more than expected. 🐛", "Reality asked difficult questions."]);
  }

  startugotchi_apply_pet_modifiers(action, success, delta);
  startugotchi_apply_delta(stats, delta);
  return { success, message };
}

function startugotchi_resolve_special_move(stats) {
  if (startugotchi_state.startugotchi_special_used) return null;
  const move = startugotchi_special_action();
  const chance = startugotchi_action_chance("special", stats);
  const success = Math.random() * 100 <= chance;
  const delta = success ? move.success : move.failure;
  startugotchi_apply_delta(stats, delta);
  return {
    success,
    message: success ? move.successMessage : move.failureMessage,
  };
}

function startugotchi_complete_turn({ beforeStats, stats, message, event, tone, action }) {
  startugotchi_state.startugotchi_turn += 1;
  const penalties = startugotchi_apply_auto_penalties(stats);
  const finalStats = startugotchi_clamp_stats(stats);

  startugotchi_state.startugotchi_stats = finalStats;
  startugotchi_state.startugotchi_last_action = action;
  startugotchi_state.startugotchi_latest_event = event;
  startugotchi_state.startugotchi_last_event = event;
  startugotchi_state.startugotchi_badges = startugotchi_calculate_badges(finalStats, startugotchi_state.startugotchi_turn);
  startugotchi_state.startugotchi_latest_headline = event?.message ?? message;
  startugotchi_state.startugotchi_game_log.unshift({
    turn: startugotchi_state.startugotchi_turn,
    message,
    eventMessage: penalties || event?.message || "",
    eventTone: penalties ? "spicy" : (event?.tone ?? tone ?? "neutral"),
    delta: startugotchi_delta_summary(beforeStats, finalStats),
    mood: startugotchi_calculate_mood(finalStats),
  });

  const earlyBreak =
    finalStats.Health <= 0
    || finalStats.Stress >= 100
    || (finalStats.Cash <= 0 && finalStats.Health < 30);
  if (earlyBreak) {
    startugotchi_state.startugotchi_game_status = "break";
    startugotchi_state.startugotchi_active_event = null;
    startugotchi_state.startugotchi_result = startugotchi_calculate_result(finalStats, true);
  } else if (startugotchi_state.startugotchi_turn >= STARTUGOTCHI_MAX_TURNS) {
    startugotchi_state.startugotchi_game_status = "complete";
    startugotchi_state.startugotchi_active_event = null;
    startugotchi_state.startugotchi_result = startugotchi_calculate_result(finalStats);
  }
}


export function startugotchi_calculate_result(stats, earlyBreak = false) {
  const survivalScore = Math.round(stats.Health + stats.Cash + stats.Popularity + stats.Focus - stats.Stress);
  if (earlyBreak) {
    return {
      survivalScore,
      category: "Needs a break",
      message: "Your Startugotchi needs a break.",
      postcard: startugotchi_result_postcard(stats, "Needs a break"),
      wentWell: startugotchi_best_summary(stats),
      hurt: startugotchi_break_reason(stats),
    };
  }

  let category = "Burned out";
  let message = "Your startup ran out of energy. Time to hatch another one.";
  if (survivalScore >= 300) {
    category = "Thriving";
    message = "Your startup survived the chaos and is looking strong. Big founder energy. 🚀";
  } else if (survivalScore >= 230) {
    category = "Stable";
    message = "Your startup made it through. Not perfect, but alive and learning.";
  } else if (survivalScore >= 160) {
    category = "Struggling";
    message = "Your startup survived, but it needs better balance.";
  }

  return {
    survivalScore,
    category,
    message,
    postcard: startugotchi_result_postcard(stats, category),
    wentWell: startugotchi_best_summary(stats),
    hurt: startugotchi_hurt_summary(stats),
  };
}

function startugotchi_prepare_context(model) {
  const rows = (model?.rows ?? []).map((row) => ({ ...row }));
  const headers = startugotchi_headers(model);
  const signature = `${rows.length}:${headers.join("|")}:${model?.clusterResult?.clusterColumn ?? ""}`;

  startugotchi_context.rows = rows;
  startugotchi_context.headers = headers;

  if (startugotchi_state.startugotchi_dataset_signature !== signature) {
    startugotchi_reset_state();
    startugotchi_state.startugotchi_dataset_signature = signature;
    startugotchi_state.startugotchi_column_mapping = startugotchi_detect_columns(model);
  }
}

function startugotchi_reset_state() {
  startugotchi_state.startugotchi_selected_startup = null;
  startugotchi_state.startugotchi_stats = null;
  startugotchi_state.startugotchi_turn = 0;
  startugotchi_state.startugotchi_game_log = [];
  startugotchi_state.startugotchi_game_status = "idle";
  startugotchi_state.startugotchi_column_mapping = {};
  startugotchi_state.startugotchi_stat_sources = {};
  startugotchi_state.startugotchi_pet = null;
  startugotchi_state.startugotchi_result = null;
  startugotchi_state.startugotchi_last_action = null;
  startugotchi_state.startugotchi_last_event = null;
  startugotchi_state.startugotchi_badges = [];
  startugotchi_state.startugotchi_special_used = false;
  startugotchi_state.startugotchi_mission = null;
  startugotchi_state.startugotchi_latest_event = null;
  startugotchi_state.startugotchi_latest_headline = "";
  startugotchi_state.startugotchi_active_event = null;
}

function startugotchi_hatch_random_startup() {
  const rows = startugotchi_context.rows;
  if (!rows.length) return;

  const current = startugotchi_state.startugotchi_selected_startup;
  let row = rows[Math.floor(Math.random() * rows.length)];
  if (rows.length > 1 && current) {
    const currentName = startugotchi_value(current, startugotchi_state.startugotchi_column_mapping.name);
    let attempts = 0;
    while (attempts < 6 && startugotchi_value(row, startugotchi_state.startugotchi_column_mapping.name) === currentName) {
      row = rows[Math.floor(Math.random() * rows.length)];
      attempts += 1;
    }
  }

  startugotchi_state.startugotchi_selected_startup = { ...row };
  startugotchi_recalculate_current();
  startugotchi_state.startugotchi_turn = 0;
  startugotchi_state.startugotchi_game_status = "active";
  startugotchi_state.startugotchi_result = null;
  startugotchi_state.startugotchi_last_action = null;
  startugotchi_state.startugotchi_last_event = null;
  startugotchi_state.startugotchi_special_used = false;
  startugotchi_state.startugotchi_mission = startugotchi_pick(STARTUGOTCHI_MISSIONS);
  startugotchi_state.startugotchi_latest_event = null;
  startugotchi_state.startugotchi_active_event = null;
  startugotchi_state.startugotchi_latest_headline = "Make the first move.";
  startugotchi_state.startugotchi_badges = startugotchi_calculate_badges(startugotchi_state.startugotchi_stats, 0);
  startugotchi_state.startugotchi_game_log = [
    {
      turn: 0,
      message: `${startugotchi_state.startugotchi_pet.label} hatched. The roadmap is tiny, but the feelings are large.`,
      eventMessage: startugotchi_opening_headline(startugotchi_state.startugotchi_stats),
      eventTone: "good",
      delta: "",
      mood: startugotchi_calculate_mood(startugotchi_state.startugotchi_stats),
    },
  ];
}

function startugotchi_recalculate_current() {
  const row = startugotchi_state.startugotchi_selected_startup;
  if (!row) return;
  const calculation = startugotchi_calculate_stats(
    { ...row },
    startugotchi_context.rows.map((item) => ({ ...item })),
    { ...startugotchi_state.startugotchi_column_mapping },
  );
  startugotchi_state.startugotchi_pet = calculation.pet;
  startugotchi_state.startugotchi_stats = calculation.stats;
  startugotchi_state.startugotchi_stat_sources = calculation.explanations;
  startugotchi_state.startugotchi_badges = startugotchi_calculate_badges(
    calculation.stats,
    startugotchi_state.startugotchi_turn,
  );
  if (startugotchi_state.startugotchi_game_status === "complete") {
    startugotchi_state.startugotchi_result = startugotchi_calculate_result(calculation.stats);
  }
}

function startugotchi_render_waiting_panel() {
  return `
    <article class="startugotchi-empty">
      <div class="startugotchi-empty-egg">🥚</div>
      <div>
        <h3>Ready to hatch a startup?</h3>
        <p>Pick a random row from the loaded dataset and turn its funding profile into one of four Startugotchi pets.</p>
      </div>
    </article>
  `;
}

function startugotchi_render_entry() {
  return `
    <article class="startugotchi-entry">
      <div>
        <p class="eyebrow">Mini-game mode</p>
        <h3>Startugotchi</h3>
        <p>Hatch a startup pet and survive 10 risky decisions.</p>
      </div>
      <button class="startugotchi-primary startugotchi-enter-button" type="button" data-startugotchi-enter>
        🎮 Enter Startugotchi Mode
      </button>
    </article>
  `;
}

function startugotchi_render_mode_topbar() {
  return `
    <header class="startugotchi-mode-topbar">
      <button type="button" data-startugotchi-exit>← Back to App</button>
      <strong>Startugotchi</strong>
      <span>Turn ${formatNumber(startugotchi_state.startugotchi_turn)} / ${formatNumber(STARTUGOTCHI_MAX_TURNS)}</span>
    </header>
  `;
}

function startugotchi_render_hatch_screen() {
  return `
    <section class="startugotchi-hatch-screen">
      <div class="startugotchi-hatch-egg">🥚</div>
      <h3>Ready to hatch a random startup?</h3>
      <button class="startugotchi-primary" type="button" data-startugotchi-hatch>🥚 Hatch Random Startup</button>
      <details class="startugotchi-compact-details">
        <summary>Column mapping</summary>
        ${startugotchi_render_mapping_panel()}
      </details>
    </section>
  `;
}

function startugotchi_render_active_game() {
  return `
    <div class="startugotchi-mode-grid">
      <aside class="startugotchi-side startugotchi-side-left">
        ${startugotchi_render_stats()}
        ${startugotchi_render_log()}
      </aside>
      <section class="startugotchi-arena">
        ${startugotchi_render_pet_stage()}
        ${startugotchi_state.startugotchi_result ? startugotchi_render_result() : ""}
        ${startugotchi_state.startugotchi_active_event ? startugotchi_render_special_event() : startugotchi_render_actions()}
      </section>
      <aside class="startugotchi-side startugotchi-side-right">
        ${startugotchi_render_details_panel()}
        ${startugotchi_render_explanations()}
      </aside>
    </div>
  `;
}

function startugotchi_render_mapping_panel() {
  const mapping = startugotchi_state.startugotchi_column_mapping;
  const options = startugotchi_context.headers
    .map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(prettifyColumn(header))}</option>`)
    .join("");

  return `
    <details class="startugotchi-mapping">
      <summary>Column mapping used for the game</summary>
      <p>
        Startugotchi detected these fields from the already-loaded dataset. Change a field here only for this mini-game.
      </p>
      <div class="startugotchi-mapping-grid">
        ${STARTUGOTCHI_FIELD_CONFIG.map((field) => `
          <label>
            <span>${escapeHtml(field.label)}</span>
            <select class="select-control" data-startugotchi-map="${escapeHtml(field.key)}">
              <option value="">Not available</option>
              ${options}
            </select>
          </label>
        `).join("")}
      </div>
    </details>
  `;
}

function startugotchi_render_pet_stage() {
  const row = startugotchi_state.startugotchi_selected_startup;
  const mapping = startugotchi_state.startugotchi_column_mapping;
  const pet = startugotchi_state.startugotchi_pet;
  const stats = startugotchi_state.startugotchi_stats;
  const name = startugotchi_display(startugotchi_value(row, mapping.name), "Unnamed startup");
  const fundingValue = startugotchi_display(startugotchi_value(row, mapping.fundingProfile), "Cluster unknown");
  const mood = startugotchi_calculate_mood(stats);
  const mission = startugotchi_state.startugotchi_mission;
  const missionDone = mission ? startugotchi_is_mission_complete(mission, stats) : false;
  const resultClass = startugotchi_state.startugotchi_result ? "is-ended" : "";
  const visual = startugotchi_pet_visual_state(stats);

  return `
    <div class="startugotchi-pet-stage ${resultClass} ${escapeHtml(visual.stageClass)}" style="${escapeHtml(visual.style)}">
      <div class="startugotchi-pill-row">
        <span class="startugotchi-pill">${escapeHtml(pet.clusterLabel)}</span>
        <span class="startugotchi-pill mood">${escapeHtml(mood)}</span>
        ${mission ? `<span class="startugotchi-pill mission ${missionDone ? "is-done" : ""}">Mission: ${escapeHtml(mission.label)}</span>` : ""}
      </div>
      <div class="startugotchi-pet-orbit ${escapeHtml(visual.orbitClass)}">
        <span class="startugotchi-aura startugotchi-aura-cash" aria-hidden="true"></span>
        <span class="startugotchi-aura startugotchi-aura-buzz" aria-hidden="true"></span>
        <span class="startugotchi-aura startugotchi-aura-stress" aria-hidden="true"></span>
        <button class="startugotchi-big-pet" type="button" data-startugotchi-pet-boop aria-label="Interact with Startugotchi">
          <span>${escapeHtml(pet.emoji)}</span>
        </button>
        <span class="startugotchi-focus-reticle" aria-hidden="true"></span>
      </div>
      <h3>${escapeHtml(name)}</h3>
      <div class="startugotchi-pet-badges">
        <span>${escapeHtml(pet.label)}</span>
        <span>Cluster: ${escapeHtml(fundingValue)}</span>
      </div>
      ${startugotchi_render_living_vitals(stats)}
      <p class="startugotchi-pet-line">${escapeHtml(startugotchi_reaction_line(stats, pet))}</p>
      <div class="startugotchi-headline">
        ${escapeHtml(startugotchi_state.startugotchi_latest_headline || "Make a move. Keep it alive.")}
      </div>
      ${startugotchi_render_mini_log_chips()}
    </div>
  `;
}

function startugotchi_render_special_event() {
  const event = startugotchi_state.startugotchi_active_event;
  if (!event) return "";
  return `
    <article class="startugotchi-special-card">
      <div class="startugotchi-special-icon">${escapeHtml(event.icon)}</div>
      <div>
        <p class="eyebrow">Special event</p>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.situation)}</p>
      </div>
      <div class="startugotchi-event-actions">
        ${event.choices.map((choice) => `
          <button type="button" data-startugotchi-event-choice="${escapeHtml(choice.key)}">
            <span>${escapeHtml(choice.label)}</span>
            <small>${escapeHtml(startugotchi_choice_preview(choice))}</small>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function startugotchi_render_living_vitals(stats) {
  const items = [
    { key: "Health", icon: "❤️", value: stats.Health, tone: stats.Health < 30 ? "danger" : "good" },
    { key: "Cash", icon: "💸", value: stats.Cash, tone: stats.Cash < 25 ? "danger" : "good" },
    { key: "Popularity", icon: "📣", value: stats.Popularity, tone: stats.Popularity > 70 ? "good" : "neutral" },
    { key: "Focus", icon: "🎯", value: stats.Focus, tone: stats.Focus > 70 ? "good" : "neutral" },
    { key: "Stress", icon: "⚠️", value: stats.Stress, tone: stats.Stress > 75 ? "danger" : "inverse" },
  ];
  return `
    <div class="startugotchi-living-vitals" aria-label="Pet visual stats">
      ${items.map((item) => `
        <span class="startugotchi-vital-dot" data-tone="${escapeHtml(item.tone)}" title="${escapeHtml(item.key)} ${formatNumber(item.value)}" style="--vital:${startugotchi_clamp(item.value)}%">
          <b>${escapeHtml(item.icon)}</b>
        </span>
      `).join("")}
    </div>
  `;
}

function startugotchi_render_details_panel() {
  const row = startugotchi_state.startugotchi_selected_startup;
  const mapping = startugotchi_state.startugotchi_column_mapping;
  const details = [
    ["Market", startugotchi_value(row, mapping.market)],
    ["Country", startugotchi_value(row, mapping.country)],
    ["Status", startugotchi_value(row, mapping.status)],
    ["Stage", startugotchi_value(row, mapping.stage)],
    ["Level", startugotchi_value(row, mapping.level)],
    ["Rounds", startugotchi_value(row, mapping.rounds)],
    ["Funding", startugotchi_format_possible_money(startugotchi_value(row, mapping.total))],
    ["Date", startugotchi_value(row, mapping.date)],
  ].filter(([, value]) => startugotchi_has_value(value));

  return `
    <details class="startugotchi-compact-details">
      <summary>Startup details</summary>
      <div class="startugotchi-detail-grid">
        ${details.map(([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(startugotchi_display(value, "N/A"))}</strong></div>
        `).join("")}
      </div>
    </details>
    <details class="startugotchi-compact-details">
      <summary>Column mapping</summary>
      ${startugotchi_render_mapping_panel()}
    </details>
  `;
}

function startugotchi_render_startup_card() {
  const row = startugotchi_state.startugotchi_selected_startup;
  const mapping = startugotchi_state.startugotchi_column_mapping;
  const pet = startugotchi_state.startugotchi_pet;
  const stats = startugotchi_state.startugotchi_stats;
  const name = startugotchi_display(startugotchi_value(row, mapping.name), "Unnamed startup");
  const fundingColumn = mapping.fundingProfile ? prettifyColumn(mapping.fundingProfile) : "Funding profile";
  const fundingValue = startugotchi_display(startugotchi_value(row, mapping.fundingProfile), "Not recorded");
  const mood = startugotchi_calculate_mood(stats);
  const turnPercent = (startugotchi_state.startugotchi_turn / STARTUGOTCHI_MAX_TURNS) * 100;
  const facts = [
    ["Market", startugotchi_value(row, mapping.market)],
    ["Country", startugotchi_value(row, mapping.country)],
    ["Date", startugotchi_value(row, mapping.date)],
    ["Status", startugotchi_value(row, mapping.status)],
    ["Funding stage", startugotchi_value(row, mapping.stage)],
    ["Level", startugotchi_value(row, mapping.level)],
    ["Funding rounds", startugotchi_value(row, mapping.rounds)],
    ["Funding total", startugotchi_format_possible_money(startugotchi_value(row, mapping.total))],
  ].filter(([, value]) => startugotchi_has_value(value));

  return `
    <article class="startugotchi-card">
      <div class="startugotchi-card-top">
        <div class="startugotchi-emoji" aria-hidden="true">${escapeHtml(pet.emoji)}</div>
        <div>
          <p class="eyebrow">${escapeHtml(pet.clusterLabel)}</p>
          <h3>${escapeHtml(name)}</h3>
          <p class="startugotchi-pet-name">${escapeHtml(pet.label)}</p>
        </div>
      </div>
      <p class="startugotchi-description">${escapeHtml(pet.description)}</p>
      <div class="startugotchi-reaction">
        <span>${escapeHtml(startugotchi_reaction_label(mood))}</span>
        <strong>${escapeHtml(startugotchi_reaction_line(stats, pet))}</strong>
      </div>
      <dl class="startugotchi-card-meta">
        <div>
          <dt>${escapeHtml(fundingColumn)}</dt>
          <dd>${escapeHtml(fundingValue)}</dd>
        </div>
        <div>
          <dt>Current mood</dt>
          <dd>${escapeHtml(mood)}</dd>
        </div>
        <div>
          <dt>Turn</dt>
          <dd>${formatNumber(startugotchi_state.startugotchi_turn)} / ${formatNumber(STARTUGOTCHI_MAX_TURNS)}</dd>
        </div>
      </dl>
      <div class="startugotchi-turn-progress" aria-label="Turn progress ${formatNumber(turnPercent)} percent">
        <div style="--startugotchi-turn:${startugotchi_clamp(turnPercent)}%"></div>
      </div>
      ${startugotchi_render_badges()}
      ${facts.length ? `
        <div class="startugotchi-facts">
          ${facts.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(startugotchi_display(value, "Not recorded"))}</strong>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function startugotchi_render_pulse() {
  const stats = startugotchi_state.startugotchi_stats ?? {};
  const pulse = startugotchi_calculate_pulse(stats);
  return `
    <article class="startugotchi-pulse">
      <div class="startugotchi-panel-heading">
        <h3>Startup pulse</h3>
        <p>${escapeHtml(startugotchi_board_headline(stats))}</p>
      </div>
      <div class="startugotchi-pulse-grid">
        ${pulse.map((item) => `
          <div class="startugotchi-pulse-card" data-tone="${escapeHtml(item.tone)}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <small>${escapeHtml(item.note)}</small>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function startugotchi_render_stats() {
  const stats = startugotchi_state.startugotchi_stats ?? {};
  return `
    <article class="startugotchi-stat-board">
      <div class="startugotchi-stats">
        ${Object.entries(stats).map(([name, value]) => {
          const stress = name === "Stress";
          const icon = startugotchi_stat_icon(name);
          return `
            <div class="startugotchi-stat ${stress ? "is-stress" : ""}">
              <div class="startugotchi-stat-label">
                <span>${escapeHtml(icon)} ${escapeHtml(name)}</span>
                <strong>${formatNumber(value)}</strong>
              </div>
              <div class="startugotchi-stat-track" aria-label="${escapeHtml(name)} ${formatNumber(value)} out of 100">
                <div class="startugotchi-stat-fill" style="--startugotchi-value:${startugotchi_clamp(value)}%"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function startugotchi_render_actions() {
  const active = startugotchi_state.startugotchi_game_status === "active" && !startugotchi_state.startugotchi_active_event;
  const actions = [...STARTUGOTCHI_ACTIONS, startugotchi_special_action()];
  return `
    <article class="startugotchi-controller">
      <div class="startugotchi-actions">
        ${actions.map((action) => {
          const chance = startugotchi_action_chance(action.key, startugotchi_state.startugotchi_stats);
          const used = action.key === "special" && startugotchi_state.startugotchi_special_used;
          const disabled = !active || used;
          return `
          <button class="startugotchi-action ${action.key === "special" ? "is-special" : ""}" type="button" data-startugotchi-action="${escapeHtml(action.key)}" ${disabled ? "disabled" : ""}>
            <span>${escapeHtml(action.label)}</span>
            <small>${used ? "Used" : `${startugotchi_risk_icon(chance)} ${formatNumber(chance)}% · ${action.effect}`}</small>
          </button>
        `;
        }).join("")}
      </div>
    </article>
  `;
}

function startugotchi_render_result() {
  const result = startugotchi_state.startugotchi_result;
  if (!result) return "";
  const mission = startugotchi_state.startugotchi_mission;
  const missionDone = mission ? startugotchi_is_mission_complete(mission, startugotchi_state.startugotchi_stats) : false;

  return `
    <article class="startugotchi-result">
      <p class="eyebrow">Game over</p>
      <h3>${escapeHtml(result.category)}</h3>
      ${mission ? `<div class="startugotchi-result-mission ${missionDone ? "is-done" : "is-failed"}">${missionDone ? "Mission complete" : "Mission failed"} · ${escapeHtml(mission.label)}</div>` : ""}
      <p>${escapeHtml(result.message)}</p>
      ${result.postcard ? `<p class="startugotchi-postcard">${escapeHtml(result.postcard)}</p>` : ""}
      <div class="startugotchi-result-grid">
        <div>
          <span>Survival score</span>
          <strong>${formatNumber(result.survivalScore)}</strong>
        </div>
        <div>
          <span>What went well</span>
          <strong>${escapeHtml(result.wentWell)}</strong>
        </div>
        <div>
          <span>What hurt most</span>
          <strong>${escapeHtml(result.hurt)}</strong>
        </div>
      </div>
      <div class="startugotchi-result-actions">
        <button class="startugotchi-primary" type="button" data-startugotchi-hatch>🥚 Hatch Another Startup</button>
        <button class="startugotchi-secondary" type="button" data-startugotchi-exit>← Back to App</button>
      </div>
    </article>
  `;
}

function startugotchi_render_log() {
  const items = startugotchi_state.startugotchi_game_log.slice(0, 3);
  return `
    <details class="startugotchi-compact-details">
      <summary>Last events</summary>
      <ol class="startugotchi-log">
        ${items.map((item) => `
          <li data-tone="${escapeHtml(item.eventTone || "neutral")}">
            <span>Turn ${formatNumber(item.turn)}</span>
            <p>${escapeHtml(item.message)}</p>
            ${item.eventMessage ? `<p class="startugotchi-log-event">${escapeHtml(item.eventMessage)}</p>` : ""}
            <small>${item.delta ? `${escapeHtml(item.delta)} - ` : ""}Mood: ${escapeHtml(item.mood)}</small>
          </li>
        `).join("")}
      </ol>
    </details>
  `;
}

function startugotchi_render_explanations() {
  const explanations = startugotchi_state.startugotchi_stat_sources ?? {};
  return `
    <details class="startugotchi-explain">
      <summary>Where do these stats come from?</summary>
      <div class="startugotchi-explain-grid">
        ${Object.entries(explanations).map(([stat, detail]) => `
          <div>
            <h4>${escapeHtml(stat)}: ${formatNumber(startugotchi_state.startugotchi_stats?.[stat] ?? detail.value)}</h4>
            <p><strong>Used fields:</strong> ${escapeHtml(detail.usedFields.length ? detail.usedFields.join(", ") : "neutral fallback")}</p>
            <p>${escapeHtml(detail.explanation)}</p>
          </div>
        `).join("")}
      </div>
      <p class="startugotchi-disclaimer">
        These stats are simplified game metrics based on dataset signals. They are not predictions or real business evaluations.
      </p>
    </details>
  `;
}

function startugotchi_render_badges() {
  const badges = startugotchi_state.startugotchi_badges ?? [];
  if (!badges.length) return "";
  return `
    <div class="startugotchi-badges" aria-label="Startugotchi badges">
      ${badges.map((badge) => `
        <span title="${escapeHtml(badge.note)}">${escapeHtml(badge.label)}</span>
      `).join("")}
    </div>
  `;
}

function startugotchi_render_mini_log_chips() {
  const items = startugotchi_state.startugotchi_game_log.slice(0, 3);
  if (!items.length) return "";
  return `
    <div class="startugotchi-mini-log">
      ${items.map((item) => `<span>${escapeHtml(item.message)}</span>`).join("")}
    </div>
  `;
}

function startugotchi_attach_handlers() {
  const container = startugotchi_context.container;
  if (!container) return;

  const mapping = startugotchi_state.startugotchi_column_mapping;
  for (const button of container.querySelectorAll("[data-startugotchi-enter]")) {
    button.addEventListener("click", () => {
      startugotchi_state.startugotchi_mode_active = true;
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const button of container.querySelectorAll("[data-startugotchi-exit]")) {
    button.addEventListener("click", () => {
      startugotchi_state.startugotchi_mode_active = false;
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const select of container.querySelectorAll("[data-startugotchi-map]")) {
    const key = select.dataset.startugotchiMap;
    select.value = mapping[key] ?? "";
    select.addEventListener("change", () => {
      startugotchi_state.startugotchi_column_mapping[key] = select.value || null;
      if (startugotchi_state.startugotchi_selected_startup) {
        startugotchi_recalculate_current();
        startugotchi_state.startugotchi_turn = 0;
        startugotchi_state.startugotchi_game_status = "active";
        startugotchi_state.startugotchi_result = null;
        startugotchi_state.startugotchi_game_log = [
          {
            turn: 0,
            message: "Column mapping updated for this Startugotchi run. Fresh strategy, fresh spreadsheet.",
            eventMessage: startugotchi_opening_headline(startugotchi_state.startugotchi_stats),
            eventTone: "good",
            delta: "",
            mood: startugotchi_calculate_mood(startugotchi_state.startugotchi_stats),
          },
        ];
      }
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const button of container.querySelectorAll("[data-startugotchi-hatch]")) {
    button.addEventListener("click", () => {
      startugotchi_hatch_random_startup();
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const button of container.querySelectorAll("[data-startugotchi-action]")) {
    button.addEventListener("click", () => {
      startugotchi_apply_action(button.dataset.startugotchiAction);
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const button of container.querySelectorAll("[data-startugotchi-event-choice]")) {
    button.addEventListener("click", () => {
      startugotchi_apply_special_event_choice(button.dataset.startugotchiEventChoice);
      startugotchi_render(startugotchi_context.model);
    });
  }

  for (const button of container.querySelectorAll("[data-startugotchi-pet-boop]")) {
    button.addEventListener("click", () => {
      startugotchi_state.startugotchi_latest_headline = startugotchi_pet_boop_line();
      startugotchi_render(startugotchi_context.model);
    });
  }
}

function startugotchi_headers(model) {
  const profileHeaders = model?.datasetSummary?.profiles?.map((profile) => profile.name) ?? [];
  const datasetHeaders = model?.datasets?.clustered?.headers ?? [];
  const rowHeaders = Object.keys(model?.rows?.[0] ?? {});
  return [...new Set([...profileHeaders, ...datasetHeaders, ...rowHeaders])];
}

function startugotchi_find_column(headers, candidates) {
  const normalized = new Map(headers.map((header) => [startugotchi_normalize_column(header), header]));
  for (const candidate of candidates) {
    const direct = normalized.get(startugotchi_normalize_column(candidate));
    if (direct) return direct;
  }
  for (const candidate of candidates) {
    const needle = startugotchi_normalize_column(candidate);
    const found = headers.find((header) => startugotchi_normalize_column(header).includes(needle));
    if (found) return found;
  }
  return null;
}

function startugotchi_normalize_column(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function startugotchi_matches_any(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function startugotchi_is_cluster_column(column) {
  return /^cluster$/i.test(String(column ?? "")) || /cluster/i.test(String(column ?? ""));
}

function startugotchi_dominant_source(row) {
  const sources = ["early_stage_funding", "venture", "debt_financing", "private_equity"]
    .map((column) => ({ column, value: startugotchi_parse_numeric(row[column]) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
  return sources[0]?.value > 0 ? sources[0].column : null;
}

function startugotchi_maybe_apply_event(action, stats) {
  const eventChance = action === "launch" ? 0.55 : 0.42;
  if (Math.random() > eventChance) return null;

  const pool = STARTUGOTCHI_TINY_EVENTS.filter((event) => {
    if (action === "organized") return event.key !== "meeting_sprawl";
    if (action === "money") return event.key !== "budget_surprise";
    return true;
  });
  const event = startugotchi_pick(pool);
  for (const [stat, delta] of Object.entries(event.delta)) {
    stats[stat] = (stats[stat] ?? 50) + delta;
  }
  return event;
}

function startugotchi_action_chance(action, stats = startugotchi_state.startugotchi_stats) {
  if (!stats) return 50;
  const formulas = {
    money: () => 40 + 0.25 * stats.Popularity + 0.15 * stats.Health - 0.2 * stats.Stress,
    team: () => 35 + 0.3 * stats.Cash + 0.15 * stats.Health - 0.2 * stats.Stress,
    attention: () => 45 + 0.2 * stats.Popularity + 0.15 * stats.Focus - 0.15 * stats.Stress,
    organized: () => 50 + 0.25 * stats.Focus - 0.15 * stats.Stress,
    launch: () => 30 + 0.3 * stats.Focus + 0.2 * stats.Health - 0.25 * stats.Stress,
    special: () => startugotchi_special_action().chance(stats),
  };
  return startugotchi_clamp_chance((formulas[action] ?? (() => 50))());
}

function startugotchi_clamp_chance(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.round(Math.max(10, Math.min(95, number)));
}

function startugotchi_risk_icon(chance) {
  if (chance >= 70) return "✅";
  if (chance >= 45) return "⚠️";
  return "🔥";
}

function startugotchi_special_action() {
  const pet = startugotchi_state.startugotchi_pet ?? STARTUGOTCHI_PETS.early;
  if (pet === STARTUGOTCHI_PETS.venture) {
    return {
      key: "special",
      label: "🚀 Growth Sprint",
      effect: "Once per game",
      chance: (stats) => 35 + 0.25 * stats.Cash + 0.25 * stats.Popularity - 0.25 * stats.Stress,
      success: { Popularity: 35, Health: 10, Stress: 25, Cash: -15 },
      failure: { Health: -10, Stress: 20, Cash: -10 },
      successMessage: "Growth Sprint worked. Momentum surged. 🚀",
      failureMessage: "Growth Sprint became a growth stumble. 🚀",
    };
  }
  if (pet === STARTUGOTCHI_PETS.debt) {
    return {
      key: "special",
      label: "🐢 Budget Shield",
      effect: "Once per game",
      chance: (stats) => 50 + 0.25 * stats.Focus + 0.15 * stats.Cash - 0.1 * stats.Stress,
      success: { Cash: 15, Focus: 25, Stress: -30, Popularity: -10 },
      failure: { Cash: -10, Stress: 12 },
      successMessage: "Budget Shield held. Calm restored. 🐢",
      failureMessage: "The budget shield had holes. 🐢",
    };
  }
  if (pet === STARTUGOTCHI_PETS.equity) {
    return {
      key: "special",
      label: "🦈 Efficiency Push",
      effect: "Once per game",
      chance: (stats) => 45 + 0.25 * stats.Focus + 0.2 * stats.Health - 0.15 * stats.Stress,
      success: { Focus: 30, Health: 20, Cash: 10, Popularity: -15 },
      failure: { Focus: -10, Stress: 12 },
      successMessage: "Efficiency Push landed. Sharp execution. 🦈",
      failureMessage: "Efficiency push caused more meetings. 🦈",
    };
  }
  return {
    key: "special",
    label: "🌱 Pitch Day",
    effect: "Once per game",
    chance: (stats) => 35 + 0.25 * stats.Popularity + 0.2 * stats.Focus - 0.2 * stats.Stress,
    success: { Popularity: 30, Cash: 20, Stress: 25, Focus: -10 },
    failure: { Stress: 15, Focus: -10 },
    successMessage: "Pitch Day landed. Brave and useful. 🌱",
    failureMessage: "Pitch Day was brave, but confusing. Stress up. 🌱",
  };
}

function startugotchi_apply_pet_modifiers(action, success, delta) {
  const pet = startugotchi_state.startugotchi_pet;
  if (pet === STARTUGOTCHI_PETS.early) {
    if (action === "money" && success) delta.Cash = (delta.Cash ?? 0) + 8;
    if (["attention", "launch"].includes(action)) delta.Stress = (delta.Stress ?? 0) + 8;
    if ((delta.Health ?? 0) < 0) delta.Health -= 6;
  }
  if (pet === STARTUGOTCHI_PETS.venture) {
    if (["attention", "launch"].includes(action) && success) delta.Popularity = (delta.Popularity ?? 0) + 8;
    delta.Stress = (delta.Stress ?? 0) + (success ? 5 : 7);
    if (action === "team") delta.Cash = (delta.Cash ?? 0) - 5;
  }
  if (pet === STARTUGOTCHI_PETS.debt) {
    if (action === "organized" && success) delta.Focus = (delta.Focus ?? 0) + 8;
    if ((delta.Stress ?? 0) > 0) delta.Stress -= 6;
    if (action === "attention" && success) delta.Popularity = (delta.Popularity ?? 0) - 6;
  }
  if (pet === STARTUGOTCHI_PETS.equity) {
    if (action === "organized" && success) {
      delta.Focus = (delta.Focus ?? 0) + 8;
      delta.Health = (delta.Health ?? 0) + 6;
    }
    if (action === "team") delta.Cash = (delta.Cash ?? 0) + 7;
    if (action === "attention" && success) delta.Popularity = (delta.Popularity ?? 0) - 7;
  }
}

function startugotchi_apply_random_event(stats) {
  const event = startugotchi_pick(STARTUGOTCHI_TINY_EVENTS);
  startugotchi_apply_delta(stats, event.delta);
  return event;
}

function startugotchi_apply_auto_penalties(stats) {
  const notes = [];
  if ((stats.Cash ?? 0) <= 0) {
    stats.Health = (stats.Health ?? 0) - 10;
    notes.push("No cash. Health -10.");
  }
  if ((stats.Stress ?? 0) > 85) {
    stats.Health = (stats.Health ?? 0) - 10;
    notes.push("Stress high. Health -10.");
  }
  if ((stats.Focus ?? 0) < 20) {
    stats.Stress = (stats.Stress ?? 0) + 8;
    notes.push("Focus low. Stress +8.");
  }
  if (startugotchi_state.startugotchi_turn >= 5 && (stats.Popularity ?? 0) < 15) {
    stats.Cash = (stats.Cash ?? 0) - 8;
    notes.push("Visibility low. Cash -8.");
  }
  return notes.join(" ");
}

function startugotchi_apply_delta(stats, delta = {}) {
  for (const [stat, value] of Object.entries(delta)) {
    stats[stat] = (stats[stat] ?? 50) + value;
  }
}

function startugotchi_rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function startugotchi_choice_preview(choice) {
  if (!choice.chance) return choice.preview;
  const chance = startugotchi_clamp_chance(choice.chance(startugotchi_state.startugotchi_stats));
  return `${startugotchi_risk_icon(chance)} ${formatNumber(chance)}% · ${choice.preview}`;
}

function startugotchi_stat_icon(name) {
  return { Health: "❤️", Cash: "💸", Popularity: "📣", Focus: "🎯", Stress: "⚠️" }[name] ?? "";
}

function startugotchi_pet_visual_state(stats = {}) {
  const health = startugotchi_clamp(stats.Health ?? 50);
  const cash = startugotchi_clamp(stats.Cash ?? 50);
  const popularity = startugotchi_clamp(stats.Popularity ?? 50);
  const focus = startugotchi_clamp(stats.Focus ?? 50);
  const stress = startugotchi_clamp(stats.Stress ?? 50);
  const classes = [];

  if (stress >= 80) classes.push("is-stress-critical");
  else if (stress >= 60) classes.push("is-stressed");
  if (health <= 25) classes.push("is-fragile");
  else if (health >= 75) classes.push("is-healthy");
  if (cash >= 75) classes.push("is-cash-rich");
  else if (cash <= 25) classes.push("is-cash-low");
  if (popularity >= 75) classes.push("is-popular");
  if (focus >= 75) classes.push("is-focused");

  return {
    stageClass: classes.join(" "),
    orbitClass: classes.join(" "),
    style: [
      `--pet-health:${health}`,
      `--pet-cash:${cash}`,
      `--pet-popularity:${popularity}`,
      `--pet-focus:${focus}`,
      `--pet-stress:${stress}`,
      `--pet-energy:${Math.max(0.8, Math.min(1.16, 0.88 + health / 360 + popularity / 520 - stress / 700))}`,
      `--pet-wobble:${Math.max(0, stress - 45) / 55}`,
      `--pet-dim:${Math.max(0, 55 - health) / 55}`,
      `--pet-saturation:${0.78 + health / 150}`,
      `--pet-cash-glow:${cash / 135}`,
      `--pet-cash-glow-strong:${cash / 105}`,
      `--pet-cash-scale:${0.82 + cash / 260}`,
      `--pet-popularity-ring:${popularity / 140}`,
      `--pet-popularity-ring-strong:${popularity / 120}`,
      `--pet-popularity-scale:${0.82 + popularity / 230}`,
      `--pet-stress-aura:${Math.max(0, stress - 45) / 55}`,
      `--pet-focus-alpha:${focus / 140}`,
    ].join(";"),
  };
}

function startugotchi_pet_boop_line() {
  const stats = startugotchi_state.startugotchi_stats;
  const pet = startugotchi_state.startugotchi_pet;
  if (!stats || !pet) return "The Startugotchi blinks at the roadmap.";
  if (stats.Stress >= 85) return `${pet.label} is visibly vibrating. Maybe fewer emergencies. ⚠️`;
  if (stats.Health <= 25) return `${pet.label} leans on the strategy deck for support. ❤️`;
  if (stats.Cash <= 25) return `${pet.label} checks the runway and makes a tiny face. 💸`;
  if (stats.Popularity >= 80) return `${pet.label} waves at the crowd. The crowd waves back. 📣`;
  if (stats.Focus >= 80) return `${pet.label} locks onto the roadmap with laser focus. 🎯`;
  if (stats.Cash >= 80) return `${pet.label} sparkles with responsible runway energy. 💸`;
  return `${pet.label} bounces once. Morale improves, spiritually.`;
}

function startugotchi_delta_summary(beforeStats, afterStats) {
  const parts = Object.entries(afterStats)
    .map(([stat, value]) => ({ stat, delta: value - (beforeStats[stat] ?? value) }))
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
    .map((item) => `${item.stat} ${item.delta > 0 ? "+" : ""}${formatNumber(item.delta)}`);
  return parts.length ? parts.join(", ") : "No visible stat shift";
}

function startugotchi_calculate_badges(stats, turn) {
  if (!stats) return [];
  const badges = [];
  if (stats.Cash >= 80) badges.push({ label: "Runway Hero", note: "Cash is in a strong place." });
  if (stats.Popularity >= 80) badges.push({ label: "Traction Magnet", note: "Popularity is carrying real momentum." });
  if (stats.Focus >= 75 && stats.Stress <= 40) badges.push({ label: "Calm Operator", note: "Focus is high while stress stays controlled." });
  if (stats.Health >= 75 && turn >= 5) badges.push({ label: "Still Standing", note: "Health stayed strong deep into the run." });
  if (stats.Stress <= 25 && turn >= 3) badges.push({ label: "Zen Founder", note: "Stress is impressively low." });
  if (stats.Health >= 65 && stats.Cash >= 65 && stats.Focus >= 65) {
    badges.push({ label: "Balanced Board Deck", note: "Health, cash, and focus are all solid." });
  }
  return badges.slice(0, 4);
}

function startugotchi_calculate_pulse(stats) {
  const runway = startugotchi_clamp((stats.Cash ?? 50) * 0.7 + (stats.Focus ?? 50) * 0.15 + (100 - (stats.Stress ?? 50)) * 0.15);
  const buzz = startugotchi_clamp((stats.Popularity ?? 50) * 0.8 + (stats.Health ?? 50) * 0.2);
  const balance = startugotchi_clamp(((stats.Health ?? 50) + (stats.Cash ?? 50) + (stats.Focus ?? 50) + (100 - (stats.Stress ?? 50))) / 4);
  const pressure = startugotchi_clamp(stats.Stress ?? 50);

  return [
    {
      label: "Runway vibe",
      value: startugotchi_rating_label(runway, true),
      note: `${formatNumber(runway)} / 100`,
      tone: startugotchi_tone_for_score(runway, true),
    },
    {
      label: "Market buzz",
      value: startugotchi_rating_label(buzz, true),
      note: `${formatNumber(buzz)} / 100`,
      tone: startugotchi_tone_for_score(buzz, true),
    },
    {
      label: "Balance",
      value: startugotchi_rating_label(balance, true),
      note: `${formatNumber(balance)} / 100`,
      tone: startugotchi_tone_for_score(balance, true),
    },
    {
      label: "Pressure",
      value: startugotchi_rating_label(pressure, false),
      note: `${formatNumber(pressure)} / 100`,
      tone: startugotchi_tone_for_score(pressure, false),
    },
  ];
}

function startugotchi_rating_label(value, higherIsBetter) {
  if (higherIsBetter) {
    if (value >= 78) return "Strong";
    if (value >= 58) return "Promising";
    if (value >= 38) return "Wobbly";
    return "Risky";
  }
  if (value <= 25) return "Chill";
  if (value <= 50) return "Manageable";
  if (value <= 75) return "Spicy";
  return "Too loud";
}

function startugotchi_tone_for_score(value, higherIsBetter) {
  if (higherIsBetter) {
    if (value >= 70) return "good";
    if (value >= 45) return "neutral";
    return "spicy";
  }
  if (value <= 40) return "good";
  if (value <= 70) return "neutral";
  return "spicy";
}

function startugotchi_board_headline(stats) {
  const score = (stats.Health ?? 50) + (stats.Cash ?? 50) + (stats.Popularity ?? 50) + (stats.Focus ?? 50) - (stats.Stress ?? 50);
  if ((stats.Stress ?? 50) >= 82) return "Board update: everyone is using the word alignment very carefully.";
  if ((stats.Cash ?? 50) <= 28) return "Board update: runway is the main character right now.";
  if (score >= 280) return "Board update: strong signal, low drama, unusually calm calendar.";
  if ((stats.Popularity ?? 50) >= 78) return "Board update: visibility is up. Expectations are also standing nearby.";
  if ((stats.Focus ?? 50) >= 76) return "Board update: the roadmap finally looks like a roadmap.";
  return "Board update: the startup is alive, learning, and occasionally overusing the word momentum.";
}

function startugotchi_opening_headline(stats) {
  return `Opening read: ${startugotchi_board_headline(stats).replace("Board update: ", "")}`;
}

function startugotchi_is_mission_complete(mission = startugotchi_state.startugotchi_mission, stats = startugotchi_state.startugotchi_stats) {
  if (!mission || !stats) return false;
  return mission.test(stats, startugotchi_state.startugotchi_turn);
}

function startugotchi_reaction_label(mood) {
  if (mood === "Overwhelmed") return "Pet reaction";
  if (mood === "Confident") return "Founder aura";
  if (mood === "Calm") return "Office weather";
  if (mood === "Worried") return "Runway whisper";
  return "Mood check";
}

function startugotchi_reaction_line(stats, pet) {
  const mood = startugotchi_calculate_mood(stats);
  if (mood === "Overwhelmed") return `${pet.label} is smiling in public and opening 37 tabs in private.`;
  if (mood === "Fragile") return `${pet.label} needs a quiet week and fewer surprise pivots.`;
  if (mood === "Worried") return `${pet.label} keeps refreshing the cash forecast with spiritual intensity.`;
  if (mood === "Excited but tired") return `${pet.label} has traction, caffeine, and a suspiciously full calendar.`;
  if (mood === "Comfortable") return `${pet.label} is not relaxed exactly, but the runway looks friendlier.`;
  if (mood === "Calm") return `${pet.label} has a tidy roadmap and a rare peaceful Slack channel.`;
  if (mood === "Confident") return `${pet.label} is giving strong update-email energy.`;
  return `${pet.label} is doing okay. The strategy deck has only minor smoke coming out of it.`;
}

function startugotchi_result_postcard(stats, category) {
  if (category === "Thriving") return "Founder postcard: crisp execution, enough runway, and just the right amount of public optimism.";
  if (category === "Stable") return "Founder postcard: not every slide was beautiful, but the company kept moving.";
  if (category === "Struggling") return "Founder postcard: there is a business in here, but it wants a calmer operating system.";
  if (category === "Burned out") return "Founder postcard: the learning was real. The nap should also be real.";
  if (stats.Stress >= 100) return "Founder postcard: pressure ate the roadmap before dessert.";
  return "Founder postcard: the startup needs rest, balance, and maybe one less emergency all-hands.";
}

function startugotchi_status_scores(value) {
  const status = String(value ?? "").toLowerCase();
  if (!status.trim()) return {};
  if (startugotchi_matches_any(status, ["closed", "inactive", "failed", "dead", "shutdown", "shut down"])) {
    return { health: 5, focus: 20, stress: 96 };
  }
  if (startugotchi_matches_any(status, ["acquired", "ipo", "public"])) {
    return { health: 94, focus: 82, stress: 28 };
  }
  if (startugotchi_matches_any(status, ["active", "operating", "live"])) {
    return { health: 78, focus: 70, stress: 42 };
  }
  return { health: 50, focus: 50, stress: 50 };
}

function startugotchi_stage_scores(value) {
  const stage = String(value ?? "").toLowerCase();
  if (!stage.trim()) return {};
  if (startugotchi_matches_any(stage, ["pre-seed", "pre seed", "seed", "angel", "early"])) {
    return { maturity: 24, cash: 24, popularity: 42, focus: 28, stress: 84 };
  }
  if (startugotchi_matches_any(stage, ["series a"])) {
    return { maturity: 48, cash: 54, popularity: 62, focus: 48, stress: 72 };
  }
  if (startugotchi_matches_any(stage, ["series b", "series c"])) {
    return { maturity: 68, cash: 72, popularity: 74, focus: 66, stress: 62 };
  }
  if (startugotchi_matches_any(stage, ["series d", "series e", "late", "growth", "private equity", "buyout"])) {
    return { maturity: 88, cash: 84, popularity: 76, focus: 84, stress: 38 };
  }
  if (startugotchi_matches_any(stage, ["debt", "loan", "credit"])) {
    return { maturity: 68, cash: 68, popularity: 46, focus: 78, stress: 34 };
  }
  return { maturity: 50, cash: 50, popularity: 50, focus: 50, stress: 50 };
}

function startugotchi_funding_profile_scores(pet) {
  if (pet === STARTUGOTCHI_PETS.venture) {
    return { cash: 64, popularity: 82, focus: 50, stress: 82 };
  }
  if (pet === STARTUGOTCHI_PETS.debt) {
    return { cash: 68, popularity: 42, focus: 82, stress: 30 };
  }
  if (pet === STARTUGOTCHI_PETS.equity) {
    return { cash: 88, popularity: 56, focus: 86, stress: 28 };
  }
  return { cash: 24, popularity: 44, focus: 30, stress: 86 };
}

function startugotchi_normalize_date_percentile(value, rows, column) {
  if (!column) return null;
  const date = startugotchi_parse_date(value);
  if (!Number.isFinite(date)) return null;
  const values = rows
    .map((row) => startugotchi_parse_date(row[column]))
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);
  if (values.length < 2) return 50;
  const lower = values.filter((item) => item < date).length;
  const equal = values.filter((item) => item === date).length;
  return startugotchi_clamp(((lower + equal * 0.5) / values.length) * 100);
}

function startugotchi_parse_date(value) {
  if (!startugotchi_has_value(value)) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function startugotchi_market_frequency_score(value, rows, column) {
  if (!column || !startugotchi_has_value(value)) return null;
  const counts = new Map();
  for (const row of rows) {
    const label = String(row[column] ?? "").trim().toLowerCase();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const current = counts.get(String(value).trim().toLowerCase());
  if (!current || counts.size < 2) return 50;
  const values = [...counts.values()].sort((a, b) => a - b);
  const lower = values.filter((item) => item < current).length;
  const equal = values.filter((item) => item === current).length;
  return startugotchi_clamp(((lower + equal * 0.5) / values.length) * 100);
}

function startugotchi_signal(value, weight, field) {
  if (!Number.isFinite(value) || !field) return null;
  return { value: startugotchi_clamp(value), weight, field };
}

function startugotchi_weighted_average(items) {
  const valid = items.filter(Boolean);
  if (!valid.length) return 50;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  return startugotchi_clamp(valid.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

function startugotchi_used_fields(items) {
  return [...new Set(items.filter(Boolean).map((item) => prettifyColumn(item.field)))];
}

function startugotchi_clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, number));
}

function startugotchi_clamp_stats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, Math.round(startugotchi_clamp(value))]));
}

function startugotchi_value(row, column) {
  if (!row || !column) return null;
  return row[column];
}

function startugotchi_has_value(value) {
  return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "(missing)";
}

function startugotchi_display(value, fallback) {
  if (!startugotchi_has_value(value)) return fallback;
  return toDisplayValue(value);
}

function startugotchi_format_possible_money(value) {
  const number = startugotchi_parse_numeric(value);
  return Number.isFinite(number) ? formatMoney(number) : value;
}

function startugotchi_pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function startugotchi_best_summary(stats) {
  const positives = ["Health", "Cash", "Popularity", "Focus"]
    .map((name) => ({ name, value: stats[name] }))
    .sort((a, b) => b.value - a.value);
  const top = positives[0];
  if (!top) return "The startup kept going.";
  return `${top.name} carried the run at ${formatNumber(top.value)}.`;
}

function startugotchi_hurt_summary(stats) {
  const positives = ["Health", "Cash", "Popularity", "Focus"]
    .map((name) => ({ name, value: stats[name] }))
    .sort((a, b) => a.value - b.value);
  if (stats.Stress >= 70) return `Stress stayed high at ${formatNumber(stats.Stress)}.`;
  return `${positives[0].name} needed more attention at ${formatNumber(positives[0].value)}.`;
}

function startugotchi_break_reason(stats) {
  if (stats.Stress >= 100) return "Too much stress built up before the startup found balance.";
  if (stats.Health <= 0) return "Health fell too low after too many problems at once.";
  if (stats.Cash <= 20 && stats.Stress >= 80) return "Not enough balance between runway and pressure.";
  return "Too many problems arrived at the same time.";
}
