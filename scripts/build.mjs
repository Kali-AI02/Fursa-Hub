// Builds the website into the site/ folder from:
//   data/opportunities.json   (made by fetch.mjs)
//   content/                  (your pages and guides)
//   assets/                   (CSS, JavaScript, images)
//
// Run:  npm run build    (or: node scripts/build.mjs)

import { readFile, writeFile, mkdir, rm, readdir, cp } from 'node:fs/promises';

// ✏️ Change these to your own details
const SITE = {
  name: 'FursaHub',
  tagline: 'Jobs, internships, grants and scholarships you can still apply for',
  // Where the site lives. Change to your own domain later, e.g. 'https://fursahub.com'
  url: 'https://kali-ai02.github.io/Fursa-Hub',
  // Public contact email, e.g. 'contact@fursahub.com'. Leave '' until you have one.
  email: '',
  // Social links (leave '' to hide). Full URLs.
  social: {
    whatsapp: '',  // e.g. WhatsApp channel link
    facebook: '',
    instagram: '',
    linkedin: '',
    x: '',
  },
  // Optional photo behind the homepage headline: put a file in assets/img/ and write e.g. 'img/hero.jpg'
  heroImage: '',
  // After AdSense approval, paste the <script> tag Google gives you here:
  adsenseHead: '',
  // Google Search Console verification code (the content="..." part of the meta tag)
  googleVerification: 'KNgnhlyvS3wz_3uPlrjBfV-LSx4hrAqM-tvZrlEtB54',
  // Google Analytics Measurement ID, e.g. 'G-XXXXXXXXXX' ('' = off)
  analyticsId: '',
};

const root = new URL('../', import.meta.url);
const out = new URL('site/', root);
const TODAY = new Date().toISOString().slice(0, 10);
const BASE_PATH = new URL(SITE.url + '/').pathname; // e.g. /Fursa-Hub/

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'opportunity';

const TYPES = {
  job: 'Job', internship: 'Internship', scholarship: 'Scholarship', grant: 'Grant',
  fellowship: 'Fellowship', training: 'Training', consultancy: 'Consultancy', volunteer: 'Volunteer',
};
// Which listing page each type belongs to
const GROUP = {
  job: 'jobs', consultancy: 'jobs', internship: 'internships', volunteer: 'internships',
  scholarship: 'scholarships', fellowship: 'scholarships', training: 'scholarships', grant: 'grants',
};
const GROUP_LABEL = { jobs: 'Jobs', internships: 'Internships', scholarships: 'Scholarships', grants: 'Grants' };

// Homepage category tiles: [key, label, description, emoji, link]
const CATEGORIES = [
  ['job', 'Jobs', 'Careers worldwide', '💼', 'jobs.html?type=job'],
  ['internship', 'Internships', 'Start your career', '🚀', 'internships.html?type=internship'],
  ['scholarship', 'Scholarships', 'Fund your studies', '🎓', 'scholarships.html?type=scholarship'],
  ['fellowship', 'Fellowships', 'Research & leadership', '🏅', 'scholarships.html?type=fellowship'],
  ['grant', 'Grants', 'Funding for projects', '💰', 'grants.html'],
  ['training', 'Training', 'Courses & workshops', '📚', 'scholarships.html?type=training'],
  ['consultancy', 'Consultancies', 'Short-term contracts', '🧭', 'jobs.html?type=consultancy'],
  ['volunteer', 'Volunteering', 'Give back & learn', '🤝', 'internships.html?type=volunteer'],
  ['remote', 'Remote', 'Work from anywhere', '🌍', 'index.html?tab=remote#browse'],
];

const fmtDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function initials(s = '') {
  const w = s.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
}
function hue(s = '') {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// ---------- icons ----------
const icon = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
};
const svg = (name, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const socialLinks = () => Object.entries(SITE.social).filter(([, u]) => u)
  .map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${{ whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X (Twitter)' }[k]}</a>`).join('');

// ---------- layout shared by every page ----------

function layout({ title, description, body, depth = 0, active = '', path = '', bodyAttrs = '', base = false }) {
  const r = '../'.repeat(depth);
  const nav = [
    ['index.html', 'Home', 'home'],
    ['jobs.html', 'Jobs', 'jobs'],
    ['internships.html', 'Internships', 'internships'],
    ['scholarships.html', 'Scholarships', 'scholarships'],
    ['grants.html', 'Grants', 'grants'],
    ['guides/index.html', 'Guides', 'guides'],
    ['contact.html', 'Contact', 'contact'],
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${base ? `<base href="${BASE_PATH}">` : ''}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE.url}/${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="#4f46e5">
${SITE.googleVerification ? `<meta name="google-site-verification" content="${esc(SITE.googleVerification)}">` : ''}
${SITE.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(SITE.analyticsId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(SITE.analyticsId)}');</script>` : ''}
<link rel="icon" href="${r}img/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="${r}css/style.css">
<link rel="stylesheet" href="${r}css/home.css">
${SITE.adsenseHead}
</head>
<body ${bodyAttrs}>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="wrap topbar-inner">
    <a href="${r}index.html" class="logo"><span class="logo-mark">F</span>Fursa<b>Hub</b></a>
    <nav class="topnav" aria-label="Main">
      ${nav.map(([href, label, key]) => `<a href="${r}${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <div class="top-actions">
      <a href="${r}saved.html" class="icon-btn" aria-label="Saved opportunities" title="Saved">${svg('bookmark')}<span class="saved-count" hidden></span></a>
      <button class="icon-btn" id="theme-toggle" aria-label="Switch light or dark theme" title="Theme">${svg('sun')}</button>
    </div>
  </div>
</header>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="wrap footer-inner">
    <div>
      <a href="${r}index.html" class="logo"><span class="logo-mark">F</span>Fursa<b>Hub</b></a>
      <p class="muted">${esc(SITE.tagline)}. Free, and we never charge you to apply.</p>
      ${SITE.email ? `<p><a class="footer-mail" href="mailto:${esc(SITE.email)}">${svg('mail', 18)} ${esc(SITE.email)}</a></p>` : ''}
    </div>
    <div class="footer-cols">
      <div><h4>Browse</h4>
        <a href="${r}jobs.html">Jobs</a><a href="${r}internships.html">Internships</a>
        <a href="${r}scholarships.html">Scholarships</a><a href="${r}grants.html">Grants</a></div>
      <div><h4>FursaHub</h4>
        <a href="${r}guides/index.html">Guides</a><a href="${r}about.html">About</a>
        <a href="${r}contact.html">Contact us</a><a href="${r}contact.html#post">Post an opportunity</a></div>
      <div><h4>Legal</h4>
        <a href="${r}privacy-policy.html">Privacy Policy</a><a href="${r}terms.html">Terms</a>
        ${socialLinks() ? `<h4 class="follow">Follow</h4>${socialLinks()}` : ''}</div>
    </div>
  </div>
  <div class="wrap fine">© ${new Date().getFullYear()} ${SITE.name}. Listings link to their original sources, including Grants.gov, Remotive and ReliefWeb.</div>
</footer>

<nav class="bottomnav" aria-label="Quick">
  <a href="${r}index.html"${active === 'home' ? ' class="active"' : ''}>${svg('home')}<span>Home</span></a>
  <a href="${r}index.html#search" data-focus-search>${svg('search')}<span>Search</span></a>
  <a href="${r}saved.html"${active === 'saved' ? ' class="active"' : ''}>${svg('bookmark')}<span>Saved</span></a>
  <a href="${r}guides/index.html"${active === 'guides' ? ' class="active"' : ''}>${svg('book')}<span>Guides</span></a>
  <a href="${r}contact.html"${active === 'contact' ? ' class="active"' : ''}>${svg('chat')}<span>Contact</span></a>
</nav>
<script src="${r}js/app.js" defer></script>
</body>
</html>`;
}

// ---------- listing block (tabs, chips, cards) ----------

const searchBar = (placeholder = 'Search title, organisation, country…') => `
    <form class="searchbar" role="search" onsubmit="return false">
      ${svg('search')}
      <input id="search" type="search" placeholder="${placeholder}" aria-label="Search opportunities" autocomplete="off">
      <select id="country" aria-label="Country"><option value="">All countries</option></select>
    </form>`;

const listingBlock = ({ preset = {}, view = 'list' } = {}) => {
  const attrs = Object.entries(preset).map(([k, v]) => ` data-preset-${k}="${esc(v)}"`).join('');
  return `<div class="wrap" id="app" data-view="${view}"${attrs}>
  <div class="tabs" role="tablist" id="tabs"></div>
  <div class="chips" id="chips"></div>
  <div id="results" class="results" aria-live="polite"><p class="muted loading">Loading opportunities…</p></div>
  <div class="more"><button class="btn ghost" id="load-more" hidden>Show more</button></div>
</div>`;
};

function listingPage({ heading, intro, emoji = '', preset = {}, view = 'list' }) {
  return `
<section class="hero page-hero">
  <div class="wrap">
    ${emoji ? `<span class="hero-emoji" aria-hidden="true">${emoji}</span>` : ''}
    <h1>${heading}</h1>
    <p>${intro}</p>
    ${searchBar()}
    <p class="updated muted" id="updated"></p>
  </div>
</section>
${listingBlock({ preset, view })}`;
}

// ---------- homepage ----------

function stat(n, label, key) {
  return `<div class="stat"><strong data-count="${n}" data-stat="${key}">${n.toLocaleString('en')}</strong><span>${label}</span></div>`;
}

function homePage(items, guides) {
  const countries = new Set(items.map((o) => o.country)).size;
  const week = items.filter((o) => o.deadline && (Date.parse(o.deadline) - Date.parse(TODAY)) / 864e5 <= 7).length;
  const fresh = items.filter((o) => o.posted && (Date.parse(TODAY) - Date.parse(o.posted)) / 864e5 <= 7).length;
  const counts = {};
  for (const o of items) counts[o.type] = (counts[o.type] || 0) + 1;
  counts.remote = items.filter((o) => o.remote).length;
  const spotlight = items.filter((o) => o.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
  const heroBg = SITE.heroImage ? ` style="--hero-img:url('${esc(SITE.heroImage)}')"` : '';

  return `
<section class="home-hero${SITE.heroImage ? ' has-photo' : ''}"${heroBg}>
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <span class="eyebrow"><i class="pulse"></i> Updated every day · closed listings removed automatically</span>
      <h1>Your next <span class="rotator" aria-live="off"><span>job</span><span>scholarship</span><span>internship</span><span>grant</span><span>fellowship</span></span><br>starts here.</h1>
      <p class="lead">Discover opportunities from around the world that you can still apply for: free, in one place, with no fees to apply.</p>
      ${searchBar('Try “nursing”, “Rwanda”, “master’s”, “remote”…')}
      <div class="quick">
        <a href="scholarships.html?type=scholarship">🎓 Scholarships</a>
        <a href="jobs.html">💼 Jobs</a>
        <a href="internships.html">🚀 Internships</a>
        <a href="grants.html">💰 Grants</a>
        <a href="index.html?tab=remote#browse">🌍 Remote</a>
      </div>
      <div class="hero-ctas">
        <a class="btn" href="#browse">Browse opportunities ${svg('arrow', 18)}</a>
        <a class="btn light" href="contact.html#post">${svg('plus', 18)} Post an opportunity</a>
      </div>
    </div>
    <div class="hero-visual" aria-hidden="true">
      ${spotlight.map((o, i) => `
      <a class="float-card f${i + 1}" href="o/${o.slug}.html" tabindex="-1">
        <span class="avatar" style="--h:${hue(o.org)}">${esc(initials(o.org))}</span>
        <span class="fc-body"><small>${esc(TYPES[o.type])} · ${esc(o.country)}</small><b>${esc(o.title)}</b><em class="deadline" data-deadline="${o.deadline}"></em></span>
      </a>`).join('')}
    </div>
  </div>
  <div class="wrap">
    <div class="stats">
      ${stat(items.length, 'Open opportunities', 'open')}
      ${stat(week, 'Closing this week', 'week')}
      ${stat(fresh, 'Added this week', 'fresh')}
      ${stat(countries, 'Countries & regions', 'countries')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><div><h2>Explore by category</h2><p class="muted">Find opportunities that match your goals</p></div></div>
    <div class="cat-grid">
      ${CATEGORIES.map(([key, label, desc, emoji, href], i) => `
      <a class="cat reveal" href="${href}" style="--i:${i}">
        <span class="cat-icon">${emoji}</span>
        <span><b>${label}</b><small>${desc}</small></span>
        <em data-cat="${key}">${(counts[key] || 0).toLocaleString('en')}</em>
      </a>`).join('')}
    </div>
  </div>
</section>

<section class="section tint" id="featured-section" hidden>
  <div class="wrap">
    <div class="section-head"><div><h2>⭐ Featured</h2><p class="muted">Hand-picked by the FursaHub team</p></div></div>
    <div class="rail" id="rail-featured"></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div><h2>⏳ Closing soon</h2><p class="muted">Deadlines approaching: apply before they close</p></div>
      <a href="index.html?tab=closing#browse" class="see-all">See all ${svg('arrow', 16)}</a>
    </div>
    <div class="rail" id="rail-closing"></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div><h2>✨ Just added</h2><p class="muted">Fresh opportunities from the last few days</p></div>
      <a href="index.html?tab=new#browse" class="see-all">See all ${svg('arrow', 16)}</a>
    </div>
    <div class="rail" id="rail-new"></div>
  </div>
</section>

<section class="section browse" id="browse">
  <div class="wrap section-head"><div><h2>All opportunities</h2><p class="muted updated" id="updated"></p></div></div>
  ${listingBlock()}
</section>

<section class="section tint">
  <div class="wrap">
    <div class="section-head">
      <div><h2>📖 Guides to help you win</h2><p class="muted">Practical advice for applications, CVs and exams</p></div>
      <a href="guides/index.html" class="see-all">All guides ${svg('arrow', 16)}</a>
    </div>
    <div class="grid">${guides.slice(0, 4).map((g) => `<a class="mini guide-card reveal" href="guides/${g.file}"><span class="guide-emoji">${g.emoji}</span><strong>${esc(g.title)}</strong><span class="muted">${esc(g.description)}</span></a>`).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="cta-band reveal">
      <div>
        <h2>Have an opportunity to share?</h2>
        <p>Organisations, universities and recruiters can post jobs, scholarships and programmes on FursaHub for free.</p>
      </div>
      <div class="cta-actions">
        <a class="btn light" href="contact.html#post">${svg('plus', 18)} Post an opportunity</a>
        <a class="btn outline" href="contact.html">${svg('mail', 18)} Contact us</a>
      </div>
    </div>
  </div>
</section>`;
}

// ---------- contact page ----------

function contactPage() {
  const email = SITE.email;
  const postBody = encodeURIComponent('Title:\nOrganisation:\nType (job / internship / scholarship / grant / fellowship / training):\nCountry or Remote:\nDeadline (YYYY-MM-DD):\nOfficial link:\nShort description:\n');
  const emailBlock = email
    ? `<a class="contact-card" href="mailto:${esc(email)}"><span class="cc-icon">${svg('mail')}</span><span><b>Email us</b><small>${esc(email)}</small></span></a>`
    : `<div class="contact-card soon"><span class="cc-icon">${svg('mail')}</span><span><b>Email</b><small>Our contact email is coming soon.</small></span></div>`;
  const social = Object.entries(SITE.social).filter(([, u]) => u);

  return `
<section class="hero page-hero">
  <div class="wrap">
    <span class="hero-emoji" aria-hidden="true">👋</span>
    <h1>Contact us</h1>
    <p>Questions, a broken link, a scam to report, or an opportunity to share? We'd love to hear from you.</p>
  </div>
</section>
<div class="wrap contact-wrap">
  <div class="contact-cards">
    ${emailBlock}
    ${social.map(([k, u]) => `<a class="contact-card" href="${esc(u)}" target="_blank" rel="noopener"><span class="cc-icon">${svg('chat')}</span><span><b>${{ whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X (Twitter)' }[k]}</b><small>Follow and message us</small></span></a>`).join('')}
  </div>

  <div class="panel">
    <h2>Send a message</h2>
    ${email
      ? `<p class="muted">This opens your email app with your message ready to send.</p>
    <form class="form" id="contact-form" data-email="${esc(email)}">
      <div><label for="name">Your name</label><input id="name" name="name" required></div>
      <div><label for="topic">Topic</label>
        <select id="topic" name="topic"><option>General question</option><option>Report a broken link</option><option>Report a scam</option><option>Partnership</option><option>Advertising</option></select></div>
      <div><label for="message">Message</label><textarea id="message" name="message" required></textarea></div>
      <button class="btn" type="submit">${svg('mail', 18)} Write email</button>
    </form>`
      : `<p class="muted">Messaging will open here as soon as our contact email is ready. Meanwhile, keep exploring <a href="index.html">open opportunities</a>.</p>`}
  </div>

  <div class="panel" id="post">
    <h2>📣 Post an opportunity (free)</h2>
    <p>Are you an employer, university, NGO or programme organiser? We publish genuine opportunities for free. Send us:</p>
    <ul class="checklist">
      <li>Title and organisation</li>
      <li>Type: job, internship, scholarship, grant, fellowship or training</li>
      <li>Country (or "Remote")</li>
      <li>Application deadline</li>
      <li>Link to the official page</li>
      <li>A short description</li>
    </ul>
    ${email
      ? `<a class="btn" href="mailto:${esc(email)}?subject=${encodeURIComponent('New opportunity for FursaHub')}&body=${postBody}">${svg('plus', 18)} Submit by email</a>`
      : '<p class="muted"><em>Submissions open as soon as our contact email is ready.</em></p>'}
    <p class="muted small">We review every submission. We never publish opportunities that charge applicants a fee.</p>
  </div>
</div>`;
}

// ---------- detail page ----------

function detailPage(o, related) {
  const typeLabel = TYPES[o.type] || 'Opportunity';
  const group = GROUP[o.type] || 'jobs';
  const meta = [
    ['Type', typeLabel + (o.remote ? ' · Remote' : '')],
    ['Organisation', o.org],
    ['Location', o.country],
    ['Deadline', o.deadline ? fmtDate(o.deadline) : 'Open until filled'],
    ['Posted', o.posted ? fmtDate(o.posted) : ''],
    ['Source', o.source],
  ].filter(([, v]) => v);

  return `
<div class="detail-hero" style="--h:${hue(o.org)}"></div>
<article class="wrap detail" data-id="${esc(o.id)}" data-deadline="${o.deadline || ''}">
  <nav class="crumbs"><a href="../index.html">Home</a> › <a href="../${group}.html">${GROUP_LABEL[group]}</a></nav>
  <div class="detail-head">
    <span class="avatar" style="--h:${hue(o.org)}">${esc(initials(o.org))}</span>
    <div>
      <p class="muted">${esc(o.org)} · ${esc(o.country)}</p>
      <h1>${esc(o.title)}</h1>
      <div class="badges"><span class="status" data-deadline="${o.deadline || ''}"></span><span class="badge">${typeLabel}</span>${o.remote ? '<span class="badge remote">Remote</span>' : ''}<span class="deadline" data-deadline="${o.deadline || ''}"></span></div>
    </div>
  </div>

  <div class="closed-banner" hidden>⛔ This opportunity has closed. Browse <a href="../${group}.html">open ${GROUP_LABEL[group].toLowerCase()}</a> instead.</div>

  <div class="detail-grid">
    <div class="detail-body">
      <h2>About this opportunity</h2>
      <p>${esc(o.summary) || 'Full details are available on the official page.'}</p>
      ${o.tags?.length ? `<p class="tags">${o.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
      <div class="ad-slot"></div>
      <div class="note"><strong>Before you apply:</strong> always read the full requirements on the official page. Genuine employers and funders never ask you to pay to apply.</div>
    </div>
    <aside class="detail-side">
      ${o.deadline ? `<div class="countdown" data-deadline="${o.deadline}"></div>` : ''}
      <dl>${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <a class="btn apply" href="${esc(o.url)}" target="_blank" rel="noopener nofollow">Apply on ${esc(o.source)} ↗</a>
      <div class="side-actions">
        <button class="btn ghost" data-save="${esc(o.id)}">Save</button>
        <button class="btn ghost" data-share>Share</button>
      </div>
    </aside>
  </div>

  ${related.length ? `<section class="related"><h2>Similar opportunities</h2><div class="grid">${related.map(relatedCard).join('')}</div></section>` : ''}
</article>`;
}

function relatedCard(o) {
  return `<a class="mini" href="${o.slug}.html" data-deadline-card="${o.deadline || ''}">
    <span class="badge">${TYPES[o.type]}</span>
    <strong>${esc(o.title)}</strong>
    <span class="muted">${esc(o.org)} · ${esc(o.country)}</span>
  </a>`;
}

// ---------- content pages ----------

async function readContent(file) {
  const raw = await readFile(new URL(`content/${file}`, root), 'utf8');
  const get = (k) => (raw.match(new RegExp(`<!--\\s*${k}:\\s*(.*?)\\s*-->`)) || [])[1] || '';
  return { title: get('title'), description: get('description'), emoji: get('emoji') || '📘', body: raw };
}

// ---------- build ----------

const data = JSON.parse(await readFile(new URL('data/opportunities.json', root), 'utf8'));
const items = data.items
  .filter((o) => !o.deadline || o.deadline >= TODAY)
  .map((o) => ({ ...o, slug: `${slugify(o.title)}-${o.id.replace(/[^a-z0-9-]/gi, '')}` }));

await rm(out, { recursive: true, force: true });
await mkdir(new URL('o/', out), { recursive: true });
await mkdir(new URL('guides/', out), { recursive: true });
await mkdir(new URL('data/', out), { recursive: true });
await cp(new URL('assets/', root), out, { recursive: true });
await writeFile(new URL('.nojekyll', out), ''); // GitHub Pages: serve files as they are

// Slim data file the browser loads
await writeFile(new URL('data/opportunities.json', out), JSON.stringify({
  updated: data.updated,
  items: items.map(({ id, type, title, org, country, remote, posted, deadline, summary, slug, featured }) =>
    ({ id, type, title, org, country, remote, posted, deadline, slug, featured, summary: summary ? summary.slice(0, 180) : '' })),
}));

const urls = [];
const page = async (file, html, priority = '0.5') => {
  await writeFile(new URL(file, out), html);
  urls.push([file === 'index.html' ? '' : file, priority]);
};

// Guides (read first: the homepage shows them)
const guideFiles = (await readdir(new URL('content/guides/', root))).filter((f) => f.endsWith('.html')).sort();
const guides = [];
for (const f of guideFiles) guides.push({ ...(await readContent(`guides/${f}`)), file: f });

// Homepage
await page('index.html', layout({
  title: `${SITE.name}: ${SITE.tagline}`,
  description: 'Find jobs, internships, scholarships, fellowships and grants you can still apply for. Updated daily; closed listings are removed automatically.',
  body: homePage(items, guides), active: 'home', path: '', bodyAttrs: 'data-page="home"',
}), '1.0');

// Category pages
const listings = [
  ['jobs.html', 'jobs', { emoji: '💼', heading: 'Jobs', intro: 'Open jobs and consultancies around the world, including remote roles.', preset: { group: 'jobs' } }],
  ['internships.html', 'internships', { emoji: '🚀', heading: 'Internships', intro: 'Internships and volunteer opportunities to start your career.', preset: { group: 'internships' } }],
  ['scholarships.html', 'scholarships', { emoji: '🎓', heading: 'Scholarships & fellowships', intro: 'Funding to study, research and grow, with deadlines you can still meet.', preset: { group: 'scholarships' } }],
  ['grants.html', 'grants', { emoji: '💰', heading: 'Grants', intro: 'Funding for projects, organisations and research.', preset: { group: 'grants' } }],
];
for (const [file, key, opts] of listings) {
  await page(file, layout({ title: `${opts.heading} you can still apply for | ${SITE.name}`, description: opts.intro, body: listingPage(opts), active: key, path: file }), '0.9');
}
await writeFile(new URL('saved.html', out), layout({
  title: `Saved opportunities | ${SITE.name}`, description: 'Opportunities you saved.', active: 'saved', path: 'saved.html',
  body: listingPage({ emoji: '🔖', heading: 'Saved opportunities', intro: 'Saved on this device. Closed ones are removed automatically.', view: 'saved' }),
}));

// Detail pages
const byType = {};
for (const o of items) (byType[o.type] ||= []).push(o);
for (const o of items) {
  const related = (byType[o.type] || []).filter((x) => x.id !== o.id && x.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  await page(`o/${o.slug}.html`, layout({
    title: `${o.title}: ${o.org} | ${SITE.name}`,
    description: (o.summary || `${TYPES[o.type]} at ${o.org}, ${o.country}.`).slice(0, 155),
    body: detailPage(o, related), depth: 1, path: `o/${o.slug}.html`, bodyAttrs: 'data-page="detail"',
  }), '0.6');
}

// Static pages
await page('contact.html', layout({ title: `Contact us | ${SITE.name}`, description: 'Contact FursaHub or post an opportunity for free.', body: contactPage(), active: 'contact', path: 'contact.html' }), '0.4');
for (const name of ['about', 'privacy-policy', 'terms']) {
  const c = await readContent(`${name}.html`);
  await page(`${name}.html`, layout({ title: `${c.title} | ${SITE.name}`, description: c.description, body: `<div class="wrap prose">${c.body}</div>`, path: `${name}.html` }), '0.3');
}

// Guide pages + index
for (const g of guides) {
  await page(`guides/${g.file}`, layout({ title: `${g.title} | ${SITE.name}`, description: g.description, body: `<article class="wrap prose">${g.body}<p class="back"><a href="index.html">← All guides</a></p></article>`, depth: 1, active: 'guides', path: `guides/${g.file}` }), '0.8');
}
await page('guides/index.html', layout({
  title: `Guides: jobs, scholarships and applications | ${SITE.name}`,
  description: 'Practical guides to help you find and win jobs, internships, scholarships and grants.',
  depth: 1, active: 'guides', path: 'guides/',
  body: `<section class="hero page-hero"><div class="wrap"><span class="hero-emoji" aria-hidden="true">📖</span><h1>Guides</h1><p>Practical advice to help you apply and win.</p></div></section>
<div class="wrap grid guides">${guides.map((g) => `<a class="mini guide-card" href="${g.file}"><span class="guide-emoji">${g.emoji}</span><strong>${esc(g.title)}</strong><span class="muted">${esc(g.description)}</span></a>`).join('')}</div>`,
}), '0.8');

// Sitemap, robots, 404
await writeFile(new URL('sitemap.xml', out), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p]) => `<url><loc>${SITE.url}/${u}</loc><lastmod>${TODAY}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>`);
await writeFile(new URL('robots.txt', out), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
await writeFile(new URL('404.html', out), layout({
  title: `Not found | ${SITE.name}`, description: 'Page not found', path: '404.html', base: true,
  body: `<section class="hero page-hero"><div class="wrap"><span class="hero-emoji" aria-hidden="true">🔍</span><h1>This page isn't here</h1><p>The opportunity may have closed and been removed automatically.</p><p><a class="btn" href="index.html">See what's open now ${svg('arrow', 18)}</a></p></div></section>`,
}));

console.log(`Built ${items.length} opportunity pages, ${guides.length} guides → site/`);
