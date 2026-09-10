import React from 'react';

/**
 * Composant de Pagination standardisé
 *
 * @param {number} currentPage - Page actuelle (1-indexé)
 * @param {number} totalItems - Nombre total d'éléments dans la liste
 * @param {number} itemsPerPage - Nombre d'éléments par page (défaut : 10)
 * @param {function} onPageChange - Callback déclenché lors du changement de page (newPage: number)
 * @param {string} label - Libellé des éléments (ex: "réservations", "formations", "membres")
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  label = 'éléments',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalItems <= itemsPerPage && totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Génération des numéros de pages avec ellipsis intelligent
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-white border-t border-outline-variant/15 text-xs text-on-surface-variant">
      {/* Texte indicatif */}
      <div className="font-medium">
        Affichage de <span className="font-bold text-primary">{startItem}</span> à{' '}
        <span className="font-bold text-primary">{endItem}</span> sur{' '}
        <span className="font-bold text-primary">{totalItems}</span> {label}
      </div>

      {/* Boutons de navigation */}
      <div className="flex items-center gap-1.5">
        {/* Bouton Précédent */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Page précédente"
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
        </button>

        {/* Numéros de page */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="w-6 text-center text-on-surface-variant/50 font-bold select-none">
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-secondary text-white shadow-xs'
                    : 'border border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container active:scale-95'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Bouton Suivant */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Page suivante"
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
        </button>
      </div>
    </div>
  );
}
