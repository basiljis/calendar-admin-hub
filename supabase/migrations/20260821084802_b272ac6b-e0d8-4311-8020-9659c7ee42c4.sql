ALTER TABLE public.holidays ADD COLUMN is_working BOOLEAN DEFAULT false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
TRUNCATE public.holidays;
INSERT INTO public.holidays (holiday_date, name, is_working) VALUES
('2026-01-01', 'Новогодние каникулы', false),
('2026-01-02', 'Новогодние каникулы', false),
('2026-01-03', 'Новогодние каникулы', false),
('2026-01-04', 'Новогодние каникулы', false),
('2026-01-05', 'Новогодние каникулы', false),
('2026-01-06', 'Новогодние каникулы', false),
('2026-01-07', 'Рождество Христово', false),
('2026-01-08', 'Новогодние каникулы', false),
('2026-02-23', 'День защитника Отечества', false),
('2026-03-08', 'Международный женский день', false),
('2026-05-01', 'Праздник Весны и Труда', false),
('2026-05-09', 'День Победы', false),
('2026-06-12', 'День России', false),
('2026-11-04', 'День народного единства', false);