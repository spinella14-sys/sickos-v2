import { TRANSACTIONS, TEAMS, LOGOS } from '../data/league'
import './SimplePages.css'

function TeamLogo({ abbrev, size = 18 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }} loading="lazy" />
}

export default function TransactionsPage() {
  const typeColor = { trade: 'var(--blue)', signing: 'var(--green)', release: 'var(--red)' }
  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Transaction Wire</h1>
        <p className="sp-sub">Full league activity log · 2025 Season</p>
      </div>
      <div className="sp-content">
        <div className="txn-full-list">
          {TRANSACTIONS.map(txn => (
            <div key={txn.id} className="txn-full-row">
              <div className="txn-full-date">{txn.date}</div>
              <span className="txn-full-type" style={{ borderColor: typeColor[txn.type], color: typeColor[txn.type] }}>
                {txn.type}
              </span>
              <div className="txn-full-body">
                <div className="txn-full-desc">{txn.desc}</div>
                <div className="txn-full-teams">
                  {txn.teams.map(a => {
                    const t = TEAMS.find(x => x.abbrev === a)
                    return (
                      <span key={a} className="txn-full-team">
                        <TeamLogo abbrev={a} />
                        {t?.name || a}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="sp-note">Full transaction history will be populated from backend in Drop 3</div>
      </div>
    </div>
  )
}
