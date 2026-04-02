/**
 * Fujifilm X-Trans Recipe API
 * Cloudflare Worker — D1 + KV + Validator Engine
 *
 * Routes:
 *   GET  /api/recipes              — List approved recipes (filterable)
 *   GET  /api/recipes/:id          — Single recipe detail
 *   POST /api/recipes/submit       — Submit a new recipe (queues for approval)
 *   POST /api/recipes/validate     — Validate a recipe payload without submitting
 *   POST /api/recipes/:id/vote     — Upvote a recipe (IP-rate-limited)
 *   GET  /api/sensors              — List all sensor generations
 *   GET  /api/simulations          — List all base simulations
 *   GET  /api/fields               — List all recipe fields with sensor constraints
 */

// ============================================================
// SENSOR CONSTRAINT MATRIX
// Single source of truth — mirrors the database seed
// ============================================================
const SENSOR_CAPS = {
  1: {
    name: 'X-Trans I',
    sims: ['provia','velvia','astia','pro-neg-hi','pro-neg-std','monochrome','sepia'],
    fields: {
      grain_effect: false, grain_size: false,
      color_chrome: false, color_chrome_fx_blue: false,
      clarity: false, bw_adj_warm_cool: false, bw_adj_magenta_green: false,
    }
  },
  2: {
    name: 'X-Trans II',
    sims: ['provia','velvia','astia','pro-neg-hi','pro-neg-std','monochrome','sepia','classic-chrome'],
    fields: {
      grain_effect: false, grain_size: false,
      color_chrome: false, color_chrome_fx_blue: false,
      clarity: false, bw_adj_warm_cool: false, bw_adj_magenta_green: false,
    }
  },
  3: {
    name: 'X-Trans III',
    sims: ['provia','velvia','astia','pro-neg-hi','pro-neg-std','monochrome','sepia','classic-chrome','acros','eterna'],
    fields: {
      grain_effect: true, grain_size: false,
      color_chrome: false, color_chrome_fx_blue: false,
      clarity: false, bw_adj_warm_cool: false, bw_adj_magenta_green: false,
    }
  },
  4: {
    name: 'X-Trans IV',
    sims: ['provia','velvia','astia','pro-neg-hi','pro-neg-std','monochrome','sepia','classic-chrome','acros','eterna','classic-neg','bleach-bypass','nostalgic-neg'],
    fields: {
      grain_effect: true, grain_size: true,
      color_chrome: true, color_chrome_fx_blue: true,
      clarity: true, bw_adj_warm_cool: true, bw_adj_magenta_green: true,
    }
  },
  5: {
    name: 'X-Trans V',
    sims: ['provia','velvia','astia','pro-neg-hi','pro-neg-std','monochrome','sepia','classic-chrome','acros','eterna','classic-neg','bleach-bypass','nostalgic-neg','reala-ace'],
    fields: {
      grain_effect: true, grain_size: true,
      color_chrome: true, color_chrome_fx_blue: true,
      clarity: true, bw_adj_warm_cool: true, bw_adj_magenta_green: true,
    }
  }
}

