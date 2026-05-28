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
  { key: "money", label: "💸 Add Money" },
  { key: "team", label: "👥 Build Team" },
  { key: "attention", label: "📣 Get Attention" },
  { key: "organized", label: "📊 Get Organized" },
  { key: "launch", label: "🚀 Launch Something" },
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
  startugotchi_selected_startup: null,
  startugotchi_stats: null,
  startugotchi_turn: 0,
  startugotchi_game_log: [],
  startugotchi_game_status: "idle",
  startugotchi_column_mapping: {},
  startugotchi_stat_sources: {},
  startugotchi_pet: null,
  startugotchi_result: null,
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

  if (!startugotchi_context.rows.length) {
    container.innerHTML = `
      <article class="startugotchi-empty">
        <h3>No startup rows available</h3>
        <p>Startugotchi needs the already-loaded clustered dataset before it can hatch a startup.</p>
      </article>
    `;
    return;
  }

  container.innerHTML = `
    <div class="startugotchi-about">
      <p>
        This game uses the dataset's funding profile or clustering results to turn each startup into a playful character.
        The goal is not to predict real company outcomes, but to make funding clusters easier and more fun to explore.
      </p>
      <button class="startugotchi-primary" type="button" data-startugotchi-hatch>🥚 Hatch Random Startup</button>
    </div>
    ${startugotchi_render_mapping_panel()}
    ${startugotchi_state.startugotchi_selected_startup ? startugotchi_render_active_game() : startugotchi_render_waiting_panel()}
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

  const signals = {
    Health: [
      startugotchi_signal(statusScores.health, 3, mapping.status),
      startugotchi_signal(levelPct, 1.4, mapping.level),
      startugotchi_signal(stageScores.maturity, 1.3, mapping.stage),
      startugotchi_signal(totalPct, 0.8, mapping.total),
      startugotchi_signal(roundsPct, 0.5, mapping.rounds),
    ],
    Cash: [
      startugotchi_signal(totalPct, 4, mapping.total),
      startugotchi_signal(levelPct, 1, mapping.level),
      startugotchi_signal(stageScores.cash, 1, mapping.stage),
      startugotchi_signal(fundingScores.cash, 1.3, mapping.fundingProfile),
    ],
    Popularity: [
      startugotchi_signal(roundsPct, 2, mapping.rounds),
      startugotchi_signal(totalPct, 1.3, mapping.total),
      startugotchi_signal(marketPct, 1, mapping.market),
      startugotchi_signal(datePct, 0.6, mapping.date),
      startugotchi_signal(stageScores.popularity, 0.8, mapping.stage),
      startugotchi_signal(fundingScores.popularity, 0.7, mapping.fundingProfile),
    ],
    Focus: [
      startugotchi_signal(stageScores.focus, 2, mapping.stage),
      startugotchi_signal(statusScores.focus, 1, mapping.status),
      startugotchi_signal(fundingScores.focus, 1.5, mapping.fundingProfile),
      startugotchi_signal(levelPct, 1.2, mapping.level),
    ],
    Stress: [
      startugotchi_signal(stageScores.stress, 1.4, mapping.stage),
      startugotchi_signal(fundingScores.stress, 1.5, mapping.fundingProfile),
      startugotchi_signal(roundsPct, 1.1, mapping.rounds),
      startugotchi_signal(Number.isFinite(totalPct) ? 100 - totalPct : null, 0.9, mapping.total),
      startugotchi_signal(datePct, 0.5, mapping.date),
      startugotchi_signal(statusScores.stress, 1.2, mapping.status),
      startugotchi_signal(totalPct > 85 && roundsPct > 70 ? Math.min(92, (totalPct + roundsPct) / 2) : null, 0.5, mapping.total),
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
  if (startugotchi_state.startugotchi_turn >= STARTUGOTCHI_MAX_TURNS) return;

  const stats = { ...startugotchi_state.startugotchi_stats };
  let message = "";

  if (action === "money") {
    stats.Cash += 15;
    stats.Health += 4;
    stats.Stress += 3;
    message = startugotchi_pick(STARTUGOTCHI_MESSAGES.money);
  }

  if (action === "team") {
    stats.Health += 10;
    stats.Popularity += 4;
    stats.Cash -= 8;
    stats.Stress += 4;
    message = startugotchi_pick(STARTUGOTCHI_MESSAGES.team);
  }

  if (action === "attention") {
    stats.Popularity += 14;
    stats.Stress += 8;
    stats.Focus -= 5;
    message = startugotchi_pick(STARTUGOTCHI_MESSAGES.attention);
  }

  if (action === "organized") {
    stats.Focus += 14;
    stats.Stress -= 10;
    stats.Cash += 3;
    message = startugotchi_pick(STARTUGOTCHI_MESSAGES.organized);
  }

  if (action === "launch") {
    const roll = Math.random();
    if (roll < 0.38) {
      stats.Health += 9;
      stats.Popularity += 12;
      stats.Stress += 4;
      message = startugotchi_pick(STARTUGOTCHI_MESSAGES.launchSuccess);
    } else if (roll < 0.76) {
      stats.Popularity += 8;
      stats.Stress += 10;
      stats.Focus -= 3;
      message = startugotchi_pick(STARTUGOTCHI_MESSAGES.launchMixed);
    } else {
      stats.Health -= 11;
      stats.Stress += 12;
      stats.Cash -= 4;
      message = startugotchi_pick(STARTUGOTCHI_MESSAGES.launchFailure);
    }
  }

  startugotchi_state.startugotchi_turn += 1;
  startugotchi_state.startugotchi_stats = startugotchi_clamp_stats(stats);
  startugotchi_state.startugotchi_game_log.unshift({
    turn: startugotchi_state.startugotchi_turn,
    message,
    mood: startugotchi_calculate_mood(startugotchi_state.startugotchi_stats),
  });

  if (
    startugotchi_state.startugotchi_turn < STARTUGOTCHI_MAX_TURNS
    && (startugotchi_state.startugotchi_stats.Health <= 0 || startugotchi_state.startugotchi_stats.Stress >= 100)
  ) {
    startugotchi_state.startugotchi_game_status = "break";
    startugotchi_state.startugotchi_result = startugotchi_calculate_result(startugotchi_state.startugotchi_stats, true);
  } else if (startugotchi_state.startugotchi_turn >= STARTUGOTCHI_MAX_TURNS) {
    startugotchi_state.startugotchi_game_status = "complete";
    startugotchi_state.startugotchi_result = startugotchi_calculate_result(startugotchi_state.startugotchi_stats);
  }
}

export function startugotchi_calculate_result(stats, earlyBreak = false) {
  const survivalScore = Math.round(stats.Health + stats.Cash + stats.Popularity + stats.Focus - stats.Stress);
  if (earlyBreak) {
    return {
      survivalScore,
      category: "Needs a break",
      message: "Your Startugotchi needs a break.",
      wentWell: startugotchi_best_summary(stats),
      hurt: startugotchi_break_reason(stats),
    };
  }

  let category = "Burned out";
  let message = "Your startup ran out of energy. Time to hatch another one.";
  if (survivalScore >= 280) {
    category = "Thriving";
    message = "Your startup survived the chaos and is looking strong. Big founder energy. 🚀";
  } else if (survivalScore >= 220) {
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
  startugotchi_state.startugotchi_game_log = [
    {
      turn: 0,
      message: `${startugotchi_state.startugotchi_pet.label} hatched. The roadmap is tiny, but the feelings are large.`,
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

function startugotchi_render_active_game() {
  return `
    <div class="startugotchi-layout">
      ${startugotchi_render_startup_card()}
      <div class="startugotchi-play-area">
        ${startugotchi_render_stats()}
        ${startugotchi_render_actions()}
        ${startugotchi_render_result()}
        ${startugotchi_render_log()}
        ${startugotchi_render_explanations()}
      </div>
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

