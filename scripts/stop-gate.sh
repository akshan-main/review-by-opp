#!/usr/bin/env bash
# review-by-opp stop gate hook
# Prevents Claude from stopping while blocking review findings remain unresolved.
#
# This hook runs on the "Stop" event. If it exits non-zero,
# Claude is prevented from completing.

set -euo pipefail

REVIEWS_DIR="reviews"
CURRENT_FILE="${REVIEWS_DIR}/current.json"

# If no active session, allow stop
if [ ! -f "$CURRENT_FILE" ]; then
  exit 0
fi

# Check if session is already finalized
FINAL_VERDICT=$(node -e "
  const fs = require('fs');
  try {
    const state = JSON.parse(fs.readFileSync('${CURRENT_FILE}', 'utf-8'));
    console.log(state.final_verdict || '');
  } catch { console.log(''); }
" 2>/dev/null)

if [ -n "$FINAL_VERDICT" ]; then
  # Session is finalized, allow stop
  exit 0
fi

# Check for blocking findings
RESULT=$(node -e "
  const fs = require('fs');
  try {
    const state = JSON.parse(fs.readFileSync('${CURRENT_FILE}', 'utf-8'));
    const blockingSeverities = new Set(state.config?.reviewLedger?.blockingSeverities || ['critical', 'high', 'medium']);
    const allowedCategories = new Set(state.config?.reviewLedger?.allowedUnresolvedCategories || []);
    const validStatuses = new Set(['open', 'fixed', 'not_reproducible', 'wont_fix', 'needs_context', 'duplicate', 'superseded']);
    const invalidStatus = state.findings.filter(f => !f.status || !validStatuses.has(f.status));
    const blocking = state.findings.filter(f =>
      f.status === 'open' &&
      blockingSeverities.has(f.severity) &&
      !allowedCategories.has(f.category)
    );

    if (invalidStatus.length > 0) {
      console.log('BLOCKED');
      console.error('');
      console.error('=== REVIEW-BY-OPP STOP GATE ===');
      console.error('');
      console.error('Cannot complete: ' + invalidStatus.length + ' finding(s) have missing/invalid resolution state.');
      console.error('');
      invalidStatus.forEach(f => {
        console.error('  - ' + f.id + ': status=' + String(f.status || '(missing)'));
      });
      console.error('');
      console.error('Each finding must end in exactly one explicit resolution state.');
      console.error('');
    } else if (blocking.length > 0) {
      console.log('BLOCKED');
      console.error('');
      console.error('=== REVIEW-BY-OPP STOP GATE ===');
      console.error('');
      console.error('Cannot complete: ' + blocking.length + ' blocking finding(s) remain unresolved.');
      console.error('');
      blocking.forEach(f => {
        console.error('  - [' + f.severity + '] ' + f.id + ': ' + f.title + ' (' + f.file + ')');
      });
      console.error('');
      console.error('Use /review-by-opp:fix to resolve findings, then /review-by-opp:finalize to close the session.');
      console.error('');
    } else {
      // Check for findings marked fixed without resolution notes
      const noNote = state.findings.filter(f => f.status === 'fixed' && !f.resolution_note);
      if (noNote.length > 0) {
        console.log('BLOCKED');
        console.error('');
        console.error('=== REVIEW-BY-OPP STOP GATE ===');
        console.error('');
        console.error(noNote.length + ' finding(s) marked fixed without resolution notes:');
        noNote.forEach(f => {
          console.error('  - ' + f.id + ': ' + f.title);
        });
        console.error('');
        console.error('Each fixed finding must have a resolution_note explaining the fix.');
        console.error('');
      } else {
        console.log('OK');
      }
    }
  } catch (err) {
    // If we can't parse, don't block
    console.log('OK');
  }
" 2>&1)

if echo "$RESULT" | grep -q "^BLOCKED"; then
  # Print the error messages (everything after BLOCKED line)
  echo "$RESULT" | grep -v "^BLOCKED" | grep -v "^OK" >&2
  exit 1
fi

exit 0