// ============================================================
// VALIDATOR ENGINE
// Returns { valid: bool, errors: [], warnings: [], min_sensor: int }
// ============================================================
function validateRecipe(recipe) {
  const errors = []
  const warnings = []
  let min_sensor = 1

  // --- Base simulation check ---
  let simFound = false
  let simMinSensor = 1
  for (const [gen, caps] of Object.entries(SENSOR_CAPS)) {
    if (caps.sims.includes(recipe.base_sim)) {
      if (!simFound) {
        simMinSensor = parseInt(gen)
        simFound = true
      }
    }
  }
  if (!simFound) {
    errors.push(`Unknown base simulation: "${recipe.base_sim}"`)
  } else {
    min_sensor = Math.max(min_sensor, simMinSensor)
  }

  // --- Field availability checks ---
  const iv4Fields = {
    grain_size:          'Grain Size requires X-Trans IV or later.',
    color_chrome:        'Color Chrome Effect requires X-Trans IV or later.',
    color_chrome_fx_blue:'Color Chrome FX Blue requires X-Trans IV or later.',
    clarity:             'Clarity requires X-Trans IV or later.',
    bw_adj_warm_cool:    'B&W Warm/Cool adjustment requires X-Trans IV or later.',
    bw_adj_magenta_green:'B&W Magenta/Green adjustment requires X-Trans IV or later.',
  }
  const iii3Fields = {
    grain_effect: 'Grain Effect requires X-Trans III or later.',
  }

  for (const [field, msg] of Object.entries(iv4Fields)) {
    const val = recipe[field]
    if (val !== undefined && val !== null && val !== 'Off' && val !== 0 && val !== '') {
      min_sensor = Math.max(min_sensor, 4)
    }
  }
  for (const [field, msg] of Object.entries(iii3Fields)) {
    const val = recipe[field]
    if (val !== undefined && val !== null && val !== 'Off' && val !== '') {
      min_sensor = Math.max(min_sensor, 3)
    }
  }

  // --- REALA ACE sim check ---
  if (recipe.base_sim === 'reala-ace') {
    min_sensor = Math.max(min_sensor, 5)
    if (recipe.color_chrome_fx_blue && recipe.color_chrome_fx_blue !== 'Off') {
      warnings.push('X-Trans V tip: REALA ACE typically looks better with CC FX Blue set to Off or Weak.')
    }
  }

  // --- Range checks ---
  const ranges = {
    wb_shift_red:   [-9, 9],   wb_shift_blue:  [-9, 9],
    highlights:     [-2, 4],   shadows:        [-2, 4],
    color:          [-4, 4],   sharpness:      [-4, 4],
    noise_reduction:[-4, 4],   clarity:        [-5, 5],
    bw_adj_warm_cool: [-18, 18], bw_adj_magenta_green: [-18, 18],
  }
  for (const [field, [min, max]] of Object.entries(ranges)) {
    const val = recipe[field]
    if (val !== undefined && val !== null) {
      if (val < min || val > max) {
        errors.push(`${field}: ${val} is out of range [${min}, ${max}]`)
      }
    }
  }

  // --- DR check ---
  const validDR = ['DR100','DR200','DR400','DRAuto']
  if (recipe.dynamic_range && !validDR.includes(recipe.dynamic_range)) {
    errors.push(`Invalid dynamic_range value. Must be one of: ${validDR.join(', ')}`)
  }

  // --- Community tuning warnings ---
  if (recipe.noise_reduction > -2) {
    warnings.push('Community tip: Noise Reduction ≥ -2 can produce plasticky JPEGs. Consider -4 for more texture.')
  }
  if (recipe.base_sim === 'classic-chrome' && recipe.color === 2) {
    warnings.push('Classic Chrome at Color +2 can oversaturate greens. Consider Color 0 or -1.')
  }
  if (recipe.grain_size === 'Large' && recipe.sharpness > 2) {
    warnings.push('Large grain + high sharpness can look artificial. Consider Sharpness 0–1.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    min_sensor,
    min_sensor_name: SENSOR_CAPS[min_sensor]?.name
  }
}

// ============================================================
// TRANSLATION ENGINE
// Attempt to translate a recipe to a lower sensor generation
// ============================================================
function translateRecipe(recipe, target_gen) {
  const target = SENSOR_CAPS[target_gen]
  if (!target) return { success: false, error: 'Unknown target generation.' }

  const translated = { ...recipe }
  const changes = []

  // --- Translate base simulation ---
  if (!target.sims.includes(recipe.base_sim)) {
    // Classic Negative → Classic Chrome (nearest analog)
    const sim_map = {
      'classic-neg':    'classic-chrome',
      'nostalgic-neg':  'astia',
      'bleach-bypass':  'acros',
      'reala-ace':      'provia',
      'acros':          'monochrome',
      'eterna':         'pro-neg-std',
    }
    const fallback = sim_map[recipe.base_sim]
    if (fallback) {
      translated.base_sim = fallback
      changes.push(`Base simulation "${recipe.base_sim}" → "${fallback}" (nearest X-Trans ${target_gen} equivalent)`)
    } else {
      changes.push(`WARNING: No good equivalent for "${recipe.base_sim}" on X-Trans ${target_gen}. Defaulting to Provia.`)
      translated.base_sim = 'provia'
    }
  }

  // --- Strip unavailable fields ---
  if (!target.fields.grain_effect) {
    delete translated.grain_effect
    if (recipe.grain_effect && recipe.grain_effect !== 'Off') {
      changes.push('Grain Effect removed (not available on X-Trans I–II).')
    }
  }
  if (!target.fields.grain_size) {
    delete translated.grain_size
    if (recipe.grain_size) {
      changes.push('Grain Size removed (X-Trans III uses Grain Effect only).')
    }
  }
  if (!target.fields.color_chrome) {
    delete translated.color_chrome
    if (recipe.color_chrome && recipe.color_chrome !== 'Off') {
      const compensate = recipe.color === 0 ? 1 : recipe.color
      translated.color = Math.min(4, compensate + 1)
      changes.push(`Color Chrome Effect removed → Color bumped to ${translated.color} to partially compensate.`)
    }
  }
  if (!target.fields.color_chrome_fx_blue) {
    delete translated.color_chrome_fx_blue
    if (recipe.color_chrome_fx_blue && recipe.color_chrome_fx_blue !== 'Off') {
      changes.push('Color Chrome FX Blue removed (X-Trans IV+ only).')
    }
  }
  if (!target.fields.clarity) {
    delete translated.clarity
    if (recipe.clarity && recipe.clarity !== 0) {
      changes.push('Clarity removed → adjust Sharpness manually to compensate.')
    }
  }
  if (!target.fields.bw_adj_warm_cool) {
    delete translated.bw_adj_warm_cool
    delete translated.bw_adj_magenta_green
    if (recipe.bw_adj_warm_cool || recipe.bw_adj_magenta_green) {
      changes.push('B&W Toning adjustments removed (X-Trans IV+ only).')
    }
  }

  return { success: true, translated, changes }
}

// ============================================================
// CORS + RESPONSE HELPERS
// ============================================================
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

function err(message, status = 400) {
  return json({ success: false, error: message }, status)
}

// ============================================================
// SLUG GENERATOR
// ============================================================
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
}

