const fs = require('fs');

let content = fs.readFileSync('src/components/ProductResultView.tsx', 'utf8');

// Add import
const importStatement = "import { getAffiliateUrl } from '../utils/affiliate';\n";
content = content.replace("import React, { useState } from 'react';", importStatement + "import React, { useState } from 'react';");

// Replace URL generation
const oldHref = "href={item.url ? `${item.url}${item.url.includes('?') ? '&' : '?'}tag=ais-affiliate-20` : `https://www.google.com/search?q=${encodeURIComponent(result.productName + ' ' + item.retailer)}+buy&tag=ais-affiliate-20`}";
const newHref = "href={getAffiliateUrl(item.url, item.retailer, result.productName)}";

content = content.replace(oldHref, newHref);

fs.writeFileSync('src/components/ProductResultView.tsx', content);

// check .env.example
let envExample = "";
if (fs.existsSync('.env.example')) {
    envExample = fs.readFileSync('.env.example', 'utf8');
}
if (!envExample.includes('VITE_AMAZON_AFFILIATE_TAG')) {
    envExample += "\n# Affiliate Marketing IDs\nVITE_AMAZON_AFFILIATE_TAG=\nVITE_WALMART_AFFILIATE_ID=\nVITE_EBAY_CAMPAIGN_ID=\n";
    fs.writeFileSync('.env.example', envExample);
}

