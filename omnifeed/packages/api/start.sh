#!/bin/sh
set -e
node dist/db/migrate.js 2>/dev/null || echo "No migrations to run"
exec node dist/index.js
