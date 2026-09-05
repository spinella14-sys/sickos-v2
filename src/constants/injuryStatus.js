// IR-eligible injury statuses.
//
// MUST MATCH IR_ELIGIBLE_STATUSES in the backend's services/capEngine.js.
// The backend is the source of truth -- it decides whether a player on IR
// counts as healed, and a player who reads as healed LOCKS the team's roster.
// This copy exists only because the frontend cannot import from that repo.
//
//   Out  standard out designation
//   IR   on the NFL team's injured reserve
//   PUP  physically unable to perform
//   DNR  did not report
//   NA   commissioner's exempt list (non-football)
export const IR_ELIGIBLE_STATUSES = ['Out', 'IR', 'PUP', 'DNR', 'NA']
export const isIREligible = (status) => IR_ELIGIBLE_STATUSES.includes(status)
