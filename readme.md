# 🟢 OneKamer.co – Front-End (PRODUCTION)

## 🌍 Description
Version **de production** de l’application **PWA OneKamer.co**, développée avec **React + Vite + Windsurf**  
et connectée à l’API **Render** ainsi qu’à **Supabase** et **BunnyCDN**.  

Cette application constitue l’interface principale du réseau communautaire **OneKamer.co**,  
permettant aux utilisateurs d’accéder à la plateforme, gérer leurs abonnements, et interagir avec la communauté.

---

## 🧠 Architecture & Environnement

| Composant | Technologie | Hébergement |
|------------|-------------|--------------|
| Front-End (PWA) | React + Vite + Windsurf | Hostinger |
| Backend API | Node.js / Express | Render |
| Base de données | Supabase (PostgreSQL) | Supabase Cloud |
| Stockage médias | BunnyCDN (Edge Storage + CDN) | Bunny.net |
| Paiement | Stripe (Checkout + Webhook) | Render |
| Authentification | Supabase Auth | Supabase |

---

## ⚙️ Fonctionnalités principales

```markdown
### Fonctionnalités principales

- Authentification sécurisée via **Supabase Auth**
- Gestion des profils utilisateurs et abonnements
- Paiements et plans dynamiques via **Stripe Checkout**
- Attribution automatique des accès via `plan_features`
- Affichage et synchronisation des **OK COINS**
- Interface responsive et installable (PWA)
- Intégration complète des médias via **BunnyCDN**
- Routage et gestion d’état avec **React Router** et **Context API**
### Variables d’environnement

VITE_SUPABASE_URL=<url_supabase_prod>  
VITE_SUPABASE_ANON_KEY=<cle_anon_supabase>  
VITE_RENDER_API_URL=https://onekamer-server.onrender.com  
VITE_BUNNY_CDN_URL=https://onekamer-media-cdn.b-cdn.net  
VITE_STRIPE_PUBLIC_KEY=<cle_publique_stripe>

### Commandes utiles

# Installation des dépendances
npm install

# Lancement du serveur de développement
npm run dev

# Construction de la version production
npm run build

# Prévisualisation du build (optionnel)
npm run preview

### 🌐 Déploiement

L’application est déployée automatiquement sur **Hostinger** à l’adresse suivante :  
👉 [https://onekamer.co](https://onekamer.co)


### Structure du projet

onekamer-front/
├── public/                 # Manifest & assets PWA
├── src/
│   ├── components/         # Composants UI réutilisables
│   ├── pages/              # Pages principales de l’application
│   ├── contexts/           # Contexts globaux (auth, profil, etc.)
│   ├── lib/                # Clients API (Supabase, Stripe)
│   └── styles/             # Feuilles de style globales
├── package.json            # Métadonnées du projet
├── vite.config.js          # Configuration Vite
└── README.md               # Documentation (ce fichier)

### Auteurs

Développé par **William Soppo** & **Annaëlle Bilounga**  
© 2025 **OneKamer SAS** — Tous droits réservés.  

### Licence

Propriété privée – Usage exclusif de OneKamer SAS.  
Toute reproduction, modification ou diffusion non autorisée du code est strictement interdite.
