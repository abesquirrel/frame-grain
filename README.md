# FRAMEGRAIN — Fujifilm Recipe Database
## Deployment Guide

### Stack
- **Frontend**: Static HTML/CSS/JS → Cloudflare Pages
- **API**: Cloudflare Workers (Worker + D1 + KV)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Cache**: Cloudflare KV (recipe list TTL 60s)

---

### 1. Prerequisites
```bash
npm install -g wrangler
wrangler login
```

### 2. Create D1 Database
```bash
wrangler d1 create fujifilm-recipes
# Copy the database_id into wrangler.toml
```

### 3. Create KV Namespace
```bash
wrangler kv:namespace create RECIPE_CACHE
# Copy the id into wrangler.toml
```

### 4. Run Migrations
```bash
# Apply schema
wrangler d1 execute fujifilm-recipes --file=./db/schema.sql

# Seed initial data
wrangler d1 execute fujifilm-recipes --file=./db/seed.sql

# Verify
wrangler d1 execute fujifilm-recipes --command="SELECT COUNT(*) FROM Recipes"
```

### 5. Deploy Worker API
```bash
wrangler deploy
# Note your worker URL e.g. https://fujifilm-recipes-api.yourname.workers.dev
```

### 6. Update Site Config
In `site/index.html`, set:
```js
const API_BASE = 'https://fujifilm-recipes-api.yourname.workers.dev'
const USE_MOCK = false
```

### 7. Deploy Static Site
```bash
# Option A: Cloudflare Pages (recommended)
wrangler pages deploy ./site --project-name=framegrain

# Option B: Drag-and-drop at pages.cloudflare.com
```

### 8. Custom Domain (optional)
In Cloudflare Dashboard → Pages → Custom domains → Add your domain.

---

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recipes` | List recipes (filterable: `?sim=classic-chrome&sensor=3&look=film&sort=votes`) |
| GET | `/api/recipes/:id` | Single recipe by ID or slug |
| POST | `/api/recipes/submit` | Submit new recipe (queued for approval) |
| POST | `/api/recipes/validate` | Validate without submitting |
| POST | `/api/recipes/:id/vote` | Upvote (IP-rate-limited) |
| POST | `/api/recipes/translate` | Translate recipe to lower sensor gen |
| GET | `/api/sensors` | All sensor generations |
| GET | `/api/simulations` | All base simulations |
| GET | `/api/fields` | All recipe fields with constraints |

### Validate Example
```bash
curl -X POST https://your-worker.workers.dev/api/recipes/validate \
  -H "Content-Type: application/json" \
  -d '{
    "base_sim": "classic-neg",
    "color_chrome_fx_blue": "Strong",
    "grain_effect": "Weak",
    "noise_reduction": -4,
    "wb_shift_red": 2,
    "wb_shift_blue": -6
  }'
```

### Translate Example
```bash
curl -X POST https://your-worker.workers.dev/api/recipes/translate \
  -H "Content-Type: application/json" \
  -d '{
    "recipe": { "base_sim": "classic-neg", "color_chrome": "Strong", "grain_size": "Large" },
    "target_gen": 2
  }'
```

---

### Project Structure
```
/
├── db/
│   ├── schema.sql        # Full D1 schema with all tables + indexes
│   └── seed.sql          # 5 sensors, 14 sims, 15 fields, 8 sample recipes
├── worker/
│   └── index.js          # Cloudflare Worker — full REST API + validator engine
├── site/
│   └── index.html        # Static site — browse, submit, about views
├── wrangler.toml          # Cloudflare deployment config
└── README.md
```
