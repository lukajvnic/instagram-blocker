/*
 * Intentional Instagram content script.
 *
 * Instagram is a dynamic React app: navigation often happens without a full page
 * load, and feed/recommendation modules are mounted after the initial DOM is
 * ready. This script therefore:
 *   1. redirects home/explore/reels surfaces away from passive browsing,
 *   2. injects page-state attributes used by styles.css,
 *   3. repeatedly removes recommendation/prompt modules as they appear,
 *   4. hooks History API navigation so SPA URL changes are noticed.
 *
 * Privacy: no user data is collected, stored, sent, or logged.
 */

const INBOX_URL = "https://www.instagram.com/direct/inbox/";
const INSTAGRAM_RESERVED_TOP_LEVEL_PATHS = new Set([
  "about",
  "accounts",
  "api",
  "challenge",
  "developer",
  "direct",
  "emails",
  "explore",
  "legal",
  "oauth",
  "p",
  "reel",
  "reels",
  "stories",
  "tv"
]);

// Text fragments commonly used by Instagram for recommendations and prompts.
// Keep these easy to edit: Instagram changes its DOM and wording often.
const DISTRACTING_TEXT_PATTERNS = [
  /suggested\s+for\s+you/i,
  /suggested\s+accounts?/i,
  /people\s+you\s+may\s+know/i,
  /because\s+you\s+follow/i,
  /recommended/i,
  /popular\s+near\s+you/i,
  /discover\s+people/i,
  /find\s+people\s+to\s+follow/i,
  /similar\s+accounts/i,
  /turn\s+on\s+notifications/i,
  /allow\s+instagram\s+notifications/i,
  /get\s+notifications/i,
  /enable\s+notifications/i,
  /add\s+instagram\s+to\s+your\s+home\s+screen/i
];

// Obvious UI entry points into passive browsing. We hide the containing link or
// button, not the whole navigation bar, so DMs and Search remain usable.
const DISTRACTING_CONTROL_SELECTORS = [
  'a[href="/"]',
  'a[href="/explore/"]',
  'a[href^="/explore/people/"]',
  'a[href^="/reels/"]',
  '[aria-label="Home"]',
  '[aria-label="Explore"]',
  '[aria-label="Reels"]',
  '[aria-label="Notifications"]'
];

function pathSegments() {
  return location.pathname.split("/").filter(Boolean);
}

function isHomePage() {
  return location.origin === "https://www.instagram.com" && location.pathname === "/";
}

function isDirectPage() {
  return location.pathname.startsWith("/direct/inbox") || location.pathname.startsWith("/direct/t/");
}

function isExplorePage() {
  // Keep /explore/search/ available for intentional account lookup.
  return location.pathname === "/explore" || location.pathname === "/explore/";
}

function isReelsPage() {
  // Block the infinite Reels surface (/reels/), but do not block individual
  // /reel/<code>/ pages because they may be opened intentionally from a profile.
  return location.pathname === "/reels" || location.pathname.startsWith("/reels/");
}

function isProfilePage() {
  const segments = pathSegments();
  if (segments.length !== 1) return false;

  const username = segments[0];
  if (INSTAGRAM_RESERVED_TOP_LEVEL_PATHS.has(username.toLowerCase())) return false;

  return /^[A-Za-z0-9._]+$/.test(username);
}

function redirectHomeToInbox() {
  if (isHomePage()) {
    location.replace(INBOX_URL);
  }
}

function redirectPassiveSurfaces() {
  // Home is also handled by the background script, but this catches client-side
  // React navigation to / without a full page load.
  if (isHomePage() || isExplorePage() || isReelsPage()) {
    location.replace(INBOX_URL);
  }
}

function currentPageKind() {
  if (isDirectPage()) return "direct";
  if (isHomePage()) return "home";
  if (isExplorePage()) return "explore";
  if (isReelsPage()) return "reels";
  if (isProfilePage()) return "profile";
  if (location.pathname.startsWith("/stories/")) return "story";
  if (location.pathname.startsWith("/p/") || location.pathname.startsWith("/reel/")) return "post";
  return "other";
}

