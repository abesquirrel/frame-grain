-- =============================================================
-- Fujifilm X-Trans Recipe Database — Seed Data
-- Run after schema.sql
-- =============================================================

-- -------------------------------------------------------------
-- SENSORS
-- -------------------------------------------------------------
INSERT INTO Sensors (id, name, gen, megapixels, released, notes) VALUES
  (1, 'X-Trans I',  1, '16MP', 2012, 'Base simulations only. No Grain, No Classic Chrome, No Clarity.'),
  (2, 'X-Trans II', 2, '16MP', 2014, 'Adds Classic Chrome (most models). No Grain, No ACROS.'),
  (3, 'X-Trans III',3, '24MP', 2016, 'Adds Grain Effect (Weak/Strong), ACROS, Eterna (X-H1 only).'),
  (4, 'X-Trans IV', 4, '26MP', 2020, 'Adds Grain Size, Color Chrome Effect, Color Chrome FX Blue, Clarity, B&W Toning, Classic Negative.'),
  (5, 'X-Trans V',  5, '40MP/26MP', 2022, 'Adds REALA ACE. Cleaner processing; recipes often need lower CC Blue values.');

-- -------------------------------------------------------------
-- BASE SIMULATIONS
-- -------------------------------------------------------------
INSERT INTO BaseSimulations (id, sim_name, slug, min_sensor_id, description) VALUES
  -- X-Trans I+ (all sensors)
  (1,  'Provia/Standard',   'provia',        1, 'Balanced, natural rendering. Great all-rounder.'),
  (2,  'Velvia/Vivid',      'velvia',        1, 'Punchy saturation and contrast. Classic slide film look.'),
  (3,  'Astia/Soft',        'astia',         1, 'Gentle contrast, subtle saturation. Flattering for portraits.'),
  (4,  'PRO Neg. Hi',       'pro-neg-hi',    1, 'Controlled contrast with natural color. Portrait workhorse.'),
  (5,  'PRO Neg. Std',      'pro-neg-std',   1, 'Softer than Hi. Muted, refined palette.'),
  (6,  'Monochrome',        'monochrome',    1, 'Clean black and white conversion.'),
  (7,  'Sepia',             'sepia',         1, 'Warm monochrome toning.'),
  -- X-Trans II+
  (8,  'Classic Chrome',    'classic-chrome',2, 'Desaturated, filmic rendering. Inspired by slide film used in reportage.'),
  -- X-Trans III+
  (9,  'ACROS',             'acros',         3, 'High-acuity monochrome with rich tonality and fine grain simulation.'),
  (10, 'Eterna Cinema',     'eterna',        3, 'Low saturation, subdued highlights. Designed for video/grading.'),
  -- X-Trans IV+
  (11, 'Classic Negative',  'classic-neg',   4, 'Inspired by Fujicolor Superia. Cool shadows, retained highlight color.'),
  (12, 'Eterna Bleach Bypass','bleach-bypass',4,'High contrast, desaturated. Silver-retention process look.'),
  (13, 'Nostalgic Negative', 'nostalgic-neg',4, 'Warm, faded vintage aesthetic. Inspired by American New Wave films.'),
  -- X-Trans V+
  (14, 'REALA ACE',         'reala-ace',     5, 'Fujifilm''s most accurate color science. Natural, reference rendering.');

-- -------------------------------------------------------------
-- RECIPE FIELDS (all sensors = 1, III+ = 3, IV+ = 4)
-- -------------------------------------------------------------
INSERT INTO RecipeFields (id, field_name, slug, data_type, introduced_in_sensor_id, min_value, max_value, options, unit, description) VALUES
  -- All sensors
  (1,  'White Balance Shift (Red)',  'wb-red',   'integer', 1, -9,  9,    NULL, 'step', 'Red channel bias in custom WB shift.'),
  (2,  'White Balance Shift (Blue)', 'wb-blue',  'integer', 1, -9,  9,    NULL, 'step', 'Blue channel bias in custom WB shift.'),
  (3,  'Dynamic Range',  'dynamic-range',    'select',  1, NULL,NULL, '["DR100","DR200","DR400","DRAuto"]', NULL, 'Highlight recovery range.'),
  (4,  'Highlights',     'highlights',       'integer', 1, -2,  4,    NULL, 'step', 'Highlight tone curve adjustment.'),
  (5,  'Shadows',        'shadows',          'integer', 1, -2,  4,    NULL, 'step', 'Shadow tone curve adjustment.'),
  (6,  'Color',          'color',            'integer', 1, -4,  4,    NULL, 'step', 'Global saturation level.'),
  (7,  'Sharpness',      'sharpness',        'integer', 1, -4,  4,    NULL, 'step', 'In-camera edge sharpening.'),
  (8,  'Noise Reduction','noise-reduction',  'integer', 1, -4,  4,    NULL, 'step', 'Luminance NR. Negative = more texture.'),
  -- X-Trans III+ 
  (9,  'Grain Effect',   'grain-effect',     'select',  3, NULL,NULL, '["Off","Weak","Strong"]', NULL, 'Simulated analog grain overlay.'),
  -- X-Trans IV+
  (10, 'Grain Size',     'grain-size',       'select',  4, NULL,NULL, '["Small","Large"]', NULL, 'Size of simulated grain (requires Grain Effect ≠ Off).'),
  (11, 'Color Chrome Effect', 'color-chrome','select',  4, NULL,NULL, '["Off","Weak","Strong"]', NULL, 'Boosts color depth in richly-saturated areas.'),
  (12, 'Color Chrome FX Blue','cc-fx-blue',  'select',  4, NULL,NULL, '["Off","Weak","Strong"]', NULL, 'Blue/cyan saturation differentiation.'),
  (13, 'Clarity',        'clarity',          'integer', 4, -5,  5,    NULL, 'step', 'Midtone contrast (micro-contrast). Negative = softening.'),
  (14, 'B&W Adj. Warm/Cool',   'bw-wc',     'integer', 4, -18, 18,   NULL, 'step', 'Warm or cool toning on B&W sims.'),
  (15, 'B&W Adj. Magenta/Green','bw-mg',    'integer', 4, -18, 18,   NULL, 'step', 'Magenta/green toning on B&W sims.');

