// services/api/documents.js — Documents Membres (Module K)
import { apiFetch, API_URL } from './_core';

export const documentsApi = {
  getContent: (type) =>
    fetch(`${API_URL}/api/documents/content/${type}`).then(r => r.json()),
  setContent: (payload) =>
    apiFetch('/api/documents/content', { method: 'PUT', body: JSON.stringify(payload) }),
  getMyDocuments: () => apiFetch('/api/members/me/documents-k'),
  upload: (payload) =>
    apiFetch('/api/members/me/documents-k', { method: 'POST', body: JSON.stringify(payload) }),
  accept: (type_doc) =>
    apiFetch('/api/members/me/accept', { method: 'POST', body: JSON.stringify({ type_doc }) }),
  getSignDocument: (token) =>
    fetch(`${API_URL}/api/documents/sign/${token}`).then(r => r.json()),
  signDocument: (token) =>
    fetch(`${API_URL}/api/documents/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json()),
  getMemberDocuments: (userId) => apiFetch(`/api/admin/members/${userId}/documents`),
  sendSignature: (userId, payload) =>
    apiFetch(`/api/admin/members/${userId}/documents/send-signature`, { method: 'POST', body: JSON.stringify(payload) }),
};