function markPageKind() {
  const kind = currentPageKind();
  document.documentElement.dataset.iiPage = kind;
  if (document.body) document.body.dataset.iiPage = kind;
}

function hideElement(element) {
  if (!element || element.dataset.iiHidden === "true") return;
  element.dataset.iiHidden = "true";
  element.style.setProperty("display", "none", "important");
}

function nearestClickableOrNavItem(element) {
  return element.closest('a, button, [role="button"], [role="link"]') || element;
}

function hidePassiveNavigationControls() {
  for (const selector of DISTRACTING_CONTROL_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      hideElement(nearestClickableOrNavItem(element));
    }
  }
}

function removeHomeFeedShells() {
  if (!isHomePage() && !isExplorePage() && !isReelsPage()) return;

  // These pages are redirected away from, but hide visible feed UI immediately
  // during the short interval before the redirect completes.
  for (const element of document.querySelectorAll('main article, main [role="feed"], main section')) {
    hideElement(element);
  }
}

function containsDistractingText(element) {
  const text = element.innerText || element.textContent || "";
  if (!text || text.length > 3000) return false;
  return DISTRACTING_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function chooseRemovalRoot(element) {
  // Notification prompts and app-install nags usually live in dialogs.
  const dialog = element.closest('[role="dialog"], [aria-modal="true"]');
  if (dialog) return dialog;

  // Sidebars commonly contain suggested accounts. Avoid touching DMs.
  const aside = element.closest("aside");
  if (aside && !isDirectPage()) return aside;

  // Recommendation modules are usually articles/sections or compact div cards.
  const semantic = element.closest("article, section");
  if (semantic) return semantic;

  // Conservative fallback: climb a few levels but stop before hiding <main>,
  // <body>, navigation, or very large containers that could contain Search/DMs.
  let current = element;
  for (let depth = 0; depth < 5 && current && current.parentElement; depth += 1) {
    const parent = current.parentElement;
    const tag = parent.tagName.toLowerCase();
    if (["main", "body", "html", "nav"].includes(tag)) break;

    const text = parent.innerText || parent.textContent || "";
    if (text.length > 0 && text.length < 1500) current = parent;
    else break;
  }

  return current;
}

function removeTextBasedDistractions() {
  // DMs should be left alone. We only hide nav controls and obvious prompts on
  // Direct pages to avoid accidentally affecting conversation content.
  const direct = isDirectPage();
  const candidates = document.querySelectorAll('span, div, section, article, aside, [role="dialog"]');

  for (const element of candidates) {
    if (element.dataset.iiHidden === "true") continue;
    if (!containsDistractingText(element)) continue;

    const root = chooseRemovalRoot(element);
    if (!root) continue;

    if (direct && !root.matches('[role="dialog"], [aria-modal="true"]')) continue;
    hideElement(root);
  }
}

const INTENTIONAL_SEARCH_BUTTON_ID = "intentional-instagram-search-button";
const INTENTIONAL_SEARCH_OVERLAY_ID = "intentional-instagram-search-overlay";
const INTENTIONAL_SEARCH_INPUT_ID = "intentional-instagram-search-input";
const INTENTIONAL_SEARCH_RESULTS_ID = "intentional-instagram-search-results";

let searchDebounceTimer = null;
let searchAbortController = null;

function findInstagramSidebar() {
  // Desktop Instagram usually has a left <nav> containing the Direct link.
  // We prefer that over generic navs so we do not accidentally inject into a
  // mobile bottom bar or unrelated dialog navigation.
  const navs = Array.from(document.querySelectorAll("nav"));

  return navs.find((nav) => {
    const hasDirectLink = nav.querySelector('a[href^="/direct/"]');
    const rect = nav.getBoundingClientRect();
    const looksLikeSidebar = rect.width === 0 || rect.height >= rect.width;
    return hasDirectLink && looksLikeSidebar;
  }) || null;
}

function createIntentionalSearchButton() {
  let button = document.getElementById(INTENTIONAL_SEARCH_BUTTON_ID);
  if (button) return button;

  button = document.createElement("button");
  button.id = INTENTIONAL_SEARCH_BUTTON_ID;
  button.type = "button";
  button.innerHTML = '<span aria-hidden="true">🔎</span><span>Search accounts</span>';
  button.title = "Search Instagram accounts intentionally";
  button.setAttribute("aria-label", "Intentional Instagram account search");
  button.addEventListener("click", openIntentionalSearch);

  return button;
}

function createIntentionalSearchUI() {
  // Some Instagram layouts hide Search while Direct is open. To keep normal
  // account search reliable, provide an extension-owned search box that uses
  // Instagram's own web search endpoint and renders account results only.
  // The extension does not store or log queries/results.
  if (!document.body) return;

  const button = createIntentionalSearchButton();
  const sidebar = findInstagramSidebar();

  if (sidebar) {
    button.dataset.iiPlacement = "sidebar";
    if (button.parentElement !== sidebar) sidebar.appendChild(button);
  } else {
    button.dataset.iiPlacement = "floating";
    if (button.parentElement !== document.body) document.body.appendChild(button);
  }
}

function openIntentionalSearch() {
  let overlay = document.getElementById(INTENTIONAL_SEARCH_OVERLAY_ID);

  if (!overlay) {
    overlay = buildIntentionalSearchOverlay();
    document.body.appendChild(overlay);
  }

  overlay.hidden = false;

  const input = document.getElementById(INTENTIONAL_SEARCH_INPUT_ID);
  if (input) {
    input.focus();
    input.select();
  }
}

function closeIntentionalSearch() {
  const overlay = document.getElementById(INTENTIONAL_SEARCH_OVERLAY_ID);
  if (overlay) overlay.hidden = true;

  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }
}

