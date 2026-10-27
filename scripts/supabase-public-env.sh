#!/usr/bin/env bash
# Exports the project's public URL and publishable (anon) key for front-end builds.
# Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF. Without them the apps build in offline demo mode.
set -euo pipefail
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" || -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "::warning::Supabase secrets not set; building without a backend."
  exit 0
fi
keys=$(curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys")
key=$(echo "$keys" | jq -r '[.[] | select(.type == "publishable")][0].api_key // empty')
[[ -z "$key" ]] && key=$(echo "$keys" | jq -r '[.[] | select(.name == "anon")][0].api_key // empty')
url="https://$SUPABASE_PROJECT_REF.supabase.co"
echo "::add-mask::$key"
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$url"
  echo "NEXT_PUBLIC_SUPABASE_KEY=$key"
  echo "SUPABASE_URL=$url"
  echo "SUPABASE_PUBLIC_KEY=$key"
} >> "$GITHUB_ENV"
echo "Supabase project: $url"
