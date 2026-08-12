/*
config.js — 공개돼도 안전한 값만 남긴 설정 파일.

TourAPI 서비스키(SERVICE_KEY)와 데이터랩 빅데이터 키(TOURAPI_BIGDATA_KEY)는
더 이상 여기 없다 — Supabase Edge Function(supabase/functions/korservice-proxy,
datalab-proxy)의 secret으로만 저장돼 있고, 브라우저는 그 프록시 주소만 호출한다
(js/api.js, js/popArea.js 참고). 네이버 지도 클라이언트ID/시크릿도 지금 코드에서는
아예 안 쓰여서(지도 스크립트 태그에 이미 직접 박혀있음) 같이 뺐다.

SUPABASE_ANON_KEY는 RLS로 보호되는 공개용 키라 노출돼도 안전하다 — 그래서 이
파일은 이제 .gitignore에서 빼고 깃허브에 커밋해도 된다 (GitHub Pages로 배포된
사이트도 이 파일이 있어야 Supabase에 붙을 수 있음).
*/
const CONFIG = {
    SUPABASE_URL: "https://zesxgdaqjamxilbichym.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_4fj_HBiy_F1oGDLKBc9a3w_p7-JfhsE"
};