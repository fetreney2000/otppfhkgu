# Jadual OT Solver — Current Staff Selection & Roster Filing Logic

> This document describes the CURRENT implementation of the solver as of the latest code.
> Source: `src/workers/rosterSolver.worker.ts` (882 lines)

---

## 1. OVERALL FLOW

```
1. Receive data from server (employees, holidays, AE assignments, preselections, unavailability, archive, config)
2. Build lookup structures (holiday dates, AE map, unavailability set, preselection map)
3. Build slot sequence for the month
4. Apply preselections (admin-locked assignments)
5. Run STRATEGY A: 6 constructive strategies × 25 restarts each (150 total attempts)
6. If still unfilled → STRATEGY B: Beam Search (width=50)
7. If still unfilled → STRATEGY C: 6 structured constructive strategies × 25 restarts each
8. Append POST-AE marker rows
9. Return result
```

---

## 2. DAY CLASSIFICATION

```typescript
classifyDay(dateStr, holidayDates):
  if dateStr in holidayDates → "holiday"
  else if dayOfWeek == 0 (Sunday) → "sunday"
  else if dayOfWeek == 6 (Saturday) → "saturday"
  else → "weekday"
```

**Important**: Holiday ALWAYS overrides day-of-week (e.g., a Saturday that is a public holiday is classified as "holiday", not "saturday").

---

## 3. AE HOURS CALCULATION

```typescript
calcAEHours(dateStr, dayType, allHolidays):
  Mon–Thu (dayOfWeek 1–4):   → 0 hours  (informational marker, staff still assigned)
  Friday (dayOfWeek 5):      → 9 hours  (full AE shift)
  Saturday (dayOfWeek 6):    → 9 hours  (full AE shift)
  Sunday (dayOfWeek 0):      → next day is holiday? 9 : 2
  Holiday:                   → next day is Sat/Sun/Holiday? 9 : 2
```

**Key point**: Mon-Thu AE slots have 0 hours but ARE filled with a staff member. The employee is assigned but does NOT accrue working hours. However, their AE count and unpaid AE count ARE incremented.

---

## 4. AE CATEGORY CLASSIFICATION

```typescript
getAECategory(dateStr, allHolidays):
  if tomorrow is public holiday → "friSatHol" (paid)
  if today is Friday → "friSatHol" (paid)
  if today is Saturday → "friSatHol" (paid)
  otherwise → "sunThu" (unpaid)
```

---

## 5. SLOT TEMPLATES PER DAY TYPE

### Weekday (Mon–Fri, not holiday) — up to 5 slots

| Slot | Department | Role | Hours | Notes |
|------|-----------|------|-------|-------|
| AE | aeAssign[date] | PPF | 0-9 | If dept assigned. Mon-Thu=0h, Fri=9h |
| IPP_1 | IPP | PPF | 4 | Always |
| OPD_1 | null (flexible) | PPF | 4 | Mix: target 2 OPD + 1 IPP |
| OPD_2 | null (flexible) | PPF | 4 | Mix: target 2 OPD + 1 IPP |
| OPD_3 | null (flexible) | PPF | 4 | Mix: target 2 OPD + 1 IPP |

### Saturday/Sunday — up to 11 slots

| Slot | Department | Role | Hours |
|------|-----------|------|-------|
| AE | aeAssign[date] | PPF | 2-9 |
| IPP_1..3 | IPP | PPF | 7 each |
| OPD_1..4 | OPD | PPF | 7 each |
| PP_PPF | null | PPF | 6 |
| PP_PRA_1 | null | PRA | 6 |
| PP_PRA_2 | null | PRA | 6 |

### Holiday — up to 13 slots

| Slot | Department | Role | Hours |
|------|-----------|------|-------|
| AE | aeAssign[date] | PPF | 2-9 |
| IPP_1..4 | IPP | PPF | 7 each |
| OPD_1..5 | OPD | PPF | 7 each |
| PP_PPF | null | PPF | 6 |
| PP_PRA_1 | null | PRA | 6 |
| PP_PRA_2 | null | PRA | 6 |

---

## 6. ELIGIBILITY ENGINE (13 Constraints)

For each slot, every active employee is checked against ALL constraints. Must pass ALL to be eligible.

### CHECK 1: ROLE MATCH
- PP_PRA_1, PP_PRA_2 → requires PRA role
- All other slots → requires PPF role

