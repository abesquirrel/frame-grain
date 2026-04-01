-- =============================================================
-- Fujifilm X-Trans Recipe Database — Schema Migration
-- Cloudflare D1 / SQLite compatible
-- =============================================================



-- -------------------------------------------------------------
-- SENSORS — five generations, ordered by capability
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sensors (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  gen         INTEGER NOT NULL,           -- 1–5
  megapixels  TEXT    NOT NULL,           -- "16MP", "24MP", etc.
  released    INTEGER,                    -- year
  notes       TEXT
);

-- -------------------------------------------------------------
-- BASE SIMULATIONS — per-sensor availability
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS BaseSimulations (
  id              INTEGER PRIMARY KEY,
  sim_name        TEXT    NOT NULL UNIQUE,
  slug            TEXT    NOT NULL UNIQUE, -- url-safe id
  min_sensor_id   INTEGER NOT NULL,
  description     TEXT,
  FOREIGN KEY (min_sensor_id) REFERENCES Sensors(id)
);

-- -------------------------------------------------------------
-- RECIPE FIELDS — each setting a recipe can contain
-- Each field tracks which sensor generation introduced it
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS RecipeFields (
  id                    INTEGER PRIMARY KEY,
  field_name            TEXT    NOT NULL UNIQUE,
  slug                  TEXT    NOT NULL UNIQUE,
  data_type             TEXT    NOT NULL,  -- 'integer', 'text', 'select'
  introduced_in_sensor_id INTEGER NOT NULL,
  min_value             INTEGER,
  max_value             INTEGER,
  options               TEXT,             -- JSON array for 'select' type
  unit                  TEXT,             -- 'EV', 'step', etc.
  description           TEXT,
  FOREIGN KEY (introduced_in_sensor_id) REFERENCES Sensors(id)
);

-- -------------------------------------------------------------
-- RECIPES — the core community content
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Recipes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  slug            TEXT    NOT NULL UNIQUE,
  author          TEXT    NOT NULL DEFAULT 'Anonymous',
  description     TEXT,
  base_sim_id     INTEGER NOT NULL,
  min_sensor_id   INTEGER NOT NULL,       -- derived from fields used
  look_tags       TEXT    NOT NULL DEFAULT '[]', -- JSON array: ["film","warm","street"]
  -- Core settings (all sensors)
  wb_preset       TEXT    NOT NULL DEFAULT 'Auto',
  wb_shift_red    INTEGER NOT NULL DEFAULT 0 CHECK(wb_shift_red BETWEEN -9 AND 9),
  wb_shift_blue   INTEGER NOT NULL DEFAULT 0 CHECK(wb_shift_blue BETWEEN -9 AND 9),
  dynamic_range   TEXT    NOT NULL DEFAULT 'DR100' CHECK(dynamic_range IN ('DR100','DR200','DR400','DRAuto')),
  highlights      INTEGER NOT NULL DEFAULT 0 CHECK(highlights BETWEEN -2 AND 4),
  shadows         INTEGER NOT NULL DEFAULT 0 CHECK(shadows BETWEEN -2 AND 4),
  color           INTEGER NOT NULL DEFAULT 0 CHECK(color BETWEEN -4 AND 4),
  sharpness       INTEGER NOT NULL DEFAULT 0 CHECK(sharpness BETWEEN -4 AND 4),
  noise_reduction INTEGER NOT NULL DEFAULT 0 CHECK(noise_reduction BETWEEN -4 AND 4),
  -- X-Trans III+ fields
  grain_effect    TEXT    CHECK(grain_effect IN ('Off','Weak','Strong')),
  grain_size      TEXT    CHECK(grain_size IN (NULL,'Small','Large')),  -- IV+
  -- X-Trans IV+ fields
  color_chrome    TEXT    CHECK(color_chrome IN (NULL,'Off','Weak','Strong')),
  color_chrome_fx_blue TEXT CHECK(color_chrome_fx_blue IN (NULL,'Off','Weak','Strong')),
  clarity         INTEGER CHECK(clarity BETWEEN -5 AND 5),
  bw_adj_warm_cool INTEGER CHECK(bw_adj_warm_cool BETWEEN -18 AND 18),
  bw_adj_magenta_green INTEGER CHECK(bw_adj_magenta_green BETWEEN -18 AND 18),
  -- Exposure guidance
  exposure_compensation TEXT DEFAULT '0 EV',
  -- Meta
  submitted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  approved        INTEGER NOT NULL DEFAULT 0, -- 0=pending, 1=approved
  votes           INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (base_sim_id)   REFERENCES BaseSimulations(id),
  FOREIGN KEY (min_sensor_id) REFERENCES Sensors(id)
);

-- -------------------------------------------------------------
-- VOTES — one per recipe (simple upvote, IP-limited)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id   INTEGER NOT NULL,
  voter_hash  TEXT    NOT NULL, -- hashed IP+UA
  voted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(recipe_id, voter_hash),
  FOREIGN KEY (recipe_id) REFERENCES Recipes(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- INDEXES for common query patterns
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recipes_sim       ON Recipes(base_sim_id);
CREATE INDEX IF NOT EXISTS idx_recipes_sensor     ON Recipes(min_sensor_id);
CREATE INDEX IF NOT EXISTS idx_recipes_approved   ON Recipes(approved, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_votes      ON Recipes(votes DESC);
CREATE INDEX IF NOT EXISTS idx_votes_recipe       ON Votes(recipe_id);
