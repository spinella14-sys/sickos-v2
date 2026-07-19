// src/pages/draft/RookieDraft.jsx
// Gold/Amber accent on dark navy base
// Three-panel layout: Left (draft order) | Center (player board) | Right (team view)
// Bottom ticker for completed picks

import { useState, useEffect, useCallback, useRef } from 'react';
import DraftOrderPanel from '../../components/draft/DraftOrderPanel';
import PlayerBoard from '../../components/draft/PlayerBoard';
import TeamPanel from '../../components/draft/TeamPanel';
import DraftHero from '../../components/draft/DraftHero';
import DraftTicker from '../../components/draft/DraftTicker';
import './RookieDraft.css';

const API = import.meta.env.VITE_API_URL;

// 16 Sickos Only teams
const TEAMS = [
  { abbr: 'NH', name: 'New Hampshire Primaries', division: 'EAST' },
  { abbr: 'JOH', name: 'JOH', division: 'EAST' },
  { abbr: 'JJ', name: 'JJ', division: 'EAST' },
  { abbr: 'ACC', name: 'ACC', division: 'EAST' },
  { abbr: 'TNJ', name: 'TNJ', division: 'CENTRAL' },
  { abbr: 'GG', name: 'GG', division: 'CENTRAL' },
  { abbr: 'RAY', name: 'RAY', division: 'CENTRAL' },
  { abbr: 'MAC', name: 'MAC', division: 'CENTRAL' },
  { abbr: 'FLA', name: 'FLA', division: 'SOUTH' },
  { abbr: 'WIXT', name: 'WIXT', division: 'SOUTH' },
  { abbr: 'STAY', name: 'STAY', division: 'SOUTH' },
  { abbr: 'FLEM', name: 'FLEM', division: 'SOUTH' },
  { abbr: 'CER', name: 'CER', division: 'WEST' },
  { abbr: 'H2P', name: 'H2P', division: 'WEST' },
  { abbr: 'SANT', name: 'SANT', division: 'WEST' },
  { abbr: 'SNOW', name: 'SNOW', division: 'WEST' },
];

export default function RookieDraft({ currentTeam = 'NH', isCommissioner = false }) {
  const [draftState, setDraftState] = useState(null);
  const [currentPick, setCurrentPick] = useState(null);
  const [allPicks, setAllPicks] = useState([]);
  const [rookies, setRookies] = useState([]);
  const [activeRound, setActiveRound] = useState(1);
  const [viewingTeam, setViewingTeam] = useState(currentTeam);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastPicks, setLastPicks] = useState([]); // for ticker
  const pollRef = useRef(null);

  // ── Fetch draft state ──────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const [stateRes, picksRes, rookiesRes] = await Promise.all([
        fetch(`${API}/api/draft/state`),
        fetch(`${API}/api/draft/picks`),
        fetch(`${API}/api/draft/rookies`),
      ]);
      const stateData = await stateRes.json();
      const picksData = await picksRes.json();
      const rookiesData = await rookiesRes.json();

      setDraftState(stateData.state);
      setCurrentPick(stateData.currentPick);
      setAllPicks(picksData);
      setRookies(rookiesData);

      // Set active round to current
      if (stateData.currentPick) {
        setActiveRound(stateData.currentPick.round);
      }

      // Build ticker from completed picks (last 20)
      const completed = picksData
        .filter(p => p.status === 'completed')
        .sort((a, b) => b.overall_pick - a.overall_pick)
        .slice(0, 20);
      setLastPicks(completed);

      setLoading(false);
    } catch (err) {
      console.error('Draft state fetch error:', err);
    }
  }, []);

  // ── Poll every 30 seconds for updates ─────────────────────────────────────
  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchState]);

  // ── Countdown clock ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPick?.clock_expires_at) return;
    const tick = () => {
      const diff = new Date(currentPick.clock_expires_at) - new Date();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [currentPick?.clock_expires_at]);

  // ── Submit pick ────────────────────────────────────────────────────────────
  const handlePick = async (rookie) => {
    if (submitting) return;
    const confirmed = window.confirm(
      `Draft ${rookie.full_name} (${rookie.position}) with pick ${currentPick?.overall_pick}?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/draft/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team: currentTeam,
          sleeper_id: rookie.sleeper_id,
          overall_pick: currentPick.overall_pick,
          password: isCommissioner ? localStorage.getItem('adminPassword') : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchState();
    } catch (err) {
      alert(`Pick failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isMyPick = currentPick?.current_team === currentTeam && currentPick?.status === 'on_clock';

  if (loading) {
    return (
      <div className="draft-loading">
        <div className="draft-loading-spinner" />
        <p>Loading draft room...</p>
      </div>
    );
  }

  return (
    <div className="draft-room">
      {/* Hero Bar */}
      <DraftHero
        currentPick={currentPick}
        timeLeft={timeLeft}
        teams={TEAMS}
        isMyPick={isMyPick}
        draftState={draftState}
      />

      {/* Three-panel body */}
      <div className="draft-body">
        {/* Left: Draft Order */}
        <DraftOrderPanel
          allPicks={allPicks}
          activeRound={activeRound}
          setActiveRound={setActiveRound}
          currentPickNumber={draftState?.current_pick}
          teams={TEAMS}
        />

        {/* Center: Player Board */}
        <PlayerBoard
          rookies={rookies}
          allPicks={allPicks}
          currentPick={currentPick}
          isMyPick={isMyPick}
          submitting={submitting}
          onPick={handlePick}
          currentTeam={currentTeam}
        />

        {/* Right: Team Panel */}
        <TeamPanel
          viewingTeam={viewingTeam}
          setViewingTeam={setViewingTeam}
          teams={TEAMS}
          currentTeam={currentTeam}
        />
      </div>

      {/* Bottom Ticker */}
      <DraftTicker picks={lastPicks} />
    </div>
  );
}
