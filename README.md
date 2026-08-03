# OpenMeter Admin UI

A React + Vite admin console for the [OpenMeter](https://openmeter.io) product catalog and billing APIs. It lets you manage meters, features, plans, customers, events, and invoices from a single dashboard.

## Features

- **Product Catalog** — create, list, and archive features (features are immutable after creation, per the [OpenMeter docs](https://openmeter.io/docs/product-catalog/feature); archiving maps to `DELETE /v1/features/{id}`).
- **Meters** — view and filter usage meters.
- **Customers, Plans, Events, Invoices** — manage the rest of the product catalog surface.
- **Dark / Light theme** — toggle persisted in `localStorage` (`openmeter_theme`), respects `prefers-color-scheme` by default.

## Tech Stack

- [React 18](https://react.dev) + [Vite](https://vitejs.dev)
- [React Router](https://reactrouter.com) (v6)
- [Tailwind CSS](https://tailwindcss.com) with `darkMode: 'class'`
- [Recharts](https://recharts.org) for usage charts
- [lucide-react](https://lucide.dev) icons
- [Axios](https://axios-http.com) for the API client

## Getting Started

### Prerequisites

- Node.js 18+
- A running OpenMeter instance (the dev proxy targets `http://localhost:48888` by default, or set a custom one, see below).

### Install & run

```bash
npm install
npm run dev
```

By default Vite runs on `http://localhost:3000` and proxies `/api` to `http://localhost:48888`. To point at another OpenMeter instance, create a `.env`:

```bash
# Any target (proxy rewrites /api -> /api/v3 unless path is already versioned)
API_PROXY_TARGET=http://localhost:48888

# Optional override for the axios base URL (bypasses the Vite proxy).
# Leave unset to use the relative /api proxy.
# VITE_API_BASE_URL=https://openmeter.cloud/api
```

Open the app, enter your OpenMeter API token on the login screen, and press **Connect**. The token is stored locally in `localStorage`.

### Production build

```bash
npm run build
npm run preview   # serves the built app on :4173
```

## Project Layout

```
src/
  api/openmeter.js       # Axios client + endpoints against the OpenMeter v1 API
  components/            # Page components (Dashboard, Meters, Features, ...)
  context/ThemeContext.jsx  # Dark/light theme state provider
  hooks/useConfirm.jsx   # Reusable confirm dialog hook
  utils/                 # Shared helpers
index.html               # Entry HTML + no-flash theme script
vite.config.js           # Dev/preview proxy to the OpenMeter backend
```

## Theme

Toggling is handled by `ThemeContext` (adds/removes the `dark` class on `<html>`) plus a no-flash inline script in `index.html`. The current selection is saved under `openmeter_theme` in `localStorage`; the system preference is used when nothing is saved yet.

## Notes on Feature CRUD

Per the OpenMeter v1 API, features have **no update endpoint** — a feature's `key` is assigned at creation and is immutable. The UI therefore provides **create**, **list** (with an "Archived" toggle), and **archive** (delete). To change a feature, archive it and create a new one.