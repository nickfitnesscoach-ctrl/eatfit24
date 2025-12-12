# 🧪 Testing Checklist - Diary Flicker Fix

## Quick Test (5 minutes)

### 1. DEV Environment
```bash
cd frontend && npm run dev
```

**Check:**
- [ ] Red "DEBUG MODE" banner at top ✅
- [ ] Switch tabs 10 times rapidly
  - [ ] No white/gray screen on Diary
  - [ ] Instant tab switching
- [ ] Change date in calendar
  - [ ] Skeleton ONLY in meals list
  - [ ] Header/goals stay visible

### 2. Production Build
```bash
cd frontend && npm run build
cd dist/assets && grep -l "DEBUG" *.js
```

**Expected:** Empty output (no debug code)

### 3. Production Server

Open: `https://eatfit24.ru/app`

**Check:**
- [ ] NO red banner at top ❌
- [ ] Switch tabs 20 times
  - [ ] Instant navigation
  - [ ] No skeleton on return to Diary
- [ ] Change dates
  - [ ] Skeleton only in meals list
  - [ ] First load: skeleton
  - [ ] Return to same date: instant (cached)

## Pass Criteria

✅ All checkboxes checked
✅ No console errors
✅ Network tab shows meals request only on date change

## If Issues Found

1. Check browser console for errors
2. Verify production build completed successfully
3. Confirm latest code deployed to server
4. Check DIARY_FLICKER_FIX.md for detailed info

---

**Time estimate:** 5-10 minutes
**Required:** Browser, SSH access to server (for deploy)
