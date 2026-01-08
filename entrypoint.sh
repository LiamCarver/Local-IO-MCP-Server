#!/usr/bin/env bash
set -e

if [ -z "$PROJECT_REPO" ]; then
  echo "ERROR: PROJECT_REPO environment variable not set."
  exit 1
fi

if [ ! -d "/workspace/project/.git" ]; then
  echo "Cloning workspace project..."
  git clone "$PROJECT_REPO" /workspace/project
fi

cd /workspace/project

if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  echo "Installing workspace dependencies..."
  npm install
fi

echo "Starting MCP server..."
exec node /app/src/server.js