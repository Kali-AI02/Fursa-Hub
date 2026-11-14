// Downloads open opportunities from free public sources, merges them with
// your own entries in data/manual.json, removes anything that has closed,
// and saves the result to data/opportunities.json.
//
// Run:  npm run fetch      (or: node scripts/fetch.mjs)
//
// If a source is down, the listings we already had from it are kept
// (minus any that have since closed), so the site never goes empty.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../data/opportunities.json', import.meta.url);
const MANUAL = new URL('../data/manual.json', import.meta.url);
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------

const stripHtml = (s = '') =>
  s.replace(/<[^>]*>/g, ' ')
   .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
   .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, ' ')
   .replace(/[*#_>`]+/g, ' ') // markdown symbols
   .replace(/\s+/g, ' ').trim();

const summarize = (s, n = 280) => {
  const t = stripHtml(s);
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Grants.gov uses MM/DD/YYYY
const usDate = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

const isOpen = (o) => !o.deadline || o.deadline >= TODAY;

async function getJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'FursaHub opportunity listing', ...(options.headers || {}) },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} – ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- sources ----------
// Each source returns a list of opportunities in this shape:
// { id, type, title, org, country, remote, posted, deadline, url, source, summary, tags }

const sources = {
  // US federal grants – public domain data, no key needed.
  async grantsgov() {
    const items = [];
    const rows = 250;
    for (let start = 0; start < 5000; start += rows) {
      const body = { rows, startRecordNum: start, oppStatuses: 'posted' };
      const { data } = await getJson('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      for (const g of data.oppHits || []) {
        items.push({
          id: `gg-${g.id}`,
          type: /fellowship/i.test(g.title) ? 'fellowship' : 'grant',
          title: g.title,
          org: g.agency || g.agencyCode,
          country: 'United States',
          remote: false,
          posted: usDate(g.openDate),
          deadline: usDate(g.closeDate),
          url: `https://www.grants.gov/search-results-detail/${g.id}`,
          source: 'Grants.gov',
          summary: `Funding opportunity ${g.number} from ${g.agency || g.agencyCode}. See the full eligibility rules and application package on Grants.gov.`,
          tags: [],
        });
      }
      if (start + rows >= data.hitCount) break;
    }
    return items;
  },

  // Remote jobs. Remotive's terms: always link back to Remotive and credit
  // them as the source, and fetch no more than 4 times a day.
  async remotive() {
    const { jobs = [] } = await getJson('https://remotive.com/api/remote-jobs');
    return jobs.map((j) => ({
      id: `rm-${j.id}`,
      type: /intern/i.test(j.title) || j.job_type === 'internship' ? 'internship' : 'job',
      title: j.title,
      org: (j.company_name || '').trim(),
      country: j.candidate_required_location || 'Worldwide',
      remote: true,
      posted: isoDate(j.publication_date),
      deadline: null, // open until filled; disappears when Remotive removes it
      url: j.url,
      source: 'Remotive',
      summary: summarize(j.description),
      tags: [j.category].filter(Boolean),
    }));
  },

  // Humanitarian & development jobs, internships, consultancies and trainings
  // (UN OCHA). Needs a FREE approved app name – request one at
  // https://apidoc.reliefweb.int/parameters#appname and set it as the
  // RELIEFWEB_APPNAME environment variable (or GitHub secret).
  async reliefweb() {
    const appname = process.env.RELIEFWEB_APPNAME;
    if (!appname) {
      console.log('  (skipped: set RELIEFWEB_APPNAME to enable ReliefWeb)');
      return null;
    }
    const typeMap = { Job: 'job', Internship: 'internship', Consultancy: 'consultancy', 'Volunteer Opportunity': 'volunteer' };
    const items = [];
    for (const [endpoint, defaultType] of [['jobs', 'job'], ['training', 'training']]) {
      for (let offset = 0; offset < 3000; offset += 500) {
        const body = {
          limit: 500,
          offset,
          sort: ['date.created:desc'],
          fields: { include: ['title', 'url_alias', 'url', 'date.created', 'date.closing', 'date.registration', 'source.name', 'country.name', 'type.name', 'career_categories.name', 'body', 'format.name'] },
          filter: { operator: 'OR', conditions: [
            { field: endpoint === 'jobs' ? 'date.closing' : 'date.registration', value: { from: `${TODAY}T00:00:00+00:00` } },
          ] },
        };
        const res = await getJson(`https://api.reliefweb.int/v2/${endpoint}?appname=${encodeURIComponent(appname)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        for (const { id, fields: f } of res.data || []) {
          const typeName = f.type?.[0]?.name;
          const formats = (f.format || []).map((x) => x.name).join(' ');
          items.push({
            id: `rw-${endpoint}-${id}`,
            type: typeMap[typeName] || defaultType,
            title: f.title,
            org: f.source?.[0]?.name || 'ReliefWeb',
            country: f.country?.[0]?.name || 'Worldwide',
            remote: /remote|home[- ]based|online/i.test(`${f.title} ${formats}`),
            posted: isoDate(f.date?.created),
            deadline: isoDate(f.date?.closing || f.date?.registration),
            url: f.url_alias || f.url,
            source: 'ReliefWeb',
            summary: summarize(f.body),
            tags: (f.career_categories || []).map((c) => c.name),
          });
        }
        if ((res.data || []).length < 500) break;
      }
    }
    return items;
  },
};

// ---------- main ----------

async function readJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); } catch { return fallback; }
}

const previous = await readJson(OUT, { items: [] });
const all = [];
const report = {};

for (const [name, run] of Object.entries(sources)) {
  process.stdout.write(`Fetching ${name}… `);
  try {
    const items = await run();
    if (items === null) {
      // source disabled – keep nothing from it
      report[name] = 'disabled';
      continue;
    }
    const open = items.filter(isOpen);
    all.push(...open);
    report[name] = open.length;
    console.log(`${open.length} open`);
  } catch (err) {
    // keep what we had last time from this source, minus anything now closed
    const prefix = { grantsgov: 'gg-', remotive: 'rm-', reliefweb: 'rw-' }[name];
    const kept = previous.items.filter((o) => o.id.startsWith(prefix) && isOpen(o));
    all.push(...kept);
    report[name] = `failed (${err.message}); kept ${kept.length} from last run`;
    console.log(`FAILED – ${err.message}. Keeping ${kept.length} previous listings.`);
  }
}

// Your own entries (scholarships, local jobs, etc.)
const manual = await readJson(MANUAL, []);
const manualOpen = manual
  .filter((o) => o.title && o.url)
  .map((o, i) => ({
    id: o.id || `my-${i + 1}`,
    type: o.type || 'scholarship',
    title: o.title,
    org: o.org || '',
    country: o.country || 'Worldwide',
    remote: !!o.remote,
    posted: o.posted || TODAY,
    deadline: o.deadline || null,
    url: o.url,
    source: o.source || 'FursaHub',
    summary: o.summary || '',
    tags: o.tags || [],
    featured: !!o.featured,
  }))
  .filter(isOpen);
all.push(...manualOpen);
report.manual = manualOpen.length;
console.log(`Your entries (data/manual.json): ${manualOpen.length} open`);

// Remove duplicates (same id)
const unique = [...new Map(all.map((o) => [o.id, o])).values()];

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), report, items: unique }, null, 1));
console.log(`\nSaved ${unique.length} open opportunities to data/opportunities.json`);
