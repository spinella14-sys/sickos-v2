/**
 * contractCalc.js
 * CURRENT_SEASON is derived from the real calendar year.
 * No hardcoding — works correctly in 2026, 2027, 2028, etc.
 */

// Use the actual current year as the active season
export const CURRENT_SEASON = new Date().getFullYear()

/**
 * contractCalc.js — Single source of truth for contract math
 * Used by: CapSheetPage (edit modal), FABidPage (bid form), AdminRosterPage (sign panel)
 */

// Season constants — all derived from LTL which grows $10/year from $110 in 2025
export function getSeasonConsts(year) {
  const ltl = 110 + (year - 2025) * 10  // Anchored at $110 in 2025, +$10/yr regardless of current year
  return {
    year,
    ltl,
    hardCap:   parseFloat((ltl * 1.15).toFixed(2)),
    minSalary: parseFloat((ltl / 50).toFixed(2)),
    qbMax:     parseFloat((ltl / 4.5).toFixed(2)),
    nonQbMax:  parseFloat((ltl / 5.5).toFixed(2)),
    buyIn:     parseFloat((ltl * 0.50).toFixed(2)),
    sbBase:    parseFloat((ltl * 0.20).toFixed(2)),
    psLimit:   parseFloat((ltl / 6).toFixed(2)),
  }
}

export function getMaxForYear(position, year) {
  const c = getSeasonConsts(year)
  return position === 'QB' ? c.qbMax : c.nonQbMax
}

export function getMinForYear(year) {
  return getSeasonConsts(year).minSalary
}

/**
 * Build the full year-by-year salary array for a contract.
 * Handles all four structures, with:
 *   - Escalating: caps at that year's max (then stays tethered)
 *   - Descending: floors at that year's min
 *   - Max: tethered to LTL formula each year (not compounding from base)
 *   - Min: tethered to LTL formula each year
 *
 * @param {object} params
 * @param {number}  params.baseSalary     - Year 1 salary (ignored for max/min)
 * @param {string}  params.structure      - 'flat' | 'escalating' | 'descending' | 'max' | 'minimum'
 * @param {number}  params.years          - Contract length
 * @param {boolean} params.nonGuar        - Is final year non-guaranteed?
 * @param {number}  params.startYear      - First season of contract
 * @param {string}  params.position       - 'QB' | 'RB' | 'WR' | 'TE' | etc.
 * @returns {Array<{year, yearNum, salary, isGuaranteed, isMax, isTetheredMax, capHit}>}
 */
export function buildContractYears({ baseSalary, structure, years, nonGuar, startYear, position, slot = 'active', }) {
  const result = []
  let hitMax = false  // once escalating hits max, stay tethered

  for (let i = 0; i < years; i++) {
    const year     = startYear + i
    const yearNum  = i + 1
    const consts   = getSeasonConsts(year)
    const maxSal   = position === 'QB' ? consts.qbMax : consts.nonQbMax
    const minSal   = consts.minSalary

    let salary
    let isTetheredMax = false

    if (structure === 'max') {
      // Always tethered to that year's LTL formula
      salary        = maxSal
      isTetheredMax = true
    } else if (structure === 'minimum') {
      // Always tethered to that year's LTL formula
      salary = minSal
    } else if (structure === 'flat') {
      salary = parseFloat(baseSalary)
    } else if (structure === 'escalating') {
      if (hitMax) {
        // Already hit max in a prior year — stay tethered to LTL max
        salary        = maxSal
        isTetheredMax = true
      } else {
        const computed = parseFloat((baseSalary * Math.pow(1.1, i)).toFixed(2))
        if (computed >= maxSal) {
          salary        = maxSal
          isTetheredMax = true
          hitMax        = true
        } else {
          salary = computed
        }
      }
    } else if (structure === 'descending') {
      const computed = parseFloat((baseSalary * Math.pow(0.9, i)).toFixed(2))
      salary = Math.max(computed, minSal)
    } else {
      salary = parseFloat(baseSalary)
    }

    salary = parseFloat(salary.toFixed(2))

    const isMax       = salary >= maxSal
    const isGuaranteed = !(nonGuar && yearNum === years)

    // Cap hit
    let capHit = salary
    if (slot === 'ps' || slot === 'ir') capHit *= 0.5
    if (isMax) capHit *= 0.8  // 20% cap credit
    capHit = parseFloat(capHit.toFixed(2))

    result.push({ year, yearNum, salary, isGuaranteed, isMax, isTetheredMax, capHit, minSal, maxSal })
  }

  return result
}

/**
 * Quick check: is this a valid contract?
 * Returns array of error strings (empty = valid)
 */
/**
 * Check if a salary value is in the dead zone (above maxCapHit but below max).
 * In that range, the manager would get a worse cap hit than just signing at max.
 * Returns: null (ok), 'snap_to_max' (should jump to max), or 'above_max' (clamp down)
 */
export function checkSalaryZone(salary, position, year) {
  const max       = getMaxForYear(position, year)
  const maxCapHit = parseFloat((max * 0.8).toFixed(2))
  if (salary > max)                          return { action: 'clamp_max', max }
  if (salary > maxCapHit && salary < max)    return { action: 'snap_to_max', max, maxCapHit }
  if (salary < getMinForYear(year))          return { action: 'clamp_min', min: getMinForYear(year) }
  return null
}

export function validateContractYears(years, position) {
  const errors = []
  for (const cy of years) {
    if (cy.salary < cy.minSal) {
      errors.push(`Year ${cy.yearNum} (${cy.year}): $${cy.salary} is below minimum $${cy.minSal}`)
    }
    if (cy.salary > cy.maxSal) {
      errors.push(`Year ${cy.yearNum} (${cy.year}): $${cy.salary} exceeds ${position === 'QB' ? 'QB' : 'non-QB'} max $${cy.maxSal}`)
    }
  }
  return errors
}
