// ─── LEAGUE CONSTANTS ────────────────────────────────────────────────────────
export const LEAGUE_NAME = 'Sickos Only'
export const CURRENT_SEASON = 2025 // Most recent completed season (Sep 2025 2013 Feb 2026)
export const NEXT_SEASON = 2026
export const CURRENT_WEEK = 18
export const TOTAL_WEEKS = 18
export const IS_OFFSEASON = true

export const CAP = {
  get hardCap()  { const ltl = 110+(new Date().getFullYear()-2025)*10; return parseFloat((ltl*1.15).toFixed(2)) }, // dynamic
  get luxuryLine(){ return 110+(new Date().getFullYear()-2025)*10 }, // dynamic
  get minSalary() { const ltl = 110+(new Date().getFullYear()-2025)*10; return parseFloat((ltl/50).toFixed(2)) }, // dynamic
  get qbMax()    { const ltl = 110+(new Date().getFullYear()-2025)*10; return parseFloat((ltl/4.5).toFixed(2)) }, // dynamic
  get nonQbMax() { const ltl = 110+(new Date().getFullYear()-2025)*10; return parseFloat((ltl/5.5).toFixed(2)) }, // dynamic
}

// ─── SCORING RULES ───────────────────────────────────────────────────────────
export const SCORING = {
  pass_yd: 0.06,
  pass_cmp: 1.0,
  pass_td: 10,
  pass_int: -5,
  pass_sack: -1,
  pass_2pt: 2,
  rush_yd: 0.4,
  rush_td: 10,
  rush_2pt: 2,
  fumble_lost: -2,
  // QB/RB receptions
  qb_rec: 1.0,
  qb_rec_yd: 0.2,
  rb_rec: 1.0,
  rb_rec_yd: 0.2,
  // WR/TE receptions
  wr_rec: 1.0,
  wr_rec_yd: 0.3,
  te_rec: 1.0,
  te_rec_yd: 0.3,
  rec_td: 10,
  rec_2pt: 2,
}

// ─── LINEUP ──────────────────────────────────────────────────────────────────
export const LINEUP_SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX']
export const FLEX_POSITIONS = ['RB', 'WR', 'TE']

// ─── TEAM LOGOS — locally bundled, never expire ───────────────────────────────
import LOGOS from '../assets/logos/index.js'
export { LOGOS }

// ─── TEAMS ───────────────────────────────────────────────────────────────────
// Team colors: primary (hero bg tint), accent (text/borders), text (readable on bg)
export const TEAMS = [
  { abbrev: 'NH',   name: 'New Hampshire Primaries',        manager: 'Adam Spinella',    salary: 103.98, wins: 8, losses: 5,  color: { primary: '#c8102e', accent: '#002868', text: '#ffffff' } },
  { abbrev: 'JJ',   name: 'Low Post Bandits',               manager: 'Jarred Jones',      salary: 111.56, wins: 7, losses: 6,  color: { primary: '#1d3a6b', accent: '#e87722', text: '#ffffff' } },
  { abbrev: 'JOH',  name: "O'Neil's Team",                  manager: "John O'Neil",       salary: 112.14, wins: 6, losses: 7,  color: { primary: '#8b0000', accent: '#c0c0c0', text: '#ffffff' } },
  { abbrev: 'ACC',  name: 'Lemme CeeDee TDs',               manager: 'Anthony Accardi',   salary: 121.85, wins: 9, losses: 4,  color: { primary: '#002244', accent: '#4fc3f7', text: '#ffffff' } },
  { abbrev: 'TRTL', name: 'Turtle Army',                     manager: 'Gregory Parker-Thompson', salary: 112.92, wins: 5, losses: 8,  color: { primary: '#2a6b2e', accent: '#d4a843', text: '#ffffff' } },
  { abbrev: 'GG',   name: 'Gang Green',                     manager: 'Trey Morin',        salary: 107.37, wins: 7, losses: 6,  color: { primary: '#004c54', accent: '#3dba6e', text: '#ffffff' } },
  { abbrev: 'RAY',  name: 'Boiler Boys',                    manager: 'Kyle Ray',          salary: 105.36, wins: 6, losses: 7,  color: { primary: '#1a1a1a', accent: '#c28f2c', text: '#ffffff' } },
  { abbrev: 'MAC',  name: 'Take Off Your Pads and Jacket',  manager: 'Mac McDonald',      salary: 101.61, wins: 8, losses: 5,  color: { primary: '#2d0057', accent: '#00bcd4', text: '#ffffff' } },
  { abbrev: 'FLA',  name: 'Fantasy Frodo',                  manager: 'Evan Volpe',        salary: 110.11, wins: 7, losses: 6,  color: { primary: '#1a3d1a', accent: '#c8a84b', text: '#ffffff' } },
  { abbrev: 'WIXT', name: 'Team Wixted',                    manager: 'Gerry Wixted',      salary:  93.38, wins: 4, losses: 9,  color: { primary: '#1a1a1a', accent: '#f57c00', text: '#ffffff' } },
  { abbrev: 'FLEM', name: "Buc-ee's Nabers",                manager: 'Parker Fleming',    salary: 117.75, wins: 9, losses: 4,  color: { primary: '#8b0000', accent: '#f5c518', text: '#ffffff' } },
  { abbrev: 'STAY', name: 'Team Stayman',                   manager: 'Rich Stayman',      salary: 118.48, wins: 8, losses: 5,  color: { primary: '#0d2b6b', accent: '#5b9bd5', text: '#ffffff' } },
  { abbrev: 'SANT', name: 'The Underdogs',                  manager: 'Matt Santoro',      salary: 112.18, wins: 6, losses: 7,  color: { primary: '#1a2b3d', accent: '#7ab3c8', text: '#ffffff' } },
  { abbrev: 'H2P',  name: 'Team Blose',                     manager: 'Robert Blose',      salary: 115.31, wins: 7, losses: 6,  color: { primary: '#003366', accent: '#4fc3f7', text: '#ffffff' } },
  { abbrev: 'SNOW', name: 'Snowman',                        manager: 'Taylor Snow',       salary: 104.88, wins: 5, losses: 8,  color: { primary: '#1c2b3a', accent: '#b0c4d8', text: '#ffffff' } },
  { abbrev: 'CER',  name: 'Team Cerota',                    manager: 'Jake Cerota',       salary: 113.91, wins: 7, losses: 6,  color: { primary: '#0d2244', accent: '#c0392b', text: '#ffffff' } },
]

