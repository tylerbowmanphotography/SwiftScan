/**
 * Affiliate link builder. IDs come from the server (/api/config, set via env vars on the host),
 * never hard-coded. With no ID configured a link goes to the product with no tracking.
 */
export interface AffiliateConfig {
  amazonTag?: string | null;
  ebayCampaignId?: string | null;
  walmartLinkPrefix?: string | null;
  targetLinkPrefix?: string | null;
  bestBuyLinkPrefix?: string | null;
}

let config: AffiliateConfig = {};
export const setAffiliateConfig = (c: AffiliateConfig | undefined | null) => {
  config = c || {};
};
export const getAffiliateConfig = () => config;

/** True when at least one affiliate program is configured (links may earn commission). */
export const hasAffiliateIds = (c: AffiliateConfig = config) =>
  !!(c.amazonTag || c.ebayCampaignId || c.walmartLinkPrefix || c.targetLinkPrefix || c.bestBuyLinkPrefix);

const isHost = (host: string, domain: string) => host === domain || host.endsWith('.' + domain);

export const getAffiliateUrl = (url?: string, retailer?: string, productName?: string): string => {
  if (!url) {
    if (!retailer || !productName) return '#';
    // Fallback to Google search if no URL is provided
    return `https://www.google.com/search?q=${encodeURIComponent(productName + ' ' + retailer)}+buy`;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') return '#';
    const host = urlObj.hostname.toLowerCase();

    if (isHost(host, 'amazon.com')) {
      // Always drop any tag already on the URL (the AI can invent one), then add ours if set.
      urlObj.searchParams.delete('tag');
      if (config.amazonTag) urlObj.searchParams.set('tag', config.amazonTag);
      return urlObj.toString();
    }

    if (isHost(host, 'ebay.com')) {
      if (config.ebayCampaignId) {
        // eBay Partner Network standard tracking parameters
        urlObj.searchParams.set('mkcid', '1');
        urlObj.searchParams.set('mkrid', '711-53200-19255-0');
        urlObj.searchParams.set('siteid', '0');
        urlObj.searchParams.set('campid', config.ebayCampaignId);
        urlObj.searchParams.set('toolid', '10001');
        urlObj.searchParams.set('mkevt', '1');
      }
      return urlObj.toString();
    }

    // Impact-network style deep links: <your tracking link>?u=<encoded destination>
    const prefix = isHost(host, 'walmart.com')
      ? config.walmartLinkPrefix
      : isHost(host, 'target.com')
        ? config.targetLinkPrefix
        : isHost(host, 'bestbuy.com')
          ? config.bestBuyLinkPrefix
          : null;
    if (prefix) return `${prefix}${prefix.includes('?') ? '&' : '?'}u=${encodeURIComponent(urlObj.toString())}`;

    return urlObj.toString();
  } catch {
    // If URL parsing fails, don't pass through a link we can't vouch for
    return '#';
  }
};

/** Is this link one that may earn us a commission? (used to decide which disclosure to show) */
export const isAmazonLink = (url?: string) => {
  try {
    return !!url && isHost(new URL(url).hostname.toLowerCase(), 'amazon.com');
  } catch {
    return false;
  }
};
