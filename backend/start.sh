#!/bin/bash
# Run from the backend/ directory

echo "🫧 Starting Fizz Bizz Backend..."

# Install dependencies if not already installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install project deps
uv sync

# Seed the database with demo data
echo "Seeding database..."
uv run python -m app.db.seed

# Start the server
echo "Starting FastAPI server on http://localhost:8000"
echo "API docs at http://localhost:8000/api/docs"
uv run uvicorn app.main:app --reload --port 8000