// ─── SAMPLE ROSTERS ─────────────────────────────────────────────────────────
// Sleeper player IDs for key players
export const SAMPLE_ROSTER = {
  NH: [
    { sleeperId: '4034', pos: 'QB',  name: 'Lamar Jackson',   salary: 24.44, years: 3, slot: 'QB' },
    { sleeperId: '7547', pos: 'RB',  name: 'Derrick Henry',   salary: 14.0,  years: 2, slot: 'RB' },
    { sleeperId: '6786', pos: 'WR',  name: 'CeeDee Lamb',     salary: 20.0,  years: 4, slot: 'WR' },
    { sleeperId: '6794', pos: 'WR',  name: 'Tyreek Hill',     salary: 18.5,  years: 2, slot: 'WR' },
    { sleeperId: '6904', pos: 'WR',  name: 'Stefon Diggs',    salary:  9.0,  years: 1, slot: 'WR' },
    { sleeperId: '5844', pos: 'TE',  name: 'Travis Kelce',    salary: 16.0,  years: 2, slot: 'TE' },
    { sleeperId: '7561', pos: 'RB',  name: 'Austin Ekeler',   salary:  2.2,  years: 1, slot: 'FLEX'},
  ],
}

// ─── SAMPLE TRANSACTIONS ────────────────────────────────────────────────────
export const TRANSACTIONS = [
  { id: 1, type: 'trade',    date: '2025-11-15', teams: ['ACC', 'NH'],   desc: 'CeeDee Lamb → ACC | Derrick Henry + $8M → NH' },
  { id: 2, type: 'signing',  date: '2025-11-10', teams: ['FLEM'],        desc: 'Signed Puka Nacua · 3yr / $9.8M' },
  { id: 3, type: 'release',  date: '2025-11-08', teams: ['WIXT'],        desc: 'Released Dalton Kincaid' },
  { id: 4, type: 'trade',    date: '2025-11-05', teams: ['GG', 'STAY'],  desc: 'Josh Allen → GG | Amon-Ra St. Brown + picks → STAY' },
  { id: 5, type: 'signing',  date: '2025-10-30', teams: ['MAC'],         desc: 'Signed Jordan Love · 4yr / $24.44M' },
  { id: 6, type: 'trade',    date: '2025-10-22', teams: ['H2P', 'SANT'], desc: "Ja'Marr Chase → H2P | Davante Adams + $5M → SANT" },
]

// ─── SAMPLE SCOREBOARD ───────────────────────────────────────────────────────
export const SCOREBOARD_WK14 = [
  { home: 'ACC', away: 'FLEM', homeScore: 142.8, awayScore: 131.2, status: 'final' },
  { home: 'NH',  away: 'STAY', homeScore: 118.4, awayScore: 127.6, status: 'final' },
  { home: 'GG',  away: 'H2P',  homeScore: 109.1, awayScore: 98.3,  status: 'final' },
  { home: 'JJ',  away: 'MAC',  homeScore: 155.2, awayScore: 144.7, status: 'final' },
  { home: 'FLA', away: 'CER',  homeScore: 122.9, awayScore: 119.5, status: 'final' },
  { home: 'RAY', away: 'SANT', homeScore:  87.3, awayScore: 103.8, status: 'final' },
  { home: 'JOH', away: 'SNOW', homeScore: 134.1, awayScore: 111.2, status: 'final' },
  { home: 'TRTL', away: 'WIXT', homeScore: 128.6, awayScore:  94.1, status: 'final' },
]

// ─── DIVISIONS ───────────────────────────────────────────────────────────────
export const DIVISIONS = [
  {
    name: 'EAST',
    teams: ['NH', 'JOH', 'JJ', 'ACC'],
  },
  {
    name: 'CENTRAL',
    teams: ['TRTL', 'GG', 'RAY', 'MAC'],
  },
  {
    name: 'SOUTH',
    teams: ['FLA', 'WIXT', 'STAY', 'FLEM'],
  },
  {
    name: 'WEST',
    teams: ['CER', 'H2P', 'SANT', 'SNOW'],
  },
]
