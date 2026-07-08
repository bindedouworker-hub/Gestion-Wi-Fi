/* ============================================================
   Settings Page — Payment methods, subscription types, account
   ============================================================ */

import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, Plus, Edit, Trash2, Upload, X, Lock, Wifi } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { PaymentMethod, SubscriptionType } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SettingsPage() {
  const { user, addToast } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [subTypes, setSubTypes] = useState<SubscriptionType[]>([]);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  // Payment method form
  const [showPM, setShowPM] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmMerchant, setPmMerchant] = useState('');
  const [editPmId, setEditPmId] = useState<number | null>(null);

  // Subscription type form
  const [showST, setShowST] = useState(false);
  const [stName, setStName] = useState('');
  const [stHours, setStHours] = useState('');
  const [stPrice, setStPrice] = useState('');
  const [editStId, setEditStId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pmRes, stRes] = await Promise.all([
        isAdmin ? api.get('/api/settings/payment-methods') : api.get('/api/settings/payment-methods/active'),
        api.get('/api/tickets/subscription-types'),
      ]);
      setPaymentMethods(pmRes.data);
      setSubTypes(stRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/change-password', { current_password: currentPwd, new_password: newPwd });
      addToast('Mot de passe modifié', 'success');
      setCurrentPwd(''); setNewPwd('');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  // Payment method CRUD
  const handleSavePM = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editPmId) {
        await api.put(`/api/settings/payment-methods/${editPmId}`, {
          name: pmName,
          wave_merchant_number: pmMerchant || null,
        });
      } else {
        await api.post('/api/settings/payment-methods', {
          name: pmName,
          wave_merchant_number: pmMerchant || null,
        });
      }
      addToast(editPmId ? 'Moyen de paiement modifié' : 'Moyen de paiement ajouté', 'success');
      setShowPM(false); setPmName(''); setPmMerchant(''); setEditPmId(null);
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const deletePM = async (id: number) => {
    if (!confirm('Supprimer ce moyen de paiement ?')) return;
    try {
      await api.delete(`/api/settings/payment-methods/${id}`);
      addToast('Supprimé', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const uploadQR = async (methodId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.post(`/api/settings/payment-methods/${methodId}/upload-qr`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast('QR code uploadé', 'success');
        loadData();
      } catch (err: any) {
        addToast(err.response?.data?.detail || 'Erreur d\'upload', 'error');
      }
    };
    input.click();
  };

  // Subscription type CRUD
  const handleSaveST = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editStId) {
        await api.put(`/api/tickets/subscription-types/${editStId}`, {
          name: stName,
          duration_hours: Number(stHours),
          price: Number(stPrice),
        });
      } else {
        await api.post('/api/tickets/subscription-types', {
          name: stName,
          duration_hours: Number(stHours),
          price: Number(stPrice),
        });
      }
      addToast(editStId ? 'Type modifié' : 'Type ajouté', 'success');
      setShowST(false); setStName(''); setStHours(''); setStPrice(''); setEditStId(null);
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  const deleteST = async (id: number) => {
    if (!confirm('Supprimer ce type d\'abonnement ?')) return;
    try {
      await api.delete(`/api/tickets/subscription-types/${id}`);
      addToast('Type d\'abonnement supprimé', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Erreur', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Paramètres</h2>
        <p className="text-muted text-sm">Gérer votre compte et la configuration</p>
      </div>

      <div style={{ display: 'grid', gap: '20px', maxWidth: '800px' }}>
        {/* Password Change */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} /> Changer mon mot de passe
          </h3>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Mot de passe actuel</label>
              <input type="password" className="form-input" required value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <input type="password" className="form-input" required minLength={4} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Modifier</button>
          </form>
        </div>

        {/* Payment Methods (admin) */}
        {isAdmin && (
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} /> Moyens de paiement
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditPmId(null); setPmName(''); setPmMerchant(''); setShowPM(true); }}>
                <Plus size={14} /> Ajouter
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {paymentMethods.map((pm) => (
                <div key={pm.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{pm.name}</span>
                    {pm.wave_merchant_number && (
                      <span className="text-muted text-sm" style={{ marginLeft: '8px' }}>
                        ({pm.wave_merchant_number})
                      </span>
                    )}
                    <span className={`badge ${pm.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ marginLeft: '8px' }}>
                      {pm.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {pm.name.toLowerCase().includes('wave') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => uploadQR(pm.id)} title="Uploader QR">
                        <Upload size={14} />
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setEditPmId(pm.id); setPmName(pm.name); setPmMerchant(pm.wave_merchant_number || ''); setShowPM(true);
                    }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePM(pm.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Wave QR preview */}
            {paymentMethods.filter(pm => pm.wave_qr_image_path).map(pm => (
              <div key={pm.id} className="wave-qr-container" style={{ marginTop: '16px' }}>
                <img src={`${API_BASE_URL}/${pm.wave_qr_image_path}`} alt="QR Code Wave" />
                {pm.wave_merchant_number && (
                  <>
                    <div className="wave-merchant-label">Numéro Marchand Wave</div>
                    <div className="wave-merchant">{pm.wave_merchant_number}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Subscription Types (admin) */}
        {isAdmin && (
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={18} /> Types d'abonnement
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditStId(null); setStName(''); setStHours(''); setStPrice(''); setShowST(true); }}>
                <Plus size={14} /> Ajouter
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subTypes.map((st) => (
                <div key={st.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{st.name}</span>
                    <span className="text-muted text-sm" style={{ marginLeft: '8px' }}>
                      {st.duration_hours}h — {new Intl.NumberFormat('fr-FR').format(st.price)} FCFA
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setEditStId(st.id); setStName(st.name); setStHours(String(st.duration_hours)); setStPrice(String(st.price)); setShowST(true);
                    }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteST(st.id)} title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Method Modal */}
      {showPM && (
        <div className="modal-overlay" onClick={() => setShowPM(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{editPmId ? 'Modifier' : 'Ajouter un moyen de paiement'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPM(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSavePM}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" required value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="ex: Wave, Orange Money..." />
              </div>
              <div className="form-group">
                <label className="form-label">Numéro marchand (optionnel)</label>
                <input className="form-input" value={pmMerchant} onChange={(e) => setPmMerchant(e.target.value)} placeholder="ex: +225 07 XX XX XX XX" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowPM(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editPmId ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Type Modal */}
      {showST && (
        <div className="modal-overlay" onClick={() => setShowST(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{editStId ? 'Modifier' : "Ajouter un type d'abonnement"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowST(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveST}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" required value={stName} onChange={(e) => setStName(e.target.value)} placeholder="ex: 1 Heure, 24 Heures..." />
              </div>
              <div className="form-group">
                <label className="form-label">Durée (heures) *</label>
                <input type="number" className="form-input" required min={1} value={stHours} onChange={(e) => setStHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Prix (FCFA) *</label>
                <input type="number" className="form-input" required min={1} value={stPrice} onChange={(e) => setStPrice(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowST(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">{editStId ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
