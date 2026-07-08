/* ============================================================
   Reports Page — Generate PDF and Excel reports
   ============================================================ */

import { useState } from 'react';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function ReportsPage() {
  const { user, addToast } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);

  const generateReport = async (format: 'pdf' | 'excel') => {
    setGenerating(true);
    try {
      const payload: any = { report_type: reportType, format };
      if (reportType === 'custom') {
        if (!startDate || !endDate) {
          addToast('Sélectionnez les dates de début et de fin', 'error');
          setGenerating(false);
          return;
        }
        payload.start_date = startDate;
        payload.end_date = endDate;
      }

      const res = await api.post('/api/reports/generate', payload, {
        responseType: 'blob',
      });

      // Download file
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_${reportType}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      addToast(`Rapport ${format.toUpperCase()} téléchargé`, 'success');
    } catch (err: any) {
      addToast('Erreur lors de la génération du rapport', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes = [
    { value: 'daily', label: 'Journalier', desc: "Rapport d'aujourd'hui", icon: '📅' },
    { value: 'weekly', label: 'Hebdomadaire', desc: 'Rapport de la semaine en cours', icon: '📆' },
    { value: 'monthly', label: 'Mensuel', desc: 'Rapport du mois en cours', icon: '🗓️' },
    { value: 'custom', label: 'Personnalisé', desc: 'Choisissez vos dates', icon: '⚙️' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Rapports</h2>
        <p className="text-muted text-sm">Générer des rapports de ventes en PDF ou Excel</p>
      </div>

      {/* Report type selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {reportTypes.map((rt) => (
          <div
            key={rt.value}
            className="card"
            onClick={() => setReportType(rt.value)}
            style={{
              cursor: 'pointer',
              borderColor: reportType === rt.value ? 'var(--primary-400)' : undefined,
              background: reportType === rt.value ? 'rgba(59, 125, 243, 0.08)' : undefined,
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{rt.icon}</div>
            <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>{rt.label}</h4>
            <p className="text-muted text-sm">{rt.desc}</p>
          </div>
        ))}
      </div>

      {/* Custom date range */}
      {reportType === 'custom' && (
        <div className="card mb-4 slide-up" style={{ padding: '20px' }}>
          <h4 style={{ fontWeight: 700, marginBottom: '16px' }}>Période personnalisée</h4>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Date de début</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Date de fin</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Generate buttons */}
      <div className="card" style={{ padding: '24px' }}>
        <h4 style={{ fontWeight: 700, marginBottom: '16px' }}>Télécharger le rapport</h4>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => generateReport('pdf')}
            disabled={generating}
            style={{ padding: '14px 28px' }}
          >
            <FileText size={20} />
            {generating ? 'Génération...' : 'Télécharger PDF'}
          </button>
          <button
            className="btn btn-accent"
            onClick={() => generateReport('excel')}
            disabled={generating}
            style={{ padding: '14px 28px' }}
          >
            <FileSpreadsheet size={20} />
            {generating ? 'Génération...' : 'Télécharger Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
