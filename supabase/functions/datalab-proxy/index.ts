// ============================================================
// datalab-proxy — TourAPI 데이터랩(지역별 방문자 수, DataLabService)로
// 대신 요청을 보내주는 Edge Function.
// --------------------------------------------------------------
// 진짜 빅데이터 서비스키(TOURAPI_BIGDATA_KEY)는 Supabase 프로젝트의 secret으로만
// 저장돼 있고, 이 서버 코드 안에서만 읽힌다. js/popArea.js는 이 함수의 URL만
// 호출하고, 실제 키는 절대 보지 못한다.
//
// 클라이언트(js/popArea.js) 호출 형태:
//   {SUPABASE_URL}/functions/v1/datalab-proxy?startYmd=...&endYmd=...&pageNo=...&numOfRows=...
//   (KorService2와 달리 엔드포인트가 하나뿐이라 endpoint 파라미터는 필요 없음)
//
// 배포: supabase secrets set TOURAPI_BIGDATA_KEY=... 로 키를 먼저 등록한 뒤
//       supabase functions deploy datalab-proxy --no-verify-jwt
// ============================================================

const BASE_URL = "https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList";
const BIGDATA_KEY = Deno.env.get("TOURAPI_BIGDATA_KEY") ?? "";

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
    if (!BIGDATA_KEY) {
      return new Response(
        JSON.stringify({ error: "서버에 TOURAPI_BIGDATA_KEY가 설정되지 않았습니다" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    // 클라이언트가 보낸 파라미터(startYmd, endYmd, pageNo, numOfRows, MobileOS 등)를
    // 그대로 전달하고, serviceKey는 여기서만(서버 쪽에서만) 붙인다. secret에는
    // 이미 인코딩된 문자열이 아니라 디코딩된 원본 키를 저장해야 한다
    // (URLSearchParams가 값을 다시 인코딩해주기 때문).
    const forwarded = new URLSearchParams(url.searchParams);
    forwarded.set("serviceKey", BIGDATA_KEY);

    const targetUrl = `${BASE_URL}?${forwarded.toString()}`;
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
