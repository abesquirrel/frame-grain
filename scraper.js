const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://fujixweekly.com/recipes/';

async function scrapeRecipe(url, sensorGen) {
  try {
    console.log(`  - Scraping: ${url}`);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const title = $('.entry-title').text().trim() || $('h1, h2').first().text().trim();
    
    // Crucial: Preserving newlines from <br> tags which separate settings
    $('.entry-content p br').replaceWith('\n');
    const entryContent = $('.entry-content');
    const content = entryContent.text();

    const recipe = {
      title,
      url,
      sensor: sensorGen,
      sim: '',
      dynamic_range: 'DR100',
      highlights: 0,
      shadows: 0,
      color: 0,
      sharpness: 0,
      noise_reduction: 0,
      grain_effect: 'Off',
      grain_size: 'Small',
      white_balance: 'Auto',
      wb_shift_red: 0,
      wb_shift_blue: 0,
      clarity: 0,
      exposure_compensation: '0 EV'
    };

    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    
    const SIMS = ['Classic Chrome', 'Classic Negative', 'Provia', 'Velvia', 'Astia', 'Acros', 'Monochrome', 'Eterna', 'Bleach Bypass', 'Nostalgic Negative', 'REALA ACE', 'Pro Neg. Hi', 'Pro Neg. Std'];

    lines.forEach(line => {
      const l = line.toLowerCase().trim();
      if (!l) return;
      
      // Simulation detection
      let foundSim = null;
      if (l.includes('simulation') && line.includes(':')) {
           foundSim = line.split(':')[1].trim();
      } else {
           // Case where simulation name is just a standalone line or the first line of the block
           for (const s of SIMS) {
               if (l === s.toLowerCase()) {
                   foundSim = s;
                   break;
               }
           }
      }
      if (foundSim && (!recipe.sim || recipe.sim === 'Provia')) {
          recipe.sim = foundSim;
      }

      if (l.includes('dynamic range')) {
          let drVal = line.split(':')[1]?.trim() || line.match(/DR[- ]?\d+/i)?.[0] || 'DR100';
          drVal = drVal.replace(/[- ]/g, '').toUpperCase();
          if (drVal.includes('AUTO')) drVal = 'DRAuto';
          if (!['DR100','DR200','DR400','DRAuto'].includes(drVal)) drVal = 'DR100';
          recipe.dynamic_range = drVal;
      }
      
      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

      if (l.includes('highlight') && (l.includes(':') || l.match(/highlight\s*[:\s]*[-+]\d/))) {
          recipe.highlights = clamp(grabNum(line), -2, 4);
      }
      if (l.includes('shadow') && (l.includes(':') || l.match(/shadow\s*[:\s]*[-+]\d/))) {
          recipe.shadows = clamp(grabNum(line), -2, 4);
      }
      if (l.includes('color') && !l.includes('chrome') && (l.includes(':') || l.match(/color\s*[:\s]*[-+]\d/))) {
          recipe.color = clamp(grabNum(line), -2, 4);
      }
      if ((l.includes('sharpness') || l.includes('sharpening')) && (l.includes(':') || l.match(/sharp\s*[:\s]*[-+]\d/))) {
          recipe.sharpness = clamp(grabNum(line), -2, 4);
      }
      if (l.includes('noise reduction') && (l.includes(':') || l.match(/noise\s*[:\s]*[-+]\d/))) {
          recipe.noise_reduction = clamp(grabNum(line), -2, 4);
      }
      if (l.includes('clarity') && (l.includes(':') || l.match(/clarity\s*[:\s]*[-+]\d/))) {
          recipe.clarity = clamp(grabNum(line), -2, 4);
      }
      if (l.includes('exposure compensation')) recipe.exposure_compensation = line.split(':')[1]?.trim() || '0 EV';
    });

    return recipe;
  } catch (e) {
    return null;
  }
}

async function getIndexLinks() {
  const { data } = await axios.get(BASE_URL);
  const $ = cheerio.load(data);
  const indices = [];
  
  // Fuji X Weekly index uses 'a' tags that often contain the sensor name as text
  $('.entry-content a').each((i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (href && href.includes('fujixweekly.com') && 
        (text.includes('X-Trans IV') || text.includes('X-Trans V') || 
         text.includes('X-Trans 4') || text.includes('X-Trans 5'))) {
      indices.push({ name: text, url: href });
    }
  });
  
  console.log(`Found ${indices.length} sensor index pages:`, indices.map(i => i.name));
  return indices;
}

