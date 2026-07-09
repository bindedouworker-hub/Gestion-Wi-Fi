/* ============================================================
   Dashboard Page — Real-time statistics
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  Package, ShoppingCart, DollarSign, Banknote, Smartphone,
  Clock, Users, BarChart3, TrendingUp, Ticket, Crown, UserCheck, CalendarDays, Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { DashboardStats, StockSummaryItem } from '../types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, stockRes] = await Promise.all([
        api.get('/api/dashboard/'),
        api.get('/api/tickets/stock-summary'),
      ]);
      setStats(statsRes.data);
      setStockSummary(stockRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <h4>Chargement...</h4>
      </div>
    );
  }

  const formatCFA = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

  const statCards = [
    ...(isAdmin
      ? [{ icon: Package, label: 'Stock central', value: stats.central_stock, color: 'blue' }]
      : []),
    { icon: Ticket, label: isAdmin ? 'Stock vendeurs' : 'Mon stock', value: stats.vendor_stock, color: 'purple' },
    { icon: ShoppingCart, label: 'Ventes du jour', value: stats.today_sales, color: 'green' },
    { icon: DollarSign, label: "CA du jour", value: formatCFA(stats.today_revenue), color: 'gold' },
    { icon: Banknote, label: 'Espèces', value: formatCFA(stats.cash_payments), color: 'green' },
    { icon: Smartphone, label: 'Wave', value: formatCFA(stats.wave_payments), color: 'blue' },
    { icon: Clock, label: 'Demandes en attente', value: stats.pending_requests, color: 'red' },
    ...(isAdmin
      ? [
          { icon: Users, label: 'Vendeurs actifs', value: stats.total_vendors, color: 'purple' },
        ]
      : []),
  ];

  const pieData = [
    { name: 'Espèces', value: stats.cash_payments || 1 },
    { name: 'Wave', value: stats.wave_payments || 1 },
  ];
  const pieColors = ['#22c55e', '#3b82f6'];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
          {isAdmin ? 'Tableau de bord' : `Bonjour, ${user?.full_name}`}
        </h2>
        <p className="text-muted text-sm" style={{ marginTop: '4px' }}>
          {isAdmin ? 'Vue d\'ensemble de votre activité' : 'Résumé de votre activité du jour'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="stat-info">
              <h3>{card.label}</h3>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {/* Stock by Type */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>
            <BarChart3 size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Stock par type
          </h3>
          {stockSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stockSummary.map((s) => ({
                name: s.subscription_type.name,
                Disponible: s.available,
                Attribué: s.assigned,
                Vendu: s.sold,
              }))}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                  }}
                />
                <Bar dataKey="Disponible" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Attribué" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Vendu" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>Aucune donnée</p>
            </div>
          )}
        </div>

        {/* Payment Distribution */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>
            <TrendingUp size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Répartition des paiements
          </h3>
          {stats.today_revenue > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCFA((value as unknown) as number)}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '60px 24px' }}>
              <p>Aucune vente aujourd'hui</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Statistics Section (Admin only) */}
      {isAdmin && (
        <div style={{ marginTop: '32px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} /> Statistiques détaillées (Performances)
          </h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {/* Top Client */}
            <div className="stat-card">
              <div className="stat-icon gold">
                <Crown size={22} />
              </div>
              <div className="stat-info">
                <h3>Meilleur client</h3>
                <div className="stat-value" style={{ fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stats.top_client_name || 'Aucun'}>
                  {stats.top_client_name || 'Aucun'}
                </div>
                <div className="text-muted text-sm">{stats.top_client_tickets} ticket(s) acheté(s)</div>
              </div>
            </div>

            {/* Top Vendor */}
            <div className="stat-card">
              <div className="stat-icon purple">
                <UserCheck size={22} />
              </div>
              <div className="stat-info">
                <h3>Meilleur vendeur</h3>
                <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                  {stats.top_vendor_name || 'Aucun'}
                </div>
                <div className="text-muted text-sm">{stats.top_vendor_tickets} ticket(s) vendu(s)</div>
              </div>
            </div>

            {/* Top Subscription Type */}
            <div className="stat-card">
              <div className="stat-icon blue">
                <Zap size={22} />
              </div>
              <div className="stat-info">
                <h3>Forfait le plus vendu</h3>
                <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                  {stats.top_subscription_type_name || 'Aucun'}
                </div>
                <div className="text-muted text-sm">{stats.top_subscription_type_tickets} vente(s)</div>
              </div>
            </div>

            {/* Top Day */}
            <div className="stat-card">
              <div className="stat-icon red">
                <CalendarDays size={22} />
              </div>
              <div className="stat-info">
                <h3>Jour de forte affluence</h3>
                <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                  {stats.top_day_name || 'Aucun'}
                </div>
                <div className="text-muted text-sm">{stats.top_day_tickets} ticket(s) acheté(s)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
