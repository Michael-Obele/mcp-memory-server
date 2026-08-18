# Fly.io entry point — installs workspace deps (SvelteKit never enters the
# image). NOTE: Bun validates the ENTIRE workspace graph against the lockfile,
# so all workspace package.jsons must be copied before install (documented Bun
# gotcha — see plan/notes.md).
#
# IMPORTANT: do NOT use `bun install --filter memory-server` here — the root
# workspace's own deps (tmcp, etc.) are NOT installed by --filter (it only
# matches workspace members), so the server fails with "Cannot find package
# 'tmcp'". A plain install is required.

FROM oven/bun:1-slim

WORKDIR /app

# 1) Workspace manifests + lockfile first → Docker layer caching.
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY dashboard/package.json dashboard/

# 2) Install all workspace deps (filtered installs skip the root's own deps).
RUN bun install --frozen-lockfile

# 3) Source — .dockerignore keeps node_modules, dashboard/build, .git out.
COPY . .

# The dashboard is NOT built here — it deploys to Netlify (see plan/dashboard.md).

EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