async function getRecipesFromIndex(indexUrl) {
  const { data } = await axios.get(indexUrl);
  const $ = cheerio.load(data);
  const recipes = [];
  $('.entry-content a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('fujixweekly.com') && href.length > indexUrl.length + 5 && !href.includes('/app/')) {
        if (/\/\d{4}\/\d{2}\/\d{2}\//.test(href)) {
            recipes.push(href.split('#')[0]); 
        }
    }
  });
  const unique = [...new Set(recipes)];
  console.log(`    - Found ${unique.length} candidate URLs.`);
  return unique;
}

const SIM_MAP = {
  'classic chrome': 'classic-chrome',
  'classic negative': 'classic-neg',
  'classic neg.': 'classic-neg',
  'provia': 'provia',
  'velvia': 'velvia',
  'astia': 'astia',
  'acros': 'acros',
  'monochrome': 'monochrome',
  'eterna': 'eterna',
  'bleach bypass': 'bleach-bypass',
  'nostalgic negative': 'nostalgic-neg',
  'nostalgic neg.': 'nostalgic-neg',
  'reala ace': 'reala-ace',
  'pro neg. hi': 'pro-neg-hi',
  'pro neg. std': 'pro-neg-std',
  'pro neg hi': 'pro-neg-hi',
  'pro neg std': 'pro-neg-std'
};

async function run() {
  console.log('Finding Sensor Index Pages...');
  const indices = await getIndexLinks();
  
  const allRecipes = [];
  const xtrans4 = indices.find(idx => idx.name.includes('X-Trans IV'));
  const xtrans5 = indices.find(idx => idx.name.includes('X-Trans V'));
  
  const targets = [xtrans4, xtrans5].filter(Boolean);

  for (const target of targets) {
    console.log(`Crawling index: ${target.name}...`);
    const links = await getRecipesFromIndex(target.url);
    const limit = Math.min(links.length, 15);
    console.log(`Scraping top ${limit} recipes candidates...`);
    
    for (let i = 0; i < limit; i++) {
      if (!links[i]) break;
      const r = await scrapeRecipe(links[i], target.name.includes('IV') ? 'X-Trans IV' : 'X-Trans V');
      if (r) {
         // Map Sim - look for ANY known sim in the whole text or specifically the sim field
         const fullText = (r.title + ' ' + r.sim).toLowerCase();
         let foundSimSlug = null;
         
         // Priority 1: Exact match in sim field
         const lowSim = r.sim.toLowerCase().trim();
         if (SIM_MAP[lowSim]) {
             foundSimSlug = SIM_MAP[lowSim];
         } else {
             // Priority 2: Contains check
             for (const [key, val] of Object.entries(SIM_MAP)) {
                 if (fullText.includes(key)) {
                     foundSimSlug = val;
                     break;
                 }
             }
         }
         
         if (foundSimSlug) {
             r.sim_slug = foundSimSlug;
             // Clean title
             r.title = r.title.replace(/Fujifilm [^ ]+ Film Simulation Recipe:? /i, '').trim();
             r.title = r.title.replace(/ — A Fujifilm .* Recipe/i, '').trim();
             allRecipes.push(r);
         }
      }
      await new Promise(res => setTimeout(res, 800));
    }
  }

  // Deduplicate by title
  const final = [];
  const titles = new Set();
  allRecipes.forEach(r => {
      if (!titles.has(r.title)) {
          titles.add(r.title);
          final.push(r);
      }
  });

  fs.writeFileSync('scraped_recipes.json', JSON.stringify(final, null, 2));
  
  // Generate SQL seed sample
  let sql = '-- Scraped Seed Data\n';
  final.forEach(r => {
      const sensorId = r.sensor.includes('IV') ? 4 : 5;
      sql += `INSERT INTO Recipes (title, slug, author, base_sim_id, min_sensor_id, wb_shift_red, wb_shift_blue, dynamic_range, highlights, shadows, color, sharpness, noise_reduction, clarity, approved) \n`;
      sql += `VALUES ('${r.title.replace(/'/g, "''")}', '${slugify(r.title)}', 'FujiXWeekly', (SELECT id FROM BaseSimulations WHERE slug='${r.sim_slug}'), ${sensorId}, ${r.wb_shift_red}, ${r.wb_shift_blue}, '${r.dynamic_range}', ${r.highlights}, ${r.shadows}, ${r.color}, ${r.sharpness}, ${r.noise_reduction}, ${r.clarity}, 1);\n\n`;
  });
  fs.writeFileSync('db/scraped_seed.sql', sql);

  console.log(`Done. Saved ${final.length} recipes to scraped_recipes.json and db/scraped_seed.sql`);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}

run();
