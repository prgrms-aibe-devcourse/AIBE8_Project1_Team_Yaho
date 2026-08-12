/* ============================================================
   apiCache.js — TourAPI 등 외부 API 응답을 여러 브라우저/사용자가
   공유하는 캐시 (Supabase api_cache 테이블)
   --------------------------------------------------------------
   기존에 sessionStorage/localStorage에 각자(브라우저별로) 저장하던
   캐시를 Supabase로 옮겨서, 한 사람이 이미 호출한 API 결과를 다른
   사람도 재사용할 수 있게 한다 (TourAPI 하루 호출 횟수 제한 완화 목적).
   사용자 개인 데이터가 아니므로 로그인 여부와 무관하게 동작한다.

   로드 순서: config.js → supabase-js CDN → supabaseClient.js →
             (필요하면 authState.js) → apiCache.js →
             api.js / main.js / todaySpot.js / popArea.js

   window.ApiCache.get(key, ttlMs?)
     - key로 저장된 값을 반환한다. 캐시 미스면 null.
     - ttlMs를 넘기면 updated_at 기준으로 그보다 오래된 값은 null로 취급한다.
     - ttlMs를 생략하면 나이(age) 체크 없이 저장된 값을 그대로 반환한다
       (호출부가 값 안에 자체적인 신선도 판단 필드를 이미 갖고 있는 경우용).
   window.ApiCache.set(key, value)
     - value(JSON으로 직렬화 가능한 값)를 key로 저장(upsert)한다.

   둘 다 실패해도 예외를 던지지 않는다 — 캐시는 성능/호출횟수 절약용
   기능이라서, 에러가 나면 그냥 캐시 없이(=API 재호출) 진행되게 한다.
   ============================================================ */
(function () {
  async function get(key, ttlMs) {
    try {
      const { data, error } = await window.supabaseClient
        .from('api_cache')
        .select('value, updated_at')
        .eq('cache_key', key)
        .maybeSingle();
      if (error || !data) return null;

      if (typeof ttlMs === 'number') {
        const age = Date.now() - new Date(data.updated_at).getTime();
        if (age > ttlMs) return null;
      }
      return data.value;
    } catch (e) {
      return null;
    }
  }

  async function set(key, value) {
    try {
      await window.supabaseClient
        .from('api_cache')
        .upsert({ cache_key: key, value, updated_at: new Date().toISOString() });
    } catch (e) {
      // 저장 실패는 무시 (다음 호출 때 다시 API를 부르게 될 뿐)
    }
  }

  window.ApiCache = { get, set };
})();
