#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Buka http://localhost:8080 di browser. Tekan Ctrl+C untuk berhenti."
python3 -m http.server 8080
