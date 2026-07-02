'use client';
// =====================================================================
// ATESTIO · Študentský portál: Moje kurzy (/moje)
// Tok: prihláška (potvrdenie riaditeľa) → úhrada → prístup (enrollment).
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { useAuth, LoginBox } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

const STAVY = {
  nova: 'Prihláška prijatá — čaká na spracovanie',
  cakajuca_platba: 'Čaká na úhradu (pokyny sme poslali e-mailom)',
  zaplatena: 'Úhrada prijatá — aktivujeme prístup',
  aktivna: 'Aktívne',
  zamietnuta: 'Zamietnutá',
};

export default function Moje() {
  const user = useAuth();
  const [kurzy, setKurzy] = useState([]);          // otvorené kurzy
  const [zapisy, setZapisy] = useState([]);        // moje enrollmenty + progres
  const [prihlasky, setPrihlasky] = useState([]);  // moje prihlášky
  const [faktury, setFaktury] = useState({});      // prihlaska_id -> faktúra
  const [formPre, setFormPre] = useState(null);    // course id, pre ktorý je otvorený formulár
  const [sprava, setSprava] = useState('');

  const nacitaj = useCallback(async () => {
    const [{ data: k }, { data: e }, { data: p }, { data: fx }] = await Promise.all([
      supabase.from('courses').select('*').eq('stav', 'otvoreny').order('kod'),
      supabase.from('enrollments').select('*, courses(kod, nazov, rozsah_hodin)').order('started_at', { ascending: false }),
      supabase.from('prihlasky').select('*').order('created_at', { ascending: false }),
      supabase.from('faktury').select('*'),
    ]);
    setKurzy(k ?? []); setZapisy(e ?? []); setPrihlasky(p ?? []);
    setFaktury(Object.fromEntries((fx ?? []).map(x => [x.prihlaska_id, x])));
  }, []);
  useEffect(() => { if (user) nacitaj(); }, [user, nacitaj]);

  async function podajPrihlasku(e, course) {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get('riaditel')) { setSprava('Pre pedagógov je potrebné potvrdenie riaditeľa (plán profesijného rozvoja).'); return; }
    const { error } = await supabase.from('prihlasky').insert({
      user_id: user.id, course_id: course.id,
      skola: f.get('skola') || null,
      platca: f.get('platca'),
      potvrdenie_riaditela: true,
      poznamka: f.get('poznamka') || null,
    });
    setSprava(error ? 'Chyba: ' + error.message : 'Prihláška odoslaná. O ďalšom postupe (úhrada) vás budeme informovať e-mailom.');
    setFormPre(null); nacitaj();
  }

  async function zaplatKartou(p) {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ prihlaska_id: p.id }),
    });
    const d = await r.json();
    if (d.url) location.href = d.url; else setSprava(d.error || 'Platba momentálne nie je dostupná.');
  }

  if (user === undefined) return null;
  if (!user) return <LoginBox nadpis="Atestio · vstup do štúdia" />;

  const mamPrihlasku = cid => prihlasky.find(p => p.course_id === cid);
  const mamZapis = cid => zapisy.find(z => z.course_id === cid);

  return (
    <main style={{ maxWidth: 900, margin: '30px auto', padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Moje štúdium</h1>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Odhlásiť</button>
      </header>
      {sprava && <p className="karta" style={{ marginBottom: 14 }}>{sprava}</p>}

      <section style={{ marginBottom: 30 }}>
        <h2 style={{ marginBottom: 12 }}>Moje kurzy</h2>
        {zapisy.length === 0 && <p style={{ color: 'var(--siva)' }}>Zatiaľ nemáte aktívny kurz.</p>}
        {zapisy.map(z => (
          <a key={z.id} href={`/kurz/${z.course_id}`} className="karta"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, textDecoration: 'none', color: 'inherit' }}>
            <span><b>{z.courses?.kod}</b> — {z.courses?.nazov}</span>
            <span className="btn btn-zeleny" style={{ padding: '8px 14px' }}>Pokračovať →</span>
          </a>
        ))}
      </section>

      <section>
        <h2 style={{ marginBottom: 12 }}>Ponuka kurzov</h2>
        {kurzy.map(k => {
          const pr = mamPrihlasku(k.id), za = mamZapis(k.id);
          return (
            <div key={k.id} className="karta" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <b>{k.kod}</b> — {k.nazov}
                  <div style={{ fontSize: '.85rem', color: 'var(--siva)' }}>{k.rozsah_hodin} h · {Number(k.cena_eur)} €</div>
                </div>
                {za ? <span style={{ color: 'var(--smaragd)', fontWeight: 600 }}>Zapísaný</span>
                  : pr ? (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--slate)', fontWeight: 600 }}>{STAVY[pr.stav]}</span>
                      {['nova', 'cakajuca_platba'].includes(pr.stav) && pr.platca !== 'skola' &&
                        <button className="btn btn-zeleny" onClick={() => zaplatKartou(pr)}>Zaplatiť kartou</button>}
                      {faktury[pr.id] &&
                        <a className="btn" href={`/faktura/${faktury[pr.id].id}`}>Faktúra {faktury[pr.id].cislo}</a>}
                    </span>
                  )
                  : <button className="btn btn-zeleny" onClick={() => setFormPre(formPre === k.id ? null : k.id)}>Podať prihlášku</button>}
              </div>

              {formPre === k.id && !pr && !za && (
                <form onSubmit={e => podajPrihlasku(e, k)} style={{ marginTop: 14, borderTop: '1px solid var(--linka)', paddingTop: 10 }}>
                  <label>Škola / organizácia</label>
                  <input name="skola" placeholder="Názov školy alebo firmy" />
                  <label>Kto uhradí kurz</label>
                  <select name="platca">
                    <option value="osoba">Ja (fyzická osoba)</option>
                    <option value="skola">Škola / zriaďovateľ (faktúra)</option>
                    <option value="firma_szco">Firma / SZČO (faktúra)</option>
                  </select>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginTop: 10 }}>
                    <input type="checkbox" name="riaditel" style={{ width: 'auto', marginTop: 3 }} />
                    Potvrdzujem, že vzdelávanie mám odsúhlasené riaditeľom / je v pláne profesijného rozvoja školy
                    (pri AOP a firemných kurzoch potvrdzujem oprávnenie objednať).
                  </label>
                  <label>Poznámka (nepovinné)</label>
                  <input name="poznamka" placeholder="Napr. fakturačné údaje, počet kolegov…" />
                  <button className="btn btn-zeleny" style={{ marginTop: 12 }}>Odoslať prihlášku</button>
                </form>
              )}
            </div>
          );
        })}
        {kurzy.length === 0 && <p style={{ color: 'var(--siva)' }}>Momentálne nie je otvorený žiadny kurz.</p>}
      </section>
    </main>
  );
}
