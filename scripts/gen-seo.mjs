// Generates the crawlable store pages (public/deals/<store>.html), public/sitemap.xml and public/robots.txt.
// Run: node scripts/gen-seo.mjs   (also runs as part of `npm run vercel-build`)
import { mkdirSync, writeFileSync } from "node:fs";

const SITE = "https://www.swiftscan.store";
const APP_STORE = "https://apps.apple.com/app/id6823987573";

export const STORES = [
  { name: "Amazon", slug: "amazon", note: "Amazon shows many discounts as clip coupons on the product page, so check for a coupon box under the price." },
  { name: "Walmart", slug: "walmart", note: "Walmart often runs rollbacks and online-only sales, so the same item can cost less in the app than in the store." },
  { name: "Target", slug: "target", note: "Target Circle offers and weekly ad deals change often, and many only apply when you check out with a Circle account." },
  { name: "Best Buy", slug: "best-buy", note: "Best Buy matches many prices and posts open-box and member deals that never show up as promo codes." },
  { name: "Home Depot", slug: "home-depot", note: "Home Depot sales are often bundle or appliance deals, and some only apply in store or on a minimum spend." },
  { name: "Lowe's", slug: "lowes", note: "Lowe's runs rotating weekly sales and gives extra savings to account holders and credit card users." },
  { name: "Costco", slug: "costco", note: "Costco coupons are member-only and short, so check the dates before you drive there." },
  { name: "Kohl's", slug: "kohls", note: "Kohl's stacks percent-off codes with Kohl's Cash, and the best offers usually have an end date within days." },
  { name: "Nike", slug: "nike", note: "Nike discounts the most on past-season items in the sale section, and member codes are usually the only ones that work." },
  { name: "Apple", slug: "apple", note: "Apple rarely discounts its own products, so savings usually come from refurbished stock, education pricing or trade-ins." },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function storePage(s) {
  const title = `${s.name} coupons and promo codes | SwiftScan`;
  const desc = `Current ${s.name} coupons, promo codes and sales found on the web, plus how to check if a ${s.name} deal is really a good price. Not guaranteed.`;
  const url = `${SITE}/deals/${s.slug}`;
  const others = STORES.filter((o) => o.slug !== s.slug).map((o) => `<a href="/deals/${o.slug}">${esc(o.name)}</a>`).join(" · ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">
<meta name="theme-color" content="#db2777"><meta name="robots" content="index,follow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
:root{--bg:#f8fafc;--fg:#1e293b;--muted:#475569;--card:#fff;--line:#e2e8f0;--brand:#be185d}
@media(prefers-color-scheme:dark){:root{--bg:#070b19;--fg:#e2e8f0;--muted:#94a3b8;--card:#0b1124;--line:rgba(255,255,255,.09);--brand:#f9a8d4}}
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;line-height:1.7;color:var(--fg);background:var(--bg)}
.bar{border-bottom:1px solid var(--line);background:var(--card)}
.bar div{max-width:760px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.brand{font-weight:900;font-size:20px;letter-spacing:-.02em;color:var(--fg);text-decoration:none}.brand span{color:var(--brand)}
.back{font-weight:700;font-size:14px;text-decoration:none;color:var(--brand)}
main{max-width:760px;margin:28px auto 64px;padding:28px 22px 36px;background:var(--card);border:1px solid var(--line);border-radius:24px}
@media(max-width:800px){main{margin:16px 12px 48px;padding:22px 18px}}
h1{font-size:32px;line-height:1.15;letter-spacing:-.025em;font-weight:900;margin:0 0 8px}
h2{font-size:19px;margin:28px 0 6px}
p,li{font-size:16px}small{color:var(--muted)}a{color:var(--brand)}
.deal{border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:10px 0}
.deal b{display:block}.code{display:inline-block;margin-top:6px;border:2px dashed var(--brand);border-radius:8px;padding:2px 10px;font-family:ui-monospace,Menlo,monospace;font-weight:800}
.cta{display:inline-block;margin:6px 8px 0 0;padding:10px 16px;border-radius:12px;background:#db2777;color:#fff;font-weight:800;text-decoration:none}
:focus-visible{outline:2px solid #db2777;outline-offset:2px}
</style></head><body>
<header class="bar"><div><a class="brand" href="/">Swift<span>Scan</span></a><a class="back" href="/deals">All stores</a></div></header>
<main>
<h1>${esc(s.name)} coupons and promo codes</h1>
<p>${esc(s.note)}</p>
<h2>Current ${esc(s.name)} deals</h2>
<div id="deals"><p><small>Searching the web for ${esc(s.name)} deals…</small></p></div>
<noscript><p>Turn on JavaScript to see live ${esc(s.name)} deals, or <a href="/deals">open the deals page</a>.</p></noscript>
<p><small>Found on the web and not guaranteed. Check the terms at the store before you buy. SwiftScan does not pay cash back on these.</small></p>
<h2>Is a ${esc(s.name)} deal really a good price?</h2>
<p>A big "percent off" can sit on top of an inflated list price. SwiftScan estimates what an item is worth from a photo or barcode, and checks whether a sale price beats it. Prices are SwiftScan's estimates, not live store prices.</p>
<a class="cta" href="/black-friday">Check a sale price</a><a class="cta" href="${APP_STORE}">Get the iPhone app</a>
<h2>Other stores</h2>
<p>${others}</p>
</main>
<script>
fetch(${JSON.stringify('/api/deals?store=' + encodeURIComponent(s.name).replace(/'/g, '%27'))}).then(function(r){return r.json()}).then(function(d){
  var el=document.getElementById('deals');
  if(!d||!d.coupons||!d.coupons.length){el.textContent=${JSON.stringify('No current ' + s.name + ' coupons found right now. Check back soon.')};return}
  el.innerHTML='';
  d.coupons.forEach(function(c){
    var div=document.createElement('div');div.className='deal';
    var b=document.createElement('b');b.textContent=c.title;div.appendChild(b);
    var s=document.createElement('small');s.textContent=(c.expires?'Ends '+c.expires+' · ':'')+'Found on '+c.sourceDomain;div.appendChild(s);
    if(c.code){var k=document.createElement('div');var cd=document.createElement('span');cd.className='code';cd.textContent=c.code;k.appendChild(cd);div.appendChild(k)}
    var a=document.createElement('a');a.href=c.sourceUrl;a.target='_blank';a.rel='noopener noreferrer sponsored';a.textContent='View deal';var w=document.createElement('div');w.appendChild(a);div.appendChild(w);
    el.appendChild(div);
  });
}).catch(function(){document.getElementById('deals').innerHTML='<p>Deals could not load right now.</p>'});
</script>
</body></html>
`;
}

export function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = ["/", "/deals", "/black-friday", ...STORES.map((s) => `/deals/${s.slug}`), "/terms", "/privacy"];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u === "/" ? "" : u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
}

export const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync("public/deals", { recursive: true });
  for (const s of STORES) writeFileSync(`public/deals/${s.slug}.html`, storePage(s));
  writeFileSync("public/sitemap.xml", sitemap());
  writeFileSync("public/robots.txt", robots);
  console.log(`Wrote ${STORES.length} store pages, sitemap.xml and robots.txt`);
}
