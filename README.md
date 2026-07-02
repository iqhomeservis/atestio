# Atestio — vzdelávacia platforma (repo pripravené na GitHub → Netlify/Vercel)

Next.js 14 + Supabase. Jeden projekt = verejný web (/) + admin LMS (/admin/obsah)
+ API (/api/newsletter), napojený na master databázu Supabase (projekt „master“).

## STAV: databáza je už NASADENÁ
Migrácie `atestio_001_init` + `atestio_002_security_hardening` sú aplikované
v Supabase projekte **master** (rgwrtkdflwlztdkrswhs, eu-central-1):
tabuľky, RLS politiky, GRANTy, Storage buckety (materialy, odovzdania)
a evidenčný view `v_vykaz_ucastnika`. Advisors security check: vyriešené.

## Nasadenie (GitHub → Netlify)
1. `git init && git add -A && git commit -m "Atestio MVP"`
   `git remote add origin git@github.com:TVOJ-UCET/atestio.git && git push -u origin main`
2. Netlify → Add new project → Import from GitHub → vyber repo `atestio`
   (netlify.toml je pripravený — build `npm run build`, plugin Next.js).
3. Environment variables (Site settings → Environment):
   - NEXT_PUBLIC_SUPABASE_URL = https://rgwrtkdflwlztdkrswhs.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_2O4r4ofa9z6sNfHbxhNsKw_R2VXrEaQ
   - SUPABASE_SERVICE_ROLE_KEY = (Supabase dashboard → Settings → API — NIKDY do klienta)
4. Deploy. Doména atestio.sk → Netlify DNS/CNAME.
(Vercel: rovnaké kroky, bez netlify.toml.)

## Po nasadení
- Prihlás sa na /admin/obsah (magic link) a nastav si admin rolu:
  `update public.profiles set rola='admin' where id='<tvoje-uuid>';`
- Vytvor kurz AI-L1 → moduly M1–M6 → nahrávaj lekcie (video URL + dokumenty).
- Newsletter z landing formulára padá do `newsletter_subscribers` (databáza kontaktov).

## Videá
`video_url` lekcie = Bunny Stream embed (EÚ, podpísané URL) alebo nezaradené YouTube na štart.

## Evidencia pre kontrolu (ministerstvo)
`lesson_completions` (časové pečiatky + strávený čas), `submissions` (zadania + hodnotenie),
view `v_vykaz_ucastnika` = výkaz absolvovania na jeden klik. Rovnaký motor pre AI aj budúce AOP.

## Študentský portál (hotové)
- /moje — moje kurzy + ponuka otvorených kurzov + PRIHLÁŠKA (tok z praxe:
  potvrdenie riaditeľa → úhrada → prístup; platca = osoba / škola / firma-SZČO)
- /kurz/[id] — prehrávač: moduly a lekcie s postupným odomykaním (podľa nastavenia kurzu),
  video (Bunny/YT embed), dokumenty (podpísané URL), zadania s čestným vyhlásením;
  evidencia: otvorenie/dokončenie lekcie + strávený čas + odovzdania (kontrola ministerstva)
- /admin/prihlasky — životný cyklus prihlášky: nová → čaká na úhradu → uhradená → AKTÍVNA
  (aktivácia automaticky vytvorí zápis do kurzu cez DB trigger)
Migrácie v master DB: 001_init, 002_security_hardening, 003_rezim_ukoncenia, 004_prihlasky.

## Platby (hotové)
- KARTA (Stripe): účastník s platcom osoba/firma-SZČO klikne „Zaplatiť kartou“ na /moje
  → Stripe Checkout → webhook /api/stripe-webhook platbu zapíše a prihlášku AUTOMATICKY
  aktivuje (trigger vytvorí zápis do kurzu) — nulový zásah admina.
  Nastavenie po deploji: Stripe → Developers → Webhooks → Add endpoint
  https://TVOJA-DOMENA/api/stripe-webhook (event: checkout.session.completed)
  a doplniť STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + NEXT_PUBLIC_APP_URL do env.
- FAKTÚRA (prevod, školy/firmy): admin na /admin/prihlasky „Vystaviť proformu“
  (číslo+VS automaticky zo sekvencie), tlačiteľná na /faktura/[id] (Ctrl+P → PDF);
  po prijatí prevodu „Úhrada prijatá“ → „Aktivovať prístup“.
  Dodávateľské údaje doplň v app/faktura/[id]/page.js (konštanta DODAVATEL).
Migrácie v master DB: 001–005 (005 = platby, faktury, číslovanie faktúr).

## Ďalej v poradí
Obhajoby a osvedčenia s verejným overením (atestio.sk/overit/{kod}) → mobilná appka (Expo).
