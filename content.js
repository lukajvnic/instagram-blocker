/*
 * Minimal Intentional Instagram for Chrome.
 *
 * Goals:
 * 1. Redirect instagram.com home to Direct Messages.
 * 2. In the Instagram sidebar, keep only Messages, Notifications, and an
 *    account-only Search button.
 * 3. Do not touch DM conversations or profile pages.
 */

const INSTAGRAM_ORIGIN = "https://www.instagram.com";
const INBOX_URL = `${INSTAGRAM_ORIGIN}/direct/inbox/`;

const SEARCH_BUTTON_ID = "ii-account-search-button";
const SEARCH_OVERLAY_ID = "ii-account-search-overlay";
const SEARCH_INPUT_ID = "ii-account-search-input";
const SEARCH_RESULTS_ID = "ii-account-search-results";

let searchDebounceTimer = null;
let searchAbortController = null;
let cleanupQueued = false;

function isInstagramHome() {
  return location.origin === INSTAGRAM_ORIGIN && location.pathname === "/";
}

function redirectHomeToInbox() {
  if (isInstagramHome()) location.replace(INBOX_URL);
}

function isMessagesControl(element) {
  const href = element.getAttribute("href") || "";
  const label = element.getAttribute("aria-label") || element.textContent || "";
  return href.startsWith("/direct") || /messages?|messenger|direct/i.test(label);
}

function isNotificationsControl(element) {
  const label = element.getAttribute("aria-label") || element.textContent || "";
  return /notifications?/i.test(label);
}

function shouldKeepSidebarControl(element) {
  if (element.id === SEARCH_BUTTON_ID || element.closest(`#${SEARCH_BUTTON_ID}`)) return true;
  return isMessagesControl(element) || isNotificationsControl(element);
}

function hideElement(element) {
  if (!element || element.dataset.iiHidden === "true") return;
  element.dataset.iiHidden = "true";
  element.style.setProperty("display", "none", "important");
}

function unhideElement(element) {
  if (!element || element.dataset.iiHidden !== "true") return;
  delete element.dataset.iiHidden;
  element.style.removeProperty("display");
}

function findSidebarNav() {
  const navs = Array.from(document.querySelectorAll("nav"));
  return navs.find((nav) => nav.querySelector('a[href^="/direct"]')) || navs[0] || null;
}

function hideSidebarButtons() {
  const nav = findSidebarNav();
  if (!nav) return;

  const controls = nav.querySelectorAll('a, button, [role="button"], [role="link"]');
  for (const control of controls) {
    if (control.closest(`#${SEARCH_OVERLAY_ID}`)) continue;

    if (shouldKeepSidebarControl(control)) {
      unhideElement(control);
      continue;
    }

    hideElement(control);
  }
}

function createSearchButton() {
  let button = document.getElementById(SEARCH_BUTTON_ID);
  if (button) return button;

  button = document.createElement("button");
  button.id = SEARCH_BUTTON_ID;
  button.type = "button";
  button.textContent = "Search accounts";
  button.setAttribute("aria-label", "Search Instagram accounts");
  button.addEventListener("click", openSearchOverlay);
  return button;
}

function installSearchButton() {
  if (!document.body) return;

  const button = createSearchButton();
  const nav = findSidebarNav();

  if (nav) {
    button.dataset.iiPlacement = "sidebar";
    if (button.parentElement !== nav) nav.appendChild(button);
  } else {
    button.dataset.iiPlacement = "floating";
    if (button.parentElement !== document.body) document.body.appendChild(button);
  }

  unhideElement(button);
}

function openSearchOverlay() {
  let overlay = document.getElementById(SEARCH_OVERLAY_ID);
  if (!overlay) {
    overlay = buildSearchOverlay();
    document.body.appendChild(overlay);
  }

  overlay.hidden = false;
  const input = document.getElementById(SEARCH_INPUT_ID);
  if (input) {
    input.focus();
    input.select();
  }
}

function closeSearchOverlay() {
  const overlay = document.getElementById(SEARCH_OVERLAY_ID);
  if (overlay) overlay.hidden = true;

  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }
}

function buildSearchOverlay() {
  const overlay = document.createElement("div");
  overlay.id = SEARCH_OVERLAY_ID;
  overlay.hidden = true;

  const panel = document.createElement("div");
  panel.className = "ii-account-search-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Search Instagram accounts");

  const header = document.createElement("div");
  header.className = "ii-account-search-header";

  const title = document.createElement("strong");
  title.textContent = "Search accounts";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close search");
  close.addEventListener("click", closeSearchOverlay);

  header.append(title, close);

  const input = document.createElement("input");
  input.id = SEARCH_INPUT_ID;
  input.type = "search";
  input.placeholder = "Name or username";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => scheduleAccountSearch(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSearchOverlay();
  });

  const results = document.createElement("div");
  results.id = SEARCH_RESULTS_ID;
  results.textContent = "Type to search accounts.";

  panel.append(header, input, results);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeSearchOverlay();
  });

  return overlay;
}

function scheduleAccountSearch(query) {
  clearTimeout(searchDebounceTimer);

  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }

  const results = document.getElementById(SEARCH_RESULTS_ID);
  if (!results) return;

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    results.textContent = "Type at least 2 characters.";
    return;
  }

  results.textContent = "Searching…";
  searchDebounceTimer = window.setTimeout(() => searchAccounts(trimmed), 250);
}

async function searchAccounts(query) {
  const results = document.getElementById(SEARCH_RESULTS_ID);
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
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    if (!response.ok) throw new Error("Search failed");
    const data = await response.json();
    renderResults(data.users || []);
  } catch (error) {
    if (error.name !== "AbortError") results.textContent = "Search failed.";
  } finally {
    searchAbortController = null;
  }
}

function renderResults(users) {
  const results = document.getElementById(SEARCH_RESULTS_ID);
  if (!results) return;

  results.textContent = "";

  if (!users.length) {
    results.textContent = "No accounts found.";
    return;
  }

  for (const entry of users.slice(0, 12)) {
    const user = entry.user || entry;
    if (!user.username) continue;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "ii-account-search-result";
    item.addEventListener("click", () => {
      closeSearchOverlay();
      location.assign(`${INSTAGRAM_ORIGIN}/${encodeURIComponent(user.username)}/`);
    });

    const text = document.createElement("span");
    const username = document.createElement("strong");
    username.textContent = `@${user.username}`;
    const name = document.createElement("span");
    name.textContent = user.full_name || "";
    text.append(username, name);

    item.appendChild(text);
    results.appendChild(item);
  }
}

function cleanup() {
  redirectHomeToInbox();
  installSearchButton();
  hideSidebarButtons();
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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSearchOverlay();
});

hookNavigation();
new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cleanup, { once: true });
}
cleanup();