### CHECK 2: DEPARTMENT MATCH
- **AE slot**: employee department must match AE assignment department for that date
- **IPP_* slots**: employee must be IPP department
- **OPD_* on weekend/holiday**: employee must be OPD department
- **OPD_* on weekday**: ANY PPF employee (both IPP and OPD) — this is the OPD mix
- **PP_PPF**: both IPP and OPD allowed

### CHECK 3: ONE SLOT PER DAY
- Employee cannot be assigned to more than one slot on the same day

### CHECK 4: UNAVAILABILITY
- Employee's unavailability requests are respected

### CHECK 5: POST-AE NEXT-DAY BLOCK
- Employee who worked AE on day D is BLOCKED on day D+1 for ALL slot types

### CHECK 6: CONSECUTIVE DAY RULE
- If employee worked yesterday (non-AE, Mon-Thu), they CANNOT work today (unless today is a holiday or slot is AE)

### CHECK 7: SAME SLOT TYPE CONSECUTIVE
- Employee cannot do the same slot type two days in a row (e.g., IPP_1 on Monday → IPP_1 on Tuesday is blocked)

### CHECK 8: MONTHLY MAX HOURS
- `hoursUsed + slot.hours <= MaxHoursPerMonth` (default 40, configurable per employee)
- **Note**: 0-hour AE slots pass this check automatically (0 + 0 = 0)

### CHECK 9: WEEKLY WEEKDAY CAP
- For non-AE weekday slots: max 2 such slots per employee per Monday-start week

### CHECK 10: MONTHLY DEPT DISTRIBUTION MAXIMA
- IPP PPF on weekday OPD slots: max 4 per month
- OPD PPF on weekday OPD slots: max 7 per month

### CHECK 11: MONTHLY HOLIDAY SLOT CAP
- Any employee: max 2 slots on public holiday days (any slot type, excluding AE)
- **RELAXATION**: If ALL candidates blocked by this cap, retry with cap ignored

### CHECK 12: MONTHLY AE SLOT CAP
- Max 2 AE slots total per employee per month (includes 0-hour Mon-Thu)

### CHECK 13: AE SPECIFIC CONSTRAINTS
- 13a: Max 2 AE slots per employee per month
- 13b: 2nd AE must be OPPOSITE category (sunThu vs friSatHol)
- 13c: Paid AE (friSatHol): max 1/month; Unpaid AE (sunThu): max 1/month
- 13d: Minimum 10-day gap between any two AE shifts (includes archive history)

---

## 7. STAFF SELECTION LOGIC (Candidate Ranking)

When multiple employees are eligible for a slot, they are ranked by:

### TIER 0 (DOMINANT): FAIRNESS WITHIN ROLE
- Compute average hours for each role (PPF, PRA) among candidates
- `deficit = roleAverage - employeeHours`
- If deficit difference > 0.5 hours: employee with HIGHER deficit (below average) gets priority
- If deficit is similar: employee with MORE remaining hours gets priority

### TIER 1: MONTHLY MINIMUM NEED
- IPP PPF: prioritizes employees who need more OFFDAY_IPP or WEEKDAY_IPP slots
- OPD PPF: prioritizes employees who need more OFFDAY_OPD slots

### TIER 2: ANNUAL PRIORITY
- For AE slots: lower annual AE + paid AE count = higher priority
- For holiday slots: lower annual PH count = higher priority

### TIER 3: EMPLOYEE ID LEXICAL
- Alphabetical by EmployeeID as final tiebreaker

---

## 8. OBJECTIVE FUNCTION

The solver evaluates each solution using lexicographic comparison (first difference wins):

| Rank | Metric | Direction |
|------|--------|-----------|
| 1 | unfilledCount | Lower is better |
| 2 | hardPenalty | Lower is better |
| 3 | exceedOneThirdCount | Lower is better |
| 4 | roleHoursDeviation | Lower is better |
| 5 | softPenalty | Lower is better |
| 6 | assignedHours | HIGHER is better |
| 7 | utilizationSpread | Lower is better |

### Hard Penalties (per employee)
- Excess holiday slots (>2) × 80
- Excess AE slots (>2) × 120
- Excess paid AE (>1) × 120
- Excess unpaid AE (>1) × 120
- Excess IPP weekday OPD (>4) × 70
- Excess OPD weekday OPD (>7) × 70
- Role StdDev above target (>7) × 500

### Soft Penalties (per employee)
- Deficit from monthly minimums × 35 per unit
- Utilization deviation × 240
- Role hours deviation × 10
- Role StdDev above target × 2000

