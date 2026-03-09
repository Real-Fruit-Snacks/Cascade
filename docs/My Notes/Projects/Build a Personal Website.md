---
status: in-progress
priority: high
due: 2026-04-15
tags: [project, coding]
---

# Build a Personal Website

#project #coding

## Overview

A portfolio site to showcase my work, writing, and open-source contributions. The goal is something clean and fast — no bloated frameworks, just React with Tailwind and a static-site mindset. Doubles as a landing page for recruiters and a home for my writing.

Related: [[Career Development]] | [[Git Commands]] | [[The Pragmatic Programmer]]

---

## Goals

- Establish a professional online presence before the April job search push
- Host blog posts migrated from my notes (see [[Writing]])
- Showcase projects: this app, the Rust exercises from [[Learn Rust]], side scripts
- Score 90+ on Lighthouse performance, accessibility, and SEO

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React 19 | Already fluent, component model fits |
| Styling | Tailwind CSS | Utility-first, no CSS file sprawl |
| Hosting | Vercel | Free tier, instant deploys from GitHub |
| CMS | MDX files in repo | Keep it simple, version-controlled |
| Analytics | Plausible | Privacy-friendly, no cookie banner needed |

The basic HTML shell before React hydrates:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Matt's portfolio — developer & writer" />
    <title>Matt | Developer</title>
    <link rel="stylesheet" href="/styles/globals.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Tasks

### Setup
- [x] Buy domain (mattdev.io)
- [x] Initialize repo with Vite + React + Tailwind
- [x] Configure Vercel deployment pipeline
- [x] Set up ESLint + Prettier

### Design
- [x] Sketch wireframes for landing, projects, and blog pages
- [ ] Finalize color palette and typography (leaning Catppuccin Latte-inspired)
- [ ] Design system: buttons, cards, code blocks

### Development
- [ ] Build navigation component with mobile hamburger menu
- [ ] Landing page hero section with animated tagline
- [ ] Projects grid pulling from a local JSON manifest
- [ ] Blog index page with MDX post rendering
- [ ] Contact form (Formspree backend)
- [ ] Dark / light mode toggle

### Content
- [ ] Write "About" page copy
- [ ] Port 3 notes from vault as first blog posts
- [ ] Add 5 project entries with screenshots

### Launch
- [ ] Accessibility audit (axe DevTools)
- [ ] Performance pass — lazy load images, check bundle size
- [ ] Submit sitemap to Google Search Console

---

## Resources

- [[The Pragmatic Programmer]] — mindset for clean, maintainable code
- [[Git Commands]] — deployment and branch workflow reference
- [[Career Development]] — context for why this matters right now
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [MDX Official Site](https://mdxjs.com)
