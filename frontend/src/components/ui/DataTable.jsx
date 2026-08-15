// components/ui/DataTable.jsx
import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

export function DataTable({ columns, data, isLoading, emptyTitle, emptyDescription, emptyIcon, pagination, onPageChange }) {
  if (isLoading) {
    return (
      <div className="py-5 bg-white border rounded shadow-sm d-flex align-items-center justify-content-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
      />
    );
  }

  return (
    <div className="bg-white border rounded shadow-sm overflow-hidden">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`py-3 px-4 ${col.className || ''}`} style={col.style}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`py-3 px-4 ${col.className || ''}`} style={col.style}>
                    {col.cell ? col.cell(row, rowIdx) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center py-3 px-4 border-top bg-light">
          <div className="text-muted small">
            Page {pagination.page} sur {pagination.totalPages} (Total: {pagination.total})
          </div>
          <nav aria-label="Table navigation">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 1}>
                  Précédent
                </button>
              </li>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <li key={p} className={`page-item ${pagination.page === p ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => onPageChange(p)}>
                    {p}
                  </button>
                </li>
              ))}
              <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page === pagination.totalPages}>
                  Suivant
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
