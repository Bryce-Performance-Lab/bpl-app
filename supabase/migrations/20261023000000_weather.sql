-- Weather for each run (from Open-Meteo, looked up from the run's start point and time)
alter table public.activities add column if not exists weather jsonb;
