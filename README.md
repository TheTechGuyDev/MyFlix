# MyFlix

Nigerian streaming platform (Nollywood, movies, series, documentaries).

## Live links
- Web platform: https://thetechguydev.github.io/MyFlix/
- Admin dashboard: https://thetechguydev.github.io/MyFlix/admin/ (demo staff: admin@myflix.ng / MyFlix@2026)
- Mobile app preview (in browser): https://thetechguydev.github.io/MyFlix/app/
- Android APK: [Releases → mobile-latest](https://github.com/TheTechGuyDev/MyFlix/releases/tag/mobile-latest)

## Structure
- `web/` – Web platform (Next.js, TypeScript, Tailwind CSS)
- `admin/` – Admin dashboard (Next.js, Recharts) — content, uploads, members, payments, analytics, campaigns, support, RBAC
- `mobile/` – Android + iOS app (Flutter)

Until the backend (Supabase) is connected, data lives in the browser. The admin and the web
platform share it on the same site, so titles, uploads, plans and settings published in the
admin appear on the web platform straight away.

Everything deploys automatically on every push to `main` (GitHub Actions).
