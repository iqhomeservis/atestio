-- =====================================================================
-- ATESTIO · 001_init.sql · master schéma (Supabase / PostgreSQL)
-- Pozn.: od 30.5.2026 (nové projekty) vyžaduje Supabase Data API explicitné
-- GRANTy pre roly anon/authenticated/service_role + ENABLE RLS + politiky.
-- =====================================================================

-- ---------- POUŽÍVATELIA ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  meno text,
  priezvisko text,
  titul text,
  telefon text,
  skola text,
  rola text not null default 'ucastnik' check (rola in ('admin','lektor','manazer','ucastnik')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = uid and rola = 'admin') $$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = uid and rola in ('admin','lektor')) $$;

-- auto-profil pri registrácii
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, meno) values (new.id, new.raw_user_meta_data->>'meno')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- OBSAH ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,                 -- napr. AI-L1
  nazov text not null,
  vetva text not null default 'pedagog' check (vetva in ('pedagog','aop','ine')),
  uroven text,                              -- Ziskavanie / Prehlbovanie / Vytvaranie
  rozsah_hodin int not null default 50,
  cena_eur numeric(8,2) not null default 100,
  stav text not null default 'koncept' check (stav in ('koncept','otvoreny','uzavrety')),
  popis text,
  created_at timestamptz not null default now()
);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  poradie int not null default 1,
  nazov text not null,
  popis text
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  poradie int not null default 1,
  typ text not null default 'video' check (typ in ('video','dokument','kviz','zadanie')),
  nazov text not null,
  video_url text,                            -- Bunny Stream / iný embed
  obsah_md text,                             -- text lekcie / zadanie
  subor_path text,                           -- Storage cesta k dokumentu
  minuty_odhad int default 15,               -- odhad študijnej záťaže (evidencia hodín)
  povinna boolean not null default true
);

-- ---------- ZÁPISY A EVIDENCIA (preukázateľnosť) ----------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  stav text not null default 'aktivny' check (stav in ('aktivny','ukonceny','zruseny')),
  zdroj text,                                -- objednávka / kód školy
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, course_id)
);

create table if not exists public.lesson_completions (
  id bigint generated always as identity primary key,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  otvorene_at timestamptz not null default now(),
  dokoncene_at timestamptz,
  stravene_sek int default 0,
  unique (enrollment_id, lesson_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  subor_path text,
  text_odpoved text,
  odovzdane_at timestamptz not null default now(),
  stav text not null default 'odovzdane' check (stav in ('odovzdane','akceptovane','vratene')),
  feedback text,
  hodnotil uuid references public.profiles(id)
);

create table if not exists public.newsletter_subscribers (
  id bigint generated always as identity primary key,
  email text unique not null,
  meno text,
  zdroj text,
  gdpr_suhlas boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  kto uuid,
  akcia text not null,
  entita text,
  entita_id text,
  detail jsonb,
  cas timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles              enable row level security;
alter table public.courses               enable row level security;
alter table public.course_modules        enable row level security;
alter table public.lessons               enable row level security;
alter table public.enrollments           enable row level security;
alter table public.lesson_completions    enable row level security;
alter table public.submissions           enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.audit_log             enable row level security;

-- profily: vidím seba; admin všetko
create policy "profil_vlastny" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profil_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and rola = 'ucastnik');
create policy "profil_admin"  on public.profiles for all to authenticated using (public.is_admin(auth.uid()));

-- kurzy/obsah: otvorené kurzy vidí každý prihlásený; koncepty len staff; zápis obsahu len staff
create policy "kurzy_citanie" on public.courses for select to authenticated using (stav = 'otvoreny' or public.is_staff(auth.uid()));
create policy "kurzy_sprava"  on public.courses for all to authenticated using (public.is_staff(auth.uid()));
create policy "moduly_citanie" on public.course_modules for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.stav='otvoreny'));
create policy "moduly_sprava" on public.course_modules for all to authenticated using (public.is_staff(auth.uid()));
create policy "lekcie_citanie" on public.lessons for select to authenticated
  using (public.is_staff(auth.uid()) or exists (
    select 1 from public.course_modules m join public.courses c on c.id = m.course_id
    where m.id = module_id and c.stav = 'otvoreny'));
create policy "lekcie_sprava" on public.lessons for all to authenticated using (public.is_staff(auth.uid()));

