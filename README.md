# Before You Resign — Sales Page

A production-ready, single-page sales site for the PDF ebook
**Before You Resign — A 30-Day Action Guide** (Global Edition, Aijaz Siddique).

Premium editorial design matching the book itself (deep teal / cream / muted gold /
terracotta; Fraunces + Source Serif 4 + Inter). Mobile-first conversion: CTA in the
first screen, sticky mobile purchase bar, scannable sections, real book-page previews.

---

## Folder contents

```
sales-page/
├── index.html            ← the sales page (HTML + inline CSS + tiny JS)
├── thank-you.html        ← order confirmation (noindex) — Polar delivers the PDF
├── privacy.html          ← privacy policy
├── terms.html            ← terms of use & sale
├── contact.html          ← support contact page
├── assets/
│   ├── favicon.svg
│   ├── preview.pdf       ← 6-page real preview (cover, pressure map,
│   │                        scripts, runway, dashboard, one-page card)
│   ├── img/              ← optimized page previews + og-image.jpg (shipped)
│   ├── src/              ← full-resolution PNG renders (source, not needed to deploy)
│   └── og-card.html      ← editable source for regenerating the OG/share image
└── README.md
```

Deploy the `sales-page/` folder as-is (it's fully static).

---

## 1. Preview the page

Just open `index.html` in a browser — no build step, no server required.

For a local web server (recommended, matches production behavior):

```bash
cd sales-page
npx serve .          # or: python -m http.server 8080
```

---

## 2. Change price / currency / checkout URL / preview URL

Open `index.html` and find the clearly marked config block near the bottom:

```js
var PRODUCT_CONFIG = {
  price: "9.99",                 // e.g. "9.99", "499", "12.50"
  currency: "USD",               // ISO code shown next to the price
  currencySymbol: "$",           // symbol shown before the amount
  checkoutUrl: "https://buy.polar.sh/polar_cl_…",  // live Polar checkout (same tab)
  previewUrl: "assets/preview.pdf"  // "See inside the guide" links (new tab)
};
```

- **Checkout URL** — live: points at the Polar.sh product. Every purchase button
  (header, hero, price box, final CTA, sticky mobile bar) reads this one value and
  opens it in the same tab. Polar also handles the ebook delivery after payment.
- **Preview URL** — points at the included 6-page preview PDF (real pages from the
  book). Replace with an external URL if you host the preview elsewhere.
- **Price / currency** — change the values; every price display, the CTA labels and
  the JSON-LD structured data update automatically.
- **Important:** the static HTML also ships with `$9.99` written in plain text so the
  page is correct even before JavaScript runs. If you change the price, also update the
  visible `$9.99` texts (search for `9.99`) so non-JS users see the right amount.

---

## 3. Before you deploy — checklist

1. ~~Checkout URL~~ — done: live Polar.sh link wired into `PRODUCT_CONFIG`.
2. ~~Support email~~ — done: `contact.html` uses `me@aijazmohammad.com`.
3. **Domain in meta tags** — search the HTML files for `your-domain.com`
   (canonical + Open Graph + Twitter URLs) and replace with your real domain.
   The OG image URL must be absolute for social previews to work.
4. **Jurisdiction** — `terms.html` section 10 has a `[seller's country/state]`
   placeholder; fill it in (ideally after a professional review).
5. **Delivery** — Polar.sh handles payment + PDF delivery; the thank-you page
   explains what buyers should expect and routes problems to contact.html.
6. Optional: test one purchase end-to-end in Polar's test mode.

---

## 4. Deploy

Any static hosting works — no server code, no database:

- **Netlify / Vercel** — drag the `sales-page` folder into the dashboard, or
  `npx netlify deploy`. Done.
- **GitHub Pages** — push the folder to a repo, enable Pages.
- **Cloudflare Pages / S3 / any web host** — upload the folder.

---

## 5. Design & honesty notes

- No testimonials, ratings, customer counts, countdown timers, discounts, or
  urgency devices are used — none exist, so none are invented.
- The page never claims to "cure burnout" or promise outcomes; it states plainly
  that the guide does **not** decide for the reader.
- Structured data is `Book` / `schema.org/EBook` with an `Offer` — no
  `aggregateRating`/`review`. Price/currency stay synced with `PRODUCT_CONFIG`.
- Accuracy notes baked into the copy: the PDF is a reading/print edition (no
  interactive form fields are claimed), and the 11 scripts include lower-risk
  alternatives *where appropriate* — not on every script.
- The guide can complement professional care; the page says so explicitly, and a
  crisis-support note (findahelpline.com + local emergency numbers) appears in the
  final CTA and footer.

---

## 6. Regenerating assets (optional, for future edits)

The book-page preview images were rendered from `../ebook-2.html` with Playwright.
To regenerate (requires `npm i playwright` in `../tools` and a Playwright Chromium):

```bash
cd ../tools
node render-previews.cjs     # re-render book pages -> sales-page/assets/src/*.png
node render-og.cjs           # re-render the social share image -> assets/img/og-image.jpg
node shot-sales.cjs          # full-page QA screenshots (1440/768/390) -> tools/shots/
node qa-final.cjs            # automated QA: overflow, links, accordions, sticky bar
```

The shipped WebP/JPGs in `assets/img/` were optimized from `assets/src/` at
800px width (1000px for the cover), WebP quality 80. The preview PDF was assembled
from six of the rendered pages (`assets/src/*.png`).

---

## Changelog — final correction pass (pre-launch)

1. **Removed "fill it in on screen"** everywhere (hero micro, price box, FAQ) — the
   delivered PDF is a reading/print edition. New wording: "read it on phone, tablet
   or desktop · print the worksheets when you want to write things out."
2. **Fixed the scripts overclaim** — no longer "each with a lower-risk version";
   now "lower-risk alternatives where appropriate, plus a before-you-send checklist"
   (hero, method, tools, value stack, FAQ).
3. **Tightened hero** — new headline ("Before You Resign, Find Out What Actually
   Needs to Change — and What Comes Next."), shorter subhead, CTA moved directly
   under the subhead with a compact proof line and preview link beneath it;
   benefit bullets follow. CTA label now "Get Before You Resign — $9.99".
4. **Tone corrections** — removed "you're not weak and you're not being dramatic";
   "most expensive decision of your life" → "high-stakes career and financial
   decision".
5. **Shortened the page** — removed the standalone Stay/Change/Leave card section,
   standalone money-page section and 30-day-plan table section (their key proof
   lives in the product-preview rows); merged the two accordion sections into ONE
   8-question FAQ. Desktop height 19,414 → ~16,100px (−17% height; ≈25% less copy).
6. **Health positioning** — "not for you if you need therapy" replaced with:
   the guide does not replace medical/mental-health care; use it alongside
   professional support, not instead of it.
7. **Added preview CTA** ("See inside the guide") in hero, tools intro, price box
   and final CTA — all driven by `PRODUCT_CONFIG.previewUrl`, backed by a real
   6-page preview PDF assembled from actual book pages.
8. **Mobile** — CTA lands in the first screen before any bullets; header compacted;
   sticky bar verified (hidden at top, visible mid-scroll); no horizontal overflow;
   dash+price kept together on wrap.
9. **Config & schema** — added `previewUrl`; structured data switched from
   `Product` to `Book`/`EBook` with synced price; header CTA now uses checkoutUrl.
