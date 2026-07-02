'use client';
// =====================================================================
// ATESTIO · Verejný web (landing) — app/page.js
// Súčasť tej istej aplikácie ako admin a API → jeden deploy (Netlify/Vercel),
// newsletter ukladá priamo do master databázy (Supabase) cez /api/newsletter.
// =====================================================================
import { useState } from 'react';
import './landing.css';

const Mark = ({ h = 32, dark = false }) => (
  <svg viewBox="0 0 120 120" style={{ height: h }} aria-hidden="true">
    <rect x="12" y="80" width="96" height="26" rx="9" fill={dark ? '#FFFFFF' : '#232B36'} opacity={dark ? 0.92 : 1} />
    <rect x="28" y="46" width="64" height="26" rx="9" fill={dark ? '#FFFFFF' : '#46536B'} opacity={dark ? 0.55 : 1} />
    <rect x="44" y="12" width="32" height="26" rx="9" fill={dark ? '#12B978' : '#0B9C64'} />
  </svg>
);

export default function Landing() {
  const [n, setN] = useState(1);
  const [nlStav, setNlStav] = useState('');
  const ceny = { 1: '100 €', 2: '200 €', 3: '300 €', 4: '400 €' };

  async function odoberat(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get('gdpr')) { setNlStav('Prosím, potvrďte súhlas so spracovaním e-mailu.'); return; }
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meno: f.get('meno'), email: f.get('email'), zdroj: 'landing' }),
      });
      if (!r.ok) throw new Error();
      setNlStav('Ďakujeme! Čoskoro sa ozveme.'); e.target.reset();
    } catch { setNlStav('Uloženie zlyhalo — skúste to prosím neskôr alebo napíšte na info@atestio.sk.'); }
  }

  return (
    <div className="lp">
      <nav>
        <div className="wrap nav-in">
          <a className="logo" href="#" aria-label="Atestio — domov"><Mark /><span>atestio<b>.</b></span></a>
          <div className="nav-links">
            <a href="#sluzby">Služby</a>
            <a href="#vizia">Vízia a ciele</a>
            <a href="#newsletter">Kontakt</a>
            <a className="btn" href="/moje">Prihlásiť sa</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <span className="eyebrow">Certifikovaný profesijný rozvoj online</span>
        <h1>Profesijný rast, ktorý sa <em>počíta</em>.</h1>
        <p className="sub">Atestio je vzdelávacia platforma pre ľudí, ktorých kvalifikácia má pravidlá — od pedagógov po odborné profesie. Programy absolvujete online vlastným tempom a výsledkom je doklad s reálnou hodnotou: príplatok, oprávnenie, kariérny posun.</p>
        <div className="hero-cta">
          <a className="btn btn-zeleny" href="#sluzby">Portfólio služieb</a>
          <a className="btn btn-obrys" href="#newsletter">Chcem informácie zadarmo</a>
        </div>
        <div className="hero-steps" aria-hidden="true"><div className="hs hs1" /><div className="hs hs2" /><div className="hs hs3" /></div>
      </header>

      <section id="sluzby" className="wrap">
        <h2 className="sec-title">Portfólio služieb</h2>
        <p className="sec-lead">Začíname vzdelávaním pedagógov, postupne pridávame odborné profesie. Všetko na jednej platforme, jedným kontom.</p>
        <div className="cards">
          <div className="card">
            <span className="tag tag-aktivny">PRVÝ PROGRAM · AKREDITÁCIA V KONANÍ</span>
            <h3>Inovačné vzdelávanie pre pedagógov</h3>
            <p>„Umelá inteligencia v práci učiteľa“ — tri úrovne po 50 hodín podľa oficiálneho Rámca AI kompetencií. Pre učiteľov ZŠ a SŠ, majstrov odbornej výchovy, vychovávateľov a pedagogických asistentov.</p>
            <a className="odkaz" href="#pedagogovia">Viac informácií ↓</a>
          </div>
          <div className="card">
            <span className="tag tag-pripravujeme">PRIPRAVUJEME</span>
            <h3>Odborné vzdelávanie a AOP</h3>
            <p>Aktualizačná odborná príprava a odborné kurzy pre technické profesie (elektrotechnici a ďalšie), s automatickým strážením termínov opakovania.</p>
          </div>
          <div className="card">
            <span className="tag tag-pripravujeme">PRIPRAVUJEME</span>
            <h3>Vzdelávanie na mieru</h3>
            <p>Programy pre školy, firmy a inštitúcie — od návrhu obsahu cez realizáciu online až po evidenciu a osvedčenia.</p>
          </div>
        </div>

        <details className="detail" id="pedagogovia">
          <summary>Viac informácií pre pedagógov a školy <span className="sipka">›</span></summary>
          <div className="detail-in">
            <div className="mini-cards">
              <div className="mini"><b>Level 1 · Získavanie</b><span>AI gramotnosť učiteľa: princípy, etika, bezpečné použitie. Výstup: návrh začlenenia AI do vášho predmetu v súlade so ŠVP/ŠkVP.</span><span className="pl">+3 % k platu</span></div>
              <div className="mini"><b>Level 2 · Prehlbovanie</b><span>AI vo vyučovaní so žiakmi: didaktika, diferenciácia, kritické používanie.</span><span className="pl">+3 % k platu</span></div>
              <div className="mini"><b>Level 3 · Vytváranie</b><span>Tvorba metodík, promptové knižnice, vedenie kolegov — ideálne pre digitálnych koordinátorov.</span><span className="pl">+3 % k platu</span></div>
            </div>
            <p style={{ color: 'var(--siva)', fontSize: '.95rem' }}>
              100 % online samoštúdium bez fixných termínov; jediný „živý“ bod je krátka online obhajoba v individuálnom termíne.
              Príplatok za profesijný rozvoj sa priznáva na 7 rokov (max. 12 %). Školy platia na faktúru a získavajú podklady pre povinné začlenenie AI do ŠkVP.
            </p>
            <div className="kalk">
              <label htmlFor="pocet">Kalkulačka: počet 50-hodinových kurzov</label>
              <input type="range" id="pocet" min="1" max="4" step="1" value={n} onChange={e => setN(+e.target.value)} />
              <div className="picked">{n} {n === 1 ? 'kurz' : 'kurzy'} · investícia {ceny[n]}</div>
              <div className="k-out">
                <div className="k-stat"><b>+{n * 3} %</b><span>príplatok k platu</span></div>
                <div className="k-stat"><b>{n * 45} – {n * 50} €</b><span>mesačne navyše · návratnosť ~2 mesiace</span></div>
                <div className="k-stat"><b>{(n * 45 * 84).toLocaleString('sk')} – {(n * 50 * 84).toLocaleString('sk')} €</b><span>prínos za 7 rokov</span></div>
              </div>
              <small>Orientačne; príplatok (3 % za každých 50 h) sa počíta z platovej tarify a priznáva ho riaditeľ na základe plánu profesijného rozvoja. Program je v akreditačnom konaní na MŠVVaM SR.</small>
            </div>
          </div>
        </details>
      </section>

      <section id="vizia" className="wrap">
        <div className="vizia">
          <div className="vizia-grid">
            <div>
              <h2 className="sec-title">Vízia</h2>
              <p style={{ color: 'var(--siva)' }}>Profesijný rozvoj na Slovensku je často papierovanie bez úžitku. Atestio ho chce zmeniť na niečo, čo sa počíta — vzdelávanie, ktoré sa dá zvládnuť popri práci, poctivo sa preukáže a prinesie merateľný výsledok: vyšší plat, platné oprávnenie, lepšiu prax. Jedna platforma, jedno konto, celá profesijná cesta.</p>
            </div>
            <div>
              <h2 className="sec-title">Ciele projektu</h2>
              <div className="ciel">Sprístupniť certifikované vzdelávanie plne online — vlastným tempom, bez zbytočných prekážok.</div>
              <div className="ciel">Každý program stavať na oficiálnych rámcoch a predpisoch, s preukázateľnou evidenciou.</div>
              <div className="ciel">Prepájať vzdelávanie s praxou: výstupy, ktoré účastník aj jeho škola či firma reálne použijú.</div>
              <div className="ciel">Postupne pokryť ďalšie profesie, kde kvalifikácia rozhoduje.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="newsletter" className="wrap">
        <div className="news">
          <h2 className="sec-title">Informácie zadarmo, priamo do schránky</h2>
          <p>Nechajte nám e-mail — pošleme vám podrobnosti o programoch, termíne spustenia a novinky v profesijnom rozvoji. Žiadny spam, odhlásenie jedným klikom.</p>
          <form onSubmit={odoberat}>
            <input type="text" name="meno" placeholder="Meno (nepovinné)" autoComplete="name" />
            <input type="email" name="email" placeholder="vas@email.sk" required autoComplete="email" />
            <button className="btn btn-zeleny" type="submit">Odoberať novinky</button>
            <label className="gdpr"><input type="checkbox" name="gdpr" /> Súhlasím so spracovaním e-mailu na zasielanie informácií o vzdelávaní (odvolateľné kedykoľvek). Zásady ochrany osobných údajov.</label>
          </form>
          {nlStav && <div className="ok">{nlStav}</div>}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div>
            <div className="fl"><Mark h={28} dark /> atestio<b>.</b></div>
            <small style={{ marginTop: 10 }}>Platforma pre certifikovaný profesijný rast. [DOPLNIŤ: obchodné meno s.r.o., IČO, sídlo] · info@atestio.sk</small>
          </div>
          <small>Program „Umelá inteligencia v práci učiteľa“ je v akreditačnom konaní na MŠVVaM SR; do vydania oprávnenia nejde o akreditované vzdelávanie. · GDPR · Obchodné podmienky</small>
        </div>
      </footer>
    </div>
  );
}