---

## 9. SOLVER STRATEGIES

### STRATEGY A: Constructive with 6 Sub-Strategies
Each strategy sorts the slot sequence differently, then greedily assigns the best candidate:

1. **most-constrained**: Slots with fewest eligible candidates first
2. **fairness-first**: AE → holiday → weekend → weekday priority
3. **front-loaded**: Days 1→31 chronologically
4. **back-loaded**: Days 31→1 reverse
5. **department-balanced**: Alternate IPP and OPD priority
6. **minimum-monthly-deficit**: AE → holiday → weekend → weekday

Each strategy runs 25 restarts with randomization (top-3 random pick on restart > 0).

### STRATEGY B: Beam Search (Fallback)
- Maintains top 50 partial solutions
- Expands each by trying top-3 candidates per slot
- Prunes to best 50 by objective function

### STRATEGY C: Structured Constructive (Fallback)
- 6 sub-strategies × 25 restarts each
- Same as Strategy A but with different slot ordering

---

## 10. STATE TRACKING PER EMPLOYEE

| State Field | Updated When | Purpose |
|------------|-------------|---------|
| hoursUsed[empId] | Any assignment (adds slot.hours) | Monthly hour tracking |
| assignedToday[date][empId] | Any assignment | One-slot-per-day enforcement |
| lastWorkedDay[empId] | Any assignment | Consecutive day rule |
| lastWorkedWasAE[empId] | AE assignment | Post-AE block logic |
| lastSlotType[empId] | Any assignment | Same-slot consecutive prohibition |
| aeCountThisMonth[empId] | AE assignment | AE monthly cap (max 2) |
| aeCategories[empId] | AE assignment | sunThu/friSatHol tracking |
| aeDays[empId] | AE assignment | 10-day gap enforcement |
| weekdaySlotWeekCounts[empId] | Non-AE weekday assignment | Weekly weekday cap |
| monthlyRuleStats[empId] | Any assignment | All monthly distribution counters |
| postAEBlock[empId] | AE assignment | Blocks employee on next day |
| unavailSet | Pre-loaded | Employee unavailability requests |

---

## 11. MONTHLY RULE STATS TRACKING

| Counter | Incremented When |
|---------|-----------------|
| ippOffdayIpp | IPP PPF assigned to IPP slot on weekend/holiday |
| ippWeekdayIpp | IPP PPF assigned to IPP slot on weekday |
| ippWeekdayOpd | IPP PPF assigned to OPD slot on weekday |
| opdOffdayOpd | OPD PPF assigned to OPD slot on weekend/holiday |
| opdWeekdayOpd | OPD PPF assigned to OPD slot on weekday |
| holidaySlotsAll | Any employee assigned to any slot on a holiday |
| aeSlotsAll | Any employee assigned to AE slot |
| aePaidSlotsAll | AE with friSatHol category |
| aeUnpaidSlotsAll | AE with sunThu category |

---

## 12. POST-AE MARKERS

After solving, for each day D:
- If employee X did AE on day D-1 (current month or archive), add:
  ```
  {date: D, slotType: "POST-AE", employeeId: X, hours: 0}
  ```
- These are informational rows showing who did AE duty the previous day
- They do NOT block eligibility or consume hours

---

## 13. PRESELECTION HANDLING

- Admin-locked assignments applied BEFORE solver starts
- Preselected slots are REMOVED from the slot sequence (solver skips them)
- Preselections update all state tracking (hours, AE counts, etc.)

---

## 14. RELAXATION MECHANISM

When ALL candidates for a holiday slot are blocked by CHECK 11 (holiday cap = 2):
- Retry with `isEligibleRelaxed()` which skips CHECK 11 only
- All other constraints remain enforced
- Select candidate with lowest AnnualPH count

---

## 15. HOURS EFFECT OF 0-HOUR AE SLOTS

| Effect | 0-hour AE Slot |
|--------|---------------|
| hoursUsed += 0 | ✓ No increase |
| aeCountThisMonth += 1 | ✓ Increases AE count |
| aeCategories[sunThu] = true | ✓ Increases unpaid AE count |
| aeDays += date | ✓ Tracked for 10-day gap |
| postAEBlock[nextDay] = true | ✓ Next day blocked |
| assignedToday[date] = true | ✓ One-slot-per-day enforced |
| lastWorkedDay = date | ✓ Consecutive day tracking |
| monthlyRuleStats updated | ✓ AE counters incremented |

---