function buildIntentionalSearchOverlay() {
  const overlay = document.createElement("div");
  overlay.id = INTENTIONAL_SEARCH_OVERLAY_ID;
  overlay.hidden = true;

  const panel = document.createElement("div");
  panel.className = "intentional-instagram-search-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Search Instagram accounts");

  const header = document.createElement("div");
  header.className = "intentional-instagram-search-header";

  const title = document.createElement("strong");
  title.textContent = "Search accounts";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close account search");
  closeButton.addEventListener("click", closeIntentionalSearch);

  header.append(title, closeButton);

  const input = document.createElement("input");
  input.id = INTENTIONAL_SEARCH_INPUT_ID;
  input.type = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Search by name or username";
  input.setAttribute("aria-label", "Search by name or username");
  input.addEventListener("input", () => scheduleAccountSearch(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeIntentionalSearch();
  });

  const help = document.createElement("p");
  help.className = "intentional-instagram-search-help";
  help.textContent = "Results come from Instagram search. Click a person to open their profile.";

  const results = document.createElement("div");
  results.id = INTENTIONAL_SEARCH_RESULTS_ID;
  results.setAttribute("role", "listbox");
  results.textContent = "Type to search.";

  panel.append(header, input, help, results);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeIntentionalSearch();
  });

  return overlay;
}

function scheduleAccountSearch(query) {
  clearTimeout(searchDebounceTimer);

  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }

  const trimmedQuery = query.trim();
  const results = document.getElementById(INTENTIONAL_SEARCH_RESULTS_ID);

  if (!results) return;
  if (trimmedQuery.length < 2) {
    results.textContent = "Type at least 2 characters to search.";
    return;
  }

  results.textContent = "Searching…";
  searchDebounceTimer = window.setTimeout(() => searchAccounts(trimmedQuery), 250);
}

