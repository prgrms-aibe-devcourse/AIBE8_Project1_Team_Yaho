/* ============================================================
   data.js — 화면에 뿌려지는 모든 데이터
   ------------------------------------------------------------
   ※ 소요시간 / 요금은 서울 강남구 출발 기준의 예시 값입니다.
     실제 서비스에서는 API 응답으로 대체하세요.
   ※ 이미지는 시안에서 추출한 것이라 해상도가 낮습니다.
     photo / thumb 값을 실제 사진 경로나 URL로 바꾸면 그대로 반영됩니다.
   ============================================================ */

/* 출발지 후보 */
export const ORIGINS = [
  '서울특별시 강남구',
  '서울특별시 마포구',
  '서울특별시 종로구',
  '경기도 성남시 분당구',
  '인천광역시 연수구',
  '대전광역시 유성구',
  '대구광역시 수성구',
  '광주광역시 서구',
];

/* 교통수단 정의 (좌측 리스트 순서와 동일) */
export const TRANSPORTS = [
  { key: 'car',  label: '자동차',    icon: 'i-car',   emoji: '🚙', fareLabel: '자가용 이용 시' },
  { key: 'ktx',  label: '기차 (KTX)', icon: 'i-train', emoji: '🚆', fareLabel: 'KTX 이용 시' },
  { key: 'bus',  label: '고속버스',   icon: 'i-bus',   emoji: '🚌', fareLabel: '고속버스 이용 시' },
  { key: 'air',  label: '비행기',    icon: 'i-plane', emoji: '✈️', fareLabel: '비행기 이용 시' },
];

/* 여행지 — 지도 좌표(x/y)는 지도 이미지 기준 백분율 */
export const DESTINATIONS = [
  {
    id: 'seoul',
    name: '서울',
    region: '서울특별시',
    photo: 'images/mk-seoul.png',
    desc: '한강 야경과 도심의 활기가 흐르는<br />서울에서 하루를 가득 채워보세요!',
    distance: '8km',
    map: { x: 33.23, y: 19.92 },
    fares: {
      car: { time: '25분',     cost: 2400 },
      ktx: { time: '20분',     cost: 1500 },
      bus: { time: '40분',     cost: 1500 },
      air: null,
    },
  },
  {
    id: 'gangneung',
    name: '강릉',
    region: '강원도',
    photo: 'images/hero-gangneung.png',
    marker: 'images/mk-gangwon.png',
    desc: '푸른 바다와 커피 향이 가득한<br />낭만 도시 강릉으로 떠나보세요!',
    distance: '218km',
    map: { x: 50.52, y: 16.99 },
    fares: {
      car: { time: '2시간 30분', cost: 19100 },
      ktx: { time: '2시간 10분', cost: 28600 },
      bus: { time: '2시간 50분', cost: 16500 },
      air: null,
    },
  },
  {
    id: 'sejong',
    name: '세종',
    region: '세종특별자치시',
    photo: 'images/mk-sejong.png',
    desc: '여유로운 호수공원과 정갈한 거리,<br />세종에서 천천히 쉬어가세요!',
    distance: '140km',
    map: { x: 36.72, y: 37.20 },
    fares: {
      car: { time: '1시간 50분', cost: 12400 },
      ktx: { time: '1시간 20분', cost: 18300 },
      bus: { time: '2시간 10분', cost: 11200 },
      air: null,
    },
  },
  {
    id: 'gyeongju',
    name: '경주',
    region: '경상북도',
    photo: 'images/th-bulguksa.png',
    marker: 'images/mk-gyeongbuk.png',
    desc: '천년 고도의 숨결이 남아있는<br />경주로 시간 여행을 떠나보세요!',
    distance: '371km',
    map: { x: 56.73, y: 40.69 },
    fares: {
      car: { time: '4시간 00분', cost: 32600 },
      ktx: { time: '2시간 05분', cost: 49300 },
      bus: { time: '4시간 20분', cost: 28900 },
      air: null,
    },
  },
  {
    id: 'jeonju',
    name: '전주',
    region: '전라북도',
    photo: 'images/th-hanok.png',
    marker: 'images/mk-jeonbuk.png',
    desc: '한옥의 멋과 맛이 가득한 전주에서<br />하루를 든든하게 채워보세요!',
    distance: '243km',
    map: { x: 34.56, y: 51.76 },
    fares: {
      car: { time: '2시간 50분', cost: 21400 },
      ktx: { time: '1시간 40분', cost: 34400 },
      bus: { time: '3시간 00분', cost: 18700 },
      air: null,
    },
  },
  {
    id: 'busan',
    name: '부산',
    region: '부산광역시',
    photo: 'images/th-haeundae.png',
    marker: 'images/mk-busan.png',
    desc: '바다와 도시가 어우러진 곳,<br />부산에서 여름을 만끽하세요!',
    distance: '396km',
    map: { x: 61.17, y: 60.69 },
    fares: {
      car: { time: '4시간 20분', cost: 34800 },
      ktx: { time: '2시간 40분', cost: 59800 },
      bus: { time: '4시간 30분', cost: 31000 },
      air: { time: '1시간 00분', cost: 79000 },
    },
  },
  {
    id: 'jeju',
    name: '제주',
    region: '제주특별자치도',
    photo: 'images/th-hallasan.png',
    marker: 'images/mk-jeju.png',
    desc: '화산섬이 빚어낸 절경 속에서<br />완전한 휴식을 누려보세요!',
    distance: '452km',
    map: { x: 26.79, y: 92.39 },
    fares: {
      car: null,
      ktx: null,
      bus: null,
      air: { time: '1시간 10분', cost: 68000 },
    },
  },
  /* --- 지도에는 없지만 목록/카드에서 쓰이는 여행지 --- */
  {
    id: 'yeosu',
    name: '여수',
    region: '전라남도',
    photo: 'images/pop-jeonnam.png',
    desc: '밤바다가 반짝이는 낭만 도시,<br />여수로 떠나보세요!',
    distance: '375km',
    fares: {
      car: { time: '4시간 10분', cost: 33200 },
      ktx: { time: '3시간 10분', cost: 47600 },
      bus: { time: '4시간 20분', cost: 34500 },
      air: null,
    },
  },
  {
    id: 'gapyeong',
    name: '가평',
    region: '경기도',
    photo: 'images/th-arboretum.png',
    desc: '숲과 정원이 어우러진 가평에서<br />마음을 천천히 쉬어가세요!',
    distance: '62km',
    fares: {
      car: { time: '1시간 10분', cost: 6800 },
      ktx: { time: '1시간 30분', cost: 8600 },
      bus: { time: '1시간 40분', cost: 7900 },
      air: null,
    },
  },
];