function startugotchi_render_startup_card() {
  const row = startugotchi_state.startugotchi_selected_startup;
  const mapping = startugotchi_state.startugotchi_column_mapping;
  const pet = startugotchi_state.startugotchi_pet;
  const stats = startugotchi_state.startugotchi_stats;
  const name = startugotchi_display(startugotchi_value(row, mapping.name), "Unnamed startup");
  const fundingColumn = mapping.fundingProfile ? prettifyColumn(mapping.fundingProfile) : "Funding profile";
  const fundingValue = startugotchi_display(startugotchi_value(row, mapping.fundingProfile), "Not recorded");
  const mood = startugotchi_calculate_mood(stats);
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

function startugotchi_render_stats() {
  const stats = startugotchi_state.startugotchi_stats ?? {};
  return `
    <article class="startugotchi-panel">
      <div class="startugotchi-panel-heading">
        <h3>Startup stats</h3>
        <p>Stress is bad when high, so lower is better.</p>
      </div>
      <div class="startugotchi-stats">
        ${Object.entries(stats).map(([name, value]) => {
          const stress = name === "Stress";
          return `
            <div class="startugotchi-stat ${stress ? "is-stress" : ""}">
              <div class="startugotchi-stat-label">
                <span>${escapeHtml(name)}${stress ? " (lower is better)" : ""}</span>
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
  const active = startugotchi_state.startugotchi_game_status === "active";
  return `
    <article class="startugotchi-panel">
      <div class="startugotchi-panel-heading">
        <h3>Decisions</h3>
        <p>Choose one action per turn. The game ends after 10 turns, or earlier if things get too intense.</p>
      </div>
      <div class="startugotchi-actions">
        ${STARTUGOTCHI_ACTIONS.map((action) => `
          <button class="startugotchi-action" type="button" data-startugotchi-action="${escapeHtml(action.key)}" ${active ? "" : "disabled"}>
            ${escapeHtml(action.label)}
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function startugotchi_render_result() {
  const result = startugotchi_state.startugotchi_result;
  if (!result) return "";

  return `
    <article class="startugotchi-result">
      <p class="eyebrow">Game result</p>
      <h3>${escapeHtml(result.category)}</h3>
      <p>${escapeHtml(result.message)}</p>
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
      <button class="startugotchi-primary" type="button" data-startugotchi-hatch>🥚 Hatch another startup</button>
    </article>
  `;
}

function startugotchi_render_log() {
  const items = startugotchi_state.startugotchi_game_log.slice(0, 8);
  return `
    <article class="startugotchi-panel">
      <div class="startugotchi-panel-heading">
        <h3>Game log</h3>
        <p>Small updates from the startup floor.</p>
      </div>
      <ol class="startugotchi-log">
        ${items.map((item) => `
          <li>
            <span>Turn ${formatNumber(item.turn)}</span>
            <p>${escapeHtml(item.message)}</p>
            <small>Mood: ${escapeHtml(item.mood)}</small>
          </li>
        `).join("")}
      </ol>
    </article>
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

function startugotchi_attach_handlers() {
  const container = startugotchi_context.container;
  if (!container) return;

  const mapping = startugotchi_state.startugotchi_column_mapping;
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

function startugotchi_status_scores(value) {
  const status = String(value ?? "").toLowerCase();
  if (!status.trim()) return {};
  if (startugotchi_matches_any(status, ["closed", "inactive", "failed", "dead", "shutdown", "shut down"])) {
    return { health: 12, focus: 28, stress: 92 };
  }
  if (startugotchi_matches_any(status, ["acquired", "ipo", "public"])) {
    return { health: 90, focus: 78, stress: 35 };
  }
  if (startugotchi_matches_any(status, ["active", "operating", "live"])) {
    return { health: 76, focus: 66, stress: 48 };
  }
  return { health: 50, focus: 50, stress: 50 };
}

function startugotchi_stage_scores(value) {
  const stage = String(value ?? "").toLowerCase();
  if (!stage.trim()) return {};
  if (startugotchi_matches_any(stage, ["pre-seed", "pre seed", "seed", "angel", "early"])) {
    return { maturity: 32, cash: 32, popularity: 42, focus: 38, stress: 76 };
  }
  if (startugotchi_matches_any(stage, ["series a"])) {
    return { maturity: 48, cash: 52, popularity: 58, focus: 50, stress: 68 };
  }
  if (startugotchi_matches_any(stage, ["series b", "series c"])) {
    return { maturity: 64, cash: 68, popularity: 70, focus: 64, stress: 62 };
  }
  if (startugotchi_matches_any(stage, ["series d", "series e", "late", "growth", "private equity", "buyout"])) {
    return { maturity: 82, cash: 78, popularity: 76, focus: 78, stress: 46 };
  }
  if (startugotchi_matches_any(stage, ["debt", "loan", "credit"])) {
    return { maturity: 64, cash: 62, popularity: 50, focus: 70, stress: 44 };
  }
  return { maturity: 50, cash: 50, popularity: 50, focus: 50, stress: 50 };
}

function startugotchi_funding_profile_scores(pet) {
  if (pet === STARTUGOTCHI_PETS.venture) {
    return { cash: 66, popularity: 72, focus: 56, stress: 70 };
  }
  if (pet === STARTUGOTCHI_PETS.debt) {
    return { cash: 62, popularity: 48, focus: 70, stress: 42 };
  }
  if (pet === STARTUGOTCHI_PETS.equity) {
    return { cash: 80, popularity: 62, focus: 78, stress: 38 };
  }
  return { cash: 34, popularity: 44, focus: 38, stress: 72 };
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
