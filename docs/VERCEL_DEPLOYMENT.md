# Vercel 테스트 배포

## 연결
1. Vercel에서 Add New → Project를 선택합니다.
2. GitHub agiodesign88 계정의 agio 저장소를 Import합니다.
3. Framework Preset: Other, Root Directory: ./, Node.js: 22.x.
4. Build Command와 Output Directory는 vercel.json의 설정을 사용합니다. 각각 node tools/verify-deployment.mjs / public입니다.
5. Environment Variables에 KAKAO_REST_KEY를 등록합니다. 자동차용 키가 별도면 KAKAO_MOBILITY_KEY도 등록합니다. 두 값 모두 서버 전용입니다. Production과 Preview 중 테스트할 환경을 선택합니다.
6. Deploy를 누릅니다. 키를 나중에 추가하면 Redeploy해야 합니다.

이 지도는 MapLibre/OpenFreeMap 기반이라 지도 표시에는 KAKAO_JS_KEY가 필요하지 않습니다. 카카오 REST 키는 주소 검색과 길찾기에 사용합니다.

## 테스트 범위
- 현재 등록된 공간 11개 및 편집 사진 표시
- 홈/지도/상세/저장/설정, 현재 위치(사용자 권한 필요)
- 실제 주소 검색 및 대중교통/도보/자동차 길찾기(키와 API 권한 필요)
- 방문 사진은 접속한 브라우저의 IndexedDB에만 저장합니다.
- 로컬 주소에서 저장한 개인 기록은 배포 주소로 자동 이전되지 않습니다.
- Preview 주소가 바뀌면 브라우저 저장소도 별개입니다. 반복 테스트는 같은 주소에서 진행하세요.
- 화면 잠금 중 사진 처리와 복구 기능은 아직 보강 전입니다.

## 조회 전용
배포 API의 공간 등록/수정/서버 업로드는 403으로 차단합니다. lab.html에는 로컬 관리자 이용 안내가 표시됩니다.
카탈로그는 사용자 요청에 따라 현재 초안 공간도 보여주는 테스트 스냅샷입니다. 미공개 자료는 추가하지 마세요.
공간 수정은 로컬에서 진행한 뒤 카탈로그와 편집 이미지를 GitHub에 반영해 재배포합니다.

## 운영 전
현재는 로그인 없는 테스트용입니다. 외부 API 사용량을 확인하고, 지인 테스트에는 가능한 Vercel Deployment Protection을 사용하세요.
인터넷 공개 운영 전에는 인증/사용량 제한, 외부 DB와 파일 저장소, 중단 가능한 업로드 복구 및 공개 사진 관리가 필요합니다.
단순 Origin 검사만으로 API 남용을 차단할 수는 없습니다.

## 배포 확인
- /api/config: readOnly가 true인지 확인 (서버 키 자체는 반환하지 않음)
- /api/places: 공간 목록 반환
- 홈 이미지, 상세 페이지 및 지도 정상 표시
- 경로 목록 선택 시 상세 안내와 선 표시
- 관리자 쓰기 요청 차단

이 문서는 배포 설정을 설명합니다. 실제 Vercel 배포 성공과 환경변수 등록은 대시보드에서 별도로 확인해야 합니다.
