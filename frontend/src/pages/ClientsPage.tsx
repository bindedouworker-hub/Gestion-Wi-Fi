/* ============================================================
   Clients Page — List of clients and purchase history
   ============================================================ */

import { useEffect, useState } from 'react';
import { Contact, Search, Crown, Star, User } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface ClientStats {
  name: string | null;
  phone: string | null;
  tickets_bought: number;
}

export default function ClientsPage() {
  const { addToast } = useAuthStore();
  const [clients, setClients] = useState<ClientStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await api.get('/api/sales/clients');
      setClients(res.data);
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du chargement des clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const nameMatch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const phoneMatch = c.phone?.includes(searchQuery) || false;
    return nameMatch || phoneMatch;
  });

  const getClientBadge = (count: number) => {
    if (count >= 15) {
      return {
        label: 'VIP',
        class: 'badge-active',
        icon: Crown,
        color: '#eab308'
      };
    }
    if (count >= 5) {
      return {
        label: 'Fidèle',
        class: 'badge-active',
        icon: Star,
        color: '#3b82f6'
      };
    }
    return {
      label: 'Standard',
      class: 'badge-inactive',
      icon: User,
      color: '#64748b'
    };
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <h4>Chargement des clients...</h4>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Clients</h2>
        <p className="text-muted text-sm" style={{ marginTop: '4px' }}>
          Consulter l'historique d'achat de vos clients identifiés
        </p>
      </div>

      {/* Search Filter */}
      <div className="card mb-6" style={{ padding: '16px' }}>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Rechercher par nom ou numéro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="data-table-container">
        <div className="table-header">
          <h3>Base de données clients</h3>
          <span className="text-muted text-sm">{filteredClients.length} client(s) trouvé(s)</span>
        </div>

        {filteredClients.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom du client</th>
                <th>Numéro de téléphone</th>
                <th>Tickets achetés</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c, i) => {
                const badge = getClientBadge(c.tickets_bought);
                const BadgeIcon = badge.icon;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.name || 'Nom non renseigné'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{c.phone || 'Aucun numéro'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      {c.tickets_bought} ticket(s)
                    </td>
                    <td>
                      <span
                        className={`badge ${badge.class}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: badge.color,
                          borderColor: badge.color
                        }}
                      >
                        <BadgeIcon size={12} />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="empty-icon" style={{ fontSize: '2rem' }}>👥</div>
            <h4>Aucun client trouvé</h4>
            <p className="text-muted text-sm">Les ventes avec nom ou téléphone apparaîtront ici.</p>
          </div>
        )}
      </div>
    </div>
  );
}
