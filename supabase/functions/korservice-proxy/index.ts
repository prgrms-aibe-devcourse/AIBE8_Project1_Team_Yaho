// ============================================================
// korservice-proxy — TourAPI(한국관광공사 국문 관광정보 서비스, KorService2)로
// 대신 요청을 보내주는 Edge Function.
// --------------------------------------------------------------
// 진짜 서비스키(TOURAPI_SERVICE_KEY)는 Supabase 프로젝트의 secret으로만 저장돼
// 있고, 이 서버 코드 안에서만 읽힌다. 브라우저(정적 사이트로 배포된 GitHub Pages
// 등)는 이 함수의 URL만 알고 있으면 되고, 실제 키는 절대 보지 못한다.
//
// 클라이언트(js/api.js) 호출 형태:
//   {SUPABASE_URL}/functions/v1/korservice-proxy?endpoint=areaBasedList2&numOfRows=...&...
//   (endpoint 파라미터로 KorService2의 세부 경로를 지정하고, serviceKey는 절대 안 보냄)
//
// 배포: supabase secrets set TOURAPI_SERVICE_KEY=... 로 키를 먼저 등록한 뒤
//       supabase functions deploy korservice-proxy --no-verify-jwt
// ============================================================

const BASE = "https://apis.data.go.kr/B551011/KorService2";
const SERVICE_KEY = Deno.env.get("TOURAPI_SERVICE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "endpoint 파라미터가 필요합니다" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    if (!SERVICE_KEY) {
      return new Response(
        JSON.stringify({ error: "서버에 TOURAPI_SERVICE_KEY가 설정되지 않았습니다" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // endpoint를 뺀 나머지 파라미터는 그대로 TourAPI로 전달하고, serviceKey는
    // 여기서만(서버 쪽에서만) 붙인다. URLSearchParams가 값을 인코딩해주므로
    // secret에는 이미 인코딩된 문자열이 아니라 디코딩된 원본 키를 저장해야 한다.
    const forwarded = new URLSearchParams(url.searchParams);
    forwarded.delete("endpoint");
    forwarded.set("serviceKey", SERVICE_KEY);

    const targetUrl = `${BASE}/${endpoint}?${forwarded.toString()}`;
    const res = await fetch(targetUrl);
    const body = await res.text();

    return new Response(body, {
      status: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
