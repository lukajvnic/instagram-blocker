/*
 * Minimal Intentional LinkedIn.
 *
 * Goals:
 * 1. Redirect the LinkedIn home page and /feed/ to Messaging, so the
 *    infinite scrolling post feed is never reachable.
 * 2. Hide the "Home" nav entry that leads back to the feed.
 * 3. Leave messaging, notifications, jobs, search, and profiles alone.
 */

const LINKEDIN_ORIGIN = "https://www.linkedin.com";
const MESSAGING_URL = `${LINKEDIN_ORIGIN}/messaging/`;

let cleanupQueued = false;

/**
 * True for the feed surfaces only, e.g.
 *   https://www.linkedin.com/
 *   https://www.linkedin.com/feed/
 *   https://www.linkedin.com/feed/?trk=nav
 *
 * Single post permalinks (/feed/update/...) are left alone so shared links
 * still open.
 */
function isFeedPath(pathname) {
  return pathname === "/" || pathname === "/feed" || pathname === "/feed/";
}

function isFeedPage() {
  return location.origin === LINKEDIN_ORIGIN && isFeedPath(location.pathname);
}

/** Blank the page while the redirect happens, so the feed never flashes. */
function markBlocked(blocked) {
  const root = document.documentElement;
  if (!root) return;

  if (blocked) root.setAttribute("data-ii-blocked", "true");
  else root.removeAttribute("data-ii-blocked");
}

function redirectFeedToMessaging() {
  if (!isFeedPage()) {
    markBlocked(false);
    return false;
  }

  markBlocked(true);
  location.replace(MESSAGING_URL);
  return true;
}

function isFeedLink(element) {
  const href = element.getAttribute("href") || "";
  if (!href) return false;

  let pathname;
  try {
    pathname = new URL(href, location.origin).pathname;
  } catch (_) {
    return false;
  }

  return isFeedPath(pathname);
}

function hideElement(element) {
  if (!element || element.dataset.iiHidden === "true") return;
  element.dataset.iiHidden = "true";
  element.style.setProperty("display", "none", "important");
}

/** Hide the Home nav item and any other link that points back at the feed. */
function hideFeedLinks() {
  const links = document.querySelectorAll("a[href]");
  for (const link of links) {
    if (!isFeedLink(link)) continue;

    // The branding logo is a feed link too; leave it visible but neutered by
    // the click guard below, so the top bar does not lose its layout.
    if (link.classList.contains("global-nav__branding-logo")) continue;
    if (link.closest(".global-nav__branding-logo")) continue;

    hideElement(link.closest(".global-nav__primary-item") || link);
  }
}

/** Catch client-side navigations back to the feed before they render. */
function guardFeedClicks(event) {
  const link = event.target.closest && event.target.closest("a[href]");
  if (!link || !isFeedLink(link)) return;

  event.preventDefault();
  event.stopPropagation();
  location.assign(MESSAGING_URL);
}

function cleanup() {
  if (redirectFeedToMessaging()) return;
  hideFeedLinks();
}

function scheduleCleanup() {
  if (cleanupQueued) return;
  cleanupQueued = true;
  requestAnimationFrame(() => {
    cleanupQueued = false;
    cleanup();
  });
}

function hookNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    scheduleCleanup();
    return result;
  };

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    scheduleCleanup();
    return result;
  };

  window.addEventListener("popstate", scheduleCleanup);
}

document.addEventListener("click", guardFeedClicks, true);
hookNavigation();
new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cleanup, { once: true });
}
cleanup();
