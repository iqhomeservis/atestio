'use client';
// =====================================================================
// ATESTIO · Prehrávač kurzu (/kurz/[id])
// Evidencia: otvorenie lekcie, dokončenie, strávený čas (lesson_completions),
// odovzdanie zadaní (submissions + Storage). Rešpektuje nastavenia kurzu:
// vynutit_postupnost (postupné odomykanie) — výstupy rozhodujú, čas sa loguje.
// =====================================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, LoginBox } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

export default function Kurz() {
  const { id: courseId } = useParams();
  const user = useAuth();
  const [kurz, setKurz] = useState(null);
  const [zapis, setZapis] = useState(null);
  const [moduly, setModuly] = useState([]);
  const [lekcie, setLekcie] = useState([]);       // všetky lekcie kurzu (s module_id)
  const [compl, setCompl] = useState({});          // lesson_id -> completion
  const [subs, setSubs] = useState({});            // lesson_id -> submission
  const [aktivna, setAktivna] = useState(null);    // aktívna lekcia
  const [docUrl, setDocUrl] = useState(null);
  const [sprava, setSprava] = useState('');
  const otvoreneOd = useRef(null);                 // timestamp otvorenia aktívnej lekcie

  const nacitaj = useCallback(async () => {
    const [{ data: k }, { data: e }] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('enrollments').select('*').eq('course_id', courseId).eq('user_id', user.id).maybeSingle(),
    ]);
    setKurz(k); setZapis(e);
    if (!e) return;
    const { data: m } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('poradie');
    setModuly(m ?? []);
    const modIds = (m ?? []).map(x => x.id);
    const { data: l } = modIds.length
      ? await supabase.from('lessons').select('*').in('module_id', modIds).order('poradie')
      : { data: [] };
    setLekcie(l ?? []);
    const { data: c } = await supabase.from('lesson_completions').select('*').eq('enrollment_id', e.id);
    setCompl(Object.fromEntries((c ?? []).map(x => [x.lesson_id, x])));
    const { data: s } = await supabase.from('submissions').select('*').eq('enrollment_id', e.id);
    setSubs(Object.fromEntries((s ?? []).map(x => [x.lesson_id, x])));
  }, [courseId, user]);
  useEffect(() => { if (user) nacitaj(); }, [user, nacitaj]);

  // zoradený zoznam lekcií podľa modulov a poradia + logika odomykania
  const zoznam = useMemo(() => {
    const poradieModulov = Object.fromEntries(moduly.map((m, i) => [m.id, i]));
    return [...lekcie].sort((a, b) =>
      (poradieModulov[a.module_id] - poradieModulov[b.module_id]) || (a.poradie - b.poradie));
  }, [moduly, lekcie]);

  const jeHotova = l => l.typ === 'zadanie' ? !!subs[l.id] : !!compl[l.id]?.dokoncene_at;
  const jeOdomknuta = idx => {
    if (!kurz?.vynutit_postupnost) return true;
    for (let i = 0; i < idx; i++) if (zoznam[i].povinna && !jeHotova(zoznam[i])) return false;
    return true;
  };

  // otvorenie lekcie = evidenčný záznam (otvorene_at) + meranie času
  async function otvor(l) {
    setAktivna(l); setDocUrl(null); setSprava('');
    otvoreneOd.current = Date.now();
    await supabase.from('lesson_completions')
      .upsert({ enrollment_id: zapis.id, lesson_id: l.id }, { onConflict: 'enrollment_id,lesson_id', ignoreDuplicates: true });
    if (l.subor_path) {
      const { data } = await supabase.storage.from('materialy').createSignedUrl(l.subor_path, 3600);
      setDocUrl(data?.signedUrl ?? null);
    }
    const { data: c } = await supabase.from('lesson_completions').select('*').eq('enrollment_id', zapis.id);
    setCompl(Object.fromEntries((c ?? []).map(x => [x.lesson_id, x])));
  }

  // dokončenie = dokoncene_at + pripočítanie stráveného času
  async function dokonci(l) {
    const navyse = Math.min(Math.round((Date.now() - (otvoreneOd.current ?? Date.now())) / 1000), 4 * 3600);
    const c = compl[l.id];
    await supabase.from('lesson_completions').update({
      dokoncene_at: new Date().toISOString(),
      stravene_sek: (c?.stravene_sek ?? 0) + navyse,
    }).eq('enrollment_id', zapis.id).eq('lesson_id', l.id);
    otvoreneOd.current = Date.now();
    nacitaj();
  }

  // odovzdanie zadania → Storage (odovzdania/{uid}/...) + submissions
  async function odovzdaj(e, l) {
    e.preventDefault();
    const f = new FormData(e.target);
    const subor = f.get('subor');
    let subor_path = null;
    if (subor && subor.size > 0) {
      const cesta = `${user.id}/${l.id}/${Date.now()}_${subor.name}`;
      const { error: upErr } = await supabase.storage.from('odovzdania').upload(cesta, subor);
      if (upErr) { setSprava('Nahranie zlyhalo: ' + upErr.message); return; }
      subor_path = cesta;
    }
    const { error } = await supabase.from('submissions').insert({
      enrollment_id: zapis.id, lesson_id: l.id, subor_path, text_odpoved: f.get('text') || null,
    });
    setSprava(error ? 'Chyba: ' + error.message : 'Zadanie odovzdané — lektor vám dá spätnú väzbu.');
    dokonci(l);
  }

  if (user === undefined) return null;
  if (!user) return <LoginBox nadpis="Atestio · vstup do štúdia" />;
  if (kurz && !zapis) return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: 20 }}>
      <p className="karta">K tomuto kurzu nemáte aktívny prístup. Podajte si prihlášku v sekcii <a href="/moje">Moje štúdium</a>.</p>
    </main>
  );
  if (!kurz) return null;

  const hotovo = zoznam.filter(jeHotova).length;

  return (
    <main style={{ maxWidth: 1100, margin: '24px auto', padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <a href="/moje" style={{ color: 'var(--smaragd)', textDecoration: 'none', fontWeight: 600 }}>← Moje štúdium</a>
        <h1 style={{ marginTop: 6 }}>{kurz.kod} — {kurz.nazov}</h1>
        <p style={{ color: 'var(--siva)', fontSize: '.9rem' }}>Dokončené {hotovo} / {zoznam.length} lekcií · rozsah programu {kurz.rozsah_hodin} h</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18 }}>
        {/* OSNOVA */}
        <aside>
          {moduly.map(m => (
            <div key={m.id} className="karta" style={{ marginBottom: 10, padding: 12 }}>
              <b style={{ fontFamily: 'Lexend' }}>M{m.poradie} · {m.nazov}</b>
              {zoznam.filter(l => l.module_id === m.id).map(l => {
                const idx = zoznam.findIndex(x => x.id === l.id);
                const odomknuta = jeOdomknuta(idx);
                return (
                  <button key={l.id} disabled={!odomknuta} onClick={() => otvor(l)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left',
                      background: aktivna?.id === l.id ? 'var(--papier)' : 'none', border: 'none',
                      padding: '7px 6px', borderRadius: 8, cursor: odomknuta ? 'pointer' : 'not-allowed',
                      opacity: odomknuta ? 1 : 0.45 }}>
                    <span>{jeHotova(l) ? '✅' : odomknuta ? (l.typ === 'video' ? '🎬' : l.typ === 'zadanie' ? '📝' : l.typ === 'kviz' ? '❓' : '📄') : '🔒'}</span>
                    <span style={{ fontSize: '.9rem' }}>{l.poradie}. {l.nazov}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* OBSAH LEKCIE */}
        <section className="karta" style={{ minHeight: 420 }}>
          {!aktivna && <p style={{ color: 'var(--siva)' }}>Vyberte lekciu z osnovy vľavo. {kurz.vynutit_postupnost ? 'Lekcie sa odomykajú postupne.' : 'Môžete študovať v ľubovoľnom poradí.'}</p>}
          {aktivna && (
            <>
              <h2 style={{ marginBottom: 10 }}>{aktivna.nazov}</h2>
              {sprava && <p style={{ color: 'var(--smaragd)', marginBottom: 10 }}>{sprava}</p>}

              {aktivna.video_url && (
                <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 14, background: '#000' }}>
                  <iframe src={aktivna.video_url} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                </div>
              )}

              {aktivna.obsah_md && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, marginBottom: 14 }}>{aktivna.obsah_md}</div>
              )}

              {docUrl && (
                <p style={{ marginBottom: 14 }}>
                  <a className="btn" href={docUrl} target="_blank" rel="noreferrer">📄 Otvoriť študijný dokument</a>
                </p>
              )}

              {aktivna.typ === 'zadanie' ? (
                subs[aktivna.id] ? (
                  <div className="karta" style={{ background: 'var(--papier)' }}>
                    <b>Zadanie odovzdané</b> · stav: {subs[aktivna.id].stav}
                    {subs[aktivna.id].feedback && <p style={{ marginTop: 6 }}>Spätná väzba lektora: {subs[aktivna.id].feedback}</p>}
                  </div>
                ) : (
                  <form onSubmit={e => odovzdaj(e, aktivna)}>
                    <label>Vaša odpoveď / komentár</label>
                    <textarea name="text" rows={4} placeholder="Stručný popis výstupu…" />
                    <label style={{ marginTop: 8 }}>Súbor s výstupom (PDF/DOCX…)</label>
                    <input name="subor" type="file" />
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginTop: 10 }}>
                      <input type="checkbox" required style={{ width: 'auto', marginTop: 3 }} />
                      Čestne vyhlasujem, že zadanie som vypracoval/a samostatne.
                    </label>
                    <button className="btn btn-zeleny" style={{ marginTop: 12 }}>Odovzdať zadanie</button>
                  </form>
                )
              ) : (
                !compl[aktivna.id]?.dokoncene_at &&
                <button className="btn btn-zeleny" onClick={() => dokonci(aktivna)}>Označiť lekciu ako dokončenú ✓</button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
