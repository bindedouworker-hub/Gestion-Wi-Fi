# Adven's Manager — Gestion des Tickets Wi-Fi

Application web de gestion des tickets Wi-Fi pour **Adven's Center**.

## 🚀 Démarrage rapide

### Option 1 : Docker Compose (recommandé)

```bash
docker-compose up --build
```

L'application sera disponible sur :
- **Frontend** : http://localhost:80
- **API** : http://localhost:8000
- **API Docs** : http://localhost:8000/docs

### Option 2 : Développement local

#### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Démarrer PostgreSQL (Docker)
docker run -d --name advens_db \
  -e POSTGRES_USER=advens \
  -e POSTGRES_PASSWORD=advens_secret \
  -e POSTGRES_DB=advens_manager \
  -p 5432:5432 \
  postgres:16-alpine

# Lancer le backend
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend sera disponible sur http://localhost:5173

## 🔑 Compte par défaut

| Champ | Valeur |
|-------|--------|
| **Utilisateur** | `admin` |
| **Mot de passe** | `admin123` |

> ⚠️ Changez le mot de passe après la première connexion !

## 📁 Architecture

```
wifi/
├── backend/          # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/      # Routes API (8 modules)
│   │   ├── core/     # Sécurité JWT + dépendances
│   │   ├── models/   # Modèles SQLAlchemy (8 tables)
│   │   ├── schemas/  # Schémas Pydantic
│   │   ├── services/ # Logique métier
│   │   └── utils/    # PDF & Excel
│   └── Dockerfile
├── frontend/         # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/    # 8 pages
│   │   ├── store/    # Zustand
│   │   ├── lib/      # API client
│   │   └── types/    # TypeScript types
│   └── Dockerfile
├── nginx/            # Reverse proxy
├── docker-compose.yml
└── README.md
```

## 📋 Fonctionnalités

- ✅ Authentification JWT avec rôles (Admin / Vendeur)
- ✅ Tableau de bord avec statistiques en temps réel
- ✅ Import de lots de tickets Wi-Fi (détection de doublons)
- ✅ Attribution de tickets aux vendeurs (FIFO)
- ✅ Vente avec sélection automatique du ticket (FIFO)
- ✅ Paiement Espèces et Wave (QR code + numéro marchand)
- ✅ Réapprovisionnement avec workflow d'approbation
- ✅ Rapports PDF et Excel
- ✅ Gestion des moyens de paiement (ajout/suppression)
- ✅ Gestion des types d'abonnement
- ✅ Interface responsive (mobile, tablette, desktop)
- ✅ Thème sombre premium avec glassmorphism

## 🔌 API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/change-password`, `GET /api/auth/me` |
| Users | `GET/POST /api/users/`, `PUT/DELETE /api/users/{id}`, `POST /api/users/{id}/change-password` |
| Tickets | `GET/POST /api/tickets/`, `POST /api/tickets/batches`, `POST /api/tickets/bulk-assign` |
| Sales | `GET/POST /api/sales/`, `POST /api/sales/{id}/cancel` |
| Resupply | `GET/POST /api/resupply/`, `POST /api/resupply/{id}/process` |
| Dashboard | `GET /api/dashboard/` |
| Reports | `POST /api/reports/generate` |
| Settings | `GET/POST/PUT/DELETE /api/settings/payment-methods` |

## 🛡️ Sécurité

- JWT avec expiration 8h
- Mots de passe hachés (bcrypt)
- Rôles admin/vendeur
- Protection CORS
- Journal d'audit

## 📊 Types d'abonnement par défaut

| Nom | Durée | Prix |
|-----|-------|------|
| 1 Heure | 1h | 200 FCFA |
| 3 Heures | 3h | 500 FCFA |
| 24 Heures | 24h | 1 000 FCFA |
| 7 Jours | 168h | 3 000 FCFA |
| 30 Jours | 720h | 10 000 FCFA |

---

**Développé par Jackson Dje pour Adven's Center**