/* 지도에 마커로 표시할 여행지 (구버전 고정 마커 방식 — 현재는 미사용, 참고용으로 남겨둠) */
export const MAP_PINS = ['seoul', 'gangneung', 'sejong', 'gyeongju', 'jeonju', 'busan', 'jeju'];

/* 지도 svg 시/도 id 목록 — 법정동코드 앞 2자리. destId 있는 곳만 여행지 데이터 연결됨 */
export const REGIONS = [
  { id: '11', name: '서울', label: '서울특별시',     destId: 'seoul' },
  { id: '26', name: '부산', label: '부산광역시',     destId: 'busan' },
  { id: '27', name: '대구', label: '대구광역시',     destId: null },
  { id: '28', name: '인천', label: '인천광역시',     destId: null },
  { id: '29', name: '광주', label: '광주광역시',     destId: null },
  { id: '30', name: '대전', label: '대전광역시',     destId: null },
  { id: '31', name: '울산', label: '울산광역시',     destId: null },
  { id: '36', name: '세종', label: '세종특별자치시', destId: 'sejong' },
  { id: '41', name: '경기', label: '경기도',         destId: 'gapyeong' },
  { id: '43', name: '충북', label: '충청북도',       destId: null },
  { id: '44', name: '충남', label: '충청남도',       destId: null },
  { id: '45', name: '전북', label: '전라북도',       destId: 'jeonju' },
  { id: '46', name: '전남', label: '전라남도',       destId: 'yeosu' },
  { id: '47', name: '경북', label: '경상북도',       destId: 'gyeongju' },
  { id: '48', name: '경남', label: '경상남도',       destId: null },
  { id: '50', name: '제주', label: '제주특별자치도', destId: 'jeju' },
  { id: '51', name: '강원', label: '강원도',         destId: 'gangneung' },
];

/* 인기 지역 (좌측 패널) */
export const POPULAR = [
  { destId: 'gangneung', title: '강원도',     desc: '자연과 힐링의 명소',   thumb: 'images/pop-gangwon.png' },
  { destId: 'jeju',      title: '제주도',     desc: '가장 사랑받는 여행지', thumb: 'images/pop-jeju.png' },
  { destId: 'busan',     title: '부산광역시', desc: '바다와 도시의 조화',   thumb: 'images/pop-busan.png' },
  { destId: 'yeosu',     title: '전라남도',   desc: '맛과 멋이 있는 곳',    thumb: 'images/pop-jeonnam.png' },
];

/* 테마별 추천 여행지 (하단 캐러셀) */
export const THEMES = [
  { destId: 'busan',     tag: '바다',  name: '부산 해운대',       glyph: '🌊', tone: '#3b82f6', img: 'images/th-haeundae.png' },
  { destId: 'jeju',      tag: '자연',  name: '제주 한라산',       glyph: '🌿', tone: '#22a06b', img: 'images/th-hallasan.png' },
  { destId: 'gyeongju',  tag: '역사',  name: '경주 불국사',       glyph: '🏛', tone: '#d97706', img: 'images/th-bulguksa.png' },
  { destId: 'jeonju',    tag: '감성',  name: '전주 한옥마을',     glyph: '🏮', tone: '#8b5cf6', img: 'images/th-hanok.png' },
  { destId: 'jeonju',    tag: '맛집',  name: '전주 비빔밥',       glyph: '🍜', tone: '#ef4778', img: 'images/th-bibimbap.png' },
  { destId: 'gapyeong',  tag: '힐링',  name: '가평 아침고요수목원', glyph: '🌸', tone: '#0ea5b7', img: 'images/th-arboretum.png' },
];
