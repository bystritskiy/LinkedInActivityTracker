# Chrome Web Store — Listing & Submission Copy

Everything below is ready to paste into the Chrome Web Store Developer Dashboard.
Version being submitted: **1.0.0**.

---

## Store listing tab

### Extension name
LinkedIn Activity Tracker

### Category
Productivity

### Language
English (add Russian as an additional language if desired)

### Short description (max 132 chars)
> Privacy-first tracker that passively logs your own LinkedIn activity. All data stays on your device. Never acts for you.

*(129 characters)*

### Detailed description
```
LinkedIn Activity Tracker turns your daily LinkedIn effort into a clear, local dashboard — without automating anything and without sending your data anywhere.

WHAT IT DOES
The extension passively observes the actions you take yourself on LinkedIn and records them for a personal daily challenge:
• Reactions
• Comments and replies
• Connection requests
• Messages you send
• Reposts and posts
• Active time on LinkedIn

It can also record aggregate numbers when you open LinkedIn's own analytics pages:
• Social Selling Index (SSI)
• Profile viewers
• Dashboard metrics: post impressions, total followers, profile viewers, search appearances, weekly posts and comments

Only aggregate numbers are stored — never individual people, viewers, or private content.

PRIVACY FIRST
• All data stays in your browser (chrome.storage.local). Nothing is uploaded.
• No backend, no account, no cloud sync, no analytics upload.
• The text of your messages, comments, and posts is never stored.
• Cookies, tokens, emails, and photos are never touched.
• Optional metadata is off by default and only recorded if you opt in.
• Fully open source — inspect the code yourself.

OBSERVE-ONLY
This extension never clicks, types, scrolls, submits forms, sends messages, or performs any action on your behalf. It only watches your own activity so you can measure it.

FEATURES
• Local dashboard with daily progress and history
• Analytics tab for SSI, profile views, and dashboard snapshots
• Daily goal tracking
• Privacy toggles for optional metadata
• Export your data as JSON, CSV, or Markdown
• Diagnostics that flag when LinkedIn changes its markup
• English and Russian UI

Not affiliated with LinkedIn. LinkedIn is a trademark of its respective owner.
```

### Homepage / support URL
https://github.com/bystritskiy/LinkedInActivityTracker

### Privacy policy URL
https://bystritskiy.github.io/LinkedInActivityTracker/

---

## Graphic assets checklist

| Asset | Spec | Required | Status |
|-------|------|----------|--------|
| Store icon | 128×128 PNG | yes | ✅ have (icon128.png) |
| Screenshots | 1280×800 or 640×400 PNG/JPEG, 1–5 | **yes, at least 1** | ⬜ need to capture |
| Small promo tile | 440×280 PNG/JPEG | no | ⬜ optional |
| Marquee promo tile | 1400×560 | no | ⬜ optional |

Suggested screenshots (from the real UI):
1. Popup showing today's activity + goal progress
2. Dashboard — daily history
3. Dashboard — Analytics tab (SSI / dashboard snapshot)
4. Privacy settings / toggles
5. Export options

---

## Privacy practices tab (Google's required disclosures)

### Single purpose (required statement)
> LinkedIn Activity Tracker has a single purpose: to passively record the user's own
> activity on LinkedIn (reactions, comments, posts, connection requests, messages, active
> time, and aggregate analytics numbers) and display it locally so the user can track a
> personal daily challenge. It does not perform any actions on the user's behalf.

### Permission justifications
- **storage** — Stores the user's activity counts, goals, and settings locally on the
  device via `chrome.storage.local`. No remote storage is used.
- **idle** — Detects when the user is active vs. away so "active time on LinkedIn" is
  measured accurately rather than counting idle minutes.
- **host permission `https://www.linkedin.com/*`** — The extension's entire function is to
  observe the user's own activity on LinkedIn. It runs only on LinkedIn and nowhere else.
- **Content script on linkedin.com** — Required to read the page and detect the actions the
  user performs, using passive event listeners and DOM observation. It never modifies
  LinkedIn or acts for the user.

### Remote code
> No remote code. All JavaScript is bundled in the package. Nothing is fetched or `eval`'d
> at runtime.

### Data usage — what to declare
Declare that the extension collects **"Website activity"** (the user's own LinkedIn
actions). Then check:
- ☑ Data is NOT sold to third parties
- ☑ Data is NOT used for purposes unrelated to the single purpose
- ☑ Data is NOT used for creditworthiness / lending
- ☑ Data is handled in accordance with the linked privacy policy

Note in the notes field (if helpful): *All collected data is stored locally on the user's
device and is never transmitted off the device.*

---

## Distribution / visibility
- Visibility: **Public**
- Regions: All regions

---

## Pre-submit checklist
- [x] Version 1.0.0 in `package.json` and `public/manifest.json`
- [x] Fresh `npm run build`
- [x] Clean upload ZIP (manifest at root, no `.DS_Store`, no sourcemaps)
- [x] `npm run typecheck` clean
- [x] `npm test` green (62 passing)
- [ ] GitHub Pages enabled → privacy policy URL live
- [ ] Screenshots captured (≥1 at 1280×800)
- [ ] $5 developer registration paid
- [ ] Listing copy pasted, privacy disclosures filled
- [ ] ZIP uploaded and submitted for review
```
