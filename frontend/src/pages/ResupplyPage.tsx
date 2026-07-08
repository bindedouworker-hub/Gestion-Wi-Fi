/* ============================================================
   Resupply Page — Request and manage ticket restocking
   ============================================================ */

import { useEffect, useState, type FormEvent } from 'react';
import { PackagePlus, Check, XCircle, X } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { ResupplyRequest, SubscriptionType } from '../types';

export default function ResupplyPage() {
  const { user, addToast } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<ResupplyRequest[]>([]);
  const [subTypes, setSubTypes] = useState<SubscriptionType[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRequest, setShowRequest] = useState(false);
  const [reqTypeId, setReqTypeId] = useState('');
  const [reqQty, setReqQty] = useState('');

  const [showReject, setShowReject] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [reqRes, typesRes] = await Promise.all([
        api.get('/api/resupply/'),
        api.get('/api/tickets/subscription-types'),
      ]);
      setRequests(reqRes.data);
      setSubTypes(typesRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/resupply/', { subscription_type_id: Number(reqTypeId), quantity: Number(reqQty) });
      addToast('Demande envoyée', 'success');
      setShowRequest(false);
      setReqTypeId(''); setReqQty('');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/resupply/${id}/process`, { action: 'approved' });
      addToast('Demande approuvée, tickets attribués', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!showReject) return;
    try {
      await api.post(`/api/resupply/${showReject}/process`, { action: 'rejected', rejection_reason: rejectReason });
      addToast('Demande refusée', 'info');
      setShowReject(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const statusLabels: Record<string, string> = {
    pending: 'En attente',
    approved: 'Approuvée',
    rejected: 'Refusée',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Réapprovisionnement</h2>
          <p className="text-muted text-sm">
            {isAdmin ? 'Gérer les demandes de stock' : 'Demander des tickets'}
          </p>
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowRequest(true)}>
            <PackagePlus size={16} /> Nouvelle demande
          </button>
        )}
      </div>

      <div className="data-table-container">
        <div className="table-header">
          <h3>Demandes de réapprovisionnement</h3>
          <span className="text-muted text-sm">{requests.length} demande(s)</span>
        </div>
        {requests.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {isAdmin && <th>Vendeur</th>}
                <th>Type</th>
                <th>Quantité</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Traité le</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  {isAdmin && <td style={{ fontWeight: 600 }}>{r.vendor_name}</td>}
                  <td>{r.subscription_type_name}</td>
                  <td style={{ fontWeight: 600 }}>{r.quantity}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>
                      {statusLabels[r.status] || r.status}
                    </span>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{r.processed_at ? new Date(r.processed_at).toLocaleDateString('fr-FR') : '—'}</td>
                  {isAdmin && (
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleApprove(r.id)}>
                            <Check size={14} /> Approuver
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setShowReject(r.id); setRejectReason(''); }}>
                            <XCircle size={14} /> Refuser
                          </button>
                        </div>
                      )}
                      {r.status === 'rejected' && r.rejection_reason && (
                        <span className="text-muted text-sm" title={r.rejection_reason}>
                          {r.rejection_reason.substring(0, 30)}...
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h4>Aucune demande</h4>
            <p>{isAdmin ? 'Aucune demande en attente' : 'Faites une demande de réapprovisionnement'}</p>
          </div>
        )}
      </div>

      {/* Request Modal (vendor) */}
      {showRequest && (
        <div className="modal-overlay" onClick={() => setShowRequest(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Demande de réapprovisionnement</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRequest(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label className="form-label">Type d'abonnement *</label>
                <select className="form-select" required value={reqTypeId} onChange={(e) => setReqTypeId(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {subTypes.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.price} FCFA</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantité *</label>
                <input type="number" className="form-input" required min={1} value={reqQty} onChange={(e) => setReqQty(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRequest(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal (admin) */}
      {showReject !== null && (
        <div className="modal-overlay" onClick={() => setShowReject(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Refuser la demande #{showReject}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowReject(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleReject}>
              <div className="form-group">
                <label className="form-label">Motif de refus *</label>
                <textarea className="form-textarea" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Raison du refus..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowReject(null)}>Retour</button>
                <button type="submit" className="btn btn-danger">Refuser</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
