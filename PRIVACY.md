# Privacy Policy — What if CGPA for NSUers

**Last updated: November 18, 2026** (version 2.6.0)

What if CGPA for NSUers ("the extension") is a browser extension built for North South University (NSU) students to analyze and simulate their CGPA, keep a quick-glance widget for their routine and attendance, and optionally use a customizable new-tab dashboard. This policy explains what data the extension accesses, stores, and shares, and it applies to every feature the extension ships — not just the grade analyzer.

## 1. Information We Access From the NSU Portal

The extension's content scripts run only on two pages of the official NSU RDS3 portal, both of which require you to already be logged in:

- `rds3.northsouth.edu/students/grade_history` — reads the grade table already rendered on that page (course codes, titles, credits, grades, and your student ID as displayed).
- `rds3.northsouth.edu/students/landing` — the RDS3 home page, where the Mini-RDS3 widget and the "Analyze CGPA" button appear.

To build its views, the extension also loads a few other RDS3 pages in the background, using your existing logged-in session (the same pages you could open yourself):

- your **Grade History** page, when you open the CGPA planner from the RDS3 home page;
- your **attendance pages** (registered courses, class times, rooms, and per-course attendance), for the Mini-RDS3 widget;
- the **faculty evaluation page** and the RDS3 home page, only to work out which semester is current.

These requests go only to `rds3.northsouth.edu`. The extension does not access your login credentials, password, or anything from the login flow itself, and it does not run on, or read data from, any other website.

## 2. Information We Store On Your Device

All of the data below is stored using Chrome's `chrome.storage.local` API, which keeps it **only on your own device, inside your own browser profile**. None of it is synced to a cloud account, and none of it is accessible to the developer or any third party except where Section 3 says otherwise.

- **What-if grade edits, excluded courses, and planned semesters** (Edit Grades / Plan Ahead), keyed to your student ID so that if multiple students share a computer, each only sees their own saved plan.
- **A local snapshot of your grades, attendance, and routine**, mirrored from the pages in Section 1, used to populate the CGPA journey, attendance, and routine widgets on the new-tab dashboard.
- **New-tab dashboard preferences and content**, if you use it: color theme, wallpaper settings (chosen wallpaper, shuffle categories and frequency, a custom image URL if you provide one, and text color), clock style, search bar style, section layout/order, saved favorite links, to-do list and weekly to-do items, and focus-timer state.
- **Small interface preferences**, such as whether the planner's chart is collapsed and which tab of the toolbar popup you viewed last.

Uninstalling the extension, or clearing your browser's site data for the extension, permanently deletes all of this.

## 3. Anonymous Usage Analytics

The extension sends anonymous product-usage events to **Google Analytics (GA4)** using a write-only Measurement Protocol key that can only send data, not read it back.

- Each install generates a **random identifier** (not your name, student ID, or NSU account) stored locally via `chrome.storage.local`, used only to group your own events together.
- Events describe feature usage — for example, which tab or panel you opened, which theme, wallpaper, or wallpaper categories you picked, whether a to-do item was added, or that a hypothetical "what-if" grade was edited (the letter grade you tested, not your real transcript grade or course name).
- A few events include a short label: the name of a built-in quick link you click, the **title you gave a favorite link** when you click it, which help question you opened in the popup, or the honors level (e.g. "Magna Cum Laude") that a **what-if projection** reached — never your actual CGPA. Generic, truncated error messages may also be sent to help us catch bugs.
- These events are never combined with the grade, attendance, or routine data described in Section 2, and never include your name, student ID, password, or NSU account details.
- Google's handling of this data is governed by the [Google Privacy Policy](https://policies.google.com/privacy).

## 4. Other Network Requests

Beyond the analytics events above, the extension makes a small number of other requests that are standard for any web page and do not involve us:

- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) are loaded to render text on the new-tab page.
- **Link icons** for the quick links and your favorite links on the new-tab page are loaded from Google's favicon service (`www.google.com/s2/favicons`), which receives the website's domain name (for example `youtube.com`) in order to return its icon.
- If you enable **photo backgrounds** (wallpapers) on the new-tab page, a background image is loaded either from our built-in preset list (hosted on Unsplash, `images.unsplash.com`) or from a URL you supply yourself. Loading any such image exposes your IP address and browser user agent to that image host, the same as visiting any web page that embeds a remote image — we do not see or store this traffic.
- If you use the optional new-tab **search bar**, your query is sent directly to Chrome's built-in Search API (`chrome.search`), which forwards it to whichever search engine you have set as your Chrome default. We never see or store your search queries.

## 5. Information We Do NOT Collect

We do not collect your login credentials, password, real name, email address, financial information, or health information. We do not use tracking pixels, session-replay tools, or third-party advertising SDKs. We do not know your actual grades, attendance percentage, or routine unless you choose to view them yourself in the extension — that data never leaves your device except as described in Sections 3 and 4.

## 6. Data Sharing

We do not sell, rent, or disclose any user data to advertisers or data brokers. The only party we share data with is Google: the anonymous analytics events described in Section 3, and the website domains sent to its favicon service for link icons (Section 4) — never the grade, attendance, routine, or what-if planning data described in Section 2, which stays on your device.

## 7. Data Retention and Your Controls

- Data described in Section 2 stays on your device until you delete it in-extension, uninstall the extension, or clear the extension's site data in Chrome.
- The random analytics identifier described in Section 3 is reset if you uninstall the extension or clear its storage.
- You can turn off wallpapers, hide sections such as Quick Links and Favorite Links, or switch the new tab to minimal mode at any time from the Customize panel, which stops the related network requests in Section 4.
- Links in the extension (for example to RDS3, Canvas, NSUmate, or the developer's LinkedIn) are ordinary links: nothing is sent to those sites unless you click one.

## 8. Permissions

The extension requests:

- `storage` — to save your what-if plan and new-tab preferences locally, as described in Section 2.
- `search` — to send new-tab search-bar queries to your Chrome default search engine via the Chrome Search API, as described in Section 4.
- Content scripts limited to two pages under `rds3.northsouth.edu` (`/students/grade_history` and `/students/landing`) — to show the CGPA planner and Mini-RDS3 widget described in Section 1. The background page loads described there stay on `rds3.northsouth.edu`.
- A new-tab page override (`chrome_url_overrides`) — to show the optional dashboard described in Section 2.

It requests no other permissions.

## 9. Children's Privacy

This extension is intended for use by university students and is not directed at children under 13. We do not knowingly collect information from children, and the data described above is either kept on-device or limited to the anonymous, non-identifying analytics events described in Section 3.

## 10. Changes to This Policy

If this policy changes, the updated version will be posted in this extension's GitHub repository and reflected in an updated "Last updated" date above.

## 11. Contact

Questions about this policy can be raised via the extension's GitHub repository issue tracker.
