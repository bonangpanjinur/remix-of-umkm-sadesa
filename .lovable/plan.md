

# Bug Analysis & Fix Plan

## Bugs Found

### Bug 1: `getSettingByKey` Logs False Errors (Low)
**File:** `src/lib/adminApi.ts` (line 388)
**Issue:** When a setting key doesn't exist in `app_settings`, `data` is `null` but `error` is also `null`. The condition `if (error || !data)` logs `console.error('Error fetching setting:', null)` — producing misleading console errors. The `registration_courier` and `registration_merchant` keys don't exist in the DB, so this fires on every page load.
**Fix:** Only log when `error` is truthy. Return `null` silently when `!data`.

### Bug 2: `corsproxy.io` Fallback Returns 403 (Medium)
**File:** `src/lib/addressApi.ts` (line 175-184)
**Issue:** `fetchViaCorsProxy2` uses `corsproxy.io` which now returns 403 Forbidden. This creates console noise and wasted network requests. The edge function (`wilayah-proxy`) is now working, so this proxy is unnecessary overhead.
**Fix:** Remove `corsproxy.io` fallback. Keep edge function + direct emsifa + `allorigins` as fallbacks.

### Bug 3: Unused `locationService.ts` (Low)
**File:** `src/services/locationService.ts`
**Issue:** This file duplicates `addressApi.ts` functionality and is not imported anywhere. Dead code.
**Fix:** Delete the file.

### Bug 4: Courier Dashboard — `ride_requests` Count Query May Fail Silently (Low)
**File:** `src/pages/CourierDashboardPage.tsx` (line 148-153)
**Issue:** The query `ride_requests` with `status = 'SEARCHING'` requires the courier to be approved+active+available per RLS. If the courier just logged in and `is_available` is false, the RLS policy blocks the SELECT, silently returning 0 instead of actual count. Not a crash bug but misleading data.
**Fix:** This is by-design (RLS correctly gates it). No code change needed, just noting it.

### Bug 5: `feature_collector.js` Deprecated Parameter Warning (Low)
**Issue:** This is from a third-party library (likely `lovable-tagger`). Not controllable from app code.
**Fix:** No action needed.

---

## Implementation Plan

### Fix 1: Silent `getSettingByKey` for missing keys
**File:** `src/lib/adminApi.ts`
- Change line 388: only `console.error` when `error` is truthy
- Return `null` without logging when data is simply missing

### Fix 2: Remove broken `corsproxy.io` fallback
**File:** `src/lib/addressApi.ts`
- Remove `fetchViaCorsProxy2` function
- Remove its usage from `fetchWithFallbacks`

### Fix 3: Delete unused `locationService.ts`
**File:** `src/services/locationService.ts`
- Delete the file (confirmed zero imports)

Total: 3 files modified, 1 file deleted.

