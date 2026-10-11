#!/usr/bin/env bash
# Enable Google sign-in on the Kingdom of Spins Supabase project.
# Usage: bash supabase/enable-google.sh <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>
# Google Cloud console → APIs & Services → Credentials → OAuth client ID (Web application):
#   Authorized JavaScript origins: https://kingdom-of-spins.deskmind-site.workers.dev, http://127.0.0.1:5173, http://localhost:5173
#   Authorized redirect URI:       https://lwgkaswhnycxoigegifs.supabase.co/auth/v1/callback
set -euo pipefail
REF=lwgkaswhnycxoigegifs
[ $# -eq 2 ] || { echo "usage: $0 <client_id> <client_secret>"; exit 1; }
T="${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s 'Supabase CLI' -w)}"
case "$T" in go-keyring-base64:*) T=$(echo "${T#go-keyring-base64:}" | base64 -d);; esac
curl -sf -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d "{\"external_google_enabled\":true,\"external_google_client_id\":\"$1\",\"external_google_secret\":\"$2\"}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('google enabled:',d.get('external_google_enabled'),d.get('external_google_client_id'))"
