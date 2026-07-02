'use client';
// =====================================================================
// ATESTIO · Admin: Správa obsahu (kurzy → moduly → lekcie)
// Jednoduché nahrávanie videí (URL) a dokumentov (Supabase Storage).
// Prístup: len profily s rolou admin/lektor (vynucuje aj RLS v databáze).
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SpravaObsahu() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [odoslane, setOdoslane] = useState(false);
  const [kurzy, setKurzy] = useState([]);
  const [kurz, setKurz] = useState(null);
  const [moduly, setModuly] = useState([]);
  const [modul, setModul] = useState(null);
  const [lekcie, setLekcie] = useState([]);
  const [sprava, setSprava] = useState('');

  // ---------- auth ----------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function prihlasit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) setSprava('Prihlásenie zlyhalo: ' + error.message);
    else setOdoslane(true);
  }

  // ---------- načítanie dát ----------
  const nacitajKurzy = useCallback(async () => {
    const { data, error } = await supabase.from('courses').select('*').order('kod');
    if (!error) setKurzy(data ?? []);
  }, []);
  useEffect(() => { if (user) nacitajKurzy(); }, [user, nacitajKurzy]);

  useEffect(() => {
    if (!kurz) { setModuly([]); setModul(null); return; }
    supabase.from('course_modules').select('*').eq('course_id', kurz.id).order('poradie')
      .then(({ data }) => setModuly(data ?? []));
  }, [kurz]);

  useEffect(() => {
    if (!modul) { setLekcie([]); return; }
    supabase.from('lessons').select('*').eq('module_id', modul.id).order('poradie')
      .then(({ data }) => setLekcie(data ?? []));
  }, [modul]);

  // ---------- vytváranie ----------
  async function novyKurz(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await supabase.from('courses').insert({
      kod: f.get('kod'), nazov: f.get('nazov'), uroven: f.get('uroven') || null,
      vetva: f.get('vetva'), cena_eur: Number(f.get('cena') || 100),
      rozsah_hodin: Number(f.get('rozsah') || 50),
      vynutit_postupnost: f.get('postupnost') === 'on',
      min_dni_do_obhajoby: Number(f.get('mindni') || 0),
    });
    setSprava(error ? 'Chyba: ' + error.message : 'Kurz vytvorený.');
    e.target.reset(); nacitajKurzy();
  }

  async function novyModul(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await supabase.from('course_modules').insert({
      course_id: kurz.id, poradie: Number(f.get('poradie') || moduly.length + 1), nazov: f.get('nazov'),
    });
    setSprava(error ? 'Chyba: ' + error.message : 'Modul pridaný.');
    e.target.reset();
    const { data } = await supabase.from('course_modules').select('*').eq('course_id', kurz.id).order('poradie');
    setModuly(data ?? []);
  }

  async function novaLekcia(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const subor = f.get('subor');
    let subor_path = null;

    // 1) dokument → Supabase Storage (bucket "materialy")
    if (subor && subor.size > 0) {
      const cesta = `${kurz.kod}/${modul.id}/${Date.now()}_${subor.name}`;
      const { error: upErr } = await supabase.storage.from('materialy').upload(cesta, subor);
      if (upErr) { setSprava('Nahranie súboru zlyhalo: ' + upErr.message); return; }
      subor_path = cesta;
    }

    // 2) lekcia do databázy
    const { error } = await supabase.from('lessons').insert({
      module_id: modul.id,
      poradie: Number(f.get('poradie') || lekcie.length + 1),
      typ: f.get('typ'),
      nazov: f.get('nazov'),
      video_url: f.get('video_url') || null,
      obsah_md: f.get('obsah') || null,
      subor_path,
      minuty_odhad: Number(f.get('minuty') || 15),
    });
    setSprava(error ? 'Chyba: ' + error.message : 'Lekcia uložená.');
    e.target.reset();
    const { data } = await supabase.from('lessons').select('*').eq('module_id', modul.id).order('poradie');
    setLekcie(data ?? []);
  }

  async function zmazLekciu(id) {
    if (!confirm('Zmazať lekciu?')) return;
    await supabase.from('lessons').delete().eq('id', id);
    setLekcie(lekcie.filter(l => l.id !== id));
  }

  // ---------- UI ----------
  if (!user) return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: 20 }}>
      <h1 style={{ marginBottom: 12 }}>Atestio · prihlásenie</h1>
      {odoslane ? <p>Skontrolujte si e-mail — poslali sme vám prihlasovací odkaz.</p> : (
        <form onSubmit={prihlasit} className="karta">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <button className="btn btn-zeleny" style={{ marginTop: 14, width: '100%' }}>Poslať prihlasovací odkaz</button>
        </form>
      )}
      {sprava && <p style={{ marginTop: 10, color: '#B00' }}>{sprava}</p>}
    </main>
  );

  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Správa obsahu</h1>
        <span style={{ display: 'flex', gap: 8 }}><a className="btn" href="/admin/prihlasky">Prihlášky</a><button className="btn" onClick={() => supabase.auth.signOut()}>Odhlásiť</button></span>
      </header>
      {sprava && <p className="karta" style={{ marginBottom: 14 }}>{sprava}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 16 }}>
        {/* KURZY */}
        <section className="karta">
          <h3>1 · Kurzy</h3>
          {kurzy.map(k => (
            <button key={k.id} onClick={() => { setKurz(k); setModul(null); }} className="btn"
              style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8,
                background: kurz?.id === k.id ? 'var(--smaragd)' : 'var(--grafit)' }}>
              {k.kod} — {k.nazov}
            </button>
          ))}
          <form onSubmit={novyKurz} style={{ marginTop: 16, borderTop: '1px solid var(--linka)', paddingTop: 10 }}>
            <label>Nový kurz</label>
            <input name="kod" placeholder="Kód (AI-L1)" required />
            <input name="nazov" placeholder="Názov" required style={{ marginTop: 6 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <select name="vetva"><option value="pedagog">pedagóg</option><option value="aop">AOP</option><option value="ine">iné</option></select>
              <input name="uroven" placeholder="Úroveň" />
              <input name="cena" placeholder="€" style={{ width: 70 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
              <input name="rozsah" placeholder="Rozsah h (50)" style={{ width: 110 }} title="Rozsah programu v hodinách (študijná záťaž)" />
              <input name="mindni" placeholder="Min. dní do obhajoby (0)" style={{ width: 170 }} title="Poistka: najskorší termín obhajoby od zápisu; 0 = vypnuté" />
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                <input type="checkbox" name="postupnost" defaultChecked style={{ width: 'auto' }} /> postupné odomykanie
              </label>
            </div>
            <button className="btn btn-zeleny" style={{ marginTop: 8 }}>Vytvoriť</button>
          </form>
        </section>

        {/* MODULY */}
        <section className="karta">
          <h3>2 · Moduly {kurz ? `(${kurz.kod})` : ''}</h3>
          {!kurz && <p style={{ color: 'var(--siva)' }}>Vyberte kurz.</p>}
          {moduly.map(m => (
            <button key={m.id} onClick={() => setModul(m)} className="btn"
              style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8,
                background: modul?.id === m.id ? 'var(--smaragd)' : 'var(--grafit)' }}>
              M{m.poradie} — {m.nazov}
            </button>
          ))}
          {kurz && (
            <form onSubmit={novyModul} style={{ marginTop: 16, borderTop: '1px solid var(--linka)', paddingTop: 10 }}>
              <label>Nový modul</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input name="poradie" placeholder="Č." style={{ width: 60 }} />
                <input name="nazov" placeholder="Názov modulu" required />
              </div>
              <button className="btn btn-zeleny" style={{ marginTop: 8 }}>Pridať</button>
            </form>
          )}
        </section>

        {/* LEKCIE */}
        <section className="karta">
          <h3>3 · Lekcie {modul ? `(M${modul.poradie})` : ''}</h3>
          {!modul && <p style={{ color: 'var(--siva)' }}>Vyberte modul.</p>}
          {lekcie.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--linka)' }}>
              <span>{l.poradie}. [{l.typ}] {l.nazov} {l.video_url ? '🎬' : ''} {l.subor_path ? '📄' : ''}</span>
              <button onClick={() => zmazLekciu(l.id)} style={{ background: 'none', border: 'none', color: '#B00' }}>✕</button>
            </div>
          ))}
          {modul && (
            <form onSubmit={novaLekcia} style={{ marginTop: 14 }}>
              <label>Nová lekcia</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input name="poradie" placeholder="Č." style={{ width: 60 }} />
                <select name="typ" style={{ width: 130 }}>
                  <option value="video">video</option><option value="dokument">dokument</option>
                  <option value="kviz">kvíz</option><option value="zadanie">zadanie</option>
                </select>
                <input name="minuty" placeholder="min" style={{ width: 70 }} title="Odhad študijnej záťaže (evidencia hodín)" />
              </div>
              <input name="nazov" placeholder="Názov lekcie" required style={{ marginTop: 6 }} />
              <input name="video_url" placeholder="Video URL (Bunny Stream / embed)" style={{ marginTop: 6 }} />
              <textarea name="obsah" placeholder="Text lekcie / zadanie (Markdown)" rows={3} style={{ marginTop: 6 }} />
              <label style={{ marginTop: 8 }}>Dokument na štúdium (PDF/DOCX…)</label>
              <input name="subor" type="file" />
              <button className="btn btn-zeleny" style={{ marginTop: 10 }}>Uložiť lekciu</button>
            </form>
          )}
        </section>
      </div>

      <p style={{ marginTop: 18, color: 'var(--siva)', fontSize: '.85rem' }}>
        Evidencia pre kontrolu: každé otvorenie a dokončenie lekcie účastníkom sa zapisuje do
        <code> lesson_completions</code> (čas, trvanie); súhrn na účastníka poskytuje view <code>v_vykaz_ucastnika</code>.
      </p>
    </main>
  );
}
