#!/bin/sh
set -e

echo "Excalibre - Starting up..."

# Ensure directories exist
mkdir -p /app/excalibre /app/data

# Apply database migrations
echo "Running database migrations..."
bun /app/src/db/migrate.ts

# Start the application
echo "Starting Excalibre..."
exec bun /app/.output/server/index.mjs
