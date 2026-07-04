# Jadual OT Bersepadu

Sistem Penjanaan dan Pengurusan Jadual OT Kesihatan untuk hospital Malaysia.

## Teknologi

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI Library | Mantine v7 |
| State Management | Zustand |
| Routing | React Router v6 |
| Backend | Express.js + MongoDB (Mongoose) |
| Roster Solver | Web Worker (client-side) |
| PWA | vite-plugin-pwa |
| Charts | @mantine/charts (Recharts) |
| Icons | Tabler Icons |
| Date | dayjs |

## Ciri-ciri Utama

- **Penjanaan Jadual OT** — Solver constraint-based yang berjalan pada pelayar (Web Worker) dengan 18+ sekatan, strategi berbilang, dan pengoptimuman objektif
- **Pengurusan Kakitangan** — CRUD kakitangan dengan peranan PPF/PRA dan unit IPP/OPD
- **Tugasan AE** — Kalendar interaktif untuk tugasan Ambulan Emergency
- **Pra-pilihan** — Tetapkan kakitangan ke slot tertentu sebelum penjanaan
- **Ketidakhadiran** — Kakitangan boleh menandakan tarikh tidak tersedia
- **Laporan** — Kalendar, ringkasan, bayaran OT, log kelayakan, slot tidak diisi
- **Carta** — Bar chart dan donut chart untuk analisis bulanan dan tahunan
- **Tetapan** — Konfigurasi admin dan parameter solver
- **PWA** — Boleh dipasang sebagai aplikasi, sokongan luar talian
- **Tiga Peranan** — Kakitangan, Admin, Super Admin

## Persediaan

### Prasyarat

- Node.js 18+
- MongoDB Atlas (M0 percuma) atau MongoDB tempatan

### Langkah

1. **Klon repositori**
   ```bash
   git clone <repo-url>
   cd jadual-ot-bersepadu
   ```

2. **Pasang dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi persekitaran**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` dengan tetapan anda:
   - `MONGODB_URI` — String sambungan MongoDB Atlas
   - `JWT_SECRET` — Rahsia rawak 32+ aksara
   - `SUPERADMIN_NAME` — Nama super admin (lalai: `superadmin`)
   - `SUPERADMIN_PASSWORD_HASH` — Hash SHA-256 kata laluan super admin

4. **Jalankan pembangunan**
   ```bash
   # Terminal 1: Frontend (Vite)
   npm run dev
   
   # Terminal 2: Backend (Express)
   npm run server
   ```

5. **Buka pelayar**
   - Frontend: `http://localhost:5173`
   - API: `http://localhost:3001`

### Log Masuk Lalai

| Peranan | Nama | Kata Laluan |
|---------|------|-------------|
| Super Admin | `superadmin` | `1234` |
| Admin | `admin` | `admin` |

## Pembinaan & Pengeluaran

```bash
# Bina frontend
npm run build

# Pratonton binaan
npm run preview
```

## Pengeluaran ke Vercel

1. Push kod ke GitHub
2. Import projek di Vercel
3. Tetapkan environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `SUPERADMIN_NAME`
   - `SUPERADMIN_PASSWORD_HASH`
   - `NODE_ENV=production`
4. Deploy

## Struktur Projek

```
├── server/                  # Backend Express.js
│   ├── index.ts            # Entry point server
│   ├── middleware/          # Middleware pengesahan
│   ├── models/             # Model Mongoose
│   ├── routes/             # Laluan API
│   └── utils/              # Utiliti (DB, crypto)
├── src/                     # Frontend React
│   ├── App.tsx             # Komponen utama + routing
│   ├── layouts/            # Susun atur (AppShell)
│   ├── pages/              # Komponen halaman
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   ├── utils/              # Utiliti (API, tarikh)
│   └── workers/            # Web Worker (solver)
├── public/                  # Aset statik + PWA
├── index.html              # Titik masuk HTML
├── vite.config.ts          # Konfigurasi Vite + PWA
├── vercel.json             # Konfigurasi Vercel
└── .env.example            # Contoh fail persekitaran
```

## Hak Cipta

© 2024 Jadual OT Bersepadu. Semua hak cipta terpelihara.