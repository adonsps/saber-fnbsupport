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