-- zápisy a evidencia: účastník vidí svoje; staff všetko; completion zapisuje účastník len k svojmu zápisu
create policy "zapisy_vlastne" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "zapisy_sprava"  on public.enrollments for all to authenticated using (public.is_staff(auth.uid()));
create policy "compl_citanie" on public.lesson_completions for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy "compl_zapis" on public.lesson_completions for insert to authenticated
  with check (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy "compl_update" on public.lesson_completions for update to authenticated
  using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy "sub_citanie" on public.submissions for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy "sub_zapis" on public.submissions for insert to authenticated
  with check (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy "sub_sprava" on public.submissions for update to authenticated using (public.is_staff(auth.uid()));

-- newsletter: insert komukoľvek (aj anonymne z webu), čítanie len admin
create policy "nl_insert" on public.newsletter_subscribers for insert to anon, authenticated with check (true);
create policy "nl_admin"  on public.newsletter_subscribers for select to authenticated using (public.is_admin(auth.uid()));

-- audit: zapisuje server (service_role), číta admin
create policy "audit_admin" on public.audit_log for select to authenticated using (public.is_admin(auth.uid()));

-- ---------- GRANTY (povinné pre Data API) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on public.newsletter_subscribers to anon;
grant usage, select on all sequences in schema public to authenticated, anon;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public) values ('materialy','materialy', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('odovzdania','odovzdania', false)
  on conflict (id) do nothing;

create policy "materialy_citanie" on storage.objects for select to authenticated
  using (bucket_id = 'materialy');
create policy "materialy_zapis" on storage.objects for insert to authenticated
  with check (bucket_id = 'materialy' and public.is_staff(auth.uid()));
create policy "materialy_mazanie" on storage.objects for delete to authenticated
  using (bucket_id = 'materialy' and public.is_staff(auth.uid()));
create policy "odovzdania_vlastne" on storage.objects for insert to authenticated
  with check (bucket_id = 'odovzdania' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "odovzdania_citanie" on storage.objects for select to authenticated
  using (bucket_id = 'odovzdania' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid())));

-- ---------- EVIDENČNÝ VÝKAZ (view pre kontrolu z ministerstva) ----------
create or replace view public.v_vykaz_ucastnika as
select
  e.id as enrollment_id,
  p.titul, p.meno, p.priezvisko, p.skola,
  c.id as course_id, c.kod as kurz, c.nazov as kurz_nazov, c.rozsah_hodin,
  e.started_at, e.completed_at, e.stav,
  count(lc.id) filter (where lc.dokoncene_at is not null) as dokoncene_lekcie,
  (select count(*) from public.lessons l join public.course_modules m on m.id = l.module_id where m.course_id = c.id) as lekcie_spolu,
  coalesce(sum(lc.stravene_sek),0)/3600.0 as hodiny_v_lms,
  (select count(*) from public.submissions s where s.enrollment_id = e.id and s.stav = 'akceptovane') as akceptovane_zadania
from public.enrollments e
join public.profiles p on p.id = e.user_id
join public.courses c on c.id = e.course_id
left join public.lesson_completions lc on lc.enrollment_id = e.id
group by e.id, p.titul, p.meno, p.priezvisko, p.skola, c.id, c.kod, c.nazov, c.rozsah_hodin, e.started_at, e.completed_at, e.stav;

grant select on public.v_vykaz_ucastnika to authenticated;

-- ---------- 002 · BEZPEČNOSTNÉ DOTIAHNUTIE (aplikované aj v master DB) ----------
alter view public.v_vykaz_ucastnika set (security_invoker = true);
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_admin(uuid) from anon, public;
revoke execute on function public.is_staff(uuid) from anon, public;
drop policy if exists "nl_insert" on public.newsletter_subscribers;
create policy "nl_insert" on public.newsletter_subscribers
  for insert to anon, authenticated with check (gdpr_suhlas = true);

-- ---------- 003 · REŽIM UKONČENIA KURZU (aplikované aj v master DB) ----------
-- Ukončenie = VÝSTUPY (zadania + obhajoba), nie čas. Prepínače per kurz:
alter table public.courses
  add column if not exists vynutit_postupnost boolean not null default true,
  add column if not exists min_dni_do_obhajoby int not null default 14,
  add column if not exists rezim_ukoncenia text not null default 'vystupy'
    check (rezim_ukoncenia in ('vystupy','vystupy_a_cas'));

-- ---------- 004 · PRIHLÁŠKY A AKTIVÁCIA PRÍSTUPU (aplikované aj v master DB) ----------
create table if not exists public.prihlasky (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  skola text,
  platca text not null default 'osoba' check (platca in ('osoba','skola','firma_szco')),
  potvrdenie_riaditela boolean not null default false,
  poznamka text,
  stav text not null default 'nova' check (stav in ('nova','cakajuca_platba','zaplatena','aktivna','zamietnuta')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table public.prihlasky enable row level security;
create policy "prihl_vlastne_citanie" on public.prihlasky for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "prihl_vlastne_podanie" on public.prihlasky for insert to authenticated
  with check (user_id = auth.uid());
create policy "prihl_sprava" on public.prihlasky for update to authenticated
  using (public.is_staff(auth.uid()));
grant select, insert, update on public.prihlasky to authenticated;
grant all on public.prihlasky to service_role;
create or replace function public.handle_prihlaska_aktivacia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stav = 'aktivna' and (old.stav is distinct from new.stav) then
    insert into public.enrollments (user_id, course_id, zdroj)
    values (new.user_id, new.course_id, 'prihlaska:' || new.id::text)
    on conflict (user_id, course_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.handle_prihlaska_aktivacia() from anon, authenticated, public;
drop trigger if exists on_prihlaska_aktivacia on public.prihlasky;
create trigger on_prihlaska_aktivacia after update on public.prihlasky
  for each row execute function public.handle_prihlaska_aktivacia();