async function searchAccounts(query) {
  const results = document.getElementById(INTENTIONAL_SEARCH_RESULTS_ID);
  if (!results) return;

  searchAbortController = new AbortController();

  try {
    const endpoint = new URL("/web/search/topsearch/", location.origin);
    endpoint.searchParams.set("context", "blended");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("include_reel", "false");
    endpoint.searchParams.set("search_surface", "web_top_search");

    const response = await fetch(endpoint.toString(), {
      credentials: "include",
      signal: searchAbortController.signal,
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) throw new Error("Instagram search request failed");

    const data = await response.json();
    renderAccountSearchResults(data.users || []);
  } catch (error) {
    if (error.name === "AbortError") return;
    results.textContent = "Search failed. Try again, or use Instagram's own Search if it appears.";
  } finally {
    searchAbortController = null;
  }
}

function normalizeInstagramImageUrl(url) {
  return String(url || "")
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replace(/^\/\//, "https://");
}

function renderAccountSearchResults(users) {
  const results = document.getElementById(INTENTIONAL_SEARCH_RESULTS_ID);
  if (!results) return;

  results.textContent = "";

  if (!users.length) {
    results.textContent = "No account results.";
    return;
  }

  for (const entry of users.slice(0, 10)) {
    const user = entry.user || entry;
    if (!user || !user.username) continue;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "intentional-instagram-search-result";
    item.setAttribute("role", "option");
    item.addEventListener("click", () => {
      closeIntentionalSearch();
      location.assign(`https://www.instagram.com/${encodeURIComponent(user.username)}/`);
    });

    const profilePicUrl = normalizeInstagramImageUrl(user.profile_pic_url || user.profile_pic_url_hd);
    if (profilePicUrl) {
      const avatar = document.createElement("img");
      avatar.src = profilePicUrl;
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.referrerPolicy = "origin";
      avatar.addEventListener("error", () => {
        // Instagram's CDN sometimes rejects no-referrer image loads or expires
        // thumbnail URLs. If a picture fails, keep the result usable and show a
        // simple initial instead of a broken-image icon.
        avatar.replaceWith(createAvatarFallback(user.username));
      }, { once: true });
      item.appendChild(avatar);
    } else {
      item.appendChild(createAvatarFallback(user.username));
    }

    const text = document.createElement("span");
    text.className = "intentional-instagram-search-result-text";

    const username = document.createElement("strong");
    username.textContent = `@${user.username}`;

    const fullName = document.createElement("span");
    fullName.textContent = user.full_name || "";

    text.append(username, fullName);
    item.appendChild(text);
    results.appendChild(item);
  }
}

function createAvatarFallback(username) {
  const fallback = document.createElement("span");
  fallback.className = "intentional-instagram-avatar-fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.textContent = (username || "?").slice(0, 1).toUpperCase();
  return fallback;
}

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openIntentionalSearch();
  }

  if (event.key === "Escape") closeIntentionalSearch();
});

function removeDistractingElements() {
  markPageKind();
  createIntentionalSearchUI();
  redirectHomeToInbox();
  redirectPassiveSurfaces();
  hidePassiveNavigationControls();
  removeHomeFeedShells();
  removeTextBasedDistractions();
}

let cleanupQueued = false;
function scheduleCleanup() {
  if (cleanupQueued) return;
  cleanupQueued = true;

  requestAnimationFrame(() => {
    cleanupQueued = false;
    removeDistractingElements();
  });
}

function observeDOM() {
  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function hookHistoryNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  function emitUrlChange() {
    window.dispatchEvent(new Event("intentional-instagram:urlchange"));
  }

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    emitUrlChange();
    return result;
  };

  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    emitUrlChange();
    return result;
  };

  window.addEventListener("popstate", emitUrlChange);
  window.addEventListener("intentional-instagram:urlchange", scheduleCleanup);
}

hookHistoryNavigation();
observeDOM();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", removeDistractingElements, { once: true });
}

removeDistractingElements();
