/*
 * Intentional Instagram background redirector.
 *
 * Firefox Manifest V3 currently uses background scripts instead of Chrome-style
 * service workers. This file does one deliberately small job: redirect plain
 * Instagram home page visits to Direct Messages before the feed loads.
 *
 * Privacy: this extension does not collect, store, transmit, or log anything.
 */

const INSTAGRAM_ORIGIN = "https://www.instagram.com";
const INBOX_URL = `${INSTAGRAM_ORIGIN}/direct/inbox/`;

/**
 * Return true only for plain home URLs, e.g.
 *   https://www.instagram.com/
 *   https://www.instagram.com/?hl=en
 *
 * Do not redirect profiles, DMs, posts, stories, login pages, etc.
 */
function isPlainInstagramHome(urlString) {
  try {
    const url = new URL(urlString);
    return url.origin === INSTAGRAM_ORIGIN && url.pathname === "/";
  } catch (_) {
    return false;
  }
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isPlainInstagramHome(details.url)) {
      return { redirectUrl: INBOX_URL };
    }

    return {};
  },
  {
    urls: [`${INSTAGRAM_ORIGIN}/*`],
    types: ["main_frame"]
  },
  ["blocking"]
);
