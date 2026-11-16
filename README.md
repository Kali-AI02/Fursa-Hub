# FursaHub – opportunities website that updates itself

Jobs, internships, scholarships, fellowships and grants in one place.
New listings arrive automatically every day, and **closed ones disappear automatically**.

## How the automatic updates work

```
GitHub Actions (twice a day, on every push, or by hand, free)
   └─ npm run update
        ├─ scripts/fetch.mjs → downloads open listings from the sources below,
        │                      adds your own (data/manual.json),
        │                      removes everything past its deadline
        └─ scripts/build.mjs → creates the website in site/
   └─ publishes site/ on GitHub Pages
```

Live at: **https://kali-ai02.github.io/Fursa-Hub/**

Closing happens in **two places**, so a visitor never sees an expired listing:
1. **Every update** removes listings whose deadline has passed, or that the source removed.
2. **In the visitor's browser**: the page checks today's date, hides closed listings,
   and shows "Applications closed" on any old link someone opens.

## Sources

| Source | What | Status |
|---|---|---|
| Grants.gov | US government grants & fellowships | ✅ Works, no key needed |
| Remotive | Remote jobs worldwide | ✅ Works. Their rules: always link back and credit them (done), max 4 fetches a day |
| ReliefWeb (UN) | NGO/UN jobs, **internships**, consultancies, trainings in Africa and worldwide | ⏳ Needs a free app name, see below |
| `data/manual.json` | **Your own** scholarships, local jobs, internships | ✅ Add anything you like |

### Turn on ReliefWeb (recommended, this is the biggest source for Africa)
1. Request a free app name at https://apidoc.reliefweb.int/parameters#appname
2. On your computer: `$env:RELIEFWEB_APPNAME="your-app-name"; npm run update`
3. On GitHub: **Settings → Secrets and variables → Actions → New secret**,
   name `RELIEFWEB_APPNAME`, value = your app name.

## Add your own opportunities (scholarships, local jobs…)

Edit `data/manual.json`. See `data/manual.example.json` for the format:

```json
[
  {
    "type": "scholarship",
    "title": "Master's Scholarship in Public Health",
    "org": "Example University",
    "country": "Germany",
    "deadline": "2027-01-31",
    "url": "https://official-page.example.com",
    "summary": "2–3 sentences in your own words.",
    "featured": true
  }
]
```

- `type`: job, internship, scholarship, grant, fellowship, training, consultancy, volunteer
- `deadline`: `YYYY-MM-DD`. The listing disappears automatically after this date.
- `featured: true` pins it to the top.
- Always link to the **official** page.

## Commands (run inside this folder)

| Command | What it does |
|---|---|
| `npm run update` | Fetch new listings + rebuild site |
| `npm run build` | Rebuild site only (after editing pages or manual.json) |
| `npm run preview` | View the site at http://localhost:5174 |

## Where to change things

| What | File |
|---|---|
| Site name, domain, email, social links, hero photo, AdSense code | top of `scripts/build.mjs` (the `SITE` block) |
| Colours | top of `assets/css/style.css` (`--brand`, `--accent`) |
| Homepage design | `assets/css/home.css` |
| About, Privacy, Terms | `content/*.html` |
| Contact page | `contactPage()` in `scripts/build.mjs` |
| Guides (articles) | `content/guides/*.html`: copy one to add a new guide |

⚠️ Don't edit files in `site/` directly. That folder is rebuilt from scratch every time.

## Publishing (GitHub Pages)

One-time: in the GitHub repository go to **Settings → Pages → Build and deployment → Source** and
choose **GitHub Actions**. After that, every push and the twice-daily schedule publish the site.
To update by hand: **Actions → Update & deploy → Run workflow**.

Your changes: edit files, then `git add -A`, `git commit -m "what you changed"`, `git push`.

### Contact email & social links
In `scripts/build.mjs`, fill in `SITE.email` (e.g. `contact@fursahub.com`) and any `SITE.social` links.
The contact page, footer and "Post an opportunity" buttons appear automatically.
Free email for your own domain: **Cloudflare Email Routing** forwards `contact@yourdomain` to your Gmail.

### Your own domain (everything is prepared, only these steps remain)
1. Buy the domain (~$10/year), e.g. `fursahub.org` at Cloudflare or Namecheap.
2. In `scripts/build.mjs` set `domain: 'fursahub.org'` and push. This updates every link and the sitemap, and creates the `CNAME` file.
3. At your domain registrar, add GitHub's DNS records (four `A` records for `@` and a `CNAME` for `www`
   pointing to `kali-ai02.github.io`, see GitHub's "Managing a custom domain" guide).
4. GitHub → **Settings → Pages → Custom domain**: enter the domain, then tick **Enforce HTTPS** when offered.
5. Free email: Cloudflare **Email Routing** → forward `contact@yourdomain` to your Gmail. Put it in `SITE.email`.
6. Google Search Console: add the new domain as a property, verify, and submit `https://yourdomain/sitemap.xml`.
7. ReliefWeb: request the API app name using `contact@yourdomain` (see "Turn on ReliefWeb").

### AdSense (after you have the domain)
1. Apply at adsense.google.com with your domain.
2. Put your publisher ID in `SITE.adsensePublisherId` (e.g. `'pub-1234567890123456'`) and push.
   This adds Google's ad code to every page **and** creates `ads.txt` automatically.
3. In AdSense, set up the free **Privacy & messaging** consent message (required for visitors from Europe).

## AdSense: important

Google often rejects sites made **only** of listings copied from other websites ("low-value content").
To get approved:
- Write original **guides** (aim for 20+): CV tips, interview tips, scholarship lists for your country, etc.
- Add your own hand-written opportunities with a summary in **your own words** (`data/manual.json`).
- Fill in the About page with real information about you.
- After approval, paste Google's script into `adsenseHead` in `scripts/build.mjs`. Ad spaces already exist
  between listings and inside each opportunity and guide page.
