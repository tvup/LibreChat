#!/usr/bin/env bash
#
# Upgrade this fork by merging the latest upstream changes directly into
# tvup/master and rebuilding everything that docker-compose.yml bind-mounts
# from the working tree.
#
#   upstream/main  →  tvup/master  →  rebuild dist  →  docker pull + up
#
# Safety: exits immediately on any error, refuses to run with a dirty tree,
# and stops at merge conflicts so you can resolve them by hand.
#
# Note: this script does NOT try to keep local `main` in sync — it merges
# upstream/main straight into tvup/master, sidestepping divergence on main.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

FEATURE_BRANCH="tvup/master"
UPSTREAM_REMOTE="upstream"
UPSTREAM_BRANCH="main"
ORIGIN_REMOTE="origin"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m!!\033[0m %s\n' "$*" >&2; exit 1; }

[ -n "$(git status --porcelain)" ] && die "Working tree is dirty. Commit or stash first."

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

log "Fetching $UPSTREAM_REMOTE and $ORIGIN_REMOTE"
git fetch "$UPSTREAM_REMOTE"
git fetch "$ORIGIN_REMOTE"

log "Merging $UPSTREAM_REMOTE/$UPSTREAM_BRANCH into $FEATURE_BRANCH"
git checkout "$FEATURE_BRANCH"
if ! git merge --no-edit "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"; then
  die "Merge conflict. Resolve, 'git commit', then re-run this script."
fi

log "Installing dependencies (in case upstream bumped anything)"
npm install

log "Building all packages + client (bind-mounted dist/ dirs)"
npm run build

log "Stopping containers and removing old LibreChat images"
docker compose down
docker images -a --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
  | awk '/librechat/ {print $2}' \
  | xargs -r docker rmi -f || true

log "Pulling new LibreChat image and starting"
docker compose pull
docker compose up -d

log "Pushing $FEATURE_BRANCH"
git push "$ORIGIN_REMOTE" "$FEATURE_BRANCH"

log "Done. Containers:"
docker compose ps

if [ "$CURRENT_BRANCH" != "$FEATURE_BRANCH" ]; then
  log "Returning to original branch: $CURRENT_BRANCH"
  git checkout "$CURRENT_BRANCH"
fi
