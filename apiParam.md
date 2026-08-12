# TourAPI 파라미터 정리 — "어디갈까?" 프로젝트

`api.js`에서 실제로 사용 중인 TourAPI(KorService2) 오퍼레이션 8개의 **요청 파라미터**를 정리한 문서입니다. 각 파라미터의 출처는 한국관광공사 개방데이터 활용매뉴얼(v4.4)이며, "코드에서 어떻게 값을 넣고 있는지"까지 같이 표기했습니다.

**항목구분 표기**: 🔴 필수 / ⚪ 옵션 (매뉴얼 기준)


### **랜더링된 화면으로 보고싶으면 Shift + Ctrl + V**


---

## 1. `areaBasedList2` — 지역기반 관광정보 조회 (여행지 목록)

`getTravelList()`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey` | 🔴 | 인증키 | `CONFIG.SERVICE_KEY` (고정) |
| `MobileOS` | 🔴 | IOS/AND/WEB/ETC | `'ETC'` (고정) |
| `MobileApp` | 🔴 | 서비스명(앱 이름) | `'test'` (고정) |
| `_type` | ⚪ | 응답 형식 (기본 XML, `json` 지정 시 JSON) | `'json'` (고정) |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | `10` (지역당 개수, `ITEMS_PER_AREA`) |
| `pageNo` | ⚪ | 페이지 번호 | `1` (고정) |
| `arrange` | ⚪ | 정렬 구분 — 아래 [정렬 코드표](#참고-arrange-정렬-코드) 참고 | `'Q'` (대표이미지 있는 것만, 수정일순) |
| `contentTypeId` | ⚪ | 관광타입ID (12=관광지, 14=문화시설, 15=축제공연행사 등) | `12` (여행지 고정, `CONTENT_TYPE.TRAVEL`) |
| `lDongRegnCd` | ⚪ | 법정동 시도코드 (예: `11`=서울) — 생략하면 전국 대상 | 지역 순회하며 각 시도 코드 대입 |
| `lDongSignguCd` | ⚪ | 법정동 시군구코드 (예: `11110`=종로구) — `lDongRegnCd`와 함께 넘겨야 유효함 | 시군구 필터 선택 시에만 대입 |

---

## 2. `searchFestival2` — 행사정보 조회 (축제 목록)

`getFestivalList()`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | `10` |
| `pageNo` | ⚪ | 페이지 번호 | `1` |
| `eventStartDate` | 🔴 **(필수!)** | 행사 시작일(YYYYMMDD) — **이 날짜 이후 끝나는 행사만 조회** | 오늘 날짜를 `YYYYMMDD`로 계산해서 자동 대입 (`new Date()` 기반) |
| `eventEndDate` | ⚪ | 행사 종료일(YYYYMMDD) | 미지정(생략) |
| `lDongRegnCd` | ⚪ | 법정동 시도코드 | 지역 순회하며 각 시도 코드 대입 |
| `lDongSignguCd` | ⚪ | 법정동 시군구코드 — `lDongRegnCd`와 함께 넘겨야 유효함 | 시군구 필터 선택 시에만 대입 |

> ⚠️ `eventStartDate`는 매뉴얼상 **필수(1) 파라미터**입니다. 코드에서 호출부가 안 넘겨도 함수 안에서 자동으로 오늘 날짜를 계산해 채워주기 때문에 겉으로는 옵션처럼 보이지만, 실제로는 항상 값이 채워져서 나갑니다.

---

## 3. `ldongCode2` — 법정동 코드 조회 (지역 필터용)

`getAreaCodes()` / `getSigunguCodes(lDongRegnCd)`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | `getAreaCodes()`: `20` (전국 17개 시도), `getSigunguCodes()`: `100` (시도 하나의 시군구 전부) |
| `pageNo` | ⚪ | 페이지 번호 | `1` |
| `lDongRegnCd` | ⚪ | 시도코드 — **생략하면 전국 시도 목록**, 넣으면 그 시도의 시군구 목록 | `getAreaCodes()`는 **넣지 않음**(전국 시도 17개), `getSigunguCodes()`는 사용자가 클릭한 시도 코드를 대입 |
| `lDongListYn` | ⚪ | 전체 법정동코드 목록조회 여부 | **사용 안 함** |

> 시군구 목록은 시도를 클릭할 때만(그 시도가 아직 캐시에 없을 때) 필요한 만큼씩 불러옵니다 — 전국 시군구(약 250개)를 페이지 로드 시점에 한꺼번에 조회하면 서비스키 일일 호출 한도(1,000건)를 금방 넘기기 때문입니다.

---

## 4. `searchKeyword2` — 키워드 검색 조회

`searchKeyword()`에서 정의만 해둠 (⚠️ 아직 실제로 호출하는 곳 없음, 검색 기능 추가 시 사용 예정)

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | `20` |
| `pageNo` | ⚪ | 페이지 번호 | `1` |
| `keyword` | 🔴 | 검색 키워드 | 호출부에서 문자열로 전달 (예: `'경복궁'`) |
| `contentTypeId` | ⚪ | 관광타입ID로 결과 범위 좁히기 | 호출부 선택사항 |

---

## 5. `detailCommon2` — 공통정보 조회 (상세 기본정보)

`getDetailCommon(contentId)`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `contentId` | 🔴 | 콘텐츠ID | 상세페이지 URL의 `?id=` 값 |

> ⚠️ 코드 주석에 남아있듯, `defaultYN`/`contentTypeId`/`overviewYN` 같은 추가 옵션 파라미터를 넣으면 이 배포 버전에서는 `INVALID_REQUEST_PARAMETER_ERROR`로 거부되는 게 실측 확인됐습니다. 그래서 `contentId` 단독으로만 요청합니다.

---

## 6. `detailIntro2` — 소개정보 조회 (상세 부가정보)

`getDetailIntro(contentId, contentTypeId)`에서 호출 — **contentTypeId에 따라 응답 필드 자체가 달라짐**

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `contentId` | 🔴 | 콘텐츠ID | 상세페이지 URL의 `?id=` 값 |
| `contentTypeId` | 🔴 | 관광타입ID (12/14/15/25/28 등) — 이 값에 따라 응답 필드가 완전히 달라짐 | 상세페이지 URL의 `?type=` 값 (12 또는 15) |

---

## 7. `detailImage2` — 이미지정보 조회 (현장 사진 갤러리)

`getDetailImages(contentId)`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | 미지정(기본값) |
| `pageNo` | ⚪ | 페이지 번호 | 미지정(기본값) |
| `contentId` | 🔴 | 콘텐츠ID | 상세페이지 URL의 `?id=` 값 |
| `imageYN` | ⚪ | `Y`=콘텐츠 이미지 조회, `N`=음식점 타입의 음식메뉴 이미지 | `'Y'` (고정) |

---

## 8. `detailInfo2` — 반복정보 조회 (이용 안내)

`getDetailInfo(contentId, contentTypeId)`에서 호출

| 파라미터 | 항목구분 | 매뉴얼 설명 | 코드에서 넣는 값 |
|---|---|---|---|
| `serviceKey`/`MobileOS`/`MobileApp`/`_type` | 🔴/🔴/🔴/⚪ | 위와 동일 | 고정값 동일 |
| `numOfRows` | ⚪ | 한 페이지 결과 수 | 미지정(기본값) |
| `pageNo` | ⚪ | 페이지 번호 | 미지정(기본값) |
| `contentId` | 🔴 | 콘텐츠ID | 상세페이지 URL의 `?id=` 값 |
| `contentTypeId` | 🔴 | 관광타입ID — "숙박"은 객실정보, "여행코스"는 코스정보, 그 외는 이름-값 쌍 반복정보 제공 | 상세페이지 URL의 `?type=` 값 |

---

## 참고: `arrange` 정렬 코드

`areaBasedList2`, `searchFestival2`, `searchKeyword2` 등 목록 계열 오퍼레이션에 공통으로 쓰이는 파라미터입니다.

| 값 | 의미 |
|---|---|
| `A` | 제목순 정렬 |
| `C` | 수정일순 정렬 (매뉴얼 기본값) |
| `D` | 생성일순 정렬 |
| `O` | 제목순 + **대표이미지가 반드시 있는 것만** |
| `Q` | 수정일순 + **대표이미지가 반드시 있는 것만** |
| `R` | 생성일순 + **대표이미지가 반드시 있는 것만** |

프로젝트에서는 `getTravelListByArea`가 `'Q'`를 사용 — 사진 없는 카드가 대표 이미지 자리에 뜨는 걸 줄이기 위함입니다.

## 참고: `contentTypeId` (관광타입ID) 코드

이 프로젝트에서 실제로 쓰는 두 가지만 정리합니다 (전체 코드는 매뉴얼에 12/14/15/25/28/32/38/39 등 더 있음).

| 값 | 의미 | 사용처 |
|---|---|---|
| `12` | 관광지 | `TourAPI.CONTENT_TYPE.TRAVEL` |
| `15` | 축제/공연/행사 | `TourAPI.CONTENT_TYPE.FESTIVAL` |

## 참고: 모든 오퍼레이션에 공통으로 들어가는 고정 파라미터

`buildUrl()` 함수 안에서 오퍼레이션 종류와 상관없이 항상 자동으로 붙는 값들입니다. 위 표들에서 매번 반복해서 적은 이유가 "실제로 모든 요청에 다 들어가기 때문"이라는 걸 강조하기 위함이었습니다.

| 파라미터 | 값 | 비고 |
|---|---|---|
| `serviceKey` | `CONFIG.SERVICE_KEY` | 이미 URL 인코딩된 값이라 추가 인코딩 없이 그대로 이어붙임 |
| `MobileOS` | `ETC` | |
| `MobileApp` | `test` | |
| `_type` | `json` | 없으면 기본 응답이 XML로 옴 |