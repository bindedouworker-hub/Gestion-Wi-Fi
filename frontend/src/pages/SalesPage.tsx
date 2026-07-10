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
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePayment, setSalePayment] = useState('Espèces');
  const [saleClientName, setSaleClientName] = useState('');
  const [saleClientPhone, setSaleClientPhone] = useState('');
  const [selling, setSelling] = useState(false);
  const [saleResult, setSaleResult] = useState<Sale[] | null>(null);

  // Cancel form
  const [showCancel, setShowCancel] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelMarkDefective, setCancelMarkDefective] = useState(false);

  useEffect(() => { loadData(); }, []);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!saleTypeId) {
      setSaleQuantity(1);
    }
  }, [saleTypeId]);

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

  const getSaleStatusBadge = (s: Sale) => {
    if (s.is_cancelled) {
      return <span className="badge badge-rejected">Annulée</span>;
    }
    if (s.payment_method === 'credit' && !s.is_paid) {
      return <span className="badge badge-pending">À crédit</span>;
    }
    if (s.payment_method === 'compensation') {
      return <span className="badge badge-defective">Dédommagement</span>;
    }
    if (!s.subscription_duration_hours) {
      return <span className="badge badge-approved">Valide</span>;
    }

    const createdAt = new Date(s.created_at);
    const expirationTime = new Date(createdAt.getTime() + s.subscription_duration_hours * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = expirationTime.getTime() - now.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);

    if (remainingMs < 0) {
      return <span className="badge badge-inactive">Expiré</span>;
    }
    if (remainingHours <= 8) {
      return <span className="badge badge-pending" title={`Expire le ${expirationTime.toLocaleString('fr-FR')}`}>Presque fini</span>;
    }
    return <span className="badge badge-approved" title={`Expire le ${expirationTime.toLocaleString('fr-FR')}`}>Actif</span>;
  };

  const getPaymentMethodBadge = (s: Sale) => {
    if (s.payment_method === 'cash') {
      return <span className="badge badge-cash">Espèces</span>;
    }
    if (s.payment_method === 'wave') {
      return <span className="badge badge-wave">Wave</span>;
    }
    if (s.payment_method === 'compensation') {
      return <span className="badge badge-defective">Dédommagement</span>;
    }
    if (s.payment_method === 'credit') {
      return (
        <span className={`badge ${s.is_paid ? 'badge-approved' : 'badge-pending'}`}>
          Crédit {s.is_paid ? '(Payé)' : '(Non payé)'}
        </span>
      );
    }
    return <span className="badge">{s.payment_method}</span>;
  };

  const selectedWaveMethod = paymentMethods.find(m => m.name.toLowerCase().includes('wave'));

  const handleSell = async (e: FormEvent) => {
    e.preventDefault();
    setSelling(true);
    try {
      const res = await api.post('/api/sales/', {
        subscription_type_id: Number(saleTypeId),
        quantity: Number(saleQuantity),
        payment_method: salePayment.toLowerCase() === 'espèces' ? 'cash' : (salePayment.toLowerCase() === 'crédit' ? 'credit' : salePayment.toLowerCase()),
        client_name: saleClientName || null,
        client_phone: saleClientPhone || null,
      });
      setSaleResult(res.data);
      addToast(res.data.length > 1 ? `${res.data.length} ventes enregistrées !` : 'Vente enregistrée !', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setSelling(false);
    }
  };

  const handleMarkPaid = async (saleId: number) => {
    if (!window.confirm('Voulez-vous marquer cette vente à crédit comme payée ?')) return;
    try {
      await api.post(`/api/sales/${saleId}/mark-paid`);
      addToast('Crédit encaissé !', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const closeSaleModal = () => {
    setShowSale(false);
    setSaleResult(null);
    setSaleTypeId('');
    setSaleQuantity(1);
    setSalePayment('Espèces');
    setSaleClientName('');
    setSaleClientPhone('');
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!showCancel) return;
    try {
      const res = await api.post(`/api/sales/${showCancel}/cancel`, {
        reason: cancelReason,
        mark_defective: cancelMarkDefective,
      });
      
      const newCode = res.data.replacement_ticket_code;
      if (newCode) {
        addToast(`Vente annulée ! Nouveau code Wi-Fi attribué : ${newCode}`, 'success');
      } else {
        addToast('Vente annulée', 'success');
      }
      
      setShowCancel(null);
      setCancelReason('');
      setCancelMarkDefective(false);
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
        {(() => {
          const totalOutstandingCredit = sales
            .filter(s => s.payment_method === 'credit' && !s.is_paid && !s.is_cancelled)
            .reduce((sum, s) => sum + s.amount, 0);

          return (
            <>
              {stockSummary.filter(s => (isAdmin ? s.available : s.assigned) > 0).map((s) => (
                <div key={s.subscription_type.id} className="stat-card">
                  <div className="stat-icon blue">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="stat-info">
                    <h3>{s.subscription_type.name}</h3>
                    <div className="stat-value">{isAdmin ? s.available : s.assigned}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tickets disponibles</span>
                  </div>
                </div>
              ))}
              {isAdmin && totalOutstandingCredit > 0 && (
                <div className="stat-card">
                  <div className="stat-icon red" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div className="stat-info">
                    <h3>Crédits en attente</h3>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCFA(totalOutstandingCredit)}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à encaisser</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Alert section for clients to follow up */}
      {(() => {
        const expiringSales = sales.filter(s => {
          if (s.is_cancelled || !s.subscription_duration_hours || !s.client_phone) return false;
          const expirationTime = new Date(new Date(s.created_at).getTime() + s.subscription_duration_hours * 60 * 60 * 1000);
          const remainingMs = expirationTime.getTime() - new Date().getTime();
          const remainingHours = remainingMs / (1000 * 60 * 60);
          return remainingHours > 0 && remainingHours <= 8;
        });

        if (expiringSales.length === 0) return null;

        return (
          <div className="card" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid var(--warning)', marginBottom: '24px' }}>
            <h4 style={{ color: 'var(--warning)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> Clients à relancer (tickets expirant dans moins de 8h)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expiringSales.map(s => {
                const expirationTime = new Date(new Date(s.created_at).getTime() + s.subscription_duration_hours * 60 * 60 * 1000);
                const remainingHours = Math.max(0, (expirationTime.getTime() - new Date().getTime()) / (1000 * 60 * 60));
                const mins = Math.round((remainingHours % 1) * 60);
                const hoursText = Math.floor(remainingHours) > 0 ? `${Math.floor(remainingHours)}h ` : '';
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                    <div>
                      <strong>{s.client_name || 'Client sans nom'}</strong> (Tél: <span style={{ fontFamily: 'monospace' }}>{s.client_phone}</span>) — {s.subscription_type_name}
                    </div>
                    <div style={{ color: 'var(--warning)', fontSize: '0.875rem', fontWeight: 600 }}>
                      Reste {hoursText}{mins}min (expire à {expirationTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                    {getPaymentMethodBadge(s)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCFA(s.amount)}</td>
                  {isAdmin && <td>{s.vendor_name}</td>}
                  <td>{new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    {getSaleStatusBadge(s)}
                  </td>
                  {isAdmin && (
                    <td>
                      {!s.is_cancelled && s.payment_method === 'credit' && !s.is_paid && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)', marginRight: '8px' }} onClick={() => handleMarkPaid(s.id)}>
                          Encaisser
                        </button>
                      )}
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

            {(() => {
              const selectedType = subTypes.find(t => t.id === Number(saleTypeId));
              const stock = stockSummary.find(s => s.subscription_type.id === Number(saleTypeId));
              const availableCount = selectedType ? (isAdmin ? (stock?.available || 0) : (stock?.assigned || 0)) : 0;

              return saleResult ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                    {saleResult.length > 1 ? `${saleResult.length} ventes confirmées` : `Vente #${saleResult[0].id} confirmée`}
                  </h4>
                  <div className="card" style={{ textAlign: 'left', marginTop: '16px' }}>
                    <p><strong>Code(s) Wi-Fi :</strong></p>
                    <div style={{
                      maxHeight: '120px',
                      overflowY: 'auto',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      color: 'var(--accent-400)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '12px',
                      border: '1px solid var(--border)'
                    }}>
                      {saleResult.map(s => (
                        <span key={s.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {s.ticket_code}
                        </span>
                      ))}
                    </div>
                    <p><strong>Type :</strong> {saleResult[0].subscription_type_name}</p>
                    <p><strong>Montant Total :</strong> {formatCFA(saleResult.reduce((acc, s) => acc + s.amount, 0))}</p>
                    <p><strong>Paiement :</strong> {saleResult[0].payment_method === 'cash' ? 'Espèces' : 'Wave'}</p>
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
                        const count = isAdmin ? (stock?.available || 0) : (stock?.assigned || 0);
                        return (
                          <option key={t.id} value={t.id} disabled={count === 0}>
                            {t.name} — {t.price} FCFA ({count} dispo)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {saleTypeId && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Quantité *</label>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          max={availableCount}
                          required
                          value={saleQuantity}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(availableCount, Number(e.target.value)));
                            setSaleQuantity(val);
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Les tickets les plus anciens seront automatiquement sélectionnés (FIFO).
                        </span>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label">Mode de paiement *</label>
                    <select className="form-select" value={salePayment} onChange={(e) => setSalePayment(e.target.value)}>
                      {paymentMethods.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                      {isAdmin && (
                        <option value="compensation">Dédommagement (Gratuit)</option>
                      )}
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
                    <input className="form-input" value={saleClientName} onChange={(e) => setSaleClientName(e.target.value)} placeholder="Nom du client (optionnel)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Téléphone du client *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={saleClientPhone}
                      onChange={(e) => setSaleClientPhone(e.target.value)}
                      placeholder="Ex: 0707070707"
                      pattern="^\+?[0-9\s\-()]+$"
                      minLength={8}
                      title="Veuillez saisir un numéro de téléphone valide (chiffres, espaces, tirets ou parenthèses, min. 8 caractères)"
                    />
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" onClick={closeSaleModal}>Annuler</button>
                    <button type="submit" className="btn btn-accent" disabled={selling}>
                      {selling ? 'Vente...' : 'Valider la vente'}
                    </button>
                  </div>
                </form>
              );
            })()}
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
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="markDefective"
                  checked={cancelMarkDefective}
                  onChange={(e) => setCancelMarkDefective(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <label htmlFor="markDefective" style={{ cursor: 'pointer', fontSize: '0.9rem', userSelect: 'none' }}>
                  Marquer le ticket comme défectueux (ne sera plus vendu)
                </label>
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
