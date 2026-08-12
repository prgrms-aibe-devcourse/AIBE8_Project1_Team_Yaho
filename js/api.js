// -------------------------------------------------------------------------------------------------------------------
//  api.js TourAPI(korServiec2) 호출 공용 모듈
// -------------------------------------------------------------------------------------------------------------------

// IIFE ( 즉시 실행 함수 )로 만든 싱글톤 객체 패턴 ( 모듈화에 최적화된 패턴 )
const TourAPI = ( () => {

    // End Point
    const BASE = 'https://apis.data.go.kr/B551011/KorService2';

    // 컨텐츠 타입 코드 객체에 저장
    const CONTENT_TYPE = {
        TRAVEL : 12, // 관광지
        FESTIVAL : 15, // 축제/공연/행사
    };
    
    // Supabase api_cache 테이블 기반 공유 캐시 (js/apiCache.js)
    // 같은 URL은 CACHE_TTL_MS 동안 재호출하지 않도록 ( 일 1000회건 초과를 방지하기 위함 )
    // 예전에는 sessionStorage(브라우저 세션 한정)를 썼지만, 이제는 Supabase에
    // 저장해서 다른 사람 브라우저에서 이미 호출한 결과도 같이 재사용한다.

    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1일

    // try catch 구조를 사용한 이유는 성능 향상을 위한 기능이기 때문에 에러가 났을 때 성능을 포기하고 그냥 무시하게끔 동작시키기 위함
    // key = 완성된 API 요청 URL을 받아서 캐시에 저장된 값이 있으면 꺼내오기 없으면 null
    async function cacheGet(key){
        try{
            return await window.ApiCache.get('tourapi:' + key, CACHE_TTL_MS);
        }catch (e) {
            return null; // 캐시 조회 실패하면 캐시 포기하고 null
        }
    }

    // key
    async function cacheSet(key, value){
        try{
            await window.ApiCache.set('tourapi:' + key, value);
        }catch (e) {
            // 저장 실패 ( 무시 )
        }
    }


    // URL 빌더
    // endpoint : API의 세부경로
    // params : url 뒤에 추가로 붙일 파라메타들 { numofRows : 10, pageNo : 1 등등 }
    function buildUrl(endpoint, params) {
      // API 사용 문서에 나와 있는 url 대로 조합
        let url = `${BASE}/${endpoint}` +
        `?serviceKey=${CONFIG.SERVICE_KEY}` +
        `&MobileOS=ETC&MobileApp=test&_type=json`;

        //params 객체를 [key, value] 쌍으로 순회
        for (const [key, value] of Object.entries(params)) {
        // 객체가 비어 있다면 url에 추가로 붙이지 않고 넘어감
        if (value === undefined || value === null || value === '') continue;
        // value가 string이라면 URL 인코딩 처리( 한글, 특수문자가 깨지지 않도록 )
        const encoded = typeof value === 'string' ? encodeURIComponent(value) : value;
        url += `&${key}=${encoded}`; // 인코딩된 문자열을 url에 추가
        }
        return url;
    }

    // ── 공통 fetch + 정규화 ───────────────────────────────────────────────
    async function callApi(endpoint, params) {
        const url = buildUrl(endpoint, params);

        // 공유 캐시에서 url을 키로 캐시된 데이터가 존재하는지 체크, 존재하면 반환 ( 재요청 방지 )
        const cached = await cacheGet(url);
        if (cached) return cached;

        // 캐시된 url이 없다면 url로 API 요청
        // await 를 붙여줌으로써 해당 줄에서 callAppi 함수의 실행을 멈추고 서버에 요청이 돌아올때까지 기다린다.
        // 비동기 작업이라 다른 이후의 코드들은 실행이 가능함
        const res = await fetch(url); // url로 네트워크 요청을 보내는 함수
        if (!res.ok) { // 요청에 실패했다면
        throw new Error(`TourAPI 요청 실패 (HTTP ${res.status})`);
        }

        // http프로토콜의 body를 읽어서 JSON 텍스트를 자바스크립트 객체로 변환
        const data = await res.json();

        // 게이트웨이 에러 체크
        // data.response가 존재하는지 체크함으로써 API 서버까지 잘 요청이 전달됨을 체크할 수 있다.
        // API 서버까지 가지 못했다면 respone 값이 존재하지 않음
        if (data.resultCode !== undefined && data.response === undefined) {
        throw new Error(`TourAPI 요청 파라미터 오류: ${data.resultMsg || data.resultCode}`);
        }

        // data가 있으면 .response도 확인해서 존재하면 헤더값을 저장
        // 패킷의 헤더를 확인해야 하기 때문에 저장하는 것
        const header = data?.response?.header;

        // 헤더가 존재하지 않거나 API 서버 요청 처리 과정에서 문제가 생겼다면( '0000'은 정상 코드 ) 예외 처리
        if (!header || header.resultCode !== '0000') {
        throw new Error(`TourAPI 오류: ${header?.resultMsg || '알 수 없는 오류'}`);
        }

        // 데이터 정규화
        // body.itmes.item이 없으면 ( ?? 연산자 ) 빈 배열로 처리
        let items = data.response.body?.items?.item ?? []; 
        items = Array.isArray(items) ? items : [items]; // items이 배열이 아니라면 객체를 배열에 넣어서 배열로 형태로 변환시킴

        // url을 키로  items를 캐시에 저장
        await cacheSet(url, items);

        // items( 정규화된 배열 )를 반환함
        return items;
    }

// -------------------------------------------------------------------------------------------------------------------
//  매개변수로 API 매개변수의 값을 저장해서 callApi를 호출해서 정규화된 배열을 반환하는 함수들
// -------------------------------------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------------------------------------
//  API 파라메타 참고하고 싶으면 apiParam.md 참고
// -------------------------------------------------------------------------------------------------------------------

    // ── 여행지 목록 ──────────────────────────────────────────────────
  function getTravelList({ numOfRows = 100, pageNo = 1, arrange = 'C', lDongRegnCd, lDongSignguCd, lclsSystm1, lclsSystm2, lclsSystm3, contentTypeId = CONTENT_TYPE.TRAVEL } = {}) {
    return callApi('areaBasedList2', {
      numOfRows, pageNo, arrange,
      contentTypeId, // null/undefined로 넘기면 관광타입 구분 없이(관광지·문화시설·음식점 등 전체) 조회
      lDongRegnCd, // 법정동 시도코드 (예: '11'=서울). 생략하면 지역 구분 없이 조회
      lDongSignguCd, // 법정동 시군구코드. lDongRegnCd와 함께 넘겨야 유효함
      lclsSystm1, lclsSystm2, lclsSystm3, // 분류체계 대/중/소분류 (예: NA=자연관광, HS=역사관광). 분류체계 코드 조회 참고
    });
  }

  // ── 축제 목록 ────────────────────────────────────────────────────
  function getFestivalList({ eventStartDate, eventEndDate, numOfRows = 100, pageNo = 1, lDongRegnCd, lDongSignguCd } = {}) {
    // Date 객체 : 현재 시각을 담고 있는 객체
    // toISOString() : Date객체를 문자열로 변환
    // .slice(0, 10) : 문자열의 0부터 9 인덱스의 10개의 문자열만 잘라냄 ( 날짜 부분만 남기고 버림 )
    // .replace : 문자열 안의 모든 - 찾아서 제거
    const today = eventStartDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return callApi('searchFestival2', {
      numOfRows, pageNo,
      eventStartDate: today,
      eventEndDate,
      lDongRegnCd,
      lDongSignguCd, // 법정동 시군구코드. lDongRegnCd와 함께 넘겨야 유효함
    });
  }

  // ──  공식 지역(시도) 코드 목록 ────────────────────────────────
  // lDongRegnCd를 넘기지 않고 호출하면 전국 시도(17개) 목록을
  // { code: '11', name: '서울특별시' } 형태로 반환합니다.
  // (areaBasedList2 / searchFestival2의 lDongRegnCd 파라미터에 그대로 사용)
  function getAreaCodes() {
    return callApi('ldongCode2', { numOfRows: 20, pageNo: 1 });
  }

  // ── 시도 하나에 속한 시군구 코드 목록 ────────────────────────
  // lDongRegnCd(시도코드)를 넘기면 그 시도의 시군구 목록을
  // { code: '11110', name: '종로구' } 형태로 반환합니다.
  function getSigunguCodes(lDongRegnCd) {
    return callApi('ldongCode2', { numOfRows: 100, pageNo: 1, lDongRegnCd });
  }

  // ── 지역 하나에 대해서만 여행지/축제 소량 조회 ──────────────
  // lDongSignguCd를 넘기면 시군구 단위로 더 좁혀서 조회함
  function getTravelListByArea(lDongRegnCd, numOfRows = 3, lDongSignguCd) {
    return getTravelList({ numOfRows, arrange: 'Q', lDongRegnCd, lDongSignguCd }); // Q=대표이미지 보장 정렬
  }
  function getFestivalListByArea(lDongRegnCd, numOfRows = 3, lDongSignguCd) {
    return getFestivalList({ numOfRows, lDongRegnCd, lDongSignguCd });
  }
  
  // ── 전체 시도를 돌면서 지역당 소량씩 모아 합치기 ────────────
  // "지역당 최소 N개씩은 보장" 하기 위한 함수.
  // 시도 하나가 실패해도(예: 해당 지역에 데이터가 아예 없음) 전체가 죽지 않게
  // 개별적으로 catch 처리 후 빈 배열로 대체합니다.
  async function getTravelListAllAreas(perArea = 3) {
    const areas = await getAreaCodes();
    const lists = await Promise.all(
      areas.map((a) => getTravelListByArea(a.code, perArea).catch(() => []))
    );
    return lists.flat();
  }
  async function getFestivalListAllAreas(perArea = 3) {
    const areas = await getAreaCodes();
    const lists = await Promise.all(
      areas.map((a) => getFestivalListByArea(a.code, perArea).catch(() => []))
    );
    return lists.flat();
  }

  // ── 이름으로 검색 ────────────────────────────────────────────────
  function searchKeyword(keyword, { contentTypeId, numOfRows = 20, pageNo = 1 } = {}) {
    return callApi('searchKeyword2', {
      numOfRows, pageNo, contentTypeId, keyword,
    });
  }

  // ──  상세 소개글 ──────────────────────────────────────────────────
  // ⚠️ defaultYN / contentTypeId / overviewYN 전부 이 배포 버전에서는
  //    INVALID_REQUEST_PARAMETER_ERROR로 거부됨 (실측 확인).
  //    contentId 단독으로만 요청 (overview가 기본 포함되는지 확인 중).
  async function getDetailCommon(contentId) {
    const items = await callApi('detailCommon2', { contentId });
    return items[0] ?? null;
  }

  // ──  상세 부가정보 ────────────────────────────────────────────────
  async function getDetailIntro(contentId, contentTypeId) {
    const items = await callApi('detailIntro2', {
      contentId, contentTypeId,
    });
    return items[0] ?? null;
  }

  // ── 상세 갤러리 사진 ─────────────────────────────────────────────
  function getDetailImages(contentId) {
    return callApi('detailImage2', {
      contentId, imageYN: 'Y',
    }).catch(() => []); // 사진이 없는 콘텐츠도 많으므로 실패해도 빈 배열 처리
  }

  // ── 상세 반복정보 (입장료, 이용안내 등 이름-값 쌍이 여러 개) ────
  function getDetailInfo(contentId, contentTypeId) {
    return callApi('detailInfo2', { contentId, contentTypeId }).catch(() => []);
    // 반복정보가 없는 콘텐츠도 많으므로 실패해도 빈 배열 처리
  }

  // ── 상세 페이지용: 4개 API 동시 호출 ─────────────────────────────────
  async function getDetailAll(contentId, contentTypeId) {
    const [common, intro, images, extraInfo] = await Promise.all([
      getDetailCommon(contentId),
      getDetailIntro(contentId, contentTypeId),
      getDetailImages(contentId),
      getDetailInfo(contentId, contentTypeId),
    ]);
    return { common, intro, images, extraInfo };
  }

  // 즉시 실행함수에 선언된 비공개 함수들을 밖에서 호출할 수 있도록 객체로 함수 이름을 반환
  return {
    CONTENT_TYPE,
    getTravelList,
    getFestivalList,
    searchKeyword,
    getAreaCodes,
    getSigunguCodes,
    getTravelListByArea,
    getFestivalListByArea,
    getTravelListAllAreas,
    getFestivalListAllAreas,
    getDetailCommon,
    getDetailIntro,
    getDetailImages,
    getDetailInfo,
    getDetailAll,
  };

})();