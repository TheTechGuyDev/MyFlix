#!/usr/bin/env bash
# Asserts the security-rules test produced the expected outcomes.
set -e
out="$1"; fail=0
expect() { if grep -qE "$2" "$out"; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi; }
expect "member can't mark own account paid"          "Those account fields can only be changed by MyFlix"
expect "member can't read profile PINs"              "permission denied for table profile_pins"
expect "member can't create payments"                "permission denied for table payments"
expect "unpaid member can't stream"                  '"reason": "membership"'
expect "plan screen limit enforced"                  '"reason": "screens"'
expect "stopped stream stays stopped"                "stopped"
expect "promo priced on server"                      '"amount": 20400'
expect "other members' profiles hidden"              "bob_sees_profiles"
expect "staff without two-step see only own account" "staff_aal1_accounts"
if grep -A2 "bob_sees_profiles" "$out" | grep -qE "^ +[1-9]"; then echo "FAIL  Bob saw Ada's profiles"; fail=1; fi
if grep -A2 "staff_aal1_accounts" "$out" | grep -qE "^ +[2-9]"; then echo "FAIL  staff without MFA saw members"; fail=1; fi
if ! grep -A2 "staff_aal2_accounts" "$out" | grep -qE "^ +3"; then echo "FAIL  staff with MFA couldn't see members"; fail=1; fi
if grep -q "ERROR:  permission denied for function" "$out"; then echo "FAIL  missing function grant"; fail=1; fi
exit $fail
