import './SimplePages.css'

export default function RulesPage() {
  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">League Rules</h1>
        <p className="sp-sub">Sickos Only Dynasty · Bylaws & Scoring</p>
      </div>
      <div className="sp-content">
        <div className="rules-grid">
          {[
            { title: 'Roster & Lineup', items: ['16 teams, dynasty format', 'Lineup: 1 QB · 2 RB · 3 WR · 1 TE · 1 FLEX (RB/WR/TE)', 'No bench limit (dynasty roster)'] },
            { title: 'Salary Cap', items: ['Hard Cap: $126.5M', 'Luxury Tax Line: $110M', 'Minimum Salary: $2.2M', 'QB Max: $24.44M', 'Non-QB Max: $20M'] },
            { title: 'Passing Scoring', items: ['Passing Yards: 0.06 / yd', 'Completion: +1.0', 'Passing TD: +10', 'Interception: -5', 'Sack: -1', '2-pt Conversion: +2'] },
            { title: 'Rushing Scoring', items: ['Rushing Yards: 0.4 / yd', 'Rushing TD: +10', '2-pt Conversion: +2', 'Fumble Lost: -2'] },
            { title: 'Receiving Scoring', items: ['Reception (all): +1.0', 'QB/RB Rec Yards: 0.2 / yd', 'WR/TE Rec Yards: 0.3 / yd', 'Receiving TD: +10', '2-pt Conversion: +2'] },
            { title: 'Transactions', items: ['FA bids submitted via TSF form', 'Commissioner processes weekly', 'Trades require both managers', 'Trades close Week 14'] },
          ].map(card => (
            <div key={card.title} className="rules-card">
              <div className="rules-card-title">{card.title}</div>
              <ul className="rules-list">
                {card.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
