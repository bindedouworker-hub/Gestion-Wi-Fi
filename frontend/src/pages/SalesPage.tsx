/* ============================================================
   Sales Page — Sell tickets, view history, cancel (admin)
   ============================================================ */

import { useEffect, useState, type FormEvent } from 'react';
import { ShoppingCart, X, QrCode } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { Sale, SubscriptionType, PaymentMethod, StockSummaryItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SalesPage() {
  const { user, addToast } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [sales, setSales] = useState<Sale[]>([]);
  const [subTypes, setSubTypes] = useState<SubscriptionType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sale form
  const [showSale, setShowSale] = useState(false);
  const [saleTypeId, setSaleTypeId] = useState('');
  const [salePayment, setSalePayment] = useState('Espèces');
  const [saleClientName, setSaleClientName] = useState('');
  const [saleClientPhone, setSaleClientPhone] = useState('');
  const [selling, setSelling] = useState(false);
  const [saleResult, setSaleResult] = useState<Sale | null>(null);

  // Cancel form
  const [showCancel, setShowCancel] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [salesRes, typesRes, pmRes, stockRes] = await Promise.all([
        api.get('/api/sales/'),
        api.get('/api/tickets/subscription-types'),
        api.get('/api/settings/payment-methods/active'),
        api.get('/api/tickets/stock-summary'),
      ]);
      setSales(salesRes.data);
      setSubTypes(typesRes.data);
      setPaymentMethods(pmRes.data);
      setStockSummary(stockRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

  const selectedWaveMethod = paymentMethods.find(m => m.name.toLowerCase().includes('wave'));

  const handleSell = async (e: FormEvent) => {
    e.preventDefault();
    setSelling(true);
    try {
      const res = await api.post('/api/sales/', {
        subscription_type_id: Number(saleTypeId),
        payment_method: salePayment.toLowerCase() === 'espèces' ? 'cash' : salePayment.toLowerCase(),
        client_name: saleClientName || null,
        client_phone: saleClientPhone || null,
      });
      setSaleResult(res.data);
      addToast('Vente enregistrée !', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setSelling(false);
    }
  };

  const closeSaleModal = () => {
    setShowSale(false);
    setSaleResult(null);
    setSaleTypeId('');
    setSalePayment('Espèces');
    setSaleClientName('');
    setSaleClientPhone('');
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!showCancel) return;
    try {
      await api.post(`/api/sales/${showCancel}/cancel`, { reason: cancelReason });
      addToast('Vente annulée', 'success');
      setShowCancel(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Ventes</h2>
          <p className="text-muted text-sm">Enregistrer et suivre les ventes de tickets</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowSale(true)}>
          <ShoppingCart size={16} /> Nouvelle vente
        </button>
      </div>

      {/* Quick stock overview */}
      <div className="stats-grid">
        {stockSummary.filter(s => s.assigned > 0).map((s) => (
          <div key={s.subscription_type.id} className="stat-card">
            <div className="stat-icon blue">
              <ShoppingCart size={20} />
            </div>
            <div className="stat-info">
              <h3>{s.subscription_type.name}</h3>
              <div className="stat-value">{s.assigned}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tickets disponibles</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Table */}
      <div className="data-table-container">
        <div className="table-header">
          <h3>Historique des ventes</h3>
          <span className="text-muted text-sm">{sales.length} vente(s)</span>
        </div>
        {sales.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Code ticket</th>
                <th>Type</th>
                <th>Client</th>
                <th>Paiement</th>
                <th>Montant</th>
                {isAdmin && <th>Vendeur</th>}
                <th>Date</th>
                <th>Statut</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={s.is_cancelled ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                  <td>{s.id}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.ticket_code}</td>
                  <td>{s.subscription_type_name}</td>
                  <td>{s.client_name || '—'}</td>
                  <td>
                    <span className={`badge ${s.payment_method === 'cash' ? 'badge-cash' : 'badge-wave'}`}>
                      {s.payment_method === 'cash' ? 'Espèces' : 'Wave'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCFA(s.amount)}</td>
                  {isAdmin && <td>{s.vendor_name}</td>}
                  <td>{new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge ${s.is_cancelled ? 'badge-rejected' : 'badge-approved'}`}>
                      {s.is_cancelled ? 'Annulée' : 'Valide'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {!s.is_cancelled && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setShowCancel(s.id); setCancelReason(''); }}>
                          Annuler
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h4>Aucune vente</h4>
            <p>Enregistrez votre première vente</p>
          </div>
        )}
      </div>

      {/* Sale Modal */}
      {showSale && (
        <div className="modal-overlay" onClick={closeSaleModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{saleResult ? '✅ Vente enregistrée' : 'Nouvelle vente'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={closeSaleModal}><X size={18} /></button>
            </div>

            {saleResult ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Vente #{saleResult.id} confirmée</h4>
                <div className="card" style={{ textAlign: 'left', marginTop: '16px' }}>
                  <p><strong>Code Wi-Fi :</strong> <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--accent-400)' }}>{saleResult.ticket_code}</span></p>
                  <p><strong>Type :</strong> {saleResult.subscription_type_name}</p>
                  <p><strong>Montant :</strong> {formatCFA(saleResult.amount)}</p>
                  <p><strong>Paiement :</strong> {saleResult.payment_method === 'cash' ? 'Espèces' : 'Wave'}</p>
                </div>
                <div className="modal-footer" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={closeSaleModal}>Fermer</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSell}>
                <div className="form-group">
                  <label className="form-label">Type d'abonnement *</label>
                  <select className="form-select" required value={saleTypeId} onChange={(e) => setSaleTypeId(e.target.value)}>
                    <option value="">Sélectionner...</option>
                    {subTypes.filter(t => t.is_active).map(t => {
                      const stock = stockSummary.find(s => s.subscription_type.id === t.id);
                      return (
                        <option key={t.id} value={t.id} disabled={!stock || stock.assigned === 0}>
                          {t.name} — {t.price} FCFA ({stock?.assigned || 0} dispo)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mode de paiement *</label>
                  <select className="form-select" value={salePayment} onChange={(e) => setSalePayment(e.target.value)}>
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Wave QR display */}
                {salePayment.toLowerCase().includes('wave') && selectedWaveMethod && (
                  <div className="wave-qr-container">
                    {selectedWaveMethod.wave_qr_image_path && (
                      <img src={`${API_BASE_URL}/${selectedWaveMethod.wave_qr_image_path}`} alt="QR Code Wave" />
                    )}
                    {selectedWaveMethod.wave_merchant_number && (
                      <>
                        <div className="wave-merchant-label">Numéro Marchand Wave</div>
                        <div className="wave-merchant">{selectedWaveMethod.wave_merchant_number}</div>
                      </>
                    )}
                    {!selectedWaveMethod.wave_qr_image_path && !selectedWaveMethod.wave_merchant_number && (
                      <p style={{ color: '#64748b' }}>QR code et numéro Wave non configurés. Allez dans Paramètres.</p>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Nom du client (optionnel)</label>
                  <input className="form-input" value={saleClientName} onChange={(e) => setSaleClientName(e.target.value)} placeholder="Nom du client" />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone du client (optionnel)</label>
                  <input className="form-input" value={saleClientPhone} onChange={(e) => setSaleClientPhone(e.target.value)} placeholder="Numéro de téléphone" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={closeSaleModal}>Annuler</button>
                  <button type="submit" className="btn btn-accent" disabled={selling}>
                    {selling ? 'Vente...' : 'Valider la vente'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel !== null && (
        <div className="modal-overlay" onClick={() => setShowCancel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Annuler la vente #{showCancel}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCancel(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCancel}>
              <div className="form-group">
                <label className="form-label">Motif d'annulation *</label>
                <textarea className="form-textarea" required minLength={5} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Expliquez la raison de l'annulation..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCancel(null)}>Retour</button>
                <button type="submit" className="btn btn-danger">Confirmer l'annulation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
