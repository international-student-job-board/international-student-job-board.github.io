# Getting the site into Google

A temporary walkthrough. Delete this file once it's done.

---

## The blocker is fixed

Before today, every page except the homepage returned **HTTP 404**. GitHub Pages
served `404.html` — which is the app, so a person saw the site — but the response
said "not found", and Google will not index that. The sitemap listed 2,730 URLs
of which one could be indexed.

The build now writes a real file per address. Verified live:

```
/                        HTTP 200
/jobs/84820004/          HTTP 200
/jobs/84820004           HTTP 200
/companies               HTTP 200
/sitemap.xml             HTTP 200
```

2,726 job pages plus `/companies`, `/about` and `/post`, each with its own
title, meta description, canonical, Open Graph tags and `JobPosting` structured
data — and real body text a crawler reads without running any JavaScript.

None of it is visible to Google until the steps below are done.

---

## 1. Add the property

Go to **[search.google.com/search-console](https://search.google.com/search-console)**
and sign in.

Add property → choose **URL prefix** (the left box, not Domain — Domain needs
DNS records and you don't control `github.io`). Enter exactly:

```
https://international-student-job-board.github.io/
```

## 2. Verify it

Pick **HTML tag**. Google gives you a line like:

```html
<meta name="google-site-verification" content="SOME_LONG_STRING" />
```

**Paste that to Claude and it gets wired in and deployed.**

> ⚠️ It must go in `job-board/public/index.html`, **not** in `docs/`.
> `build:pages` empties `docs/` on every build, so a file dropped there vanishes
> on the next deploy and verification silently breaks. Same trap if you choose
> the HTML-file method — the file belongs in `job-board/public/`.

Wait a minute for Pages to rebuild, then click **Verify**.

## 3. Submit the sitemap

Left sidebar → **Sitemaps** → under "Add a new sitemap" type just:

```
sitemap.xml
```

Submit. It should read "Success" and eventually report ~2,730 discovered URLs.
Processing takes hours to a couple of days.

## 4. Inspect a job page

Paste a full URL into the search bar at the top of Search Console:

```
https://international-student-job-board.github.io/jobs/84820004/
```

You'll get one of two answers:

- **"URL is not on Google"** → click **Request indexing**.
- **"URL is on Google"** → it's already in.

Either way, click **View crawled page** → **Screenshot / HTML**. That shows
exactly what Google fetched, which is the direct answer to "why can't I find
it", and where a remaining problem would show up.

---

## What to expect

| | |
|---|---|
| Verification | immediate |
| Sitemap processing | a day or two |
| Indexing | **days to weeks** |

Google indexes a fraction of a large sitemap at first — it will not take all
2,726 job pages quickly. If the site is still absent tomorrow, that is normal,
not a fault.

## The thing that speeds it up

**One real inbound link.** Google's own starter guide says links are the primary
way it discovers pages, and the site currently has none. The
[My Two Rupees](https://medium.com/@milindi.beeloud/list/my-two-rupees-2311414b6960)
list is the obvious first one.
