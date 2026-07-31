#!/bin/zsh
# Double-click this file to start CHM Ops.
# Repairs dependencies if needed, starts the app on port 3005,
# and opens it in your browser automatically.

source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null

cd "$(dirname "$0")"

echo ""
echo "  Starting CHM Ops..."
echo "  (first run after an update can take a couple of minutes)"
echo ""

# Installs anything missing and regenerates the database client.
# Fast no-op when everything is already in place.
npm install

# Open the app in the browser once the server actually answers,
# however long the install takes.
(
  for i in {1..150}; do
    if curl -s -o /dev/null --max-time 2 "http://localhost:3005"; then
      open "http://localhost:3005/money"
      exit 0
    fi
    sleep 2
  done
) &

npm run dev

echo ""
echo "  Server stopped. You can close this window."
