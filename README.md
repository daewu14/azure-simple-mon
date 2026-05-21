# Azure Simple Mon

Standalone Node.js dashboard untuk monitoring Azure DevOps Product Delivery sprint, termasuk:

- Login dashboard
- Welcome wizard (`/`)
- PBI Ready Release dashboard (`/dashboard`)
- Timeline/Gantt sprint (`/timeline`)
- Progress Minggu Lalu (`/progress`)
- JSON API (`/api/data`, `/api/timeline`, `/api/progress`, `/api/me`, dll.)

Aplikasi ini adalah server Node.js single-file tanpa dependency eksternal.

## Requirements

- Node.js 18+
- Azure DevOps PAT dengan akses read work items / project

## Setup

```bash
git clone https://github.com/daewu14/azure-simple-mon.git
cd azure-simple-mon
cp .env.example .env
```

Isi konfigurasi di `.env`, terutama:

```env
AZURE_DEVOPS_PAT=
DASHBOARD_AUTH_SALT=
DASHBOARD_AUTH_PASSWORD_SHA256=
DASHBOARD_SESSION_SECRET=
```

Generate password hash:

```bash
node -e "const crypto=require('crypto'); const salt=crypto.randomBytes(16).toString('hex'); const password='CHANGE_ME'; console.log('DASHBOARD_AUTH_SALT='+salt); console.log('DASHBOARD_AUTH_PASSWORD_SHA256='+crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex'))"
```

Generate session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Run

```bash
set -a
source .env
set +a
npm start
```

Default URL:

```text
http://localhost:5762
```

## Scripts

```bash
npm run check   # syntax check
npm start       # start server
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5762` | Port HTTP server |
| `HOST` | `0.0.0.0` | Bind host |
| `AZURE_DEVOPS_ORG` | `KiriminAja2026` | Azure DevOps organization |
| `AZURE_DEVOPS_PROJECT` | `Product Delivery` | Azure DevOps project |
| `AZURE_DEVOPS_TEAM` | `Platform Squad` | Default team |
| `AZURE_DEVOPS_TEAMS` | empty | Optional comma-separated teams |
| `AZURE_DEVOPS_PAT` | empty | PAT untuk fetch data live Azure DevOps |
| `DASHBOARD_AUTH_USERNAME` | `daewubintara@kiriminaja.com` | Username login dashboard |
| `DASHBOARD_AUTH_SALT` | empty | Salt password login |
| `DASHBOARD_AUTH_PASSWORD_SHA256` | empty | SHA256 hash format `salt:password` |
| `DASHBOARD_SESSION_SECRET` | random at boot | Secret untuk signed session cookie |

> Jangan commit file `.env` atau secret apa pun. `.gitignore` sudah mengabaikan `.env*` kecuali `.env.example`.

## Health Check

```text
GET /healthz
```

## Notes

Jika `AZURE_DEVOPS_PAT` belum diset atau Azure DevOps tidak bisa diakses, sebagian halaman dapat memakai fallback/sample data bawaan untuk menjaga dashboard tetap bisa dibuka.
