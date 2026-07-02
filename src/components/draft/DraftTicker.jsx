export default function DraftTicker({ picks, getTeamName }) {
  const items = [...picks, ...picks];

  return (
    <div className="draft-ticker">
      <div className="draft-ticker__label">PICKS</div>
      <div className="draft-ticker__viewport">
        <div className="draft-ticker__track">
          {items.map((pick, idx) => (
            <div key={`${pick.overall_pick}-${idx}`} className="ticker-item">
              <span className="ticker-item__pick">
                {pick.round}.{String(pick.pick_in_round).padStart(2, '0')}
              </span>
              <span className="ticker-item__dot">◆</span>
              <span className="ticker-item__team">{getTeamName(pick.current_team)}</span>
              <span className="ticker-item__player">{pick.player_name}</span>
              {pick.auto_picked && (
                <span className="ticker-item__auto">AUTO</span>
              )}
              <span className="ticker-item__sep">|</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}