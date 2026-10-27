# MyFlix

Nigerian streaming platform (Nollywood, movies, series, documentaries).

## Live links
- Web platform: https://thetechguydev.github.io/MyFlix/
- Admin dashboard: https://thetechguydev.github.io/MyFlix/admin/ (demo staff: admin@myflix.ng / MyFlix@2026)
- Mobile app preview (in browser): https://thetechguydev.github.io/MyFlix/app/
- Smart TV app (open in a TV's web browser, use arrow keys / remote): https://thetechguydev.github.io/MyFlix/tv/
- Clips feed: https://thetechguydev.github.io/MyFlix/clips/
- Android APK: [Releases → mobile-latest](https://github.com/TheTechGuyDev/MyFlix/releases/tag/mobile-latest)

## Demo notes (until Supabase is connected)
- Emails and SMS (sign-in codes, password resets, receipts) appear in an on-screen demo inbox and in Admin > Campaigns > Delivery log.
- Screen limits, TV pairing and Live Now work across tabs in the same browser.
- Yorùbá, Hausa, Igbo and Pidgin translations are a first pass and need review by native speakers.

## Structure
- `web/` – Web platform (Next.js, TypeScript, Tailwind CSS)
- `admin/` – Admin dashboard (Next.js, Recharts) — content, uploads, members, payments, analytics, campaigns, support, RBAC
- `mobile/` – Android + iOS app (Flutter)

Until the backend (Supabase) is connected, data lives in the browser. The admin and the web
platform share it on the same site, so titles, uploads, plans and settings published in the
admin appear on the web platform straight away.

Everything deploys automatically on every push to `main` (GitHub Actions).
