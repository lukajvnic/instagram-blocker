# Intentional Instagram

**Instagram is a messaging app and profile directory, not a feed.**

Intentional Instagram is a minimal Firefox Manifest V3 WebExtension that makes Instagram useful for:

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

## What it blocks or hides

- Home feed
- Home-page stories tray
- Explore landing page
- Reels infinite-scroll surface
- Suggested posts/accounts
- “People you may know” modules
- Recommendation sidebars
- Notification prompts/popups where detectable

## Privacy

This extension does **not** collect, store, transmit, or log user data.

The **Search accounts** fallback sends your typed search query to Instagram, the same way Instagram search does, so Instagram can return account results. The extension itself does not save or send that query anywhere else.

There are no external dependencies.

## Files

- `manifest.json` — Firefox Manifest V3 extension definition
- `background.js` — redirects plain Instagram home URLs before the feed loads
- `content.js` — DOM cleanup, SPA navigation hooks, MutationObserver
- `styles.css` — fast CSS-based hiding of broad distracting surfaces
- `README.md` — this file

## Install in Firefox temporarily

1. Open Firefox.
2. Go to `about:debugging`.
3. Click **This Firefox**.
4. Click **Load Temporary Add-on…**.
5. Select this extension’s `manifest.json` file.
6. Visit `https://www.instagram.com/`.

Firefox temporary add-ons are removed when Firefox restarts. For long-term personal use, package/sign the extension through Mozilla’s normal add-on workflow or reload it after restarting.

## Permissions

The extension requests:

- `https://www.instagram.com/*` host access only
- `webRequest` / `webRequestBlocking` so Firefox can redirect the plain home page to DMs before the feed loads

## Customization

Instagram changes its markup often. The easiest places to adjust behavior are:

- `DISTRACTING_TEXT_PATTERNS` in `content.js`
- `DISTRACTING_CONTROL_SELECTORS` in `content.js`
- broad CSS selectors in `styles.css`

The extension is intentionally conservative: it should let you open DMs, search an account, click a profile, view that profile’s posts/stories, and leave.

If Instagram does not show a Search button in your layout, use the extension’s **Search accounts** button in the Instagram sidebar, or press `Ctrl+K` / `Cmd+K`. If no sidebar is available, the button falls back to the bottom-left corner. Type a name or username, then click a result to open that profile directly.
