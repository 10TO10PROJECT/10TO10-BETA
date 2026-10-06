-- 거절(rejected)된 신청은 설명회 모집 인원 집계에서 제외
CREATE OR REPLACE FUNCTION public.get_seminar_application_count(_seminar_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(count(*)::integer, 0)
  FROM public.seminar_applications
  WHERE seminar_id = _seminar_id
    AND status <> 'rejected';
$$;
