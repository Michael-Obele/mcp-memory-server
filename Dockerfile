# Fly.io entry point — installs ONLY the server's deps (SvelteKit never
# enters the image). NOTE: Bun validates the ENTIRE workspace graph against
# the lockfile, so all workspace package.jsons must be copied before install
# (documented Bun gotcha — see plan/notes.md).

FROM oven/bun:1-slim

WORKDIR /app

# 1) Workspace manifests + lockfile first → Docker layer caching.
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY dashboard/package.json dashboard/

# 2) Install ONLY the server's deps.
RUN bun install --frozen-lockfile --filter memory-server

# 3) Source — .dockerignore keeps node_modules, dashboard/build, .git out.
COPY . .

# The dashboard is NOT built here — it deploys to Netlify (see plan/dashboard.md).

EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