function uniqueSlug(base) {
  return `${slugify(base)}-${Date.now().toString(36)}`
}

// ============================================================
// MAIN FETCH HANDLER
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    if (method === 'OPTIONS') return new Response(null, { headers: CORS })

    // ── GET /api/sensors ───────────────────────────────────
    if (method === 'GET' && path === '/api/sensors') {
      const { results } = await env.DB.prepare('SELECT * FROM Sensors ORDER BY gen').all()
      return json(results)
    }

    // ── GET /api/simulations ───────────────────────────────
    if (method === 'GET' && path === '/api/simulations') {
      const { results } = await env.DB.prepare(
        'SELECT bs.*, s.name as min_sensor_name, s.gen FROM BaseSimulations bs JOIN Sensors s ON bs.min_sensor_id = s.id ORDER BY s.gen, bs.sim_name'
      ).all()
      return json(results)
    }

    // ── GET /api/fields ────────────────────────────────────
    if (method === 'GET' && path === '/api/fields') {
      const { results } = await env.DB.prepare(
        'SELECT rf.*, s.name as introduced_in_name FROM RecipeFields rf JOIN Sensors s ON rf.introduced_in_sensor_id = s.id ORDER BY s.gen, rf.id'
      ).all()
      return json(results)
    }

    // ── GET /api/recipes ───────────────────────────────────
    if (method === 'GET' && path === '/api/recipes') {
      const params = url.searchParams
      const sim    = params.get('sim')
      const sensor = params.get('sensor')
      const look   = params.get('look')
      const sort   = params.get('sort') || 'votes'
      const page   = Math.max(1, parseInt(params.get('page') || '1'))
      const limit  = Math.min(48, parseInt(params.get('limit') || '24'))
      const offset = (page - 1) * limit

      // Cache key
      const cacheKey = `recipes:${sim}:${sensor}:${look}:${sort}:${page}:${limit}`
      const cached = await env.KV?.get(cacheKey)
      if (cached) return json(JSON.parse(cached))

      let where = ['r.approved = 1']
      const bindings = []

      if (sim) {
        where.push('bs.slug = ?')
        bindings.push(sim)
      }
      if (sensor) {
        where.push('r.min_sensor_id <= ?')
        bindings.push(parseInt(sensor))
      }
      if (look) {
        where.push("r.look_tags LIKE ?")
        bindings.push(`%"${look}"%`)
      }

      const orderCol = sort === 'new' ? 'r.submitted_at DESC' : 'r.votes DESC'

      const query = `
        SELECT r.id, r.title, r.slug, r.author, r.description,
               bs.sim_name, bs.slug as sim_slug,
               s.name as min_sensor_name, s.gen as min_sensor_gen,
               r.look_tags, r.votes, r.submitted_at,
               r.wb_shift_red, r.wb_shift_blue, r.dynamic_range,
               r.highlights, r.shadows, r.color, r.sharpness, r.noise_reduction,
               r.grain_effect, r.grain_size, r.color_chrome, r.color_chrome_fx_blue,
               r.clarity, r.exposure_compensation
        FROM Recipes r
        JOIN BaseSimulations bs ON r.base_sim_id = bs.id
        JOIN Sensors s ON r.min_sensor_id = s.id
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderCol}
        LIMIT ? OFFSET ?
      `

      const countQuery = `
        SELECT COUNT(*) as total FROM Recipes r
        JOIN BaseSimulations bs ON r.base_sim_id = bs.id
        WHERE ${where.join(' AND ')}
      `

      bindings.push(limit, offset)

      const [{ results }, { results: countRes }] = await Promise.all([
        env.DB.prepare(query).bind(...bindings).all(),
        env.DB.prepare(countQuery).bind(...bindings.slice(0, -2)).all()
      ])

      const payload = {
        recipes: results,
        pagination: {
          page, limit,
          total: countRes[0].total,
          pages: Math.ceil(countRes[0].total / limit)
        }
      }

      await env.KV?.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 })
      return json(payload)
    }

    // ── GET /api/recipes/:id ───────────────────────────────
    const singleMatch = path.match(/^\/api\/recipes\/([a-z0-9-]+)$/)
    if (method === 'GET' && singleMatch) {
      const idOrSlug = singleMatch[1]
      const isNumeric = /^\d+$/.test(idOrSlug)
      const query = isNumeric
        ? 'SELECT r.*, bs.sim_name, bs.slug as sim_slug, s.name as min_sensor_name, s.gen FROM Recipes r JOIN BaseSimulations bs ON r.base_sim_id = bs.id JOIN Sensors s ON r.min_sensor_id = s.id WHERE r.id = ? AND r.approved = 1'
        : 'SELECT r.*, bs.sim_name, bs.slug as sim_slug, s.name as min_sensor_name, s.gen FROM Recipes r JOIN BaseSimulations bs ON r.base_sim_id = bs.id JOIN Sensors s ON r.min_sensor_id = s.id WHERE r.slug = ? AND r.approved = 1'
      const { results } = await env.DB.prepare(query).bind(idOrSlug).all()
      if (!results.length) return err('Recipe not found.', 404)
      return json(results[0])
    }

    // ── POST /api/recipes/validate ─────────────────────────
    if (method === 'POST' && path === '/api/recipes/validate') {
      const body = await request.json()
      const result = validateRecipe(body)
      return json(result)
    }

    // ── POST /api/recipes/submit ───────────────────────────
    if (method === 'POST' && path === '/api/recipes/submit') {
      const body = await request.json()

      if (!body.title || body.title.length < 3) return err('Title must be at least 3 characters.')
      if (!body.author) body.author = 'Anonymous'
      if (!body.base_sim) return err('base_sim is required.')

      const validation = validateRecipe(body)
      if (!validation.valid) {
        return json({ success: false, errors: validation.errors, warnings: validation.warnings }, 422)
      }

      // Resolve sim ID
      const { results: simRes } = await env.DB.prepare(
        'SELECT id FROM BaseSimulations WHERE slug = ?'
      ).bind(body.base_sim).all()
      if (!simRes.length) return err(`Unknown simulation slug: ${body.base_sim}`)
      const sim_id = simRes[0].id
      const sensor_id = validation.min_sensor

      const slug = uniqueSlug(body.title)

      await env.DB.prepare(`
        INSERT INTO Recipes (
          title, slug, author, description,
          base_sim_id, min_sensor_id, look_tags,
          wb_preset, wb_shift_red, wb_shift_blue,
          dynamic_range, highlights, shadows,
          color, sharpness, noise_reduction,
          grain_effect, grain_size,
          color_chrome, color_chrome_fx_blue, clarity,
          bw_adj_warm_cool, bw_adj_magenta_green,
          exposure_compensation, approved
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
      `).bind(
        body.title, slug, body.author, body.description || '',
        sim_id, sensor_id, JSON.stringify(body.look_tags || []),
        body.wb_preset || 'Auto', body.wb_shift_red || 0, body.wb_shift_blue || 0,
        body.dynamic_range || 'DR100', body.highlights || 0, body.shadows || 0,
        body.color || 0, body.sharpness || 0, body.noise_reduction || 0,
        body.grain_effect || null, body.grain_size || null,
        body.color_chrome || null, body.color_chrome_fx_blue || null, body.clarity || null,
        body.bw_adj_warm_cool || null, body.bw_adj_magenta_green || null,
        body.exposure_compensation || '0 EV'
      ).run()

      return json({
        success: true,
        message: 'Recipe submitted for review. It will appear once approved.',
        slug,
        warnings: validation.warnings
      }, 201)
    }

    // ── POST /api/recipes/:id/vote ─────────────────────────
    const voteMatch = path.match(/^\/api\/recipes\/(\d+)\/vote$/)
    if (method === 'POST' && voteMatch) {
      const recipe_id = parseInt(voteMatch[1])
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      const ua = request.headers.get('User-Agent') || ''
      
      // Fetch the simulation ID for this recipe to enforce the "1 vote per simulation" rule
      const { results: rResults } = await env.DB.prepare(
        'SELECT base_sim_id FROM Recipes WHERE id = ?'
      ).bind(recipe_id).all()
      
      if (!rResults.length) return err('Recipe not found.', 404)
      const sim_id = rResults[0].base_sim_id

      // Use simulation ID in the hash to prevent voting on other recipes with the same simulation
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${ua}:sim:${sim_id}`))))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      try {
        await env.DB.prepare(
          'INSERT INTO Votes (recipe_id, voter_hash) VALUES (?, ?)'
        ).bind(recipe_id, hash).run()

        await env.DB.prepare(
          'UPDATE Recipes SET votes = votes + 1 WHERE id = ?'
        ).bind(recipe_id).run()

        // Invalidate cache broadly
        await env.KV?.delete('recipes:::::votes:1:24')

        const { results } = await env.DB.prepare(
          'SELECT votes FROM Recipes WHERE id = ?'
        ).bind(recipe_id).all()

        return json({ success: true, votes: results[0]?.votes })
      } catch {
        return json({ success: false, error: 'You have already voted for a recipe with this simulation profile.' }, 409)
      }
    }

    // ── POST /api/recipes/translate ────────────────────────
    if (method === 'POST' && path === '/api/recipes/translate') {
      const body = await request.json()
      if (!body.recipe || !body.target_gen) return err('recipe and target_gen required.')
      const result = translateRecipe(body.recipe, body.target_gen)
      return json(result)
    }

    return err('Not found.', 404)
  }
}
