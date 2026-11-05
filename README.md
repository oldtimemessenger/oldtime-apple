# Oldtime Apple

Private working snapshot of Oldtime’s PWA, Cloudflare API, and Expo mobile app.
This repository is separate from the existing Oldtime repositories and does not
change production.

## Packages

- `artifacts/oldtimehive`: website and installable PWA.
- `artifacts/api-server`: Cloudflare API source and D1 migrations.
- `artifacts/oldtime-mobile`: Expo mobile app for iOS and Android.
- `lib`: shared API clients, contracts, and required app policy packages.

The snapshot excludes other artifacts, archived code, reference uploads,
production user records, secrets, generated builds, and the workspace’s Git
history.

## Local checks

Use Node.js 22+ and the pnpm version in `package.json`:

    pnpm install --frozen-lockfile
    pnpm --filter @workspace/oldtimehive run build
    pnpm --filter @workspace/api-server run typecheck
    pnpm --filter @workspace/oldtime-mobile run typecheck
    node --test artifacts/oldtime-mobile/test/*.test.mjs

PWA installation is separate from Expo or App Store distribution. App Store
signing and Apple developer credentials are not included.

## Cloudflare

Supply secrets through Cloudflare settings; never add them to source control.
Before applying a database migration, inspect the production D1 migration
journal. This repository does not enable automatic production deployment.
