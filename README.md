# Azure Simple Mon

Dashboard monitoring Azure DevOps Platform Sprint — dibangun dengan **Nuxt 3** + **Nuxt UI v3**.

## Fitur

| Halaman | Route | Deskripsi |
|---|---|---|
| Welcome Wizard | `/` | Overview fitur & panduan |
| PBI Ready Release | `/dashboard` | PBI yang siap release, expandable child task |
| Timeline Gantt Chart | `/timeline` | History state task: In Progress → Released |
| Progress Minggu Lalu | `/progress` | Task In Progress minggu lalu + durasi jam kerja |
| Login | `/login` | Session-based auth (SHA-256 + signed cookie) |

## Tech Stack

- **Framework:** [Nuxt 3](https://nuxt.com) (Nitro SSR)
- **UI:** [Nuxt UI v3](https://ui.nuxt.com) (Tailwind CSS v4 + Reka UI)
- **Backend:** Nuxt server routes (`/server/api/`) → Azure DevOps REST API v7.1
- **Auth:** SHA-256 password hash + signed session cookie (no external session library)

## Requirements

- Node.js **≥ 20**
- Azure DevOps PAT dengan akses **read** work items & project

## Setup

```bash
git clone https://github.com/daewu14/azure-simple-mon.git
cd azure-simple-mon
cp .env.example .env
npm install
```

Isi konfigurasi di `.env`:

```env
AZURE_DEVOPS_PAT=
DASHBOARD_AUTH_SALT=
DASHBOARD_AUTH_PASSWORD_SHA256=
DASHBOARD_SESSION_SECRET=
```

### Generate password hash

```bash
node -e "
  const c = require('crypto');
  const salt = c.randomBytes(16).toString('hex');
  const password = 'GANTI_PASSWORD_INI';
  console.log('DASHBOARD_AUTH_SALT=' + salt);
  console.log('DASHBOARD_AUTH_PASSWORD_SHA256=' + c.createHash('sha256').update(salt+':'+password).digest('hex'));
"
```

### Generate session secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Scripts

```bash
npm run dev      # Dev server (hot reload)
npm run build    # Build production
npm start        # Jalankan production build (.output/server/index.mjs)
```

Dev server default: **http://localhost:5762**

## CI/CD Release Deployment

Repository ini punya GitHub Actions workflow `.github/workflows/release-deploy.yml` yang otomatis build dan deploy ke server production saat release tag dibuat.

Trigger deploy:

- push tag dengan format `v*`, contoh `v2.0.1`
- atau publish GitHub Release dengan tag `v*`

Production target default:

- URL app: `http://129.226.91.201:5762`
- server user: `ubuntu`
- app dir: `/home/ubuntu/workspace/azure-simple-mon`
- systemd service: `delivery-kpi-dashboard.service`

GitHub secrets yang wajib diset:

| Secret | Deskripsi |
|---|---|
| `DEPLOY_SSH_KEY` | Private SSH key untuk login ke server deploy |

GitHub secrets opsional:

| Secret | Default | Deskripsi |
|---|---|---|
| `DEPLOY_HOST` | `129.226.91.201` | Host/IP server deploy |
| `DEPLOY_USER` | `ubuntu` | User SSH server deploy |
| `DEPLOY_PORT` | `22` | Port SSH server deploy |

GitHub variables opsional:

| Variable | Default | Deskripsi |
|---|---|---|
| `APP_URL` | `http://129.226.91.201:5762` | URL public untuk verifikasi deploy |
| `DEPLOY_APP_DIR` | `/home/ubuntu/workspace/azure-simple-mon` | Path repo app di server |
| `DEPLOY_SERVICE_NAME` | `delivery-kpi-dashboard.service` | Nama systemd service |
| `DEPLOY_HEALTHCHECK_URL` | `http://127.0.0.1:5762/api/test` | Healthcheck lokal setelah restart |

Contoh release:

```bash
git tag v2.0.1
git push origin v2.0.1
```

Deploy script akan checkout tag tersebut di server, menjalankan `npm ci`, `npm run build`, restart service, lalu verifikasi healthcheck lokal dan URL public.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5762` | Port server |
| `HOST` | `0.0.0.0` | Bind host |
| `AZURE_DEVOPS_ORG` | `KiriminAja2026` | Azure DevOps organization |
| `AZURE_DEVOPS_PROJECT` | `Product Delivery` | Azure DevOps project |
| `AZURE_DEVOPS_TEAM` | `Platform Squad` | Default team |
| `AZURE_DEVOPS_TEAMS` | — | Comma-separated daftar team (opsional) |
| `AZURE_DEVOPS_PAT` | — | Personal Access Token Azure DevOps |
| `DASHBOARD_AUTH_USERNAME` | `daewubintara@kiriminaja.com` | Username login |
| `DASHBOARD_AUTH_SALT` | — | Salt untuk password hash |
| `DASHBOARD_AUTH_PASSWORD_SHA256` | — | SHA-256 hash dari `salt:password` |
| `DASHBOARD_SESSION_SECRET` | random at boot | Secret signed session cookie |

> [!CAUTION]
> Jangan commit file `.env`. `.gitignore` sudah mengabaikan `.env*` (kecuali `.env.example`) dan folder `.nuxt/`, `.output/`.

## Struktur Project

```
├── pages/              # Vue pages (login, dashboard, timeline, progress)
├── layouts/            # Default layout (sidebar + nav)
├── components/         # Shared components (StateBadge, ReasonBadge)
├── composables/        # useTeam composable
├── server/
│   ├── api/            # Nuxt server routes (Azure DevOps proxy)
│   │   └── auth/       # Login / logout endpoints
│   ├── middleware/      # Auth middleware (proteksi route)
│   └── utils/          # azure.ts (API logic), auth.ts (session)
├── assets/css/         # Global CSS (Tailwind + Nuxt UI + custom)
├── nuxt.config.ts      # Nuxt configuration
└── app.config.ts       # Nuxt UI theme (orange primary)
```

## Notes

- Jika `AZURE_DEVOPS_PAT` belum diset, endpoint API akan throw error `AZURE_DEVOPS_PAT is not set`
- Data di-cache di memori server selama **60 detik** per sprint/team
- Auth bisa dinonaktifkan dengan mengosongkan `DASHBOARD_AUTH_SALT` dan `DASHBOARD_AUTH_PASSWORD_SHA256`
