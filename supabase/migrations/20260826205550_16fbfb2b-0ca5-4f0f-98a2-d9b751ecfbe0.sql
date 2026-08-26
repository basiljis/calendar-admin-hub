UPDATE public.shifts 
SET break_time = '13:00' 
WHERE type = 'work' AND break_time IS NULL;

ALTER TABLE public.shifts 
ADD CONSTRAINT shifts_work_break_time_required 
CHECK (type != 'work' OR break_time IS NOT NULL);