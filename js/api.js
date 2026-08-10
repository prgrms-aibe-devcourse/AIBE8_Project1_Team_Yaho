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
    
    // sesstionStorage 기반 캐시 ( sesstionStorage : 브라우저가 기본으로 제공하는 저장 공간(전역 객체) )
    // 같은 URL은 세션 동안 재호출하지 않도록 ( 일 1000회건 초과를 방지하기 위함 )

    // try catch 구조를 사용한 이유는 성능 향상을 위한 기능이기 때문에 에러가 났을 때 성능을 포기하고 그냥 무시하게끔 동작시키기 위함
    // key = 완성된 API 요청 URL을 받아서 Stoarage에서 저장된 값이 있으면 꺼내오기 없으면 null
    function cacheGet(key){
        try{
            const raw = sessionStorage.getItem('tourapi:' + key); // Storage에서 꺼내오기 
            return raw ? JSON.parse(raw) : null; // raw가 존재하면 캐시 히트로 문자열을 배열 + 객체로 변환해줌, raw가 없으면 null
        }catch (e) {
            return null; //getItem 함수가 에러 나면 캐시 포기하고 null
        }
    }

    // key 
    function cacheSet(key, value){
        try{
            sessionStorage.setItem('tourapi:' + key, JSON.stringify(value)); // Storage에 저장하기 ( 배열 + 객체 -> 문자열로 변환)
        }catch (e) {
            // 저장 실패 ( 무시 )
        }
    }


    // URL 빌더
    function buildUrl(endpoint, params) {
        let url = `${BASE}/${endpoint}` +
        `?serviceKey=${CONFIG.SERVICE_KEY}` +
        `&MobileOS=ETC&MobileApp=test&_type=json`;

        for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        const encoded = typeof value === 'string' ? encodeURIComponent(value) : value;
        url += `&${key}=${encoded}`;
        }
        return url;
    }

    // ── 공통 fetch + 정규화 ───────────────────────────────────────────────
    async function callApi(endpoint, params) {
        const url = buildUrl(endpoint, params);

        const cached = cacheGet(url);
        if (cached) return cached;

        // await 를 붙여줌으로써 해당 줄에서 코드가 멈춰서 서버에 요청이 돌아올때까지 기다린다.
        const res = await fetch(url); // url로 네트워크 요청을 보내는 함수
        if (!res.ok) { // 요청에 실패했다면
        throw new Error(`TourAPI 요청 실패 (HTTP ${res.status})`);
        }

        // http body를 읽어서 JSON 텍스트를 자바스크립트 객체로 변환
        const data = await res.json();

        // 게이트웨이 에러 체크
        // data.response가 존재하는지 체크함으로써 API 서버까지 잘 요청이 전달됨을 체크할 수 있다.
        // API 서버까지 가지 못했다면 respone  값이 존재하지 않음
        if (data.resultCode !== undefined && data.response === undefined) {
        throw new Error(`TourAPI 요청 파라미터 오류: ${data.resultMsg || data.resultCode}`);
        }

        const header = data?.response?.header;

        if (!header || header.resultCode !== '0000') {
        throw new Error(`TourAPI 오류: ${header?.resultMsg || '알 수 없는 오류'}`);
        }

        let items = data.response.body?.items?.item ?? [];
        items = Array.isArray(items) ? items : [items];

        cacheSet(url, items);
        return items;
    }

    // ── 3-1. 여행지 목록 ──────────────────────────────────────────────────
  function getTravelList({ numOfRows = 100, pageNo = 1, arrange = 'C', lDongRegnCd } = {}) {
    return callApi('areaBasedList2', {
      numOfRows, pageNo, arrange,
      contentTypeId: CONTENT_TYPE.TRAVEL,
      lDongRegnCd, // 법정동 시도코드 (예: '11'=서울). 생략하면 지역 구분 없이 조회
    });
  }

  // ── 3-2. 축제 목록 ────────────────────────────────────────────────────
  function getFestivalList({ eventStartDate, eventEndDate, numOfRows = 100, pageNo = 1, lDongRegnCd } = {}) {
    // 기본값: 오늘부터 검색 (YYYYMMDD)
    const today = eventStartDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return callApi('searchFestival2', {
      numOfRows, pageNo,
      eventStartDate: today,
      eventEndDate,
      lDongRegnCd,
    });
  }

  // ── 3-2-1. 공식 지역(시도) 코드 목록 ────────────────────────────────
  // lDongRegnCd를 넘기지 않고 호출하면 전국 시도(17개) 목록을
  // { code: '11', name: '서울특별시' } 형태로 반환합니다.
  // (areaBasedList2 / searchFestival2의 lDongRegnCd 파라미터에 그대로 사용)
  function getAreaCodes() {
    return callApi('ldongCode2', { numOfRows: 20, pageNo: 1 });
  }

  // ── 3-2-2. 지역 하나에 대해서만 여행지/축제 소량 조회 ──────────────
  function getTravelListByArea(lDongRegnCd, numOfRows = 3) {
    return getTravelList({ numOfRows, arrange: 'Q', lDongRegnCd }); // Q=대표이미지 보장 정렬
  }
  function getFestivalListByArea(lDongRegnCd, numOfRows = 3) {
    return getFestivalList({ numOfRows, lDongRegnCd });
  }

  // ── 3-2-3. 전체 시도를 돌면서 지역당 소량씩 모아 합치기 ────────────
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

  // ── 3-3. 이름으로 검색 ────────────────────────────────────────────────
  function searchKeyword(keyword, { contentTypeId, numOfRows = 20, pageNo = 1 } = {}) {
    return callApi('searchKeyword2', {
      numOfRows, pageNo, contentTypeId, keyword,
    });
  }

  // ── 3-4. 상세 소개글 ──────────────────────────────────────────────────
  // ⚠️ defaultYN / contentTypeId / overviewYN 전부 이 배포 버전에서는
  //    INVALID_REQUEST_PARAMETER_ERROR로 거부됨 (실측 확인).
  //    contentId 단독으로만 요청 (overview가 기본 포함되는지 확인 중).
  async function getDetailCommon(contentId) {
    const items = await callApi('detailCommon2', { contentId });
    return items[0] ?? null;
  }

  // ── 3-5. 상세 부가정보 ────────────────────────────────────────────────
  async function getDetailIntro(contentId, contentTypeId) {
    const items = await callApi('detailIntro2', {
      contentId, contentTypeId,
    });
    return items[0] ?? null;
  }

  // ── 3-6. 상세 갤러리 사진 ─────────────────────────────────────────────
  function getDetailImages(contentId) {
    return callApi('detailImage2', {
      contentId, imageYN: 'Y',
    }).catch(() => []); // 사진이 없는 콘텐츠도 많으므로 실패해도 빈 배열 처리
  }

  // ── 3-7. 상세 반복정보 (입장료, 이용안내 등 이름-값 쌍이 여러 개) ────
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

  return {
    CONTENT_TYPE,
    getTravelList,
    getFestivalList,
    searchKeyword,
    getAreaCodes,
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

});