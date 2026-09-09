// components/dashboard/AIReportPanel.jsx — Panneau du rapport intelligent (IA embarquée)
import React from 'react';

const SENTIMENT_META = {
  positive: { color: '#2fbe8f', bg: 'rgba(47,190,143,0.1)', icon: 'verified' },
  warning: { color: '#d97706', bg: 'rgba(245,158,11,0.12)', icon: 'lightbulb' },
  danger: { color: '#ba1a1a', bg: 'rgba(186,26,26,0.09)', icon: 'error' },
};

const SEVERITY_META = {
  high: { color: '#ba1a1a', bg: 'rgba(186,26,26,0.09)' },
  warning: { color: '#d97706', bg: 'rgba(245,158,11,0.12)' },
  low: { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

const PRIORITY_META = {
  haute: { color: '#ba1a1a', bg: 'rgba(186,26,26,0.09)' },
  moyenne: { color: '#d97706', bg: 'rgba(245,158,11,0.12)' },
  basse: { color: '#2fbe8f', bg: 'rgba(47,190,143,0.1)' },
};

function MiniBars({ serie, color }) {
  if (!serie || serie.length === 0) return null;
  const max = Math.max(...serie.map((s) => s.ca), 1);
  const step = Math.max(1, Math.floor(serie.length / 24));
  const shown = serie.filter((_, i) => i % step === 0);
  return (
    <div className="flex items-end gap-1 h-14 mt-3">
      {shown.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end min-w-0">
          <div
            className="w-full rounded-t"
            style={{
              height: `${Math.max(6, Math.round((s.ca / max) * 100))}%`,
              background: color,
              opacity: 0.25 + 0.75 * (s.ca / max),
            }}
            title={`${s.label} : ${s.ca} DT`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AIReportPanel({ report, loading, error, onClose, onRefresh }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest transition-all duration-500"
      style={{ boxShadow: '0 8px 24px rgba(16,35,63,0.1)' }}>
      {/* Bandeau dégradé supérieur */}
      <div className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: 'linear-gradient(90deg, #f95d00, #8b5cf6, #0ea5e9)' }} />

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap p-5 pb-3">
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center w-11 h-11 rounded-2xl text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #f95d00)', boxShadow: '0 6px 16px rgba(139,92,246,.35)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>auto_awesome</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2fbe8f] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2fbe8f]" />
            </span>
          </span>
          <div>
            <h2 className="font-sora font-bold text-primary" style={{ fontSize: 17 }}>Rapport intelligent</h2>
            <p className="text-xs text-on-surface-variant">
              Analyse IA des données réelles ·{' '}
              {report?.periode?.label ? <span className="font-semibold text-secondary capitalize">{report.periode.label}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report?.generatedAt && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-container-low text-on-surface-variant">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
              Généré {new Date(report.generatedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {onRefresh && (
            <button onClick={onRefresh} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
              <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`} style={{ fontSize: 15 }}>refresh</span>
              Régénérer
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Fermer le rapport"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {loading && !report && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full border-4 border-[rgba(139,92,246,0.15)] border-t-[#8b5cf6] animate-spin mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">Analyse des données et génération du rapport…</p>
          </div>
        )}

        {error && !report && (
          <div className="p-3 bg-error-container text-on-error-container text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Verdict */}
            {(() => {
              const sm = SENTIMENT_META[report.verdict?.sentiment] || SENTIMENT_META.warning;
              return (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border"
                  style={{ background: sm.bg, borderColor: `${sm.color}33` }}>
                  <span className="material-symbols-outlined shrink-0" style={{ color: sm.color, fontSize: 22 }}>{sm.icon}</span>
                  <div>
                    <p className="font-sora font-bold text-sm" style={{ color: sm.color }}>{report.verdict?.label || 'Analyse'}</p>
                    <p className="text-xs text-on-surface-variant">{report.titre}</p>
                  </div>
                </div>
              );
            })()}

            {/* Synthèse introductive */}
            {report.intro && (
              <p className="text-sm leading-relaxed text-on-surface-variant" style={{ borderLeft: '3px solid rgba(249,93,0,.4)', paddingLeft: 12 }}>
                {report.intro}
              </p>
            )}

            {/* Principaux indicateurs */}
            {report.indicateurs?.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Principaux indicateurs</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                  {report.indicateurs.map((ind, i) => (
                    <div key={i} className="rounded-2xl border border-outline-variant/10 p-3 bg-surface-container-lowest"
                      style={{ boxShadow: '0 2px 8px rgba(16,35,63,0.04)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1 truncate">{ind.label}</p>
                      <p className="font-sora font-bold text-primary text-lg leading-none">{ind.value}</p>
                      {ind.evolution && <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">{ind.evolution}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sections d'analyse */}
            {report.sections?.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Détail de l'analyse</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {report.sections.map((sec) => (
                    <div key={sec.key} className="rounded-2xl border border-outline-variant/10 p-4 bg-surface-container-lowest"
                      style={{ boxShadow: '0 2px 8px rgba(16,35,63,0.04)' }}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: `${sec.accent}1a`, color: sec.accent }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{sec.icone}</span>
                        </span>
                        <h4 className="font-sora font-bold text-primary text-sm">{sec.titre}</h4>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        {[sec.stats?.stat1, sec.stats?.stat2, sec.stats?.stat3].filter(Boolean).map((st, i) => (
                          <div key={i} className="flex-1 min-w-[72px]">
                            <p className="text-[10px] text-on-surface-variant mb-0.5 truncate">{st.label}</p>
                            <p className="font-sora font-bold text-primary text-sm truncate">{st.value}</p>
                          </div>
                        ))}
                      </div>
                      {sec.serie && <MiniBars serie={sec.serie} color={sec.accent} />}
                      {sec.analyse && <p className="text-[11px] leading-relaxed text-on-surface-variant mt-2.5">{sec.analyse}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies / points à surveiller */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-outline-variant/10 p-4 bg-surface-container-lowest">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#d97706]" style={{ fontSize: 18 }}>monitor_heart</span>
                  <h4 className="font-sora font-bold text-primary text-sm">Points à surveiller</h4>
                  {report.anomalies?.length > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: '#d97706' }}>
                      {report.anomalies.length}
                    </span>
                  )}
                </div>
                {report.anomalies?.length === 0 ? (
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#2fbe8f]" style={{ fontSize: 16 }}>verified</span>
                    Aucune anomalie détectée sur la période.
                  </p>
                ) : (
                  <ul className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                    {report.anomalies.map((a, i) => {
                      const m = SEVERITY_META[a.severite] || SEVERITY_META.low;
                      return (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: m.bg, color: m.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{a.icone}</span>
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-primary leading-snug">{a.titre}</p>
                            {a.detail && <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{a.detail}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Recommandations */}
              <div className="rounded-2xl border border-outline-variant/10 p-4 bg-surface-container-lowest">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#8b5cf6]" style={{ fontSize: 18 }}>psychology</span>
                  <h4 className="font-sora font-bold text-primary text-sm">Recommandations basées sur les données</h4>
                </div>
                <ol className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                  {report.recommandations?.map((r, i) => {
                    const m = PRIORITY_META[r.priorite] || PRIORITY_META.basse;
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ background: m.color }}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-primary leading-snug">{r.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: m.bg, color: m.color }}>
                              {r.priorite}
                            </span>
                            {r.categorie && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant uppercase tracking-wide">
                                {r.categorie}
                              </span>
                            )}
                            {r.justification && <span className="text-[10px] text-on-surface-variant/80">— {r.justification}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* Conclusion */}
            {report.conclusion && (
              <div className="rounded-2xl p-4 border"
                style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#8b5cf6]" style={{ fontSize: 17 }}>summarize</span>
                  <h4 className="font-sora font-bold text-primary text-sm">Conclusion de l'analyse</h4>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant">{report.conclusion}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}