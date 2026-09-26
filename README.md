# Intentional Instagram

**Instagram and LinkedIn are messaging apps and profile directories, not feeds.**

Intentional Instagram is a minimal Chrome Manifest V3 extension that makes Instagram useful for:

1. Direct messages
2. Intentional profile lookup
3. Viewing a specific person’s posts/stories from their profile

It tries to remove or redirect away from feed, Explore, Reels, suggested accounts, notification nags, and other passive-consumption surfaces without blocking Instagram entirely.

## What it does

- Redirects plain `https://www.instagram.com/` home visits to:
  `https://www.instagram.com/direct/inbox/`
- Keeps Direct Messages usable:
  - `/direct/inbox/`
  - `/direct/t/...`
- Keeps profile pages usable:
  - `/username/`
- Keeps profile posts and intentionally opened stories usable.
- Keeps Instagram search UI available for looking up a specific account when Instagram exposes it.
- Adds a small **Search accounts** button as a reliable fallback. It searches by name or username using Instagram’s own web search and shows account results only.
- Hides obvious links/buttons for Home, Explore, Reels, and Notifications.
- Re-applies cleanup after Instagram client-side navigation and DOM changes.

### LinkedIn

- Redirects `https://www.linkedin.com/` and `https://www.linkedin.com/feed/` to:
  `https://www.linkedin.com/messaging/`
- Blanks the page during the redirect so no feed posts flash on screen.
- Hides the **Home** nav item and any other link pointing back at the feed.
- Intercepts clicks on feed links (including the LinkedIn logo) and sends them to Messaging.
- Leaves messaging, notifications, jobs, search, profiles, and `/feed/update/...` post permalinks alone.

## What it blocks or hides

- Home feed
- Home-page stories tray
- Explore landing page
- Reels infinite-scroll surface
- Suggested posts/accounts
- “People you may know” modules
- Recommendation sidebars
- Notification prompts/popups where detectable
- LinkedIn's infinite-scrolling home feed

## Privacy

This extension does **not** collect, store, transmit, or log user data.

The **Search accounts** fallback sends your typed search query to Instagram, the same way Instagram search does, so Instagram can return account results. The extension itself does not save or send that query anywhere else.

There are no external dependencies.

## Files

- `manifest.json` — Chrome Manifest V3 extension definition
- `rules.json` — Declarative Net Request rules that redirect Instagram home and LinkedIn home/feed URLs before the feed loads
- `content.js` — Instagram DOM cleanup, SPA navigation hooks, MutationObserver
- `styles.css` — fast CSS-based hiding of broad distracting Instagram surfaces
- `linkedin.js` — LinkedIn feed redirect, feed-link hiding, click guard
- `linkedin.css` — blanks the LinkedIn feed page during redirect
- `README.md` — this file

## Install in Chrome temporarily

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this extension folder.
6. Visit `https://www.instagram.com/` or `https://www.linkedin.com/`.

## Permissions

The extension requests:

- `https://www.instagram.com/*` and `https://www.linkedin.com/*` host access only
- `declarativeNetRequest` so Chrome can redirect the plain home pages to DMs / Messaging before the feed loads

## Customization

Instagram changes its markup often. The easiest places to adjust behavior are:

- `DISTRACTING_TEXT_PATTERNS` in `content.js`
- `DISTRACTING_CONTROL_SELECTORS` in `content.js`
- broad CSS selectors in `styles.css`
- `MESSAGING_URL` in `linkedin.js` and `rules.json`, if you would rather land on `/mynetwork/` or `/jobs/` than LinkedIn Messaging

The extension is intentionally conservative: it should let you open DMs, search an account, click a profile, view that profile’s posts/stories, and leave.

If Instagram does not show a Search button in your layout, use the extension’s **Search accounts** button in the Instagram sidebar, or press `Ctrl+K` / `Cmd+K`. If no sidebar is available, the button falls back to the bottom-left corner. Type a name or username, then click a result to open that profile directly.