-- -------------------------------------------------------------
-- SAMPLE RECIPES
-- -------------------------------------------------------------
INSERT INTO Recipes (
  title, slug, author, description,
  base_sim_id, min_sensor_id, look_tags,
  wb_preset, wb_shift_red, wb_shift_blue,
  dynamic_range, highlights, shadows,
  color, sharpness, noise_reduction,
  grain_effect, grain_size,
  color_chrome, color_chrome_fx_blue, clarity,
  exposure_compensation, approved, votes
) VALUES

-- Recipe 1: Classic Film Look (X-Trans II+)
(
  'Kodachrome Afternoons', 'kodachrome-afternoons', 'FilmSim_Community',
  'Warm, punchy Kodachrome feel. Works beautifully in golden hour and street photography.',
  8, 2, '["film","warm","street","golden-hour"]',
  'Daylight', 4, -5,
  'DR200', -1, 1,
  2, 1, -4,
  NULL, NULL,
  NULL, NULL, NULL,
  '+0.3 EV', 1, 42
),

-- Recipe 2: Portra 400 (X-Trans II+)
(
  'Portra 400 Skin', 'portra-400-skin', 'FilmSim_Community',
  'Flattering portrait film. Overexpose slightly for that classic Portra blown-out pastel look.',
  3, 2, '["portrait","warm","soft","film"]',
  'Auto', 3, -3,
  'DR200', 0, 1,
  -1, -1, -4,
  NULL, NULL,
  NULL, NULL, NULL,
  '+0.7 EV', 1, 38
),

-- Recipe 3: Leica Monochrome (X-Trans III+)
(
  'Leica M Look', 'leica-m-look', 'FilmSim_Community',
  'Classic reportage monochrome. High acuity, strong tonal contrast, fine grain. Channel: ACROS Red filter.',
  9, 3, '["monochrome","street","film","leica"]',
  '2700K', 0, 0,
  'DR400', -1, 3,
  0, 2, -4,
  'Weak', NULL,
  NULL, NULL, NULL,
  '0 EV', 1, 67
),

-- Recipe 4: Cinematic Teal-Orange (X-Trans IV+)
(
  'Cinematic Teal & Orange', 'cinematic-teal-orange', 'FilmSim_Community',
  'Hollywood blockbuster color grade baked in-camera. Strong Color Chrome for depth in skin tones.',
  11, 4, '["cinematic","teal-orange","street","moody"]',
  'Custom', 2, -6,
  'DR400', -2, 2,
  -1, 0, -4,
  'Weak', 'Small',
  'Strong', 'Weak', -1,
  '0 EV', 1, 91
),

-- Recipe 5: Expired Film (X-Trans IV+)
(
  'Expired Superia', 'expired-superia', 'FilmSim_Community',
  'Shifted colors, crushed blacks, and unpredictable grain — the look of truly expired film.',
  11, 4, '["film","expired","vintage","lo-fi"]',
  'Fluorescent 1', 5, -8,
  'DR200', 1, -1,
  1, -1, -4,
  'Strong', 'Large',
  'Weak', 'Off', 0,
  '+1.0 EV', 1, 55
),

-- Recipe 6: REALA Natural (X-Trans V only)
(
  'REALA Natural Reference', 'reala-natural', 'FilmSim_Community',
  'Let the scene tell the story. Clean, accurate rendering that still feels alive. Built for X-Trans V.',
  14, 5, '["natural","clean","travel","documentary"]',
  'Auto', 1, -2,
  'DR200', 0, 0,
  0, 0, -2,
  'Weak', 'Small',
  'Off', 'Off', 0,
  '0 EV', 1, 29
),

-- Recipe 7: Classic Chrome Minimal (X-Trans II+ — translatable to I)
(
  'CC Street Minimal', 'cc-street-minimal', 'FilmSim_Community',
  'Stripped-down Classic Chrome for street work. No grain needed — let the simulation do the lifting.',
  8, 2, '["street","muted","minimal","documentary"]',
  'Auto', 2, -4,
  'DR400', -1, 1,
  -2, 0, -4,
  NULL, NULL,
  NULL, NULL, NULL,
  '+0.3 EV', 1, 44
),

-- Recipe 8: Nostalgic Neg Polaroid (X-Trans IV+)
(
  'Polaroid Faded', 'polaroid-faded', 'FilmSim_Community',
  'Warm faded Polaroid aesthetic. Soft, slightly green-shifted shadows. Great for travel and lifestyle.',
  13, 4, '["vintage","warm","faded","lifestyle"]',
  'Auto', 4, -4,
  'DR200', 2, -1,
  1, -2, -4,
  'Strong', 'Large',
  'Off', 'Off', -2,
  '+0.7 EV', 1, 33
);
