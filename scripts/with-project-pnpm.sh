#!/bin/sh
set -eu
mkdir -p node_modules/.bin
corepack enable pnpm --install-directory node_modules/.bin
PATH="$PWD/node_modules/.bin:$PATH"
export PATH
exec "$@"
