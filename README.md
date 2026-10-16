# SwiftScan

Point a phone camera at a barcode, label, or item and get an AI-estimated price range, a deal verdict, and store links.

## Environment variables

Copy `.env.example` to `.env` for local development. On Vercel, set the same names in Project Settings → Environment Variables.

Variables prefixed with `VITE_` are embedded when the frontend is built. After changing one, redeploy so the new build picks it up.

### AdSense

| Variable | Required | What it does |
| --- | --- | --- |
| `VITE_ADSENSE_CLIENT_ID` | No | Publisher ID, `ca-pub-` followed by digits. When this is unset or not in that form, SwiftScan does not add the AdSense script or account meta tag, and ad slots render nothing. |
| `VITE_ADSENSE_SLOT_ID` | No | Numeric ad unit slot ID. The banner on a scan result renders only when this and `VITE_ADSENSE_CLIENT_ID` are both set. |

Other optional settings (Gemini, Stripe, sign-in, price alerts, affiliate tags) are listed in `.env.example`.
