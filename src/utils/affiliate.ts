export const getAffiliateUrl = (url?: string, retailer?: string, productName?: string): string => {
  if (!url) {
    if (!retailer || !productName) return '#';
    // Fallback to Google search if no URL is provided
    return `https://www.google.com/search?q=${encodeURIComponent(productName + ' ' + retailer)}+buy`;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Amazon Affiliate (replaces existing tag or adds it)
    if (urlObj.hostname.includes('amazon.com')) {
      const amazonTag = (import.meta as any).env.VITE_AMAZON_AFFILIATE_TAG;
      if (amazonTag) {
        urlObj.searchParams.set('tag', amazonTag);
      } else {
        // Fallback default tag or we just leave it alone
        urlObj.searchParams.set('tag', 'swiftscan-20');
      }
    }
    
    // Walmart Affiliate (Impact Radius / generic example)
    else if (urlObj.hostname.includes('walmart.com')) {
      const walmartId = (import.meta as any).env.VITE_WALMART_AFFILIATE_ID;
      if (walmartId) {
        urlObj.searchParams.set('affillinktype', '10');
        urlObj.searchParams.set('id', walmartId);
      }
    }
    
    // Ebay Affiliate
    else if (urlObj.hostname.includes('ebay.com')) {
      const ebayCampId = (import.meta as any).env.VITE_EBAY_CAMPAIGN_ID;
      if (ebayCampId) {
        urlObj.searchParams.set('campid', ebayCampId);
      }
    }

    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, return original
    return url;
  }
};
