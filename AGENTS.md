# 🚨 SABER GOVERNANCE & PIPELINE POLICY (saber-fnbsupport)

## 1. Strict 3-Stage Deployment Pipeline (Zero Direct Commits to `main`)
1. Feature / fix branches (`feat/*`, `fix/*`) are branched from `staging`.
2. Push / PR merge to `staging` triggers `.github/workflows/deploy-staging.yml` (Staging deployment & verification).
3. Only after human verification on Staging may a promotion PR from `staging` -> `main` be merged, triggering `.github/workflows/deploy-production.yml`.

## 2. Pre-Flight Verification Commands
Before pushing any branch:
```bash
npx prisma validate && npx prisma generate
npm run lint
npm run build
```

## 3. Security Standards
- Never commit `.env` files. Only `.env.example` is tracked.
- Never use `-o StrictHostKeyChecking=no` in CI/CD SSH steps; load `SSH_KNOWN_HOSTS`.
- All Nginx configs enforce `server_tokens off` and security headers.

## 4. 🎨 Website Craft & Anti-AI-Slop Rules (Hallmark Design Standards)
All UI code, landing pages, and web components must adhere to Hallmark quality gates:
1. **No Eyebrow Labels / Tracked-Caps Tags**: No `[ CATEGORY ]` uppercase tags above headings. Let headings lead cleanly.
2. **No Accented Single Words in Headings**: Headlines must remain consistent in weight, style, and color. Never highlight or color a single word.
3. **No Purple-to-Blue Gradients or Glow Halos**: Clean, solid surfaces and intentional palette contrast; no floating blurred mesh blobs.
4. **No Cards-Inside-Cards**: Strictly 1 containment layer. Separate with hairlines (`border-t`), whitespace, or wells.
5. **No Template Punctuation**: No glued arrows (`Learn more →`), excessive middle-dots (`A · B · C`), or fake status dots.
6. **No Invented Metrics / Testimonials**: Only real verified user data; no fake `"10,000+ happy clients"` claims.
7. **Hero Fold Discipline**: Headline (≤7 words), subhead (≤12 words), and primary action visible at 1280x800 without scrolling. Word budget ~80 words per screen view.
8. **Real Product Material**: Authentic UI previews and verified assets over generic illustrations or placeholder washes.
9. **Accessible Motion & Interaction**: `transition: transform, opacity` only; instant `:focus-visible`; `prefers-reduced-motion` fallbacks; tap targets ≥44px.


