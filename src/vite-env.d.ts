/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google AdSense publisher ID (ca-pub-...). Leave unset to keep ads off. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** Google AdSense ad unit ID for the result-page banner. */
  readonly VITE_ADSENSE_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
