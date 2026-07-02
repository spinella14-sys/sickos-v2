import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logoMap from '../assets/logos/logoMap.js';
import UFABidForm from '../components/ufa/UFABidForm.jsx';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

const TIER_FOR_WAVE = (w) => w <= 3 ? 1 : w <= 6 ? 2 : 3;
const WAVE_IN_TIER  = (w) => ((w - 1) % 3) + 1;
const TIER_MINS     = { 1: 18.00, 2: 9.60, 3: 2.40 };
const TIER_NAMES    = { 1: 'Tier 1 — Premium ($18+)', 2: 'Tier 2 — Mid-Range ($9.60+)', 3: 'Tier 3 — Open Market' };

const S = {
  page: { minHeight: '100vh', background: '#0D1117', color: '#E6EDF3', fontFamily: 'Barlow Condensed, sans-serif', padding: '24px' },
  card: { background: '#161B22', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' },
  label: { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#8B949E', textTransform: 'uppercase' },
  input: { width: '100%', background: '#1C2330', border: '1px solid rgba(255,255,255,0.07)', color: '#E6EDF3', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, padding: '8px 10px', borderRadius: 6, outline: 'none', boxSizing: 'border-box' },
  btn: (color) => ({ background: 'none', color, border: `1px solid ${color}`, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', padding: '9px 14px', borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', width: '100%' }),
};

function StatusBadge({ status }) {
  const colors = {
    pre_ufa:   { bg: 'rgba(139,148,158,0.15)', color: '#8B949E' },
    wave_open: { bg: 'rgba(39,174,96,0.15)',   color: '#27AE60' },
    paused:    { bg: 'rgba(155,89,182,0.15)',  color: '#9B59B6' },
    completed: { bg: 'rgba(39,174,96,0.15)',   color: '#27AE60' },
    signed:    { bg: 'rgba(39,174,96,0.15)',   color: '#27AE60' },
    available: { bg: 'rgba(139,148,158,0.15)', color: '#8B949E' },
  };
  const s = colors[status] || colors.pre_ufa;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 10, background: s.bg, color: s.color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

const POS_COLORS = {
  QB: { bg: 'rgba(231,76,60,0.2)', color: '#E74C3C' },
  RB: { bg: 'rgba(39,174,96,0.2)', color: '#27AE60' },
  WR: { bg: 'rgba(52,152,219,0.2)', color: '#3498DB' },
  TE: { bg: 'rgba(155,89,182,0.2)', color: '#9B59B6' },
};

export default function AdminUFAPage() {
  const navigate = useNavigate();
  const [ufaState,       setUfaState]       = useState(null);
  const [players,        setPlayers]        = useState([]);
  const [signedPlayers,  setSignedPlayers]  = useState([]);
  const [teams,          setTeams]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [waveDuration,   setWaveDuration]   = useState(10);
  const [resumeDuration, setResumeDuration] = useState(5);
  const [timeLeft,       setTimeLeft]       = useState(null);
  const [actingAs,       setActingAs]       = useState('NH');
  const [actingAsCapData,setActingAsCapData]= useState(null);
  const [myBids,         setMyBids]         = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [busy,           setBusy]           = useState(false);
  const [posFilter,      setPosFilter]      = useState('ALL');
  const [search,         setSearch]         = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [stateRes, playersRes, teamsRes] = await Promise.all([
        fetch(`${API}/api/ufa/state`),
        fetch(`${API}/api/ufa/players`),
        fetch(`${API}/api/teams`),
      ]);
      const [stateData, playersData, teamsData] = await Promise.all([
        stateRes.json(), playersRes.json(), teamsRes.json(),
      ]);
      setUfaState(stateData);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
      setLoading(false);
    } catch (err) { console.error(err); }
  }, []);

  const fetchActingAsData = useCallback(async () => {
    try {
      const [bidsRes, capRes] = await Promise.all([
        fetch(`${API}/api/ufa/my-bids?team=${actingAs}`),
        fetch(`${API}/api/ufa/cap/${actingAs}`),
      ]);
      const [bidsData, capData] = await Promise.all([bidsRes.json(), capRes.json()]);
      setMyBids(Array.isArray(bidsData) ? bidsData : []);
      setActingAsCapData(capData);
    } catch (err) { console.error(err); }
  }, [actingAs]);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 15000); return () => clearInterval(i); }, [fetchAll]);
  useEffect(() => { fetchActingAsData(); }, [fetchActingAsData]);

  useEffect(() => {
    if (!ufaState?.wave_closes_at) { setTimeLeft(null); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.floor((new Date(ufaState.wave_closes_at) - new Date()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ufaState?.wave_closes_at]);

  const fmt = (s) => {
    if (!s && s !== 0) return '--:--:--';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const getTeamName = (a) => teams.find(t => t.abbrev === a)?.name || a;

  const call = async (endpoint, body, confirm_msg) => {
    if (confirm_msg && !window.confirm(confirm_msg)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/ufa/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'brethart', ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAll();
      await fetchActingAsData();
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setBusy(false); }
  };

  const handleBidSubmit = async (bidData) => {
    try {
      const res = await fetch(`${API}/api/ufa/admin/submit-bid`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'brethart', team: actingAs, ...bidData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedPlayer(null);
      await fetchAll();
      await fetchActingAsData();
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D1117', color: '#8B949E', fontFamily: 'Barlow Condensed, sans-serif' }}>
      Loading UFA Admin...
    </div>
  );

  const wave   = ufaState?.current_wave || 1;
  const tier   = TIER_FOR_WAVE(wave);
  const status = ufaState?.status;
  const isOpen     = status === 'wave_open';
  const isPaused   = status === 'paused';
  const isPreUFA   = status === 'pre_ufa';
  const isCompleted = status === 'completed';

  const filtered = players.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search.trim() && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const COL = '40px 1fr 64px 80px 80px 100px';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate('/admin')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#8B949E', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>
          ← Admin
        </button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.04em', margin: 0 }}>UFA DRAFT CONTROL</h1>
          <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>2026 Unrestricted Free Agency · Wave {wave} of 9</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Wave control */}
          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.label, marginBottom: 12 }}>CURRENT WAVE</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F5A623', marginBottom: 4 }}>
              Wave {wave} · {TIER_NAMES[tier]}
            </div>
            <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 4 }}>
              Wave {WAVE_IN_TIER(wave)} of 3 in this tier · Min offer: ${TIER_MINS[tier]}
            </div>
            <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 16 }}>
              Teams can bid more than the tier minimum at any time.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <StatusBadge status={status} />
              {(isOpen || isPaused) && (
                <span style={{ fontSize: 22, fontWeight: 800, color: isPaused ? '#9B59B6' : '#F5A623', fontVariantNumeric: 'tabular-nums' }}>
                  {isOpen ? fmt(timeLeft) : 'PAUSED'}
                </span>
              )}
            </div>

            {isOpen && ufaState?.wave_closes_at && (
              <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 12 }}>
                Closes: {new Date(ufaState.wave_closes_at).toLocaleString()}
              </div>
            )}

            {isPreUFA && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>WAVE DURATION (MIN)</div>
                  <input type="number" value={waveDuration} onChange={e => setWaveDuration(parseInt(e.target.value))} min={1} style={S.input} />
                </div>
                <button onClick={() => call('admin/open-wave', { duration_minutes: waveDuration }, `Open Wave ${wave}?\nDuration: ${waveDuration} min`)}
                  disabled={busy}
                  style={{ background: '#F5A623', color: '#000', border: 'none', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', padding: '12px', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, textTransform: 'uppercase' }}>
                  {busy ? 'Opening...' : `Open Wave ${wave}`}
                </button>
              </div>
            )}

            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => call('admin/pause-wave', {}, 'Pause the wave?')} disabled={busy} style={S.btn('#9B59B6')}>⏸ Pause Wave</button>
                <button onClick={() => call('admin/close-wave', {}, `Close Wave ${wave} and process results?`)} disabled={busy} style={S.btn('#E84545')}>Close Wave & Process Results</button>
              </div>
            )}

            {isPaused && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>RESUME DURATION (MIN)</div>
                  <input type="number" value={resumeDuration} onChange={e => setResumeDuration(parseInt(e.target.value))} min={1} style={S.input} />
                </div>
                <button onClick={() => call('admin/resume-wave', { duration_minutes: resumeDuration }, `Resume wave for ${resumeDuration} min?`)} disabled={busy} style={S.btn('#27AE60')}>▶ Resume Wave</button>
                <button onClick={() => call('admin/reset-wave', {}, `Reset Wave ${wave}? This will delete all bids for this wave.`)} disabled={busy} style={S.btn('#E84545')}>↺ Reset Wave & Clear Bids</button>
              </div>
            )}

            {isCompleted && (
              <div style={{ background: 'rgba(39,174,96,0.1)', border: '1px solid #27AE60', borderRadius: 6, padding: 12, fontSize: 13, color: '#27AE60', textAlign: 'center', fontWeight: 700 }}>
                UFA PERIOD COMPLETE
              </div>
            )}
          </div>

          {/* Acting as team */}
          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.label, marginBottom: 8 }}>ACTING AS TEAM</div>
            <select value={actingAs} onChange={e => setActingAs(e.target.value)} style={{ ...S.input, fontSize: 14 }}>
              {teams.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
            </select>

            {actingAsCapData && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Cap Space', value: actingAsCapData.cap_space, color: actingAsCapData.cap_space < 5 ? '#E84545' : '#27AE60' },
                  { label: 'Cap Used',  value: actingAsCapData.cap_used,  color: '#8B949E' },
                  { label: 'Hard Cap',  value: actingAsCapData.hard_cap,  color: '#8B949E' },
                  { label: 'SB Budget', value: actingAsCapData.sb_budget_remaining, color: '#F5A623' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#8B949E' }}>{r.label}</span>
                    <span style={{ fontWeight: 700, color: r.color }}>${r.value?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {myBids.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...S.label, marginBottom: 6 }}>BIDS THIS WAVE ({myBids.length}/3)</div>
                {myBids.map(bid => (
                  <div key={bid.id} style={{ fontSize: 12, color: '#8B949E', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#E6EDF3', fontWeight: 700 }}>{bid.ufa_pool?.full_name}</span>
                    {' — '}${bid.y1_salary} · {bid.years}yr {bid.structure}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.label, marginBottom: 12 }}>POOL SUMMARY</div>
            {[
              { label: 'Available Players', value: players.length, color: '#F5A623' },
              { label: 'Signed This Period', value: signedPlayers.length, color: '#27AE60' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#8B949E' }}>{r.label}</span>
                <span style={{ fontWeight: 800, color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Player pool */}
        <div style={S.card}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...S.label }}>
              UFA POOL — 2026 ({filtered.length} players) — Acting as: <span style={{ color: '#F5A623' }}>{getTeamName(actingAs)}</span>
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {['ALL','QB','RB','WR','TE'].map(pos => (
                <button key={pos}
                  onClick={() => setPosFilter(pos)}
                  style={{
                    background: posFilter === pos ? 'rgba(245,166,35,0.15)' : 'none',
                    border: `1px solid ${posFilter === pos ? '#F5A623' : 'rgba(255,255,255,0.07)'}`,
                    color: posFilter === pos ? '#F5A623' : '#8B949E',
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  }}>{pos}</button>
              ))}
              <input
                type="text" placeholder="Search..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.input, width: 160, fontSize: 13, padding: '5px 10px' }}
              />
            </div>
          </div>

          {/* Col headers */}
          <div style={{ display: 'grid', gridTemplateColumns: COL, padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#8B949E', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1C2330' }}>
            <span /><span>PLAYER</span><span>POS</span><span>NFL TEAM</span><span>AGE</span><span>ACTION</span>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            {filtered.map(player => {
              const hasBid = myBids.some(b => b.ufa_pool?.full_name === player.full_name);
              const canBid = isOpen && myBids.length < 3;

              return (
                <div key={player.sleeper_id} style={{
                  display: 'grid', gridTemplateColumns: COL,
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center',
                  background: hasBid ? 'rgba(245,166,35,0.04)' : 'transparent',
                  borderLeft: hasBid ? '3px solid #F5A623' : '3px solid transparent',
                }}>
                  {/* Headshot */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1C2330', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <img src={`https://sleepercdn.com/content/nfl/players/thumb/${player.sleeper_id}.jpg`}
                      alt={player.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>

                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.full_name}</span>

                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: POS_COLORS[player.position]?.bg, color: POS_COLORS[player.position]?.color }}>
                    {player.position}
                  </span>

                  <span style={{ fontSize: 12, color: '#8B949E' }}>{player.nfl_team || '—'}</span>
                  <span style={{ fontSize: 12, color: '#8B949E' }}>{player.age || '—'}</span>

                  <div>
                    {isOpen && (
                      <button
                        onClick={() => setSelectedPlayer(player)}
                        disabled={!canBid && !hasBid}
                        style={{
                          background: hasBid ? 'none' : canBid ? '#3498DB' : 'none',
                          color: hasBid ? '#F5A623' : canBid ? '#fff' : '#8B949E',
                          border: hasBid ? '1px solid #F5A623' : canBid ? 'none' : '1px solid rgba(255,255,255,0.07)',
                          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, fontWeight: 800,
                          padding: '5px 10px', borderRadius: 4,
                          cursor: canBid || hasBid ? 'pointer' : 'not-allowed', letterSpacing: '0.06em',
                        }}
                      >
                        {hasBid ? 'EDIT' : canBid ? 'BID' : 'LIMIT'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedPlayer && (
        <UFABidForm
          player={selectedPlayer}
          wave={wave}
          tier={tier}
          currentTeam={actingAs}
          myCapData={actingAsCapData}
          myBids={myBids}
          onSubmit={handleBidSubmit}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
