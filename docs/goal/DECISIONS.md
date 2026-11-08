# DECISIONS — guitar-hero v1

> 형식: `D-NNN 제목` / 날짜 / 맥락 / 선택지 / 결정 / 결과·트레이드오프. goal 실행자는 SPEC에 없는 선택이나 SPEC과 다른 선택을 할 때 여기에 추가한다(사용자에게 질문하지 않는다).
> D-001–D-010은 goal 시작 전 사용자와 합의한 결정이다(2026-10-07 세션).

## D-001 대상 사용자와 악기
- 맥락: 사용자 답변 — 완전 초보, 어쿠스틱(통기타), MacBook·iPad·iPhone 모두 사용.
- 결정: Stage 0부터 시작하는 초급 커리큘럼. 스틸 줄 어쿠스틱 + 기기 내장 마이크를 1차 대상으로 DSP를 튜닝한다.

## D-002 자체 커리큘럼 (특정 강사 콘텐츠 연동 없음)
- 선택지: 강의 영상 임베드 / 링크만 / 자체 커리큘럼.
- 결정: 자체 커리큘럼. 연습 방법(1분 코드 체인지, 한 줄씩 확인 등)은 일반 명칭과 앱 자체 문구로 구현하고, 연습곡은 앱이 창작한 코드 진행으로 한다.

## D-003 데이터: local-first + JSON 내보내기
- 선택지: 로컬 + JSON / 클라우드 동기화(Supabase 등) / 단일 기기.
- 결정: 기기별 IndexedDB(Dexie) + JSON 내보내기/가져오기. 동기화는 v2. 데이터 모델은 append-only Attempt라 나중에 동기화를 붙이기 쉽다.

## D-004 배포: 정적 호스팅 준비만
- 결정: goal은 빌드 산출물, `_headers`/`vercel.json`, `docs/DEPLOY.md`, `dev:https`까지만 만든다. 실제 배포는 사용자가 goal 이후 직접 한다.

## D-005 Git: 별도 브랜치에서 마일스톤마다 커밋
- 결정: `feat/practice-app-v1`에서 마일스톤 종료 시 커밋. push·main 병합 금지. (사용자 전역 규칙 "자동 커밋 금지"의 예외로 사용자가 이 goal에 한해 승인)

## D-006 DSP 구현 언어: 순수 TypeScript
| 선택지 | 장점 | 단점 |
|---|---|---|
| TypeScript | Node 테스트와 브라우저가 같은 코드, 빌드 단순, GPL 회피 | 이론상 느림(실측상 충분) |
| C++ → WASM | 사용자에게 익숙, 성능 여유 | Emscripten 빌드 체인, worklet 로딩 번거로움 |
| Rust → WASM | 안전성 | 빌드 체인 추가 |
- 결정: v1은 TypeScript. 프로파일로 필요가 증명된 커널만 v2에서 WASM. (리서치 02 §6)

## D-007 판정 철학: 인식이 아니라 검증, 3상태 판정
- 결정: 앱은 목표 보이싱을 알고 있으므로 "무슨 코드인가"가 아니라 "기대한 음이 울렸나"를 검증한다. 판정은 PASS/FAIL/RETRY. 확신 없으면 RETRY. 스트럼 모드는 독립 partial이 있는 줄만 판정(베타), 확정 판정은 한 줄씩 모드. (리서치 02 §2.c–2.d)

## D-008 스택
- 결정: Vite 8 + React 19 + TS 7(strict) + Tailwind 4 + Dexie 4 + Zustand 5 + Zod 4 + svguitar + Recharts 3 + vite-plugin-pwa 1.3 + Vitest 5 + Playwright 1.63 + Biome 2. 이유: 병목은 오디오 파이프라인이라 UI 프레임워크 성능 차이가 결정적이지 않고, SvelteKit 3·Solid 2는 메이저 전환 직후/직전이라 위험. (리서치 03 §4.2)

## D-009 품질 계약 고정
- 결정: 테스트 임계값·매트릭스는 `docs/goal/thresholds.json`에 고정하고, goal 조건문에 SPEC.md·thresholds.json의 SHA-256을 넣어 실행 중 변경을 막는다. 합성 벤치마크는 dev/test split을 분리한다.

## D-010 UI 언어
- 결정: 한국어 UI(존댓말), 문자열은 `src/i18n/ko.ts`에 모은다(나중에 다국어 확장 가능). 음악 용어는 관용 표기.

---
<!-- goal 실행자 결정은 D-011부터 아래에 추가 -->

## D-011 턴 상한 300 → 1000 (사용자 지시)
- 날짜: 2026-10-07 (M0 진행 중)
- 맥락: goal 실행 중 사용자가 "300턴 말고 1000턴으로 변경"이라고 지시했다. SPEC §2.6(합계 300)·§16.1(턴 240 이후 축소 허용)은 SPEC 수정 금지 규칙 때문에 문서를 고치지 않는다.
- 결정: 전체 상한을 **1000턴**으로 운용한다. 마일스톤별 소프트 예산은 SPEC §2.6 비율 그대로 늘린다(약 ×3.33). §16.1 DEFERRABLE 축소는 같은 비율로 **턴 800 이후**에만 고려한다(범위를 덜 줄이는 보수적 선택).
- 트레이드오프: 실행 시간이 길어지지만 범위 축소 가능성이 줄어든다. goal 조건문 자체의 "300턴" 문구는 사용자가 `/goal`을 다시 설정해야 바뀐다.

## D-012 라우팅: react-router 8, hash 라우터
| 선택지 | 장점 | 단점 |
|---|---|---|
| react-router 8 `createHashRouter` | 정적 호스트 4종(GitHub Pages 포함)에서 SPA 재작성 규칙 없이 동작, `VITE_BASE` 하위 경로와 무관 | URL에 `#` |
| react-router BrowserRouter | 깔끔한 URL | GitHub Pages는 404 fallback 꼼수 필요 |
| TanStack Router | 타입 안전 | 화면 10개 규모에 과함 |
- 결정: react-router 8 hash 라우터. 테스트용 `?timeScale`은 `location.search`와 hash 쿼리 둘 다에서 읽는다.

## D-013 코드 다이어그램: svguitar 대신 자체 SVG 컴포넌트
- 맥락: `svguitar@2.8.0`이 Node 렌더링용 `svgdom` → `sax@1.6.1`(BlueOak-1.0.0)을 프로덕션 의존성으로 끌어온다. BlueOak는 허용적이지만 SPEC §2.4 허용 목록(MIT/BSD/ISC/Apache-2.0/0BSD/MPL-2.0/CC0/Unlicense)에 없다.
| 선택지 | 장점 | 단점 |
|---|---|---|
| svguitar 유지 + 허용 목록에 BlueOak 추가 | 구현 시간 절약 | SPEC 허용 목록 위반, 번들에 불필요한 svgdom |
| 자체 React SVG 컴포넌트 | 라이선스 문제 없음, 왼손잡이 미러·고대비 테마·접근성 제어 쉬움 | 약 150줄 구현 |
- 결정: svguitar 제거, `src/ui/ChordDiagram.tsx` 자체 구현(세로형, 손가락 번호, x/o, 바레, 왼손잡이 미러). SPEC §4.1 의미(세로형·손가락·x/o·바레·미러)는 유지.

## D-014 AudioWorklet TS 번들 방법 (M0 스파이크 1)
- 결과: `import url from './worklet/capture-processor.ts?worker&url'` + `ctx.audioWorklet.addModule(url)`이 Vite 8 dev(모듈 변환 서빙)와 build(별도 `assets/capture-processor-*.js` 청크) 양쪽에서 동작함을 확인. dev는 Playwright로 `vite` 서버에서 레벨 메시지 수신을 확인, build는 `tests/e2e/spike.mic.spec.ts`.
- worklet은 `tsconfig.worklet.json`(lib ES2023 + `@types/audioworklet`)으로 따로 타입체크한다(DOM lib와 전역 충돌 방지). `@types/audioworklet`의 `AudioWorkletProcessor`에는 `process`가 선언돼 있지 않아 `override`를 붙이지 않는다.

## D-015 E2E 가짜 마이크 하네스 (M0 스파이크 2·3)
- 스파이크 2: SPEC §14.5 설계대로 `AudioContext` 생성자를 감싸 앱 컨텍스트를 잡고 `getUserMedia`가 같은 컨텍스트의 `MediaStreamAudioDestinationNode.stream`을 돌려준다. WAV를 `__fakeMic.play(url, {at})`로 흘리면 worklet RMS로 관측됨(통과).
- fixture는 preview 서버가 `dist-e2e`만 서빙하므로 `page.route('**/fixtures/**')`로 `tests/fixtures/generated/`에서 응답한다. 서비스 워커가 `page.route`를 우회하므로 Playwright 기본값을 `serviceWorkers: 'block'`으로 두고, PWA 오프라인 테스트(E2E-09)만 `allow`로 바꾼다.
- 스파이크 3: `chromium-fake-capture` 프로젝트에서 `--use-file-for-fake-audio-capture=<abs>.wav%noloop`로 실제 getUserMedia 경로의 레벨 관측 확인(통과).
- WebKit(Playwright webkit)이 이 macOS에서 실행됨을 확인 → `webkit-ipad`/`webkit-iphone` 프로젝트는 WebKit 그대로 사용.

## D-016 한글 문자열 위치 규칙
- 결정: UI 문구는 `src/i18n/ko.ts`, 콘텐츠 데이터(스테이지 이름·설명·팁, 연습곡 제목)는 `src/content/`에 둔다. 무결성 테스트는 `src/` 전체에서 `i18n/`·`content/`·테스트 파일 밖의 한글(주석 제외)을 금지한다(SPEC §14.6-4의 "컴포넌트 TSX"보다 넓게 — 더 엄격한 쪽).
- 도메인 규칙(코칭 힌트 등)은 문구가 아니라 코드+파라미터를 반환하고, 문구 렌더링은 `ko.ts`의 함수가 한다.

## D-017 테스트 훅 제거 방식
- 결정: Vite `define`의 빌드 상수 `__GH_E2E__`(e2e 모드에서만 true)로 `window.__gh_test`·`timeScale` 코드를 감싼다. 프로덕션 빌드에서는 상수 false 분기가 minifier에 의해 제거된다(E2E-14가 `dist/` 문자열 스캔으로 확인). SPEC §11.1 예시의 `import.meta.env.VITE_E2E`와 의미가 같다.

## D-018 TS 도구 실행기: tsx
- 결정: `tools/*.ts`(verify, bench, fixtures, licenses)는 `tsx`(MIT, dev 의존성)로 실행한다. Node 24의 타입 스트리핑은 확장자 없는 import를 처리하지 못해 앱 코드와 import 규약이 달라진다.

## D-019 tonal 6.4.3 고정(devDependency)
- 맥락: `tonal@6.5.0`(2026-09-28)의 package.json이 존재하지 않는 `dist/index.js`·`dist/index.d.ts`를 가리켜 Vite/Vitest에서 해석 실패.
- 결정: `tonal@~6.4.3`(파일 구조 정상)을 쓰고, 앱 런타임은 tonal을 쓰지 않으므로(보이싱 구성음 검증 테스트 전용) devDependency로 둔다. SPEC §4.1의 용도("코드 구성음 검증용")와 같다.

## D-020 파생 데이터 = attempt 재생(replay)
- 결정: `domain/derive.ts`의 순수 함수 `applyAttempt(state, attempt)`가 지표 샘플·스킬 상태·복습 큐(졸업 시 등록, 복습 시도 결과 반영)를 한 번에 갱신한다. 증분 저장(`Repository.recordAttempt`)과 `rebuildDerived()`가 같은 함수를 쓰므로 "재계산 = 증분"이 구조적으로 보장되고 테스트로도 확인한다.
- `toMetrics`는 플러그인(React) 대신 `domain/exerciseResults.ts`의 순수 추출기 레지스트리에 두고, 플러그인은 이를 위임 호출한다(Node에서 재계산 가능).
- 스킬 상태는 지표별 `count/last/best/recent(최근 10)/dayBest(일별 최고)`. "서로 다른 2일 ≥30"·"최근 3회 중앙값"·"최근 10회 clean"이 모두 여기서 계산된다.

## D-021 루틴 시간 배분(설계값)과 Stage 0
| 블록 | 초 |
|---|---|
| 튜닝 | 60 (Stage 0: 120) |
| 워밍업 | 60 (뮤트 스트럼) / 90 (Stage 4+ E7) |
| 코드 정밀 | 신규 90 + 최약 60 |
| 1분 체인지 | 60 × 2(+1), 사이 휴식 30 |
| 리듬 | 120 |
| 기술 | 60 (곡 9분이 보장될 때만) |
| 복습 슬롯 | ≤ 180 |
| 연습곡 | 540–600, 항상 마지막 |
- Stage 0은 코드가 없어 연습곡 블록 대신 튜닝 120 → 뮤트 스트럼 60 → 다이어그램 퀴즈 300 → 뮤트 스트럼 300 → 튜닝 연습 180 → 퀴즈 240(같은 항목 연속 금지 유지).
- 3일 초과 공백이면 코드 정밀 블록을 직전 스테이지 복습(직전 스테이지 신규 코드 E1 + 직전 스테이지 첫 focus 쌍 E2)으로 바꾼다. 튜닝·워밍업은 안전상 유지.
- 통증 ≥5: E1·E2 시간을 절반(15초 단위 반올림, 최소 30초)으로 줄이고 빈 시간은 채우지 않는다.

## D-022 진급 규칙 데이터 매핑
- "학습 쌍 ≥30"과 Stage 1·2·6의 "쌍 ≥30"을 모두 `unlockedPairsAtLeast {value 30, days 2}`(해금 코드의 25쌍 부분집합 전부가 서로 다른 2일에 ≥30)로 통일한다(SPEC §7.1 정의, 01 §5.4 E2 "단계 통과 = 서로 다른 2일").
- "코드 퀴즈 통과"는 `recallUnlocked`(해금된 모든 코드 클래스의 Q2 3초 내 정답 기록 ≥1회). G 두 보이싱은 클래스 'G' 하나.
- "연습곡 1곡 완주 자가 보고" = `countAtLeast song:* completed ≥1`. "P5 시도 기록" = `countAtLeast strum:P5 hitRate ≥0 1회`.
- 조건부 진급: 미충족 규칙이 쌍 규칙뿐이고 미충족 쌍 전부가 "21일 이상 연습 + 일별 최고값의 처음 3일 중앙값 대비 마지막 3일 중앙값 상승 < 2"일 때. 승급 시 해당 쌍을 `prescribedDrills`로 넘겨 다음 스테이지 루틴의 기술 블록에 E4를 처방한다.
- G 보이싱: Stage 6에서 G-2f가 습득(최근 10회 중 clean ≥5)되면 G-3f로 전환 제안.

## D-023 코칭 힌트 보완 규칙
- SPEC §6.7 표 외에 두 경우를 보수적으로 추가: (1) 개방현 MUTED인데 인접 줄에 손가락이 없음 → "손바닥이나 손가락이 닿지 않게"; (2) 개방현 기대인데 더 낮은 음 → "튜닝을 다시 확인". 인접 손가락이 양쪽에 있으면 저음 쪽(idx−1) 손가락을 먼저 지목한다(손가락 살이 고음 쪽 줄에 닿는 경우가 흔함).

## D-024 Mode B: 누설 인지 바닥 + 시간 모양 뮤트 판정 (dev 튜닝, SPEC §10.6 의미 유지)
- 맥락: 초기 구현(잡음 대비 SNR, T_PRESENT 12 / T_ABSENT 4 dB)은 dev split에서 깨끗한 스트럼 FAIL 95%. 원인 분석(`tools/bench/debug/modeB-*.ts`): (1) bin별 잡음은 광대역 SNR보다 ~40 dB 낮아, 강한 이웃 partial의 Hann 사이드로브(−31 dB)만으로도 "증거 20–50 dB"가 나와 x 줄·기대 밖 음 오탐; (2) 뮤트 줄은 창 [+40, +210]의 앞부분에 아직 에너지가 있어 절대 증거로는 울리는 약한 줄(이득 지터 ±6 dB)과 겹침.
| 선택지 | 결과(dev) |
|---|---|
| 절대 임계값만 조정 | 뮤트·오탐 분포가 겹쳐 불가 |
| 누설 모델 + 후기 창 절대 증거 | 울리는 줄도 창이 짧아져 4–14 dB 떨어져 분리 실패 |
| **누설 모델 + 같은 길이 초기/후기 창의 decay·상대 레벨** | 뮤트 검출 0.92, 깨끗 FAIL 1.5 % |
- 결정: §10 해설의 "salience ≥ T_PRESENT → OK, ≤ T_ABSENT → MUTED"를 "증거 ≥ T_PRESENT 그리고 지속 → OK, 시간 모양이 뮤트 → MUTED"로 구체화(3상태·줄 지목·베타 의미는 같음). 기대 밖 음 탐색은 잘못된 프렛 가설(±1·±2 반음)로 좁히고 임계값을 dev 분포로 정했다. 세부 수치는 `docs/DSP.md` §5.
- 트레이드오프: 신호 모델(정상 sustain vs −30 dB/120 ms)에 기대므로 실녹음에서 decay가 빠른 줄(나일론, 낡은 줄)은 RETRY가 늘 수 있다 → GuitarSet 소프트 지표로 확인(M3).

## D-025 Mode C: 직전 잡음 대신 국소 스펙트럼 포락선("peakiness")
- 맥락: 1분 체인지 시퀀스에서는 onset 직전 0.5 s에 이전 코드가 울린다. 이를 잡음으로 쓰면 같은 코드 재스트럼의 증거가 0이 되어 margin이 무작위가 되고(과대·과소 집계), 반향이 있으면 체인지 도착도 보류됐다(dev |오차| ≤ 1 비율 0.68).
- 결정: 각 partial의 증거를 같은 창의 국소 포락선(±1/3 옥타브 30-퍼센타일, 탐침 제외) 대비로 계산하고 h^−0.5 가중 평균. dev 0.975 / MAE 0.07 / 과대 0, 집합 분류 0.996.

## D-026 Onset: 시각 정밀화를 미세 log flux로, broadband·lag dev 튜닝
- 초기 고역 미분 포락선 임계값 정밀화는 additive 합성(부드러운 attack)에서 40 ms 이르게 잡혀 F1 0.69. 미세 log 스펙트럼 flux(10.7 ms/1 ms hop) 첫 교차 + dev 보정 5 ms로 교체. broadband 상승 +6 → +3 dB, flux lag 2 → 4 프레임에서 dev F1 0.98, 지속음 가짜 onset 0 %.
- 오프라인 `pickOnsets`는 스트리밍 `OnsetPicker`를 그대로 돌린다(worklet과 벤치마크가 같은 코드).

## D-027 벤치마크 실행 구조
- worker_threads 워커는 `tools/bench/worker-boot.mjs`에서 `tsx/esm/api`의 `register()`를 호출한 뒤 TS 워커를 import한다(`execArgv: ['--import','tsx']`는 Node 24의 내장 타입 스트리핑이 먼저 잡아 확장자 없는 import를 해석하지 못함).
- Mode A/B 판정은 벤치마크에서도 **검출된 onset**을 쓰고 [onset−500, onset+400] ms만 넘긴다(앱과 동일). 정답 onset을 주지 않는다.
- SNR 정의(§14.3-2)는 반향·HPF를 거친 신호의 onset+0..500 ms RMS ÷ HPF를 거친 정상 잡음 RMS. RTT 탐침은 짧은 버스트라 SNR 기준을 버스트 자체 길이로 둔다(20–40 dB 층화).
- 벤치마크 시퀀스에서 손 뮤트(체인지 직전 15 ms 페이드)를 모델링했다. Mode D 쉼 슬롯 추가 스트럼 12 %, 누락 6 %.

## D-028 M2 리뷰(code-reviewer) 반영
- 확인된 결함과 조치:
  1. 채널 모델의 LPF 8 kHz가 잡음 스케일링 **뒤**에 적용돼 실제 SNR이 표기보다 최대 ~4.6 dB 높았다 → LPF를 신호·잡음 각각에 먼저 적용하고 SNR을 잰다. 테스트는 최종 녹음에서 잡음 = 녹음 − 무잡음 녹음으로 SNR을 측정(white/pink × LPF on/off × HPF).
  2. Mode A/B/집합 분류 벤치마크가 정답 onset에 가장 가까운 검출 이벤트를 골랐다(정답 누설) → 앱과 같은 순수 함수 `src/dsp/take.ts selectTakeEvent`(첫 onset, +400 ms 안에 다른 onset이면 RETRY(MULTIPLE_ONSETS), 없으면 NO_ONSET)를 쓴다. 앱의 E1·Q2 러너도 이 함수를 쓴다.
  3. 튜너 벤치마크가 정답 onset에서 프레임을 시작했다 → 녹음 처음부터 연속 실행하고 안정까지 시간만 onset 기준으로 잰다. 그 결과 attack이 걸친 프레임이 안정 판정에 끼어 p95 3.34 cents(dev)가 되어, **attack 포함 프레임 거부**(앞 1/4 RMS가 뒤 1/4보다 6 dB 넘게 작으면 무효)를 튜너에 추가 → dev p95 1.85 cents. 실제 튜너에도 맞는 동작이다.
  4. 무결성 테스트: thresholds.json 키 ↔ 판정 키 **양방향** 일치(perf 포함, 파라미터 키는 명시 목록), SNR 층(Mode B 15 dB는 cleanFailMax에만, 튜너 20 dB 미만 제외) 검사, 시드 겹침 검사에 전 모드 포함, Mode B 조건별 최소 표본을 **판정 층(SNR ≥ 25) 안에서** 보장(조건당 600, SNR 조건 내 균등).
  5. 소스 스캔: side-effect·동적 `import()`·`require()` 형태, `OfflineAudioContext`, `.js/.mjs` 파일의 `Math.random`, `Math[...]` 계산 접근까지 잡도록 강화하고 패턴 자기 검사 테스트 추가.
  6. worklet 경로 할당: `FluxAnalyzer`는 프레임 객체 재사용, `OnsetPicker`는 고정 버퍼 삽입 정렬과 사전 할당 후보 객체(반환 객체는 다음 호출까지 유효, 보관 시 복사).
- 지적 중 의도된 차이로 남긴 것(문서화):
  - 클릭 마스킹 창은 ±(10 ms + 반 프레임): 후보 시각이 프레임 중심이라 반 프레임 오차를 흡수해야 한다. "클릭 템플릿 일치"는 2–4 kHz 대역 flux 비중 ≥ 0.4 + 1 kHz 미만 flux < 1.5로 근사한다(저역이 오르면 정박 스트럼으로 보고 유지).
  - Mode D 타이밍 오차 분포는 ±50 ms 안에 매칭된 검출만 쓴다(§14.3-9 "검출 스트럼"의 오차). 그보다 먼 검출은 F1@±25 ms에서 이미 벌점이다.
  - 판정기의 `performance.now()`는 결과의 `processingMs` 측정에만 쓴다(도메인 시간 로직이 아님, worklet 경로에는 없음).
  - Mode B는 T_ABSENT를 "스트럼이 충분히 큰가(기준 ≥ T_ABSENT + 15 dB)"에만 쓰고, 줄 MUTED는 decay·relLate 모양으로 판정한다(D-024).
- 추가 dev 튜닝: Mode B 증거는 기대 위치 ±tol cents 안의 **실제 국소 피크**만 인정(이웃 피크의 스커트는 증거 아님) → 잘못된 프렛 PASS 0.10 → 0.0025. x 줄 임계값 16 → 14 dB(깨끗 FAIL 불변, 검출 0.93). onset broadband 조건을 "향후 4프레임 최대 vs lag 이전 3프레임 최소"로(넓은 스트럼·SNR 15에서 고역 상승이 40 ms에 걸쳐 일어남) → Mode C dev 0.958 → 0.992.

## D-029 M3: onset 재튜닝(합성 dev + GuitarSet dev), 판정 가능 구간, detector 1.1.0
- 맥락: M2 onset 설정은 GuitarSet dev 플레이어에서 F1 0.734(하드 임계값 0.85). 분석·시도 전체는 `docs/DSP.md` §13.2.
- 결정: 프레임 85.3 ms·lag 8, broadband +1 dB/고역 flux ≥ 0.5, 상대 조건이 붙은 저역 경로, 기대 선행 억제(60–180 ms, ×4), 정밀화 lookback 40 ms. 합성 dev와 GuitarSet dev 양쪽에서 동시에 확인했다(한쪽만 맞춘 설정 금지 — 앱은 하나의 검출기를 쓴다). test split/test 플레이어는 튜닝 중 보지 않았다(`--dev-only`).
- 판정 가능 구간: GuitarSet 이벤트는 [onset−500 ms, onset+400 ms]가 녹음 안에 있을 때만 판정한다. SPEC §8.2·§10.5 입력 정의(onset 주변 −500…+400 ms)를 만족하지 못하는 클립 시작부(0.02–0.05 s) 음은 앱에서도 생길 수 없다(앱은 항상 녹음이 먼저 시작). 임계값·이벤트 필터는 그대로다.
- 단음 이벤트의 "앞 150 ms 안에 다른 노트 없음"은 "앞 150 ms 동안 울리는 다른 노트 없음"(더 엄격)으로 해석했다.
- 실시간 경로: 기대 선행 억제와 정밀화는 worker 쪽(구간을 받은 뒤)에서 적용한다 → 판정 지연 ≈ 180 ms + 프레임. E2 자동 카운트·E5 사후 채점에는 문제없다.
- detectorVersion 1.0.0 → 1.1.0.

## D-030 M3 첫 GuitarSet test 실행: Mode A 하드 지표 미달 → dev에서 재현·수정 (detector 1.2.0)
- 결과(test 플레이어 04–05, detector 1.1.0): Mode A OK 0.882(15/17) < 0.95, 나머지 하드(±1 반음 오수용 0, Mode C 0.980, onset F1 0.877)와 소프트(0.064 / 0.003) 통과. n = 17이라 한 건만 틀려도 0.941로 미달한다.
- 절차(SPEC §14.3-11을 GuitarSet에 준용): test 개별 사례는 보지 않고, dev 플레이어에서 같은 지표의 여유를 분석(`tools/guitarset/debug/modeA.ts`):
  - 실제 음의 decay 비율 최소 0.12(합성 정상 음은 ≥ 0.33) — 전역 MUTED 기준 0.10에 너무 가깝다. 합성 뮤트는 p99 0.05.
  - clarity 0.846·0.864(저음 F2 등) — 0.85 기준 언저리. 레벨 10.1 dB — LOW_LEVEL 기준 10 dB 언저리.
- 수정(전부 SPEC §10.5가 dev 튜닝 대상으로 둔 초기값): 전역 MUTED 비율 0.10 → **0.07**(관대; 보통 0.085, 엄격 0.10), clarity 0.85 → **0.80**, WEAK 레벨 +10 → **+7 dB**. 합성 dev Mode A 전 지표 유지(뮤트 오수용 0.005, 뮤트 검출 0.995, 오음 검출 0.995), GuitarSet dev 단음 39/39 OK.
- detectorVersion 1.1.0 → 1.2.0. 이후 test 재실행 결과는 `docs/BENCHMARK.md` test-run log와 GuitarSet 절에 남는다.

## D-031 Mode A 실녹음 강건성 (두 번째 GuitarSet test 실행 후, detector 1.3.0)
- 결과(detector 1.2.0): test Mode A OK 여전히 15/17. 실패 유형 분해만 확인(개별 사례는 보지 않음): WEAK 1, NOT_PLAYED 1. dev에서는 두 유형 모두 0건이라 dev 재현 대신 두 유형의 일반 원인을 막는 강건화를 넣고 dev에서 회귀가 없음을 확인했다.
- 수정:
  1. **두 번째 피치 창**: 첫 창 [+30, +130 ms]이 AMBIGUOUS/DETUNED이면 [+130, +330 ms]에서 다시 잰다(실제 attack은 피크 잡음·손가락 미끄러짐이 길 수 있다). MUTED 판정은 그 전에 끝나므로 뮤트 검출에는 영향이 없고, 다른 음은 두 번째 창에서도 다른 음으로 잡힌다.
  2. **pluck onset 폴백**(`src/dsp/take.ts energyOnset`): "n번 줄을 튕기세요" 직후 flux 검출기가 아무것도 못 잡으면 5 ms RMS가 직전 150 ms의 25-퍼센타일 레벨보다 +12 dB 넘게 30 ms 유지되는 첫 지점을 onset으로 쓴다(그다음 일반 정밀화). 앱 E1 한 줄씩 흐름과 합성·GuitarSet 벤치마크가 같은 함수를 쓴다. GuitarSet 흉내에서는 무장 = 주석 150 ms 전, 결과는 여전히 주석 ±60 ms 안이어야 한다. dev에서 flux 검출을 끄고 폴백만 써도 단음 38/39를 찾는다(기준선을 최솟값으로 두면 조용한 스튜디오 녹음에서 무장 직후 바로 터져 22/39였다).
- dev 결과: 합성 Mode A 전 지표 유지, GuitarSet dev 단음 39/39.
- detectorVersion 1.2.0 → 1.3.0(두 번째 피치 창·폴백 초판; test 16/17) → 1.3.1(폴백 기준선 25-퍼센타일·+12 dB·무장 150 ms 전).
- 세 번째 실행(1.3.1): test Mode A OK 17/17, 하드 4/4·소프트 2/2 통과. GuitarSet test는 총 3회 실행됐고 매번 test 개별 사례가 아닌 실패 유형만 보고 dev에서 고쳤다.

## D-032 M4 오디오 엔진 구조: 플랫폼 주입 + worklet→worker 직결 MessageChannel
- `AudioEngine`(src/audio/engine.ts)은 브라우저 API(AudioContext 생성, getUserMedia, enumerateDevices, worklet 모듈 로드·노드 생성, Worker 생성)를 `EnginePlatform`으로 주입받는다. 실제 바인딩은 `browserPlatform.ts`, 앱 단일 인스턴스는 `appEngine.ts`/`app/services.ts`. 근거: 권한 거부·장치 분리·OS 중단(interrupted)·getSettings 진단을 Node 단위 테스트(가짜 객체)로 검증하기 위해(AC-A1). Vite 전용 `?worker&url` import는 엔진 파일 밖에 둬 Vitest가 엔진을 직접 import할 수 있다.
- 데이터 경로: 마이크 → worklet(CaptureCore) —MessageChannel→ DSP worker(정밀화+판정) → main. 세그먼트(onset −500/+400 ms), 튜너 프레임, 요청 구간은 worklet이 풀에서 꺼낸 Float32Array를 **transfer**하고 worker가 `returnBuffer`로 되돌려준다(풀이 비면 1회 경고 후 할당). main은 큰 버퍼를 거치지 않는다.
- 캡처 샘플 n ↔ 컨텍스트 시각: worklet이 첫 블록에서 `currentFrame`을 `ready{startFrame}`으로 알린다 → t = (startFrame + n)/fs. 메트로놈 예약 시각·RTT 프로브·클릭 마스크가 모두 이 한 시계를 쓴다.
- 판정 작업(job)은 worker에 상태로 둔다(`setJob`): onsets / pluck(Mode A) / template(캘리브레이션) / strum(Mode B) / pair·set(Mode C). 튜너는 별도 on/off. 구간 분석(noise, rtt, raw)과 Mode D `analyzeTiming`은 id로 짝을 맞추는 요청/응답이다. 모든 응답에 `detectorVersion`·`processingMs`.
- 요청은 zod 판별 유니온으로 검증한다. zod 출력의 `nameKo?: string | undefined`가 `exactOptionalPropertyTypes`의 `ChordVoicing`과 맞지 않아, 보이싱은 transform으로 undefined 키를 지운다(단언 캐스트 없음).

## D-033 메트로놈: 앵커 기반 예약, 템포 변경·카운트인 규칙, 타이머 2종
- 클릭 시각 = 현재 템포 구간의 앵커(시각, 박 번호) + (박 − 앵커 박)·박 길이 (+ 서브디비전). 더하기 누적이 아니므로 10분 지터 시뮬레이션에서 오차 < 1e-9 s(`metronome.test.ts`). 늦게 깬 타이머도 그리드 시각 그대로 예약하고, 0.05 s 넘게 지난 클릭은 **소리만** 생략한다(1초 멈춤 뒤 클릭 폭주 방지, 그리드·판정용 목록에는 남김).
- 템포 변경은 "아직 예약하지 않은 다음 박"부터 적용(이미 예약된 클릭은 움직이지 않음). 카운트인 중 변경은 0마디부터 적용(그리드 원점 = 0마디 1박이 미리 정해져 판정 기준이 흔들리지 않게).
- 6/8은 8분음표 6개를 박으로 세고 4번째에 2차 악센트. 음소거 마디는 (play, mute) 주기, 카운트인은 항상 들림. 시각 전용 모드는 소리만 끄고 그리드·펄스는 그대로.
- 타이머: Worker 안 setInterval 25 ms + lookahead 0.1 s가 기본, Worker가 없으면 main setInterval 200 ms + lookahead 0.25 s(SPEC §8.4 두 값).
- 클릭 마스크: 들리는 최근 8개 클릭의 예상 도착 시각(예약 + RTT)을 worklet에 넘긴다.

## D-034 캘리브레이션 마법사 규칙 (SPEC §9.1 해석)
- 튜닝: 줄 모드 튜너의 안정 판정(5프레임 ±3 cents)이 나면 |δ| ≤ 15 cents 통과, 100 cents 넘게 벗어나면 "다른 음"(앞 줄 잔향 등)으로 보고 무시. 통과 후 0.6 s 쉬고 다음 줄.
- 샘플레이트 sanity: 각 줄의 **첫 안정 측정**(다른 음 제외)과 기대 주파수의 비율이 3줄 이상에서 서로 ±0.5% 안으로 균일하고 그 중앙값이 ±1% 밖이면 `SAMPLE_RATE_SUSPECT` 경고(흩어진 오차는 단순 조율 상태로 본다).
- 템플릿: 줄마다 Mode A가 OK로 판정한 튕김 3회 → harmonic 상대 크기(h=1..8, [+30, +130 ms]) 중앙값, decay 비율 중앙값. OK가 아닌 튕김은 "다시" 안내만 하고 세지 않는다.
- RTT: loopback 측정이 연속 2회 성공하고 차이 ≤ 3 ms면 평균을 저장(MAD는 둘 중 큰 값). 실패 2회 또는 3회 안에 합의 실패 → 탭 보정(카운트인 4 + 클릭 8개 @80 BPM, onset과 클릭의 중앙 오프셋, `tapRttStats`). 출력 장치 라벨이 블루투스로 보이면 바로 탭 보정. 측정 못 하면 값을 만들지 않는다(마법사를 끝낼 수 없고 "나중에 하기"만 가능).
- 소음: 2초 구간 전체 dBFS + 1/3옥타브(63 Hz–8 kHz) 대역별 100 ms 프레임 전력의 중앙값. −45 dBFS 초과면 경고 후 계속.
- 경고 코드(`NOISY`, `PROCESSING_ON`, `BLUETOOTH_INPUT`, `BLUETOOTH_OUTPUT`, `SAMPLE_RATE_SUSPECT`, `RTT_TAP`)를 `Calibration.warnings`에 저장하고 문구는 i18n에서 렌더.
- getSettings 진단은 마이크가 켜질 때마다 `meta.captureDiagnostics`에 저장하고(세션 진단), 캘리브레이션에는 `trackSettings`로 함께 저장한다. 진단 화면은 실시간 값이 없으면 저장된 값을 보여 준다.
- 첫 실행: 홈이 페이지 로드당 1회 `/onboarding`으로 보낸다. "나중에 하기"는 홈에 남고 홈 카드에서 다시 시작할 수 있다. "마이크 없이 쓰기"는 `micDisabled = true`.

## D-035 E2E 가짜 마이크 보강과 E2E-01 단언
- `MediaStreamAudioDestinationNode` 트랙의 label이 "MediaStreamAudioDestinationNode"라서 하네스가 트랙 label을 가짜 장치 이름으로 덮는다(enumerateDevices와 일치).
- E2E-01의 "같은 조건 2회 측정 차이 ≤ 3 ms"는 마법사의 RTT 측정을 **두 번**(처음 + "다시 측정") 실행해 두 결과를 비교한다. 추가로 모든 원시 loopback 시도가 [지연, 지연 + 30 ms] 안이어야 하고 방식은 loopback이어야 한다. 저장된 δ는 fixture 디튠과 ±3 cents 안이어야 한다(D-037 참조).
- tsx(esbuild keepNames)로 실행하는 도구가 `addInitScript(fn)`을 쓰면 페이지에 `__name` 헬퍼가 필요하다(`tools/devcheck/audio-dev.ts`). Playwright 테스트 러너에서는 불필요.

## D-036 AC-A5 증거: dev 서버 점검 도구 + worklet 모듈 Node 테스트
- `npx tsx tools/devcheck/audio-dev.ts`(`npm run check:audio-dev`): Vite dev 서버에서 TS worklet(src/dsp import), DSP module worker, 메트로놈 ticker worker가 모두 로드·동작하는지 Chromium + 가짜 마이크로 확인. verify에는 넣지 않는다(빌드 산출물 기준 E2E가 verify에서 돈다).
- `src/audio/captureProcessor.test.ts`: 실제 worklet 모듈을 worklet 전역을 흉내 낸 Node에서 실행 — 세그먼트 창·지연 조건, 튜너 프레임·구간 샘플 정확성, 20초 동안 풀 고갈 경고 0(=워밍업 후 블록 처리 무할당), 블록 평균 처리 시간 ≤ 0.3 ms(측정 ≈ 0.04 ms, 튜너 켬).

## D-037 렌더 끊김(process 누락) 시 캡처 시계 정렬 + E2E-01 RTT 반복성 단언
- 발견: 첫 M4 verify에서 E2E-01이 실패(원시 RTT 140.67 → 132.67 → 132.67 ms). worklet에 진단을 넣고 병렬 부하에서 재현하니 브라우저가 `process()`를 몇 블록(예: 512 frames) 건너뛰는 일이 실제로 있었고, 그 뒤 "캡처 샘플 n = 컨텍스트 프레임 startFrame + n" 매핑이 영구히 그만큼 어긋났다(RTT·그리드·onset 시각 전부 수 ms 이동). 앱 결함.
- 수정: worklet이 매 블록 `currentFrame − (startFrame + 처리한 샘플)`을 확인하고, 모자란 프레임은 `CaptureCore.fillGap()`으로 0을 채워 정렬을 유지한다. 구멍에서 신호로 돌아오는 점프는 strum이 아니므로 [구멍 −20 ms, 구멍 끝 +80 ms]의 onset을 버린다. main에는 `gap{frames}`를 보내 진단 화면에 "오디오 끊김 n회"로 보인다. 회귀 테스트: `captureProcessor.test.ts`(블록 4개 누락 후 onset·구간 샘플 위치 정확, 복귀 점프 미보고), `engine.test.ts`(끊김 집계).
- 남은 변동: 끊김이 없어도 가짜 loopback 경로(MediaStreamDestination → MediaStream → MediaStreamSource) 내부 FIFO 지연이 부하에서 3–7 ms 바뀌는 일이 있었다(예: 137.33 → 132.67 → 132.67, gapFrames 0). 실제 마이크 입력도 같은 MediaStream FIFO를 지나므로 제품에서도 생길 수 있는 변동이고, 마법사의 "연속 2회 3 ms 안 합의" 규칙이 이것을 흡수한다.
- 그래서 처음에 SPEC보다 엄격하게 둔 "첫 두 시도가 곧바로 합의" 단언(앱이 아니라 브라우저 FIFO를 검사)을 SPEC 문구 그대로의 단언으로 바꿨다: 마법사 RTT 측정 2회(처음 + "다시 측정")의 결과 차이 ≤ 3 ms, 두 결과 모두 [120, 150] ms, **모든 원시 시도**도 [120, 150] ms, 방식 loopback. 바꾼 뒤 전체 E2E를 병렬 4 workers로 `--repeat-each=3`, `--repeat-each=4` 두 번 돌려 42/42 통과.

## D-038 M5 플러그인 골격
- 계약은 SPEC §11.1 그대로(`src/exercises/types.ts`): `ExercisePlugin<P, R, V>` + `ExerciseRunner<R, V>`. `ExerciseContext.audio`(SPEC의 `AudioEngineApi | null`)는 **마이크 쪽**(`ExerciseMic`: job, 판정 이벤트, coarse onset, 튜너, pluck fallback, analyzeTiming)이고, 마이크 없이도 필요한 출력(메트로놈·합성 재생·오디오 시계)은 `ctx.output`으로 분리했다(마이크 없는 E5·Q4·S도 메트로놈/합성은 써야 하므로).
- `ctx.clock.now()`는 시뮬레이션 ms(`performance.now() × 배율`, 배율은 E2E 빌드의 `?timeScale=`만, `src/app/testRate.ts`). DSP 이벤트 시각은 오디오 시계 초.
- 레지스트리(`registry.tsx`)는 `definePlugin`이 제네릭을 지우고 경계에서 각 플러그인의 zod로 params·result를 검증한다. 러너→뷰의 정확한 타입은 WeakMap으로 되찾아 캐스트가 없다. 다른 플러그인의 러너를 넘기면 예외.
- `BaseRunner`: 스냅샷 발행, 시계 차이 타이머(일시정지 포함), 소유 구독 해제, DSP 통계(detectorVersion·평균 processingMs). `ExerciseHost`가 마이크 시작(탭 안에서), rAF tick, 키(§12.3, Esc는 확인), Wake Lock, 끝나면 Attempt 저장(`detectorVersion`은 DSP 이벤트가 있을 때만, `processingMs`는 이벤트 평균).
- 단독 실행 경로 `/practice/:type?…`: 쿼리 값을 숫자·불리언·쉼표 목록·JSON으로 바꿔 기본 params 위에 덮고 플러그인 스키마로 검증. 라이브러리 "이 코드로 E1"과 E2E가 쓴다.
- 개인 선행 보정값: 같은 연습의 최근 5개 Attempt의 `meanOffsetMs` 중 3개 이상이면 평균(`personalOffset`).

## D-039 실시간 단일 테이크 선택 (`src/exercises/take.ts`)
- 벤치마크의 `selectTakeEvent`와 같은 규칙을 실시간으로: 무장(arm) 뒤 첫 판정 onset이 테이크, 400 ms 안에 다른 onset이 있으면 MULTIPLE_ONSETS. 판정 이벤트는 strum보다 ~0.4 s 늦게 오므로 모호성은 먼저 도착하는 worklet coarse onset으로 판단한다(같은 strum의 coarse onset은 정밀화 onset보다 최대 ~45 ms 늦어 60 ms 여유를 둔다).
- 무장 후 4초 동안 아무 onset도 없으면 worker의 'pluck' 구간 요청(`energyOnset` + Mode A, 벤치마크와 같은 함수)을 한 번 실행한다. 없으면 NO_ONSET 재시도.

## D-040 E1 코드 정밀 체크 흐름
- 시도: 손가락 놓기(준비됐어요/Space) → (한 줄씩) 연주하는 줄을 저음부터 차례로 Mode A, x 줄은 건너뜀(설정 "x줄 확인"이 켜져 있으면 무음 확인 `silent` 작업) → "전체를 한 번 스트럼해 들어 보고, 손을 떼었다가 다시" 단계. SPEC ④ 마지막 전체 스트럼은 귀로 듣는 단계로 두고 채점하지 않는다(한 줄씩 판정과 스트럼 베타 판정이 섞이지 않게).
- RETRY(약함·클리핑·모호·여러 번)는 같은 줄을 다시 무장하고 원인별 문구만 보여 준다. 판정된 줄은 코칭 힌트(§6.7)를 받고, FAIL 문구는 "무엇 — 어떻게"로 조합한다.
- 스트럼 베타: Mode B 결과의 `strings`는 연주하는 줄만 담고, 울린 x 줄은 `unexpected`로 온다 → x 줄 상태 UNEXPECTED. 시도 통과 = 판정 PASS.
- 귀 먼저: 앱 판정을 숨겨 두었다가 자가 판정(1/2/3) 뒤 공개, 일치율(깨끗 ↔ OK)을 시도마다 기록. 마이크가 없으면 수동 모드(1/2/3).
- 템플릿 decay 기준은 해당 줄의 개방현 템플릿을 그대로 쓴다(누른 음은 더 빨리 감쇠하므로 관대한 쪽).

## D-041 E2 1분 체인지
- 마이크가 있으면 "armed": 첫 coarse onset 시각에 타이머 시작(Space도 시작). 첫 A 스트럼은 Mode C 상태 머신 초기 상태와 같아 세지지 않는다. 시간 종료 후 'review' 단계에서 끝 이전 strum의 늦은 판정(≤ 0.6 s)도 반영하고, ↑↓ 보정과 Enter 확인을 받는다.
- `correctedChanges`는 보정 키를 한 번이라도 눌렀을 때만 기록(+1·−1 순보정 0도 "확인함"으로 기록). 탭 모드는 `detectedChanges = 0`, `tapChanges = n`. 직접 입력 모드는 review에서 ↑↓로 센 값. 마이크가 없으면 자동 → 탭.
- `changeTimestampsMs`는 시작(coarse onset) 기준 실제 ms(배율 1인 실제 앱에서는 시뮬레이션 ms와 같다).

## D-042 Mode D 연습(E5·E6·E8)의 그리드와 규칙
- 슬롯 시각 = 그리드 원점(0마디 1박) + 슬롯 × (60/BPM/박당 슬롯). 4/4는 메트로놈이 4분음표, 6/8(P5)은 BPM을 점4분 박으로 보고 메트로놈을 8분음표(×3, 1·4박 악센트)로 친다. 판정 = `analyzeTiming`(worker) + 캘리브레이션 RTT + 개인 선행 보정. 마지막 마디 뒤 0.7 s 기다렸다가 채점(판정 지연).
- E5 사다리: 적중률 ≥ 90 % & 누락 0 → +5, "지난번도 70 % 미만"(`previousLow` param, 세션 계획이 넘김)에서 다시 70 % 미만 → −5. 쉼 슬롯 strum은 extra. 시각 큐 숨김은 패턴·현재 슬롯 표시를 숨긴다(채점은 동일).
- E6: 마디 첫 박 슬롯만 기대하고 `analyzeTiming`의 hit = 창 안 마디, 평균 오프셋 = beat1 지연. "멈춤" = RTT를 뺀 strum이 [마디 시작 − 창, 다음 마디 시작 − 창)에 하나도 없는 마디. 통과 = ≥ 14/16(비율) & 멈춤 0.
- E8: 8분음표 전 슬롯 기대, `ioi_cv`는 정렬한 onset 간격으로. 통과 = 적중률 ≥ 90 % & ioi_cv ≤ 0.10.
- 마이크 없음: 1/2/3 자가 평가(1 = 놓친 박 없음 → 사다리 판단에 쓰임, `source: 'self'`).
- 공통 녹음은 상속 대신 합성(`GridRecorder`)으로 E6·E8·S가 공유한다.

## D-043 퀴즈와 연습곡
- Q1·Q3·Q4는 공통 객관식 러너(1/2/3, 반응 시간, 1.5 s 피드백 후 다음, 중단 시 남은 문제는 오답). seed 0 = 시계로 새 문제(가짜 시계 테스트는 결정적).
- Q2: 3초 카운트다운, 첫 strum을 해금 코드 전체로 Mode C set 분류, 맞고 ≤ 3 s면 통과. 6초까지 기다리고 없으면 오답(반응 시간 null). 마이크 없으면 자가 보고.
- Q3: 이름 고르기, 또는 마이크가 있으면 "이 음의 개방현 튕기기"(크로매틱 튜너 안정 판정의 음이름 비교). Q4: 공용 합성기(KS)로 근음 위치 3화음+옥타브 스트럼 재생(판정 중 재생 차단 규칙과 같은 엔진 경로).
- S: 학습 모드(멈춰도 됨, 멈춤은 횟수로 기록, 한 부분 반복)와 연주 모드(멈추지 않기, 마이크가 있으면 마디 첫 박 적중률). 끝나면 완주·멈춤 수·암기를 자가 보고. "들어 보기"는 첫 8마디를 박마다 다운 스트럼으로 합성(렌더러는 러너에 주입).

## D-044 M5 E2E 근거와 발견한 결함
- E2E fixture(E1 C 코드 줄별·2번 줄 뮤트·6번 줄 울린 스트럼, E2 A↔D 15회, E5 P3 80 BPM 8마디)는 합성기로 만들고, E2E에 쓰기 전에 같은 DSP로 오프라인 확인했다(줄별 OK/MUTED, 스트럼 FAIL·blamed [6번 줄], 체인지 14, P3 적중 48/48).
- E2E-12가 실제 결함을 찾음: `/practice/E2`에서 `/practice/E1`로 해시만 바뀌면 같은 화면 컴포넌트가 남아 E2의 저장 결과를 E1 요약으로 렌더(ZodError). 연습 호스트를 (종류 + 쿼리 + 회차) key로 다시 마운트하도록 수정.

## D-045 M5 리뷰(code-reviewer) 반영
리뷰 서브에이전트(보고만, 파일 수정 없음)의 지적을 모두 확인하고 고쳤다. 확인된 결함과 조치:
- (상) 프로덕션 번들에 `timeScale` 문자열이 남음(`practiceParams.ts`의 예약 키 집합) → 예약 집합 삭제. 모르는 키는 플러그인 zod가 버린다. 프로덕션 빌드(스크래치 폴더) 문자열 스캔에서 `timeScale`·`__gh_test` 0건 확인.
- (상) 큰 남은 시간 표시가 멈춤(러너가 사건 때만 발행) → `BaseRunner.tick`이 표시 초가 바뀔 때마다 발행(`baseRunner.test.ts`). Q2 카운트다운도 초 단위로만 발행.
- (중) 중단·미채점 실행이 0/전체 시간 결과로 저장돼 지표를 오염 → 계약에 `hasResult()` 추가: 시작 전 중단·답 0개·채점 실패면 Attempt를 저장하지 않고 "기록하지 않았어요" 안내. E2·E4는 실제 진행 시간을 기록(중단 시 타이머 정지, E2는 5초 미만 미기록). 퀴즈를 중간에 멈추면 답한 문제 수 기준.
- (중) `analyzeTiming` 실패 시 review에서 멈춤 → E5·E6·E8·S에 `.catch`(E5·E6·E8은 결과 없이 종료 + 안내, S는 첫 박 지표 없이 자가 보고 진행).
- (중) E1 한 줄에서 갇힘 → Next = 그 줄 건너뛰기(UNVERIFIABLE), x줄 확인에서 아무 소리도 없으면(fallback도 없음) OK, onset이 있었지만 판정 테이크가 안 나온 채 1초 지나면 fallback 허용. fallback 창은 캡처 링(3.9 s)에 들어가도록 3.5 s.
- (중) §12.3 첫 스트럼 자동 시작이 E5·E6·S에 없음 → 마이크가 있으면 'armed'(첫 coarse onset 또는 Space가 카운트인 시작), 없으면 'ready'. E2E-06은 Space로 시작.
- (중) 시작 버튼 연타 시 러너 2개 → `ExerciseHost` 시작 가드 + 버튼 비활성화. 저장 실패 시 다시 시도 UI.
- (중) 연습곡 학습 모드에서 "멈추고 다시" 불가 → review에서 Space = 처음부터 다시(멈춤 수 누적), Enter = 확인.
- (하) E2 종료음(액센트 클릭 2번, 판정 차단 규칙과 무관한 `output.cue`), 스트럼 베타 같은 RETRY 2회 → "한 줄씩" 유도(§10.6-6), E5 사다리 +5와 E8 통과는 8마디 이상에서만, E5 `previousLow`는 같은 패턴 최근 결과에서(`withHistory`), Q3는 마이크 선택(튜너로 개방현 튕기기 도달 가능, 문제마다 튜너 재시작), 개인 선행 보정은 E6의 beat1 지연도 사용, 목록형 쿼리 파라미터는 한 원소도 목록으로.
- 리뷰 에이전트가 레포 안에 남긴 메모리 파일(`.claude/agent-memory/…`)은 프로젝트 산출물이 아니어서 지웠다.

## D-046 M6 홈·세션 러너
- 홈과 세션 러너는 같은 저장 상태 스냅샷(`app/storedState.ts`)에서 `generateRoutine`을 돌린다(시드 = 날짜 → 같은 날 같은 루틴, §7.3-10). 별도 루틴 저장 없이 세션 시작 시 다시 계산해도 같은 목록이 나온다.
- 루틴 항목(루틴 어휘: `direction 'A>D'`, `pair 'A|D'`, `durationSec`)은 `features/session/routineParams.ts`가 플러그인 params로 바꾼다(플러그인 기본값 위에 덮고 스키마 검증). Stage 0–7 루틴 생성기가 낼 수 있는 모든 항목이 검증을 통과하는지 테스트한다.
- 세션 모델(`sessionModel.ts`, 순수): 항목 이동·건너뛰기·이전·일시정지, 연습 시간은 시계 차이(일시정지 제외), 30분마다 휴식 알림, 항목 계획 시간은 "남은 시간"으로만 보여 주고 강제하지 않는다. 복습 블록 항목은 `reviewOf = subjectKey`로 Attempt에 남는다(SRS 갱신).
- 세션 기록: 시작 시 `startSession`(계획 항목 수 = REST 제외), 끝에 자가 평가(통증 0–10, 난이도 1–5, 위험 신호, 메모)와 함께 `finishSession`(완료 = Attempt가 저장된 항목 수).
- 키보드만으로: 각 항목의 시작 버튼과 "다음 항목" 버튼에 자동 포커스, 연습 안의 키는 §12.3 매핑. E2E-07이 Stage 0 루틴 전체를 키보드로 끝낸다.
- 홈: 오늘의 루틴 카드(항목·총 시간·안내·상한 확인), 진급 체크리스트(데이터 규칙 평가 + 진행 막대, 다 채우면 진급 / 3주 정체 쌍만 남으면 조건부 진급 + 드릴 처방), 약한 쌍 Top 3(최근 3회 중앙값, 안 해 본 쌍은 뒤), 이번 주 분, 주간 스트릭, 복습 수, 백업 리마인더(마지막 백업 또는 첫 세션 후 7일).

## D-047 M6 졸업 시험·진도·라이브러리·설정·녹음 키트
- 졸업 시험(§7.6)은 항목별로 실제 연습을 이어 붙여 실행하고 규칙(`examModel.ts`)으로 판정한다: 1 = E0(마이크로 6줄 모두 ±5 cents, 수동 확인은 측정값이 없어 통과 불가), 2 = Q2 8코드(모두 3초 안 정답) + 코드별 최근 정밀 체크 깨끗 ≥ 50 %, 3 = 무작위 5쌍 각 1분(60초 전체) ≥ 30, 4 = P3 80 BPM 8마디를 시각 큐 보임·숨김 두 번 모두 ≥ 90 %, 5 = 악보 숨김 완주한 서로 다른 곡 5곡(자가 보고 지표). 매 판정은 EXAM Attempt로 남기고, 통과 시각은 `progression.exam[item]`(Stage 7 진급 규칙 `examPassed`가 읽음).
- 진도 화면: 주별 연습 분(8주), 쌍별 1분 체인지 점 + 이동 중앙값(창 3), 코드×줄 깨끗 비율 표(색 + 숫자), 패턴별 최고 통과 BPM/목표, 타이밍 평균·표준편차 추이, 복습 대기 수, 세션 목록. 차트마다 텍스트 대응물을 둔다.
- 코드 라이브러리: 스테이지별 다이어그램 격자 + 습득 단계, 상세(기대 음, 스트럼으로 확인 가능한 줄 = partial 충돌 맵, 공용 합성기 "들어 보기", E1 시작 링크).
- 설정: 테마·왼손잡이·엄격도·시각 전용·x줄 확인·세션 길이·마이크 없이, 상시 "마이크 판정은 보조 수단" 안내, 키·페달(기본 키 표 + 학습 모드: 아무 키나 눌러 동작에 연결, `customKeys`), 백업(내보내기 → `lastBackupAt` 기록, 가져오기 미리보기 → 합치기 또는 2단계 확인 바꾸기), 데이터 초기화 2단계 확인. 시작 시 `navigator.storage.persist()` 요청, 결과 표시 + iPad 홈 화면 추가 안내.
- 녹음 키트(§13.4): 캡처 링이 4초라 2초 'raw' 구간을 미리 연달아 요청해 이어 붙인다(`RawRecorder`, 샘플 연속성 테스트). 오디오는 OPFS에 16-bit WAV, 메타는 Dexie `recordings`. 내보내기는 의존성 없는 store 방식 zip(`src/data/zip.ts`, 독립 리더로 왕복 테스트) + `labels.json`(`tools/bench/real.ts`의 스키마로 검증). 메트로놈 클립은 그리드 시작(녹음 기준)과 RTT를 같이 기록.
- E2E-08은 내보내기 → 2단계 초기화 → 가져오기(미리보기 + 2단계 바꾸기) 뒤 11개 테이블 건수와 진도 화면 텍스트(세션·히트맵·패턴)가 같은지 본다.

## D-048 M7 PWA·반응형·접근성·배포 준비
- 아이콘: 하나의 도형 목록(코드 다이어그램)에서 SVG와 PNG(192·512·maskable 512·apple-touch 180)를 만든다(`tools/icons/generate.ts`, 의존성 없음: 해석적 도형 + 4×4 슈퍼샘플링 + node:zlib PNG). maskable은 내용을 80 % 안전 영역으로 축소.
- 서비스 워커는 `registerType: 'prompt'` + 앱 셸에서 등록(`app/pwa.tsx`). 새 버전은 저절로 새로고침하지 않고 **홈 화면에서만** "새 버전이 있어요" 토스트를 띄운다(연습 중 강제 새로고침 금지).
- E2E-09(오프라인)은 Chromium에서만 돈다: Playwright WebKit은 오프라인 컨텍스트에서 서비스 워커를 거치는 새로고침이 "WebKit encountered an internal error"로 실패한다(하네스 한계, 실제 Safari의 Workbox navigateFallback과 무관). SPEC §14.5에 따라 `.skip`이 아니라 `playwright.config.ts`의 WebKit 프로젝트 `testIgnore`로 뺐다.
- E2E-10: 주요 화면 18개(연습 화면은 실행 상태) × 4 뷰포트(1440×900, 1180×820, 820×1180, 390×844)에서 `scrollWidth ≤ innerWidth`, 연습 화면의 큰 버튼(min-h-16)이 64×64 px 이상, 전체 화면 스크린샷 저장(`test-results/screens/`). iPhone 메트로놈 BPM 줄이 12 px 넘쳐서 좁은 화면에서는 BPM 숫자를 윗줄로 보낸다.
- E2E-11: 같은 18개 화면 × 테마 3개(다크·라이트·고대비)에서 axe(wcag2a/aa, 21a/aa) serious·critical 0. 진도 차트는 텍스트 대응물이 있으므로 그림을 보조 기술에서 숨기고 Recharts 키보드 접근 레이어를 껐다(aria-hidden 안의 포커스 요소 위반 해결).
- 보안 헤더(`public/_headers`, `vercel.json`): `default-src 'self'` CSP(스크립트·워커·워클릿 같은 출처만, `eval`·인라인 스크립트 금지, 인라인 `style` 속성만 허용), `Permissions-Policy: microphone=(self)` 등. 실제 헤더 파일을 문서 응답에 붙인 E2E로 워클릿·DSP 워커·메트로놈 워커·차트·합성 재생이 위반 0인지 확인한다. Zod 4는 객체 파서를 `new Function`으로 컴파일하려고 시도해(기능 탐지 자체가 CSP 위반) 앱과 워커 진입점에서 `z.config({ jitless: true })`.
- 키·페달(§12.3): 기본 키 표 + 학습 모드(아무 키나 → 동작, `settings.customKeys`, 기본 키보다 우선). E2E로 학습한 키가 E2 카운트·확인에 쓰이고 Esc가 확인을 거치는지 본다.
- 문구 규칙(AC-U5)은 `src/i18n/ko.test.ts`가, 왼손잡이 미러(AC-U6)는 `src/ui/ChordDiagram.test.tsx`가, 테마 적용은 E2E-11(설정에서 테마 선택 → `html[data-theme]`)이 확인한다.

## D-049 M8 하드닝: 최종 리뷰 반영·실시간 표시·문서
- 최종 리뷰(code-reviewer, M6–M7 범위) 지적을 코드로 확인한 뒤 고쳤다:
  - (상) 통증 ≥ 5 감량(§7.3-7)이 실제 실행에 닿지 않았다. 루틴은 `item.durationSec`만 줄이는데 E2 매핑은 `params.durationSec`(60 s)를 읽었고, E1은 1분 아래를 다시 1분으로 올렸다. 항목 길이는 이제 `item.durationSec` 하나에서만 온다(루틴 params의 `durationSec` 제거). E1 블록 최솟값은 30 s다. §11.3의 "1–3분"은 평소 범위이고, 안전 규칙이 있을 때는 안전 규칙이 이긴다. 루틴 생성 → `pluginParamsFor`를 잇는 테스트를 넣었다.
  - (중상) 가져오기 "합치기"가 `progression`·`meta`를 빠뜨렸다. 그래서 새 기기에서 합치면 Stage 0으로 돌아갔다. 이제 두 테이블도 §13.3 그대로 같은 키가 없을 때만 넣는다. 이미 있는 키는 건너뛴다. 그 기기의 진도를 백업으로 덮어쓰려면 "바꾸기"를 쓴다.
  - (중) 세션 완료 항목 수가 "다음 항목"을 눌렀을 때만 셌다. 이제 Attempt가 저장되는 순간 센다(`markRecorded`). 실행 중에는 이전·건너뛰기·일시정지·종료를 막고 안내한다. 실행을 그만두려면 Esc 두 번이나 "마치기"를 쓴다. 이 버튼들이 실행을 말없이 버리던 문제다.
  - (중) 세션 러너에 §12.3 키가 없었다. 실행이 아닐 때 Space와 다음 키(PageDown, →, 학습한 페달)는 항목을 시작한다(`ExerciseHost` 대기 상태). 실행이 끝났거나 휴식 중이면 다음 항목으로 넘어간다. PageUp과 ←는 이전 항목, 일시정지 중에는 재개다. 포커스된 버튼의 Enter·Space는 버튼 자체에 맡긴다(`isNativeActivation`, 두 번 실행 방지). 마이크가 켜지는 동안 화면을 떠나면 러너를 만들지 않는다.
  - (중) 시험 항목을 중단하면(결과 null) 판정이 예외로 죽었다. 이제 `evaluateExamItem`(순수, `examModel.ts`)이 null을 불통과로 본다. 개발 모드(StrictMode)에서 항목 5가 두 번 기록되던 것도 막았다.
  - (중) 녹음 키트:
    - OPFS 지원 판정에 `createWritable`을 더했다.
    - 녹음·저장·내보내기 실패를 모두 메시지로 보여 준다.
    - 녹음 버튼 연타를 막았다.
    - 오디오 없는 기록(백업에서 가져온 메타)은 zip에서 빼고 몇 개를 뺐는지 알린다. 데이터 초기화 때 OPFS 파일도 지운다. 지우기는 최선 노력이라, 파일 시스템을 쓸 수 없어도 초기화는 끝난다(Playwright WebKit에서는 `getDirectory`가 UnknownError로 거부되어 첫 verify의 E2E-08이 실패했다).
    - 캡처 링에서 밀려난 구간이나 오지 않은 구간이 있으면(`copied` < 길이) 그 녹음을 저장하지 않는다(`IncompleteRecordingError`). 빈 구멍이 있는 fixture가 올바른 라벨을 달고 남는 것을 막기 위해서다.
  - (중하) 주간 연습 시간이 시작부터 끝까지의 벽시계 시간이었다. 이제 세션에 일시정지를 뺀 `practiceMs`를 저장하고 그 값으로 센다. 예전 세션은 시작부터 끝까지의 시간을 쓴다.
  - (하)
    - 연습 항목이 0개인 세션은 최소 체류 세션 수에 넣지 않는다.
    - 백업 실패 시 `lastBackupAt`을 되돌린다.
    - 세션 길이 입력란에서 중간 값을 쓸 수 있게 했다.
    - 진급 기준 달성 여부를 스크린 리더 텍스트로 알린다. 위험 증상 묶음에 legend를 달았다.
    - 1분 체인지 녹음 라벨에 실제 보이싱 id를 넣는다(G-2f 사용자).
    - 다른 스테이지 상세는 그 스테이지의 세션 수로 평가한다.
  - 리뷰 지적 중 바꾸지 않은 것: 졸업 시험을 Stage 7 전에도 열 수 있다. §7.6은 "항목별로 통과 기록이 남는다"고만 하고, 진급 규칙 `examPassed`는 Stage 7에서만 평가된다. 일찍 통과한 항목은 실제로 그 기준을 넘었다는 기록이다. 화면을 떠나 끝나지 않은 세션(`endedAt: null`)은 어떤 집계에도 들어가지 않으므로 그대로 둔다.
- 레벨 미터(§5.1 60 fps 시각 요소)는 React state 대신 rAF + canvas로 그린다. 수치 텍스트와 `<meter>`는 250 ms마다 ref로만 갱신한다.
- `docs/BENCHMARK.md`의 test-run log 절은 정해진 형식의 줄만 이어받는다(`parseLog`). 예전에 섞여 들어간 GuitarSet 절 조각은 다음 bench:dsp 실행에서 빠진다.
- 문서를 마무리했다: README(최종), `docs/ARCHITECTURE.md`, `docs/DSP.md` §14(실시간 경로 값), `docs/BACKLOG.md`(v2, DEFERRED 없음), `docs/MANUAL_VALIDATION.md`(실기기 체크리스트 + 결과 양식), `docs/goal/FINAL_REPORT.md`.

## D-050 verify 게이트는 추적 파일을 바꾸지 않는다(벤치 보고서는 bench-results 사본에)
- 문제: `bench:dsp`·`bench:guitarset`는 실행할 때마다 `docs/BENCHMARK.md`를 다시 쓴다(실행 시각, 성능 값, test-run log 한 줄). 그래서 M8 커밋 뒤의 최종 `npm ci && npm run verify`도 이 추적 파일을 바꾸게 된다. 그런데 §16.2-3은 최종 verify 뒤에 파일 수정과 커밋을 금지하고, §18.2·AC-P1은 `git status --short`가 비어 있기를 요구한다. 세 조건을 함께 지킬 수 없다.
- 대안:

| 대안 | 깨끗한 트리 | 최종 뒤 수정 없음 | 모든 test 실행 기록 |
|---|---|---|---|
| verify가 `docs/BENCHMARK.md`를 그대로 씀 | 아니오 | 예 | 예(커밋 안 된 변경) |
| 최종 verify 뒤 `git checkout -- docs/BENCHMARK.md` | 예 | 아니오 | 아니오(그 실행 기록이 사라짐) |
| **verify는 벤치 보고서를 `bench-results/BENCHMARK.md` 사본에 씀** | 예 | 예 | 예(게이트 실행은 사본의 log에 남음) |

- 결정: 세 번째 대안. verify는 시작할 때 `docs/BENCHMARK.md`를 `bench-results/BENCHMARK.md`로 복사한다(GuitarSet 절과 test-run log 이력이 이어진다). 그다음 벤치 단계에 `BENCHMARK_REPORT`를 넘겨 그 사본에 쓰게 한다(`tools/bench/reportPath.ts`). `npm run bench:dsp`나 `bench:guitarset`를 직접 실행하면 지금처럼 `docs/BENCHMARK.md`(기록용 보고서)를 갱신한다. 임계값 판정과 exit code는 바뀌지 않는다. 바뀌는 것은 보고서 파일 위치뿐이다.
- 커밋된 `docs/BENCHMARK.md`는 M8 커밋 직전 verify의 실행 결과다(detector 1.3.1, test split 전부 통과, GuitarSet 하드 4/4·소프트 2/2). 최종 게이트 실행의 보고서와 log는 `bench-results/BENCHMARK.md`에 있다.

## D-051 세션 결과 화면의 "다시 하기" (v1 이후 사용자 요청)
- 세션 러너에서 연습이 끝나면 "다음 항목"만 있어, 같은 항목을 바로 다시 할 수 없었다(예: E5 적중률 69 %, "55 BPM으로 내려서 다져 봐요").
- 결과 화면 버튼: `다시 하기 (Space)`와 `다음 항목 (Enter)`. 결과가 다른 템포를 제안하면 `같은 템포로 다시 (Space)`와 `N BPM으로 다시`, `다음 항목 (Enter)`을 보여 준다(사용자 선택: 버튼 두 개).
- 템포 제안은 각 연습 요약 문구와 같은 규칙이고, 플러그인 선택 훅 `suggestedTempoRetry`로 낸다. E5는 사다리 up/down이면 ±5, E6·E8은 통과하면 +5다. 같은 템포면 버튼이 없다. 코어는 연습 종류를 모른다.
- 다시 하기는 같은 항목을 새 호스트(새 key)의 시작 화면으로 연다. 자동으로 시작하지 않는다. 호스트가 바뀌면 마이크가 꺼지고, iOS는 마이크 시작이 탭·키 입력 안에서 일어나야 하기 때문이다. 시작은 Enter·Space·PageDown 한 번이다.
- 다시 한 실행도 Attempt로 쌓인다(append-only). 세션 완료 항목 수는 항목 단위라 늘지 않는다.
- 키(§12.3): 실행이 끝난 뒤 Space(toggle)는 다시 하기, Enter·PageDown·→(next)는 다음 항목이다. "다음 항목" 버튼에 포커스가 있어도 Space는 다시 하기다. 그 keydown을 먼저 처리하고, 이어지는 Space keyup을 한 번 막아 포커스된 버튼이 눌리지 않게 한다. 휴식 중에는 둘 다 다음 항목이다.


## D-052 v1.1 goal 키트 구조 (사전 결정, 2026-10-08)
- 계기: v1을 실제로 써 보니 커리큘럼과 루틴이 어긋났다(Stage 0의 자세·피크·프렛 누르기 연습 없음). 리서치↔SPEC↔구현 감사에서 34건이 나왔다(`docs/goal/v1.1/GAP_AUDIT.md`). 사용자가 A+B+C+D 전부를 v1.1로 goal 실행하기로 정했다.
- 대안:

| 대안 | 장점 | 단점 |
|---|---|---|
| v1 SPEC을 고쳐 다시 해시 고정 | 문서 하나 | v1 완료 기록(FINAL_REPORT·AC-P6)의 근거가 사라진다 |
| **v1.1 키트를 새 폴더에** | v1 기록 보존, 변경을 diff로 검토 가능 | 두 SPEC을 함께 보존·대조해야 한다 |

- 결정:
  - 두 번째 대안을 택한다. `docs/goal/v1.1/`에 자체 완결형 SPEC(v1 본문을 그대로 옮기고 고침), thresholds(v1 상위 집합), GAP_AUDIT, traceability, PROGRESS, 조건문 템플릿, render 스크립트를 둔다.
  - 해시 고정은 6개 파일이다(v1 SPEC·thresholds + v1.1 SPEC·thresholds·traceability·GAP_AUDIT).
  - 브랜치 `feat/practice-app-v1.1`은 `5e94332`에서 분기한다. 마일스톤은 M9–M15, 턴 상한은 1000이다. 결정 기록은 이 파일에 이어 쓴다.

## D-053 개방 파워코드 보이싱 4개 추가
- 리서치 Stage 10은 "R6/R5 파워코드"와 "파워코드 곡 2개"를 요구한다(01:248). 시드에는 G5·C5 두 개뿐이라 곡 두 곡을 만들 수 없다.
- 그래서 E5·A5·D5(개방)와 F5(R6 1프렛 이동형)를 더해 29개로 한다. 손가락은 E5·A5가 1·2, D5가 1·3, F5가 1·3·4이다.

## D-054 판정 중 합성 재생의 예외: 메트로놈과 반주
- v1 §8.6은 마이크 판정 중 합성 재생을 막았다. 반주(play-along, 01:109·361)를 넣으려면 예외가 필요하다.
- 사용자 결정은 "반주 중에도 전부 판정, 이어폰 권장"이다. 연주 시작 때 이어폰 확인을 받는다.
  - 스피커일 때: 반주 이벤트 시각의 onset을 템플릿으로 가린다. 코드 판정은 "참고"로만 표시하고 지표에서 뺀다. 타이밍 판정은 유지한다. `backingAudible`을 기록한다.
  - 이어폰일 때: 평소대로 판정한다.
- 대안 "반주 중 판정 안 함"은 사용자가 고르지 않았다. "스피커에서도 코드 판정을 지표로"는 오판 위험 때문에 택하지 않았다.

## D-055 지식 카드 간격 반복: 고정 사다리(FSRS 아님)
- 리서치는 둘로 나뉜다: 01:353(정답 & <3초 → 간격 확대, 오답 → 1일) 대 03:113(ts-fsrs).
- 대안:

| 대안 | 장점 | 단점 |
|---|---|---|
| ts-fsrs | 개인화된 간격 | 새 의존성, 평점 매핑을 따로 정해야 함(리서치에 없음) |
| **고정 사다리** | 리서치 01 정의 그대로, v1 SRS(1→3→7→14→30→90)와 같은 구조 | 개인화 없음 |

- 결정: 고정 사다리. 정답 & <3초 → 다음 간격, 정답 & ≥3초 → 유지, 오답 → 1일.

## D-056 정체 2주(처방)와 조건부 진급 3주의 구분
- 리서치 안에서 기간이 충돌한다(01:389 "2주 → 대체 연습 처방 또는 조건부 진급 제안", 01:288 "3주 정체 시 조건부 진급").
- 결정:
  - 2주 정체는 처방(OMC↔PFC 전환, 한 줄씩 모드, 감속)으로 이어진다.
  - 3주 정체는 조건부 진급 제안으로 이어진다.
  - 둘 다 `detectStagnation`이 매 세션 실제로 평가한다.

## D-057 초급 2 수료 = Stage 11 진급 기준 충족
- 리서치에는 초급 1 졸업 시험만 있다(01:365–372). 초급 2 시험을 새로 만들면 근거 없는 설계가 늘어난다.
- 결정: Stage 11 기준(7th 암기, 블루스 완주, Stage 11 쌍 75% ≥30)을 채우면 "초급 2 수료"로 한다. 수료 뒤에도 Stage 11 유지 루틴을 계속 만든다.

## D-058 별도 복습 슬롯 대신 같은 종류 블록 안 복습, 스테이지 시간 템플릿
- v1의 "복습 슬롯 최대 3분"은 20분 세션에서 곡 9분 보장과 충돌했다. 곡 복습(180초)은 영영 배정되지 않았고 다른 복습까지 막았다(감사 #20). 리서치 03:114의 "5분 슬롯"도 같은 이유로 들어갈 수 없다.
- 결정:
  - due 복습은 같은 종류 블록 안에서 한다(코드 → E1 칸, 쌍 → 1분 체인지 칸, 패턴 → 리듬, 곡 → 곡 블록 앞부분·레퍼토리). 밀린 항목이 뒤를 막지 않게 하고, 7일 안 배정을 시뮬레이션으로 검사한다.
  - 스테이지 시간 템플릿을 표로 고정한다(SPEC v1.1 §7.3-2, 합계 = 세션 길이).
  - 순환 블록(리듬·스케일·기술·지식)의 각 항목은 3세션마다 1회 이상 보장한다.

## D-059 베타 판정 정책
- 버징(02:223 "공개 연구 없음"), 스트럼 방향(02:275), 해머온 검출(01:342 "정확도 미검증"), 팜뮤트·셈여림(리서치에 측정법 없음)은 정답 데이터가 없다.
- 결정:
  - 모두 "베타"로 넣는다. 합성 벤치로 지표를 재서 `BENCHMARK.md` 별도 절에 보고한다.
  - `thresholds.json.beta`(목표치)는 verify 성패와 무관하다. PASS/FAIL·진급에 쓰지 않고, 화면에는 "참고(베타)"로만 보여 준다.
  - 사용자 결정은 버징·방향에 대해 "베타: 측정·보고만"이었고, 같은 근거로 나머지 셋에도 적용한다.

## D-060 v1.1 설계값 목록 (리서치에 숫자가 없어 SPEC이 정한 값)
- Stage 8–11 쌍(§6.5), 스테이지마다 곡 2곡 이상과 블루스 형식(quick change 없음), 스케일 3개의 프렛·손가락, 리프 4개, P6–P8, 스윙 기본 2:1.
- 기준 정의:
  - "대부분" = 75%(8쌍 중 6쌍)
  - 분당 환산은 실행 시간 55초 이상만
  - 곡 완주 = 멈춤 ≤2, 암기 = 숨김 단계 멈춤 ≤1, 레퍼토리 진입 = 멈춤 0
  - F 계열 = F-small·F(Fmaj7 제외)
  - Stage 8–11 체류 = 8세션 + 14일
- 연습 설정:
  - E3: 기본 60초, 깨끗한 도착은 자가 확인
  - E9: 시작 5프렛, 목표 100 BPM, "10회" = 4음 묶음 10개
  - E10: 시작 60, 졸업 80, 6단계 = 반주와 함께
  - E11: Finger Gym 절차를 고정, 상한 80
  - Q3: `strings65` = 자연음 16개
  - Q4: 인터벌 6종, 코드 진행 = 두 번째 코드가 IV·V·I 중 무엇인지
  - K1: 항목 6개
- 루틴 운영: 블록 전환 5초, 처방 만료 8세션.
- 새 임계값: `v1.1/thresholds.json`의 sequence·swing·backingBleed·solo 시퀀스 값과 beta 목표치.
- 이 값들은 앱 설정에서 조정할 수 있지만(SPEC §0-4), 테스트 계약 값은 고정이다.

## D-061 v1.1 키트 핀 전 독립 리뷰 반영 (2026-10-09)
- architect 서브에이전트 리뷰 결과는 "고정 불가"였다(Critical 6, High 14, Medium 10, Low 9). 대부분 §7.3 루틴 규칙과 §14.9 시뮬레이션 단언이 산술적으로 맞지 않거나, 결과가 실행자의 선택에 달린 문제였다. 모두 반영했다.
- 루틴(§7.3):
  - 합계 단언에 통증 감량 예외를 두고, 시뮬레이션은 `confirmedOverCap = true`로 돈다. 4주 상한은 Stage 0–7에만 적용한다. 세션 길이 설정과 고정 템플릿의 관계를 정했다.
  - K1은 배정 규칙 하나만 따른다(순환 목록에서 뺐다). Stage 0은 K1이 없는 날 E16을 240초로 하고, Stage 8–11 기술 슬롯은 120초다.
  - 1분 체인지 칸: 칸과 슬롯의 대응, 빈 슬롯 대체 규칙, 위험 쌍(5연습일), E3 규칙을 정했다. 보장 대상은 "현재 스테이지가 요구하고 아직 통과하지 않은 쌍"이다.
  - 복습: 같은 subjectKey를 복습으로 인정하고, 종류별 칸을 정했다. 지식 카드는 Q2 블록을 나눠 쓴다. 배정은 FIFO이고, 지연 상한은 max(7, ⌈q/c⌉+1)이다. Stage 8–11 E1에 복습 칸을 넣었다.
  - 순환 목록은 모두 2개 이하이고 선택 규칙 ①–④를 고정했다(3세션 보장을 모형으로 확인).
  - 암기 스케일은 TAB 숨김 배정, Stage 10 Q3는 20문항이다.
- §7.1·§6.10:
  - learn → practicedBy 표를 고정했다. K1이 "됐어요"가 된 뒤의 구간은 커버리지 단언에서 뺀다.
  - 모든 패턴에 모드 졸업과 모드 사다리를 정의했다. 모드가 적히지 않은 기준은 모드와 무관하다.
- §7.4: 정체 2주와 조건부 진급 3주의 창·최소 실행 수·비교식, minCount 규칙의 조건부 진급을 정했다.
- §11.10: 학습 → 연주 단계가 열리는 조건(끝까지 간 학습 실행 2회), 연주·숨김 단계의 코드 확인(`chordCorrectRatio`), 레퍼토리가 비었을 때의 대체를 정했다.
- §14.9: 모듈 주입, 학습자 모델 수치(쌍 첫 24/분 + 실행마다 +3 등), 창 = 7연습일, 커버리지 실행은 진급을 끄고 그 스테이지 진입 스냅샷에서 시작, 규칙 → 연습 대응표, 교착 판정식을 고정했다.
- DSP(§14.8·§14.4·§14.3):
  - sequence: 결함 주입(사이클당 1개)과 분모를 정했다. 무실수 게이트는 24음 이하 사이클에만 걸고, 불확실 비율 상한 0.05를 두었다.
  - swing: 판정기에 r을 준다. backingBleed: 패턴을 고정하고 겹침 제외·귀속 창을 정했다.
  - Stage 8–11은 근음이 겹치지 않는 고정 후보 집합으로 `modeCSetStage8to11`을 따로 판정한다.
  - GuitarSet solo: 매칭, 음높이 구간, δ, UNCLEAR 처리, 겹침, 표본 하한(1000)을 정했다. 시퀀스 경로 onset 파라미터를 따로 두어 v1 스트럼 게이트를 보호한다.
- 진행 규칙(§2·§16·§17):
  - 마일스톤과 AC 배정을 의존 순서대로 고쳤다. 무결성 9는 단계화했고(`verifySequence`는 M11부터), 부분 AC는 DOING + 범위 증거로 인정한다.
  - v1 테스트 갱신 규칙과 그 목록을 DECISIONS에 기록하도록 했다.
  - GuitarSet BLOCKED이면 AC-P10은 `DONE (G1–G3 BLOCKED)`를 허용한다.
  - 마지막 턴에는 PROGRESS를 갱신하지 않는다.
  - 축소 조건은 턴 수가 아니라 "M13 이후 같은 원인으로 verify 3회 연속 실패"다.
  - `.claude/agent-memory/`를 gitignore에 넣었다. git 조건은 `rev-parse | cut -c1-7`로 바꿨다.
- **2차 리뷰 반영**(Critical 1, High 7, Medium 5):
  - 계약 경로 전환을 M9에서 M11로 옮겼다. v1 계약 무결성 테스트가 판정 키 양방향 일치를 강제하므로, 새 영역이 구현되는 마일스톤에서 바꿔야 한다. M9에는 무결성 11(v1 ⊆ v1.1)만 넣는다.
  - 사다리 정체는 졸업했거나 목표 BPM 이상이면 판정하지 않는다. −10 처방 중인 BPM은 "현재 − 10"이다.
  - G-2f·G-3f의 쌍·기억 키는 클래스 `G`로 한다(전환 뒤에도 기록이 이어진다). G-4f·F-small만 보이싱 id 키를 쓴다.
  - 정체 창에 경과 하한을 두었다(3주 판정은 첫 실행이 14일 이상 앞, 2주 판정은 9일 이상 앞).
  - AC 배정을 의존 순서로 다시 나눴다(부분 AC 표기). 무결성 9의 `verifySequence`는 M12부터 `src/` 비테스트 호출처만 센다. 무결성 8은 M9–M11에 계획 ID를 허용한다.
  - 시퀀스 무실수·불확실 게이트는 SNR ≥ 25 층에서만 판정한다(`flawlessGateSnrDbMin`). 이 게이트를 통과하려면 음당 성공률이 99.3% 이상이어야 해서 SNR 15 층은 보고만 한다.
  - PROGRESS의 "턴 800" 문구를 지웠다. §14.9 하위 번호 참조, AC-RT3 지연 상한, withReviews 시드 구성, 축소 시 learn 표 예외, §11.6 패턴 졸업 대체 문구를 고쳤다.

## D-062 M9 기반·결함 수정: 구현 결정 (v1.1 goal 실행)
- **순서 조정**: Stage 0–4 시간 템플릿(§7.3-2)이 K1·E16·E17·Q5를 배정하므로, 이 네 연습의 플러그인 기본형을 M10이 아니라 M9에 만들었다. E17은 §10.10 판정이 들어오는 M12 전까지 사이클별 자가 보고(1 무실수 / 2 실수)로 동작한다. AC는 SPEC §16 배정 그대로다(NE1·NE2·NE6은 M10에서 마저 닫는다).
- **"마지막 등장"의 키**(§7.3 입력): 루틴에서 시작한 시도는 루틴 항목의 키(`Attempt.routineKey`, `<연습>|<subject>`)로 센다. 결과에서 읽은 키는 루틴 밖 시도와 K1(한 실행이 여러 카드를 다룸)에만 쓴다. 결과에서 읽은 키를 함께 세면 패턴 복습 실행(③)이 같은 패턴의 순환 항목 등장으로 잡혀 그 항목이 3세션 안에 다시 나오지 않았다(시뮬레이션이 찾은 결함). 순환 항목 키는 모드·시각 큐 숨김·셈여림·팜뮤트까지 구분한다(Stage 7의 P3 두 항목이 서로를 가리지 않게).
- **세션 번호·연습일**: 세션 번호는 "끝났고 기록이 1개 이상인 세션"의 순번 + 1(최소 체류와 같은 규칙), 연습일은 그런 세션이 있었던 날의 순번이다. 위험 쌍의 "5연습일"과 7일 보장은 연습일로 잰다.
- **세션 길이**: 설정에 `sessionLengthMode`(기본 `template`)를 더했다. 기본값이면 L = T(Stage 0–7 20분, 8–11 30분)이고, 사용자가 분을 직접 고치면 `custom`이 된다. v1 기본값 20분을 그대로 두면 Stage 8+에서 30분 템플릿이 늘 잘리기 때문이다. Stage 0(곡 블록 없음)의 L ≠ T 조정은 리듬 블록(늘림)과 기술 항목(뒤에서부터 뺌)으로 한다.
- **2주 정체 대상**: 통과한 쌍과 습득한 코드는 정체를 보지 않는다(처방이 필요 없는 항목에 처방을 붙이지 않게 — 보수적 선택). 코드 정체는 창 안 E1 실행(attemptId) 4회 이상, 처음 10회 대비 마지막 10회 clean 비율로 잰다.
- **처방의 루틴 배치(Stage 1–7)**: OMC→PFC 처방은 E3 연습이 생기기 전(M12)까지 기술 칸 ②에서 E4 앵커·공중 드릴로 배정한다(PG2 "E3 처방 제외"). 처방은 8세션 또는 쌍 통과로 만료, −10 BPM은 7일 또는 8세션, 한 줄씩 처방은 코드 습득 시 만료.
- **Q2**: 루틴이 후보(최대 9)를 정하고 문항 수 = max(3, 후보 수)로 모든 후보를 묻는다. 러너는 섞은 후보를 차례로 돌려 묻고(v1은 문항마다 무작위라 빠지는 코드가 생김), 문항마다 정답과 근음이 같은 다른 코드를 분류 후보에서 뺀다(§11.9).
- **곡 단계**: 완주 지표(`performCompleted`, 멈춤 ≤ 2), 암기(`hiddenMemorized`, 숨김 멈춤 ≤ 1), 레퍼토리(`repertoire`, 멈춤 0), 학습 완주(`learnFull`)를 v1 곡 결과(모드 learn/perform + chartHidden)에서 뽑는다. 결과 스키마 확장(단계·반주)은 M10/M12에서 한다.
- **분당 환산 55초**: E2 결과에서 실행 시간 ≥ 55초일 때만 `cpmQualified`를 기록하고, 진급·졸업·정체·조건부 진급은 모두 이 지표를 쓴다. 표시용 `cpm`은 그대로 둔다(복습 통과 판정도 `cpm`).
- **사다리 현재 BPM**: E5·E6·E8·E17 추출기가 `ladderBpm`(다음에 시작할 템포)을 기록하고 루틴이 그 마지막 값을 읽는다. 스킬 상태는 시도에서 언제든 다시 계산되므로 따로 저장하지 않는다.
- **루틴 편집**: 편집본은 그 단계의 사용자 템플릿 하나(`user-stage-<n>`)로 저장하고, 항목마다 템플릿 칸(JSON)을 남겨 다음 세션에 쌍·코드·템포를 다시 채운다. 편집본도 통증 감량과 첫 4주 20분 상한을 따른다.
- **시뮬레이션 주입**: `src/exercises/testing/simDeps.ts`가 실제 레지스트리·`pluginParamsFor`·플러그인 `toMetrics`·`applyAttempt`를 묶어 `simulate()`에 넘긴다. 무결성 9의 호출처 검사는 `testing/` 폴더를 프로덕션으로 세지 않는다.

## D-063 v1 테스트 갱신 목록 (SPEC v1.1 §2.4)
v1.1이 의미를 바꾼 규칙을 단언하던 v1 테스트만 v1.1 의미로 다시 썼다. 그 밖의 v1 단언은 그대로다(입력 형태만 바뀐 테스트는 고정 입력을 새 필드로 채웠을 뿐 단언을 바꾸지 않았다: `routine.test.ts` 규칙 1·4·7·8·10, `progression.test.ts` Stage 0·Stage 7·파생 쌍·G 전환, `homeModel.test.ts`, `session.test.ts`).

| 파일 | 테스트 | 근거 SPEC 절 |
|---|---|---|
| `src/domain/routine.test.ts` | rule 2 (블록 순서 → 스테이지 시간 템플릿 합계 = T) | §7.3-2 |
| 〃 | rule 3 (쌍 정렬 → 칸 1·칸 2·위험 쌍·하루 상한) | §7.3-3 |
| 〃 | rule 3 ordering (→ 쌍 하나인 스테이지의 반대 방향, 위험 쌍 중앙값 순) | §7.3-3 |
| 〃 | rule 5 (공백 복습: "chord 블록 없음" 단언 삭제 — 템플릿에 최약·복습 칸이 남음) | §7.3-2 |
| 〃 | rule 6 (3분 복습 슬롯 → 같은 종류 블록 안 복습) | §7.3-6 |
| 〃 | Stage 0 (E0·Q1·E5만 → K1·E16 포함) | §7.3-2, §7.1 |
| 〃 | conditional-promotion drills (→ 기술 칸 ② 처방, ① 항목을 밀어내지 않음) | §7.4, §7.3-6 |
| `src/domain/progression.test.ts` | Stage 1 (recall 1회 → 서로 다른 2일, 쌍 `cpm` → 55초 이상 `cpmQualified`) | §7.1 |
| 〃 | conditional promotion (21일 창·6회·14일 경과·minCount 규칙) | §7.4 |
| 〃 | promote() (`prescribedDrills` → `prescriptions`) | §7.4 |
| 〃 | stagnation (최고값 비교 → 창·실행 수·경과·종류별 기준·사다리 목표) | §7.4 |
| 〃 | graduated items (패턴 = progression 모드 연속 2연습일, 곡 = 레퍼토리 멈춤 0) | §7.1, §7.5 |
| `src/content/curriculum.test.ts` | unlock rule kinds (`recallUnlocked` → v1.1 규칙 종류) | §7.1, §7.4 |
| 〃 | focus pairs (삭제) → Stage 8–11 쌍 집합·E5 진행 코드 ≥ 2 | §7.3-3, §6.5, §6.10 |
| `src/domain/basics.test.ts` | covers every v1 exercise type (v1 목록 + v1.1 새 연습) | §11.2 |
| `src/exercises/registry.test.ts` | registers every v1 exercise once (v1 목록 + v1.1 새 연습, v1 부분집합 단언 추가) | §11.2 |
| `tests/e2e/session.mic.spec.ts` | E2E-07 항목 처리기에 K1·E16 추가(Stage 0 템플릿) | §7.3-2 |

## D-064 M10 진행 중 결정
- **졸업 시험 5번**(§7.6-5): "악보 숨김 완주"를 v1의 `hiddenCompleted`(숨김으로 끝까지, 멈춤 무관) 대신 v1.1 정의 `hiddenMemorized`(숨김 단계 완주 + 멈춤 ≤ 1, §11.10)로 센다. v1 테스트 갱신 목록에 더한다: `src/features/curriculum/examModel.test.ts` "5: songs …"(근거 §7.6-5가 가리키는 §11.10 곡 단계), `tests/e2e/exam.spec.ts` 시드 지표에 `hiddenMemorized` 추가(단언은 그대로).
- **연습 옵션 키**(§12.3 v1.1): `ear`(E), `cues`(V), `loop`(L), `hide`(H) 동작을 키 매핑에 더했다(대소문자 둘 다). E1의 M(모드 바꾸기)은 기존 `mark` 동작을 E1이 모드 순환으로 해석한다. 옵션은 실행 중에 바뀔 수 있어 러너가 `effectiveParams()`를 내고 호스트가 그 값을 Attempt params로 저장한다. E1 모드·귀 먼저는 시도 사이(손 놓기·놓기 단계)에서만 바꾼다.
- **곡 멈춤 자동 집계**: 연주·숨김 단계에서 마이크가 있으면 박 1 스트럼 적중을 마디별로 보고, 박 1이 빠진 마디가 2개 이상 이어질 때마다 멈춤 1회로 센다(사용자가 ↑↓로 고칠 수 있음).
- **같은 subject 복습 인정 = 큐 맨 앞일 때만**: "그날 어느 블록에든 due 항목과 같은 subjectKey의 실행이 배정되면 복습으로 인정"(§7.3-6)과 "종류별 FIFO"(§14.9-4)가 부딪치는 경우(뒤에 due된 항목이 다른 이유로 먼저 연습되는 날)가 있어, 같은 subject 인정은 그 종류 due 목록의 맨 앞 항목에만 적용한다. 1분 체인지 칸 1의 쌍이 큐 맨 앞이면 칸 1이 그 복습을 맡는다. 시뮬레이션(withReviews)이 FIFO 위반을 찾아 고친 것이다.
- **K1만 연결된 learn 항목의 커버리지 제외**: "됐어요가 된 뒤의 구간"을 그 창 안에서 됐어요가 된 창부터로 판정한다(창 끝 시점의 상태).
- **E6 코드 확인**: 마이크가 있으면 E6 스트럼을 Mode C 집합 분류(진행의 서로 다른 코드)로 받고, 코드가 바뀌는 마디마다 그 마디 코드 대 직전 코드 점수를 비교해 `chordCorrectRatio`를 낸다(§11.7). E6 테스트의 가짜 판정 이벤트는 러너가 설정한 작업 종류로 보내도록 고정 입력만 고쳤다(단언 그대로).
- **워커 집합 분류의 클래스**: `G-`로 시작하는 보이싱을 모두 'G'로 묶던 매핑을 `classOfVoicing`으로 바꿨다(G-4f는 따로, §6.5).
- **블록 운영(§7.3-12·13)**: 반복 대상(E5·E6·E8·E9·E10·E11·E17·Q*·S)은 실행 후 블록 시간이 남으면 "이어서 한 번 더"(사다리 다음 템포)를 첫 버튼으로 보이고 Space가 그것을 실행한다(Enter = 다음, D-051 키 그대로). 블록 시간이 다 되면 짧은 신호(액센트 클릭 2번) + "블록 끝" 표시. 블록이 바뀔 때 5초 전환 화면(Enter/Space = 바로 시작, ← = 이전), 그 5초는 블록 시간에 넣지 않는다. 설정에서 끌 수 있다.
- **튜닝 방향 그림**: 헤드 앞면 기준으로 3+3 헤드는 6·5·4번 줄 줄감개를 시계 반대 방향, 3·2·1번 줄은 시계 방향으로 돌리면 조여진다. 6 일렬 헤드는 모두 시계 반대 방향이다(설정에서 헤드 모양 선택).
- **지식 카드(§7.5)**: Q3 음 카드는 `card:note:<줄 idx>:<프렛>`, Q4 카드는 `card:ear:<종류>:<유형>`. 문항마다 정답·반응 시간을 결과 `items`에 남기고 파생 상태가 카드 간격을 갱신한다. 루틴이 due 카드를 그 퀴즈 실행에 먼저 넣고(`focus`), 그날 순환에 Q3·Q4가 없으면 Q2 블록을 Q2 30초 + 그 퀴즈 30초로 나눈다.
- **E5 새 필드**(`dynamics`, `palmMute`)와 Q3 새 필드(`scope`, `questions`, `focus`)는 선택 필드다(v1 결과·테스트와 호환).

## D-065 M10 리뷰(code-reviewer) 반영
v1.1 변경분 전체(M9 커밋 + M10 작업)를 리뷰 서브에이전트가 검토했다(critical 1, high 2, medium 6, low 3). 확인한 결함과 조치:
- (critical) **`.gitignore`의 `data/`가 `src/data/`까지 무시** → v1부터 `src/data/`(Dexie DB·마이그레이션·내보내기·repo·settings와 테스트)가 한 번도 커밋되지 않았다. 작업 트리에서는 모든 게이트가 통과해 드러나지 않았고, 깨끗한 클론은 빌드되지 않는다. 루트 전용 `/data/`로 고치고 `src/data`를 추적에 넣었다. 같은 일이 다시 생기지 않게 무결성 테스트 `tests/integrity/tracked-sources.test.ts`(src·tools·tests·public·docs 아래 git-ignore된 파일 0, 생성 오디오만 예외)를 더했다. `feat/practice-app-v1`은 규칙상 고칠 수 없어 v1.1 브랜치에서만 고친다(FINAL_REPORT 알려진 한계에 적는다). Biome도 `.gitignore`를 따라 `src/data`를 검사하지 않았었다 — 이제 검사한다.
- (high) **−10 BPM 처방이 사다리를 계속 내림**: 처방 실행의 결과가 낮은 템포로 사다리를 덮어써 다음 날 또 −10이 됐다. 처방 중 실행에 처방 시작 시점의 사다리 BPM(`ladderBase`)을 함께 넘기고, 그 실행은 사다리를 그 값 아래로 내리지 못한다(E5·E6·E8·E17 결과 `ladderBase`, 추출기 `max(ladderBase, next)`). 시뮬레이션에 사다리가 움직이지 않는 학습자 단언을 더했다.
- (high) **루틴 편집기가 오늘의 조정된 계획(통증 절반, 복습 곡, 카드 나누기)을 템플릿으로 저장** → 편집기는 통증·상한·복습·카드를 뺀 입력(`editorInput`)으로 만든 템플릿 시간 구성을 보여 준다.
- (medium) **복습·카드가 한 세션 안 반복으로 여러 단계 이동** → 복습은 due일 때만, 카드는 새 카드이거나 due일 때만 갱신한다(블록 반복·같은 코드 반복 문항).
- (medium) **L < T일 때 Stage 7+가 레퍼토리에서 빼려 함** → 줄일 때는 곡 블록(최소 300초) → 지식·기술 순환 순서, 늘릴 때만 Stage 7+ 레퍼토리.
- (medium) **실행이 끝난 뒤 옵션 키로 기록이 바뀜**(H·V) → 곡은 연주 동안 악보가 계속 숨겨져 있었을 때만 숨김(`hiddenThroughout`), H는 결과 확인 단계에서 잠근다. E5도 바가 도는 동안 큐가 계속 숨겨졌을 때만 숨김으로 기록한다(졸업 시험 4번).
- (medium) **시뮬레이션 단언 보강**: 규칙 → 연습 대응표(§14.9-3, 7연습일마다 1회 이상)를 상수로 넣고 단언, Stage 7 교착 단언을 실제 수료 사건으로, 통증일 E11·E12 제외분을 합계에서 뺀다, 사다리 제자리 학습자.
- (medium) **자가 평가 없이 나간 세션이 기록에서 빠짐** → 시도가 하나라도 있는 세션은 세션 번호·연습일·마지막 등장에 센다.
- (low) 공백 복습 알림은 실제로 지난 단계 복습 항목이 들어갔을 때만, 처방 카드의 내부 id → 표시 이름(`subjectLabel`), 휴식 알림 판단을 상태 갱신 함수 밖으로.
- 반영하지 않음: "E5 반복 실행의 `previousLow`가 오래된 값" — `ExerciseHost`가 실행을 시작할 때마다 최근 결과로 `withHistory`를 다시 적용해 `previousLow`를 새로 계산하므로 해당 없음(확인).
- 리뷰 에이전트는 레포에 파일을 만들지 않았다.

## D-066 M11 결정 (DSP·합성·벤치 확장)
- **계약 전환**(§14.0): 벤치·무결성이 읽는 파일을 M11에서 `docs/goal/v1.1/thresholds.json`으로 바꿨다(`tools/bench/thresholds.ts`). v1 파일은 보존하고 무결성 11(v1 ⊆ v1.1)이 계속 지킨다. 판정 키 양방향 일치에 sequence·swing·backingBleed·modeCSetStage8to11 영역을 넣었다(파라미터 키: `sequence.flawlessGateSnrDbMin`, `modeCSetStage8to11.snrDbMin`).
- **v1 테스트 갱신(§2.4, 확장만 — 완화 없음)**: `src/content/voicings.test.ts` "25 voicings" → 29(§6.4 v1.1), `tests/integrity/thresholds-contract.test.ts` "Mode C … all 25 pairs with both G voicings" → 핵심 25 + Stage 8–11 25쌍 × G 3종(§14.3-12가 그 문장을 대체), 판정 키·split 시드 검사에 v1.1 케이스 추가. 근거 절은 괄호 안.
- **Mode D는 v1 패턴 P0–P5를 그대로 쓴다**(`V1_PATTERN_IDS`): P6–P8을 콘텐츠에 넣어도 v1 타이밍 벤치의 표본 분포가 바뀌지 않게. P7·P8은 swing 영역이 판정한다. P6–P8 데이터와 `patternSlotTimes`(스윙 그리드)는 스윙 벤치에 필요해 M11에 넣었다(E5 연결은 M12).
- **Mode C 재튜닝(dev)**: 쌍 표본이 50쌍 × G 3종으로 넓어지자 dev 120에서 |오차| ≤ 1 비율이 0.933. dev 시드로 480개를 만들어 분석: 실패 9건 중 5건이 Cadd9|Em7(저음 두 줄만 다름), 나머지는 G-4f·파워코드. ① 같은 코드 추가 스트럼 4411개 중 반대 방향 마진 < 0이 0개라 `pairMarginDb` 3 → 2 dB, ② G5처럼 개방현과 음을 공유하는 보이싱은 개방현을 양의 마진으로 이길 수 없어 `distractorMarginDb` 2 → −2 dB(개방현이 2 dB 이상 앞설 때만 보류). dev 480: 0.981 → 0.994, 과대 집계 0. GuitarSet Mode C(마진 부호만 사용)는 영향 없음.
- **시퀀스 음높이(§10.10)**: 다른 줄에서 아직 울리는 이전 음이 MPM을 흐린다(제거 없이 clean OK 0.81). 이전 음 주기의 comb(`x[n] − x[n−P]`)로 지우고 MPM을 돌린다. LTI comb은 새 음의 주기성을 지키므로 MPM이 그대로 찾는다. 기대 음이 이전 음의 배음(옥타브·12도)이면 공통 배음만 남기는 comb, 같은 음이면 건너뛴다. 실녹음(GuitarSet dev)에서는 비조화성 때문에 comb 잔여가 clarity를 깎아, **comb을 적용한 측정과 적용하지 않은 측정 중 clarity가 높은 쪽**을 쓴다. clarity 기준은 §10.9 초기값 0.85(중앙값)에서 **0.8(75번째 백분위)**로 dev 튜닝했다. GuitarSet dev OK 비율: 0.912(초기값) → 0.953(선택 추가) → 0.973(0.8·q0.75). 합성 sequence 지표는 모두 그대로 통과.
- **사이클 판정 순서**(§10.10-4): 문장 순서 그대로 "전부 OK이고 EXTRA 없음 → 무실수, 아니면 UNCLEAR가 있으면 불확실, 아니면 실수". 레가토 슬롯은 사이클 판정에서 뺀다(실패를 만들지 않음).
- **반주 마스킹(§10.12)**: 저역(< 1 kHz) 에너지 **상승분**(직후 40 ms − 직전 40 ms)으로 판정한다. 절대 에너지는 사용자의 이전 코드 울림을 반주로 착각한다. 누출 이득은 **반주 전주 1마디**(반주만 나오는 구간)의 관측/템플릿 비 중앙값이다. 앱의 연주 모드도 반주를 1마디 먼저 시작한다(M12, 설계값). 전주가 없으면 전체 이벤트 비의 중앙값으로 대신한다. 약한 반주 onset은 앞쪽 요동 때문에 15–25 ms 이르게 정밀화돼 ±15 ms 창(계약값) 밖으로 빠졌다. 그래서 도착 직전(창 + 30 ms 안)의 후보는 `도착 − 15 ms` 이전 교차를 무시하고 다시 정밀화해 창 안에 들면 그 반주 이벤트로 본다. 유지 판정은 후보 자신의 시각으로 한다. v1 스트럼 경로·정밀화는 바뀌지 않는다(재정밀화는 반주 마스킹에서만 호출). 벤치 오검출 분모에서 전주 이벤트는 뺀다(보정 구간이라 판정 대상이 아님 — 쉬운 표본으로 분모를 늘리지 않는다).
- **GuitarSet solo 시퀀스 필터 해석**(§14.4 "onset 시점에 다른 줄 음이 울리는 중이면 제외", `sequenceIsolationOtherStringMs` 60): 다른 줄 음이 **onset + 60 ms 시점에도 울리고 있으면** 제외한다. 주석상 짧은 겹침(< 60 ms)은 허용하고, 겹음·계속 울리는 음은 뺀다. 인접 onset 간격은 앞뒤 둘 다 ≥ 120 ms. 음높이 판정은 앱과 같은 `judgeSequenceNote`(이전 다른 줄 음을 울림으로 보고 제거)를 쓴다.
- **합성기 기술 모델(§14.2)**: 버징 = 소프트 클립 + 줄 변위로 게이트한 고역 잡음, 잡음 레벨은 처음 200 ms 음 RMS 대비 세기 1에서 −20 dB(0.2에서 약 −30 dB). 해머온 = KS는 이전 음의 마지막 한 주기를 새 지연 길이로 늘이거나 줄여 진동을 잇고, additive는 피크 잡음 없이 1.2 kHz 4차 저역통과로 어둡게. "attack 2–8 kHz 에너지가 피킹의 −20 dB 이하"는 해머온이 **새로 더한** 에너지(직후 10 ms − 직전 10 ms)로 잰다. 줄이 이미 울리고 있어 그보다 조용해질 수 없기 때문이다. 합성 테스트 5개 시드 쌍으로 단언.
- **베타 벤치 설계**: 판정기마다 ≥ 500 표본. 셈여림은 E5 셈여림 모드처럼 세게/여리게 교대 마디와 고른 대조군이다. 실행 중앙값 기준이라 무작위 마디는 정답이 정의되지 않는다. 반주 아래 Mode C는 v1 Mode C 시퀀스 120개에 P3 반주(사용자가 잡은 코드를 따름)를 −25…−10 dB로 섞는다(전주 없음). 베타 값은 종료 코드와 무관하다(`benchExitCode`, 무결성 10).
- **베타 판정기 한계(dev)**: 방향 0.54(목표 0.85). 줄별 고유 partial이 적은 보이싱(E 등 옥타브 관계가 많은 코드)에서 이웃 줄 누설이 줄별 onset을 끌어당긴다. 버징 검출 0.62(목표 0.7, 오경보 0.084), 반주 아래 Mode C 0.76(목표 0.85). 보고만 하고 BACKLOG에 개선 과제로 남긴다.
- **Stage 8–11 보이싱 4개**(E5·A5·D5·F5)를 시드에 넣어 Mode A/B 매트릭스가 29개를 덮는다(AC-S9). v1 Mode A·B·C 임계값은 dev에서 그대로 통과.

## D-067 M12 결정 (초급 2 콘텐츠·새 연습·반주)
- **v1 테스트 갱신(§2.4, 확장만 — 완화 없음)**: `src/exercises/registry.test.ts`·`src/domain/basics.test.ts`의 등록·추출기 목록에 E3·E9·E10·E11·E12 추가(§11.2). `src/exercises/quiz/quiz.test.ts` 귀 문제는 프롬프트에 `kind`가 생겨(§11.21) `kind === 'majmin'`을 함께 확인한다(단언 그대로). `src/exercises/song/runner.test.ts`는 파라미터 타입을 입력 타입 `SongParamsInput`으로(반주 필드 기본값), 가짜 판정 이벤트의 작업 종류를 러너가 설정한 작업(`songStrum`)으로 맞췄다(D-064 E6과 같은 고정 입력 수정). `src/exercises/e5/runner.test.ts`의 작업 단언 `toEqual({kind:'onsets'})`는 §10.11 베타 판독 요청이 더해져 `toMatchObject({kind:'onsets', beta:{direction:true}})`로 바꿨다(작업 종류와 베타 요청을 모두 확인).
- **Stage 10 `newChords`**: 파워코드 단계가 G5·C5만 새 코드로 적어 쌍 목록(E5|A5, A5|D5 …)의 E5·A5·D5·F5가 "아직 안 배운 코드"였다. 쌍에 쓰는 6개 모두를 새 코드로 넣었다(§6.4·§7.1 Stage 10).
- **시퀀스 판정 청크(§10.10을 실시간으로)**: 캡처 링(약 3.9 s)보다 긴 사이클은 한 번에 보낼 수 없다. `SequenceTracker`가 판정 가능한 슬롯(슬롯 + 0.35 s 꼬리)을 모아 최대 3.2 s 구간(앞 0.6 s 예열)으로 워커에 보내고, 가장 오래 기다린 슬롯이 1 s 넘으면 덜 찬 구간도 보낸다. 앞 구간에서 울리던 음(`priorNotes`)과 앞 구간이 이미 본 구간(`extraSpan`)을 넘겨 울림 제거·EXTRA 중복을 막는다. 청크 판정 = 통째 판정(같은 상태 목록)을 `tracker.test.ts`가 확인한다. 끝(Space)에서는 그때까지 친 슬롯만 판정하고 잘린 사이클은 기록하지 않는다.
- **E3 정밀 빠른 체인지**: 도착은 E2와 같은 Mode C 상태 기계, 도착마다 Mode B를 "참고(베타)"로 보이고(워커 작업 `pfc`), 깨끗함은 사용자 표시(Enter 깨끗/↓ 아님, 표시 안 한 도착은 아님)다. 졸업 = 통과(깨끗 비율 ≥ 0.8, ≥ 20회/분)를 서로 다른 2일(`pfcGraduated`). 루틴의 PFC 칸은 OMC→PFC 처방 쌍 → 졸업 안 한 스테이지 쌍(오래된 순)이다.
- **E17 팜뮤트 베타는 시퀀스 경로에 넣지 않음**: 리프 음 판정은 §10.10(하드)만, 팜뮤트 베타는 E5 팜뮤트 옵션에서만 보고한다(시퀀스 응답에 베타 판독을 섞으면 하드 판정 경로가 바뀐다).
- **곡 반주(§8.6)**: 반주는 카운트인 마디를 전주로 쓴다(그리드 − 1마디부터, D-066 누출 이득 측정 구간). 스피커면 전주가 끝난 뒤 누출 이득을 재고 녹음기 작업에 반주 도착 시각·템플릿·이득을 넣어 워커가 스트럼마다 유지 여부(`keep`)를 낸다. 반주로 판정된 스트럼은 박 1 판정과 코드 확인에서 뺀다. 코드 확인은 E6의 `chordCorrectRatio`를 쓰고, 스피커면 "참고"로 보이며 `song:<id>:chord` 지표를 남기지 않는다. 이어폰 선택은 그 곡 기록의 출력 장치 라벨별 마지막 선택을 기본값으로 쓴다(§8.6-1). 키: B 반주 켜기·끄기, E 이어폰/스피커(연주·숨김 단계의 시작 전만).
- **E10 "반주와 함께 1단계"의 스피커 정책**(SPEC에 명시 없음 → 보수적 선택): 단음 판정 경로에는 반주 마스킹이 없고, 반주 코드(으뜸화음)의 음이 스케일 음이라 스피커 누출이 놓친 음을 OK로 만들 수 있다. 그래서 곡과 같은 이어폰 확인(E)을 두고, 스피커면 사이클은 보여 주되 "참고"로 표시하며 졸업·암기·사다리·지표에 넣지 않는다(`backingAudible`, 추출기 빈 목록, 다음 실행 계산에서 제외). 이어폰이면 1단계와 같은 점수(§11.13 6단계). — **D-102이 대체**: 단음 경로에도 반주 마스킹을 넣어 스피커 실행도 기록한다.
- **E11 하루 상한(§11.16)**: 오늘 E11 분(`hammerMinutesOn`, 기록 합계)이 10분 이상이면 루틴에서 E11을 빼고, 아니면 남은 시간을 실행 파라미터 `minutesToday`로 넘겨 러너가 상한에서 멈춘다. 연습 화면(라이브러리)에서 직접 열 때도 같은 값을 넘긴다.
- **스케일·리프 복습(§7.5)**: 졸업한 스케일 단계·리프를 복습 큐에 넣고, 복습 실행은 가장 높은 졸업 단계를 졸업 템포(80)로 친다(`review: true`).
- **E2E 지원**: 가짜 마이크 루프백에 이득(`loopbackGain`)을 더해 스피커 누출(E2E-17 b: 지연 = RTT, 이득 0.15)을 흉내 낸다. E2E-22는 모든 곡에 학습 완주 2회 기록을 넣어 세션의 곡 항목을 연주 단계로 만든 뒤 B를 확인한다(학습 단계에는 반주가 없음, §8.6). 연주 단계는 박 1 분석이 도는 동안 Enter를 받지 않아 확인을 재시도한다(단언 그대로).
- **PFC → OMC 처방의 루틴 배치**(§7.4 표 "E2로 돌아가기", 배치 칸은 SPEC에 없음 → 보수적 선택): 처방이 살아 있는 동안 그 쌍은 E3 칸 후보에서 빠지고, 1분 체인지 칸 2에서 "위험한 진급 필요 쌍" 다음 순위로 들어간다(칸 1이 이미 그 쌍이면 그대로). 처방이 순환 보장을 몰아내지 않는다는 §7.3-6과 같은 원칙이다.
- **E5 패턴 P6–P8**(§6.10): E5 파라미터가 P0–P8을 받는다. 판정 그리드와 화면의 현재 칸은 `patternSlotTimes`(스윙이면 뒤 8분을 박의 2/3에)를 쓴다. 곧은 패턴(P0–P6)의 시각은 v1과 같다. P6의 끊기(X)는 타이밍 슬롯으로 판정하고 뮤트 품질은 판정하지 않는다(베타 범위 밖).

## D-068 M12 리뷰(code-reviewer) 반영
M12 변경 전체를 리뷰 서브에이전트가 검토했다(critical 1, high 3, medium 4, low 3). 확인한 결함과 조치:
- (critical) **스케일·리프 복습이 영원히 통과하지 못함**: `graduatedItems`에 `scale:`·`riff:`를 넣었지만 `reviewPassed`에 분기가 없어 복습이 항상 실패로 기록됐다. 졸업과 같은 기준으로 통과를 판정한다(스케일 단계 = `streakBpm` ≥ 80, 리프 = `passBpm` ≥ 리프 템포 + 20). 루틴 복습 항목은 복습할 **단계**(`scale:<id>:s<n>`의 n)를 E10 파라미터로 넘기고, E10은 복습 실행에서 그 단계를 졸업 템포로 친다(이전에는 최근 5회 중 가장 높은 졸업 단계를 골라 다른 단계를 칠 수 있었다). 리프 복습은 패턴 복습처럼 사다리 현재 템포로 친다(§7.3-10 규칙 10; 졸업한 리프의 사다리는 목표 템포 이상 — 처음에 목표 템포로 고정했다가 28일 시뮬레이션의 템포 규칙 단언에 걸려 되돌렸다). 테스트: `v11Records.test.ts` "scale and riff reviews…", `routine.test.ts` "SPEC v1.1 §7.5 scale and riff review drafts".
- (high) **반주가 늦게 시작**: 반주 렌더(0.1–0.3 s, 모바일은 더 김)가 카운트인 예약 뒤에 동기로 돌아, 이미 지난 시각으로 예약된 반주가 처음부터 늦게 재생됐다(마스킹 도착 시각도 어긋남). 곡·E10 모두 **카운트인 예약 전에 렌더**하고, 엔진의 `scheduleBacking`은 지난 시각이면 그만큼 건너뛰고 재생해 그리드에 맞춘다. 테스트: `backing.test.ts` "the backing is rendered before the count-in is scheduled…".
- (high) **느린 템포에서 누출 이득 0**: 전주 1마디가 캡처 링(≈3.9 s)보다 길면(4/4 ≤ 61 BPM) 앞쪽 이벤트가 범위 밖이라 상승분 0으로 읽혀 중앙값이 0이 됐다. 누출 이득은 그리드 직전 3.5 s(`BLEED_WINDOW_S`, 설계값) 안의 전주 이벤트로만 재고, 어댑터도 범위 밖 도착은 0으로 세지 않고 뺀다. 테스트: `backing.test.ts` "the bleed gain is measured inside the capture ring…"(60 BPM에서 첫 박 제외 3개).
- (high) **E11 하루 상한이 실행 중에는 걸리지 않음**: 실행이 시작된 뒤 남은 분을 넘기면 실행을 끝내고 고르기 평가로 넘어간다. 테스트: `e11/runner.test.ts` "the daily cap also ends a run in progress…".
- (medium) **곡을 떠난 뒤 늦게 온 누출 이득이 worker 작업을 다시 켬** → `GridRecorder`가 dispose 뒤의 `updateJob`과 메트로놈 시작 콜백을 무시하고, 곡 러너는 요청한 녹음기와 같은지 확인한다. `BaseRunner.own()`은 dispose 뒤에 등록된 정리를 바로 실행한다(누수 방지). 테스트: `backing.test.ts` "a late job update after the take was left…".
- (medium) **청크 경계의 이중 검출이 EXTRA가 됨**: 다음 청크의 EXTRA 구간을 "직전 청크 마지막 매칭 onset + `duplicateMs`" 이후로 시작한다(통째 판정과 같은 중복 규칙). 테스트: `tracker.test.ts` "a double detection of a chunk's last note…"(수정 전 실패 확인).
- (medium) **E2E-17(b)가 마스킹이 고장나도 통과** → fixture에 박 1을 치지 않는 마디(5번, 코드가 바뀌지 않는 마디)를 넣고 (a)·(b) 모두 박 1 적중 = 15/16을 단언한다(SPEC의 ≥ 0.9 단언은 그대로). 마스킹을 끈 변이로 (b)가 실패(1 ≠ 0.9375)하는 것을 확인했다. 이 과정에서 드러난 것:
  - 처음 고른 루프백 이득 0.15는 §14.8 척도로 반주가 사용자 스트럼보다 −3 dB(규정 범위 −25…−10 dB 밖)였다. 누출 레벨을 §14.8 정의(첫 이벤트 500 ms RMS 비)로 −12 dB에 맞추는 이득을 fixture 도구가 계산한다(`songBleedLoopbackGain`).
  - 고정 RTT(60 ms)는 브라우저 경로 버퍼링(≈ 13–20 ms)을 빼 반주 도착 예측이 +19 ms 어긋났다(마스킹 창 ±15 ms 밖). 실기기처럼 앱의 온보딩 루프백 측정으로 RTT를 잰 뒤 연주한다(`tests/e2e/support/calibrate.ts`).
  - 가짜 마이크가 해제된(트랙이 끝난) 같은 스트림을 다시 돌려줘 온보딩 뒤의 마이크가 무음이었다. 실제 `getUserMedia`처럼 끝난 트랙이면 새 스트림을 만든다(`tests/e2e/support/fakeMic.ts`).
  (a)는 코드 확인 ≥ 0.9도 단언한다.
- (medium) **E11 고르기 평가에서 Esc(중단)가 안 됨** → 평가 단계에서도 중단을 받는다.
- (low) **늦게 끝난 메트로놈 시작**: 시퀀스 러너는 그 사이 실행이 끝났거나 떠났으면 그리드를 잡지 않고, 시작 실패는 결과 없이 끝낸다.
- (low) **이어폰 기억이 최근 곡 기록 5개만 봄** → 플러그인이 `historyDepth`로 더 깊은 기록을 요청할 수 있고(기본 5), 곡은 50개를 본다(학습 실행이 출력 장치별 선택을 지우지 않게). 개인 리드 추정은 그대로 최근 5개.
- 반영하지 않음: (low) 시퀀스 트래커가 실행 전체의 슬롯 배열을 다시 훑음 — 응답마다 한 번(≈ 1 s), 10분 E11도 1,600슬롯이라 비용이 무시할 만하다.
- 리뷰 에이전트는 레포에 파일을 만들지 않았다.

## D-069 M13 결정 (초급 2 진행 통합)
- **진급과 수료(§7.2·§7.7)**: Stage 7 시험 통과 후의 진급이 "초급 1 수료" 표시와 함께 Stage 8로 간다(`BEGINNER1_LAST_STAGE`). Stage 11 기준 충족 = 초급 2 수료이고, 다른 진급처럼 홈에서 확인 버튼("수료 기록하기")으로 기록한다(날짜 `beginner2CompletedAt`, 이후 Stage 11 루틴 유지). 조건부 진급(§7.4)은 Stage 11에서 제안하지 않는다 — 수료는 기준 충족으로만 한다(§7.7 문장). `PLAYABLE_STAGE_MAX` 11, Stage 8–11 `locked: false`.
- **v1 테스트 갱신(§2.4)**: `src/content/curriculum.test.ts` "defines stages 0–11; 0–7 playable, 8–11 locked preview" → 모두 열림 + Stage 8–11 최소 체류 8세션·14일 단언(§7.2가 v1 미리보기를 없앰). M10의 `progression.test.ts` promote 테스트도 Stage 7 → 8·Stage 11 수료로 바꿨다(같은 근거).
- **시뮬레이션(§14.9)**: 앱처럼 플러그인 `withHistory`를 주입한다(호스트와 같은 이력 깊이). 템포·단계를 실행 이력에서 정하는 연습(E9·E10·E11)이 앱과 같은 경로로 진행하고, §14.9-6 템포 단언은 그 실행 파라미터를 사다리 현재 BPM과 비교한다. 학습자 모델에 E3(clean_rate 0.6 → +0.1, 변화 수 = 그 쌍 E2 값)·E9·E10·E11(사이클 4개 무실수·통과)·E12(완료)를 §14.9-2 수치대로 넣었다. G 전환 단언은 Stage 6–7로 한정한다(Stage 8은 G-4f를 따로 배운다). 통증일 합계 도우미는 "빠진 행"을 순환 행(E11·E12가 나오는 곳)으로 한정한다 — PFC 칸이 빌 때(Stage 10+ 졸업한 쌍뿐) 그 시간은 평소처럼 곡/레퍼토리 블록으로 간다(규칙 1).
- **시뮬레이션이 찾은 결함과 조치**:
  - 스케일 복습 실행(졸업 단계, 80 BPM)이 "가장 최근 결과"가 되어 오르던 다음 단계가 60에서 다시 시작했다 → E10 결과에 `review`를 남기고 다음 실행 계산에서 뺀다.
  - E11은 6쌍을 돌아 최근 5개 결과에 그 쌍이 없으면 60에서 다시 시작했다 → 주제가 순환하는 사다리 연습(E9·E10·E11)은 이력 30개를 본다(`SEQUENCE_HISTORY_DEPTH`, 설계값).
  - 통증일 E3 블록(60초)이 절반(30초)이 되어도 실행은 E3 범위(60–120초) 때문에 60초였다 → 안전 규칙 7이 우선: E3 실행 최소 30초.
- **규칙 10 파라미터를 루틴에서 채움**: Q3 문항 수는 현재 스테이지의 `quizRunAtLeast` 규칙(그 범위)에서 온다(Stage 10 strings65 = 20). `scaleMemorized` 규칙이 걸린 스케일은 그 스케일 1단계 실행 기록이 2회 이상이면(= 3번째 배정부터) 암기 전까지 1단계 `tabHidden`으로 배정하고, E10의 다음 실행 계산은 그 실행을 1단계에 둔다.
- **세션 분할(§7.3-11)**: 두 절반을 **한 세션 id**로 이어 "한 세션 기록"을 만든다. 분할 지점(리듬 블록 다음 첫 항목)에서 "여기서 나눠 하기"를 누르면 남은 항목과 러너 상태(멈춤)를 `meta.splitResume`에 저장하고 세션은 열어 둔다. 같은 날 홈의 "이어서 하기"가 같은 세션으로 이어 가고, 끝의 자가 평가가 세션을 한 번 닫는다. 날짜가 바뀌면 다음 로드 때 그 절반을 자가 평가 없이 닫아(세션으로 센다) 선택지를 지운다. v2 스키마의 `splitOf` 열은 쓰지 않는다(두 행을 잇는 대신 한 행).
- **레퍼토리 블록 순환(§11.10 "차례로 친다")**: 레퍼토리 블록에서 "이어서 한 번 더"(Space)는 다음 레퍼토리 곡(스테이지 이하, id 순서, 끝나면 처음으로, 암기한 곡은 숨김 단계)을 친다. 레퍼토리가 한 곡뿐이면 같은 곡.
- **E2E-18**: 건너뛰기 키가 없어 "키보드만으로"는 버튼에 초점을 두고 Enter(기존 `pressOn` 도우미, E2E-07과 같은 방식)로 진행한다. **E2E-19**: Playwright `page.clock.install` 뒤 `setSystemTime`으로 15일을 진행하고, 스킬 행·세션 8개·진도 카운터를 시드한다(졸업 시험 E2E와 같은 시드 방식).

## D-070 M14 결정 (화면 마감)
- **E2E-10·11 화면 목록 확장(AC-UX4)**: 공용 목록(`tests/e2e/support/screens.ts`)에 v1.1 화면을 더했다 — Stage 10 페이지, 루틴 편집, K1, E16, E3, E9, E10, E11, E12, E17, Q3(strings65), Q4(interval), Q5, S 연주(반주 켬). 시퀀스 연습은 실행 중 상태(자가 보고 큰 버튼)까지 열고 검사한다. 4 뷰포트 가로 스크롤 0·큰 버튼 ≥ 64 px·테마 3종 axe serious/critical 0을 chromium·iPad·iPhone에서 통과.
- **왼손잡이**: 코드 다이어그램은 v1부터 모든 화면에서 설정을 따른다(새 화면 E3 포함). 새 지판 그림인 E16 프렛 위치 그림은 왼손잡이면 좌우를 뒤집는다(헤드 쪽이 오른쪽). TAB은 §6.9대로 설정과 무관하게 TAB 관례(위 = 1번 줄)를 지킨다. 단위 `src/exercises/e16/picture.test.tsx`.
- **키·페달 학습과 새 키**: 학습한 키는 키 코드로 저장되어 기본 키보다 먼저다(v1 그대로). 학습한 키가 다른 동작의 기본 키였으면(예: 페달이 보내는 B = v1.1 반주 키) 설정 화면이 "원래 무엇에 쓰이던 키인지, 이제 배운 동작이 먼저"라고 알려 준다(학습은 막지 않는다 — 페달은 흔히 →·PageDown 같은 기본 키를 보낸다). v1.1 옵션 키(E·V·L·H·B, 대소문자)가 v1 기본 키를 하나도 가리지 않음을 `src/app/keys.test.ts`가 확인하고, v1 E2E(`keys.spec.ts`, B 페달 학습)에 그 알림 단언을 더했다.
- **PWA·CSP(AC-W4)**: 오프라인 E2E에 E10(TAB)·S 연주(반주 켬)·Stage 10 페이지를, CSP E2E에 반주 재생(연주 단계, 이어폰)과 E10 시퀀스 판정(DSP worker 구간 요청)을 더했다. 위반 0.

## D-071 M15 리뷰(code-reviewer) 반영
M13–M14 변경(과 v1.1 전체 훑어보기)을 리뷰 서브에이전트가 검토했다(critical 0, high 1, medium 3, low 3). 확인한 결함과 조치:
- (high) **분할 첫 절반이 영원히 열린 채 남음**: 첫 절반이 있는 날 홈의 "시작"으로 새 세션을 열면 그 절반은 쓰이지도 닫히지도 않았고, 새 세션이 끝나며 기록만 지웠다(첫 절반은 `sessionsInStage`·주간 시간에서 빠짐). "시작"을 고르면 남은 절반을 자가 평가 없이 닫고(센다) 새 세션을 시작하며, 기록은 그 세션의 것일 때만 지운다(`closeSplit`·`clearSplit(sessionId)`). E2E-18b.
- (medium) **이어서 하기 뒤의 진행이 기록에 남지 않음**: 두 번째 절반을 하다 새로고침·이탈하면 분할 지점부터 다시 시작해 같은 항목을 두 번 저장할 수 있었고, 날짜가 바뀐 뒤 닫을 때 두 번째 절반의 시간·항목이 빠졌다. 두 번째 절반의 진행(현재 항목·기록 수·연습 시간)을 항목마다 기록에 되써 이어서 하기가 그 자리로 돌아오고 닫을 때 센다. E2E-18 확장.
- (medium) **레퍼토리 다음 곡이 원래 곡으로 기록됨**: "이어서 한 번 더"가 곡을 바꿔도 Attempt의 `routineKey`·`reviewOf`가 원래 항목 것이라 다음 곡이 "안 친 곡"으로 남아 순환이 깨졌다. 다음 곡 실행은 그 곡의 키(`S|song:<다음 곡>`)로, 복습 없음으로 저장한다(`repeat.ts` `RunIdentity`). 단위 `session.test.ts` "SPEC v1.1 §11.10 repertoire repeat (M15 review)".
- (medium) **암기 TAB 숨김이 "배정"이 아니라 "실행" 수를 셈**: 한 세션 안 반복으로 두 번째 배정부터 숨겨질 수 있었다(시뮬레이션은 항목당 실행 1회라 못 잡음). 그 스케일 1단계 실행이 있었던 **서로 다른 날** 수로 센다(하루 한 세션 기준, 같은 날 두 세션이면 늦게 숨김 — 보수적). 단위 `routine.test.ts` "Stage 9 memorization: … third assignment (day), not the third run".
- (low) 페달 학습 알림이 한글 입력(KeyB → 'ㅠ')에서 빠짐 → 키 코드의 영문자로도 기본 키를 찾는다. (low) v1에서 Stage 7을 마친 사용자가 v1.1에서 Stage 8로 갈 때 Stage 7 이력 줄이 둘이 됨 → 같은 체류의 줄이면 갱신한다(`promote`, 단위 테스트). (low) 오프라인 E2E의 Stage 10 확인이 h1만 봄 → 그 스테이지 이름을 확인한다.
- 리뷰 에이전트는 레포에 파일을 만들지 않았다.

## D-072 실사용 피드백: 커리큘럼에서 직접 골라 연습 (v1.1 이후, `feat/practice-feedback`)
v1.1 goal(M9–M15)이 끝난 뒤 사용자가 실제로 써 보며 요청한 세 가지 중 첫째. 사용자 선택: "바로 하기"와 "골라서 나만의 세션" 둘 다.
- **목록**: 단계 페이지의 "이 단계 연습하기"는 그 단계 템플릿 슬롯 + 순환 목록 항목 전부(루틴 편집기의 `addOptions`)다. 순환 목록 자체(하루 하나를 고르는 칸)는 넣지 않는다 — 그 항목들이 따로 있다. 이름은 실제로 만들어질 항목(`itemTitle`: 코드·쌍·패턴·곡)으로 붙이고, 같은 것이 두 번 나오면 한 번만 보인다.
- **파라미터**: 고른 항목을 그 단계의 **일회용 사용자 템플릿**으로 만들어 `generateRoutine`에 넣는다(진도는 그 단계로, 그 단계 세션 수로 본다). 그래서 사다리 BPM·E5 모드와 코드·쌍·곡 단계·E7 시작 프렛이 평소 루틴과 같고, 안전 규칙(통증 감량, 하루 체인지 상한, E11 하루 상한)도 그대로다. 복습 항목(`dueReviews`)은 넣지 않는다(오늘 루틴의 몫). 콘텐츠(코드·보이싱)는 그 단계 것(`ExerciseHost`에 `content` prop 추가).
- **바로 하기**: 단독 실행과 같다(`sessionId` 없음, Attempt는 평소처럼 저장되어 사다리·기록에 반영).
- **나만의 세션**: 세션 화면이 내비게이션 상태로 받은 단계·항목 순서대로 실행한다(`routineId: 'custom'`, `stage` = 그 단계, 분할 없음). 세션 시작 처리(처방 만료·정체 감지)는 하지 않는다 — 오늘 루틴의 세션이 아니다. 남겨 둔 분할 절반은 다른 "시작"처럼 닫는다(D-071).
- **최소 체류(§7.2)**: `finishSession`이 세션 단계와 상관없이 현재 단계 `sessionsInStage`를 올리던 것을 **세션 단계 = 현재 단계일 때만** 올리도록 바꿨다. 다른 단계를 복습한 세션이 현재 단계 최소 세션 수를 채우지 않게 하기 위해서다(현재 단계를 고른 세션은 평소처럼 센다). 단계 페이지는 그 단계 세션 수를 그 단계 세션으로 센다(v1.1과 같음).

## D-073 Mode A: 줄 소리가 아닌 소리(몸통 노크) = 다시 치기 (`NOT_STRING`)
- **원인**: Mode A는 감쇠비를 음높이보다 먼저 판정한다. 몸통 노크는 몇 개의 몸통 공명(≈100·205·400 Hz)이 빨리 사라지는 소리라 감쇠비가 작아 **MUTED(FAIL)**가 됐다(합성 노크 540건 중 93.9%, 설계 단계 측정).
- **판정**: MUTED를 반환하기 **직전에만** "줄 소리 증거"를 본다 — onset 뒤 [+30, +130 ms]와 앞 [−120, −20 ms]의 새 에너지 스펙트럼에서 기대음 ±700 cent 안의 가장 좋은 배음열이 새 에너지의 몇 %를 설명하는지(`hf`)와 1% 이상 배음 개수(`pc`). 줄 소리가 아니면 `WEAK/RETRY/['NOT_STRING']`("줄 소리가 아닌 것 같아요(몸통 소리 등). 그 줄을 한 번 더 쳐 주세요."). 이미 RETRY인데 새 에너지가 10 dB 이상 크고 증거가 없으면 사유만 NOT_STRING으로 바꾼다.
- **벤치 영향**: OK·WRONG_NOTE·약한 기본음 경로는 이 분기에 오지 않으므로 그 지표는 바뀔 수 없다. dev split Mode A에서 바뀐 값은 `mutedDetectRate` 하나(0.9977 → 0.9930, 임계 0.80)였다(같은 dev 케이스를 원래 커밋과 비교). test split 최종 실행에서도 바뀐 Mode A 값은 그것뿐이고 0.9953 → 0.9790(7/429, 모두 additive 모델의 빨리 죽는 뮤트 음이 NOT_STRING 재시도로)이다 — 임계 안이지만 dev보다 크다. 실녹음 뮤트로 재조정할 항목(BACKLOG).
- **안전장치**: 실제로 뮤트된 줄의 "툭" 소리가 노크처럼 보일 수 있다(실녹음 정답 없음). 감쇠가 뮤트처럼 빠른 NOT_STRING(`fastDecay`)이 같은 줄에서 허용 횟수(둔감 2, 보통·민감 1)를 넘으면 E1이 MUTED로 확정한다.
- **x 줄 확인**: x 줄에서 NOT_STRING(노크·죽은 소리)은 기대한 "줄 소리 없음" = OK.
- **고정 SPEC 편차**: SPEC §10.1의 RetryReason 목록(해시 고정)에 `NOT_STRING`을 **추가**했다. 기존 값의 의미는 그대로다.

## D-074 Mode A: 앞 줄이 울리는 채로 다음 줄 판정 (울림 상쇄)
- **원인**: 줄별 확인에서 앞서 퉁긴 줄이 계속 울린다. 그 에너지가 기대음 배음 대역의 "직전 구간"을 채워 LOW_LEVEL이 되거나, 음높이가 흐려져 AMBIGUOUS가 되거나, 감쇠가 과차감되어 MUTED가 됐다(합성: 앞 줄이 6 dB 더 크면 깨끗한 음 OK 24/60).
- **방법**: 시퀀스 판정(§10.10)의 comb 상쇄를 재사용한다(`cancellationStages`·`combFiltered` export만, 시퀀스 동작은 그대로). E1이 이번 시도에서 소리 난 줄(OK·WRONG_NOTE·울린 x 줄, 측정 f0)을 최근 3개까지 job에 싣고(`ringing`, 캡처 sample), Mode A는 0.05–3 s 전의 것을 상쇄한 사본도 판정해 고른다: ① 사본의 새 에너지가 원본의 −9 dB 미만이면 원본(앞 줄을 다시 친 것), ② 원본 음높이가 울리는 줄 ±50 cent면 사본, ③ 원본만 RETRY면 사본, ④ 둘 다 판정했는데 다르면 clarity가 높은 쪽. "줄 소리 증거"는 언제나 원본으로 본다(comb가 같은 배음을 같이 지우기 때문).
- **잘못된 OK 막기**: 사본의 OK·WRONG_NOTE는 감쇠비가 뮤트 기준의 2.5배 이상일 때만 믿는다(낮은 SNR에서 약한 뮤트 음의 감쇠비가 comb가 키운 잡음으로 기준 바로 위에 뜨는 경우, dev 7건 → 0).
- **울림이 없으면 결과가 정확히 같다**(`ringing: []` = 이전 판정, 단위 테스트). 벤치(울림 없음)는 영향 없음.
- **근거(합성, 벤치 채널 dev 케이스, `tools/bench/debug/modeA-takes.ts`)**: 울림 +6 dB·감도 보통에서 깨끗한 음 OK 3 → 20/20, 틀린 음 WRONG_NOTE 37/40, 뮤트는 OK 0(MUTED 12, 나머지 LOW_LEVEL 재시도), 틀린 음 → OK 0. 남은 한계: 옥타브 관계(예: E2 위의 E3)에서 뮤트 음의 LOW_LEVEL(직전 구간 감쇠 외삽은 BACKLOG).

## D-075 판정 감도 설정 (둔감 / 보통 / 민감)
- 사용자 선택: 자동 무시 + 설정에 감도. 고정 SPEC §10.1 "절대 레벨 사용 금지"를 지켜 모두 onset 직전 대비 **상대값**이다: `minLevelDb` 9 / 7 / 5 dB, NOT_STRING `pcMax/hfMin` 3·0.7 / 3·0.6 / 2·0.5, MUTED 확정 전 NOT_STRING 허용 2 / 1 / 1. 둔감이면 작은 소리(LOW_LEVEL)는 안내 없이 계속 듣는다.
- 기본값 '보통' = 지금까지의 판정 + 노크 거부 = 벤치가 재는 값(벤치는 인자 없이 부른다). 둔감 9 dB의 근거: GuitarSet dev 단음 39개 중 가장 작은 것이 10.1 dB였다(설계 단계 측정).
- E1·E16 pluck job과 fallback에 실린다. 옛 설정(키 없음)은 '보통'으로 읽는다.

## D-076 빠른 줄 넘김과 fallback
- **빨리 친 다음 줄이 버려짐**: 판정 결과는 퉁긴 뒤 약 0.45–0.6 s에 오고, 그때 다음 줄을 "지금"으로 무장했다. 그래서 그 사이(직전 + 0.40–0.55 s)에 친 다음 줄은 조용히 무시됐다. 자동으로 다음 줄로 넘어갈 때(그리고 NOT_STRING 같은 재시도 때)는 직전 take 구간 끝(직전 onset + 0.4 s)부터 무장한다(`TakeTracker.arm(at)`, 그때부터 들린 coarse onset은 유지 — 두 번 친 것도 여전히 잡는다). MULTIPLE_ONSETS 재시도는 지금부터.
- **job 경쟁**: 다음 줄 job이 worker에 닿기 전에 친 소리는 이전 줄 기대음으로 판정될 수 있다. 결과에 판정한 기대음(`expectedF0`)을 돌려주고, 다르면 그 구간을 지금 줄 기대음으로 fallback 재판정한다.
- **기존 버그**: 에너지 fallback이 x 줄 확인에서도 `silent: false`로 판정해, 뮤트한 x 줄이 MUTED FAIL이 될 수 있었다 → `silent`를 넘긴다.

## D-077 연주 중 즉시 피드백 (E6 박 1 체인지, E5 스트러밍, E8 교대 피킹)
- 사용자 선택: 세 연습 모두. 마이크가 있을 때 마디 칸 한 줄(줄바꿈, 가로 스크롤 없음)과 직전 마디 요약 한 줄(`aria-live`)을 보인다. 색만이 아니라 아이콘·문구로도 구분한다(✓ 제때, ± 조금 어긋남, ✗ 많이 놓침, ■ 멈춤).
- **판정은 최종과 같은 함수**: 마디의 마지막 슬롯 + RTT + 창 + 0.7 s(판정 도착 지연, `GridRecorder.SETTLE_S`와 같은 근거, 그 마디 구간 끝까지 포함)가 지나면 그 마디 슬롯과 그 마디 구간의 스트럼만 `analyzeTiming`에 넣는다. 스트럼은 자기 슬롯의 ±창 안에서만 매칭되고 슬롯 간격이 창의 두 배보다 넓어서 마디별 판정 = 최종 판정이다(무작위 스트럼으로 패턴 6개 × 템포 3개에서 슬롯 판정·적중·놓침·추가 수가 같음을 단위 테스트로 확인).
- **E6**: 박 1이 창 안이면 제때(오프셋), 창 밖에서 쳤으면 늦음/빠름(가장 가까운 스트럼 오프셋)을 들리자마자, 마디 전체에 스트럼이 없으면 마디가 끝난 뒤 멈춤(`stoppedBars`와 같은 구간). 코드가 바뀌는 마디는 `chordCorrectRatio`의 마디별 판정(`barChordVerdict`)으로 "코드 맞음 / 앞 코드 소리 같아요".
- **보기 전용**: 기록·통과 규칙·저장 형식은 그대로(끝난 뒤의 분석). E5 사다리는 개인 지연 보정 적중률을 쓰지만 즉시 피드백은 보정 전 슬롯 판정을 보인다(요약의 적중률과 같은 기준).

## D-078 홈: 오늘 한 연습과 다음 세션을 나눠 보이기
- **원인(실사용 보고)**: 홈 "오늘의 루틴"은 늘 **다음에 시작할 세션**을 `generateRoutine`으로 그린다. 순환 블록은 §7.3 규칙(세션 번호 기준)으로 세션마다 넘어가므로(Stage 2: 기술 E17 R1 ↔ E4 A|E, 리듬 E5 P0 ↔ E6), 세션을 마친 뒤 "오늘 연습을 마쳤어요" 아래 목록이 방금 한 것과 달랐다. 시작 전 목록과 세션 목록은 같다(같은 입력·날짜 시드).
- **결정**: 생성 규칙은 그대로 두고 표시만 바꾼다. 오늘 연습했으면 **오늘 한 연습**(오늘 시작한 Attempt, 처음 시작한 순서, 같은 루틴 항목은 한 줄 + 횟수, 세션·단독·커리큘럼 연습 모두)을 먼저 보이고, 다음 세션은 "한 번 더 하면" 소제목과 순환 안내 아래 둔다. 제목은 루틴 항목과 같은 말(`itemTitle`; Attempt의 E2·E4 `from/to`는 방향·쌍으로 읽음). `itemTitle`은 E5 패턴을 내부 id(P0) 대신 글자(D D D D)로, E6 진행과 E17 리프 id를 붙인다(§12.4 내부 id 금지).
- **고르지 않은 대안**: 하루 동안 같은 루틴 고정 — 순환 규칙(세션 번호)과 §14.9 시뮬레이션 검사를 바꿔야 한다.

## D-079 모든 연습의 "하는 법" (시작 전에 펼침)
- **원인(실사용 보고 + 감사)**: 리프(E17)를 하는 법을 사용자가 앱 밖에서 찾아봤다. 감사해 보니 연습 시작 전 화면(`ExerciseHost` 대기)에는 시작 버튼뿐이고, 설명은 시작한 뒤에만 연습마다 들쭉날쭉했다(E2·E5·E6·S·E17 위험 높음: 클릭당 몇 번, 통과·사다리 규칙이 요약에만, 곡·E6 패턴이 화면에 없음). 줄 번호(Stage 0부터 쓰고 Stage 4 Q5에서야 설명), 손가락 번호(설명 없음), TAB(Stage 2 리프가 Stage 4 Q5보다 먼저), 뮤트 스트럼·D/U 글자·옥타브 붙은 음 이름도 설명 전에 쓰였다.
- **결정**: `ExercisePlugin.howTo(params)`를 **필수**로 둔다(빠뜨리면 타입 검사 실패). 단계(손·클릭·판정·템포)와 공용 용어(`ko.exercises.guide.terms`, 한 곳 정의)를 돌려주고, `ExerciseHost`가 대기 화면에서 펼쳐(모든 실행 경로가 지남), 실행 중에는 접어서 보인다. 판정·통과 수치는 러너 상수에서 가져와 문구와 기준이 어긋나지 않게 한다(E5 사다리, E6 `ONE_BEAT_PASS_RATIO`, E8, E3, E9–E11, E17, E2 진급 30회 = `PAIR_UNLOCK_CHANGES`).
- **검사**: 등록된 모든 연습의 기본 파라미터와 Stage 0–11 모든 연습 항목의 실제 파라미터로 `howTo`가 비지 않고 용어 id가 사전에 있는지 단위 테스트, E2E-24(리프·E5·E2·Q1 시작 화면), E2E-10/11 화면 목록에 시작 화면 추가.

## D-080 리프: 손가락 번호·TAB 줄 번호·말로 읽기·들어 보기
- **리프 데이터**: `RiffNote.finger`(0 = 개방현), 작성 문법은 스케일 표와 같은 `6:3(3)`. 한 프렛 한 손가락: R1–R3 1포지션(프렛 = 손가락), R4 3포지션(3프렛 = 1번, 5프렛 = 3번). 음·박자 데이터(SPEC v1.1 §6.9 표)는 그대로다.
- **TAB**(공용): 선 옆 줄 번호 1–6, 선택적 마디선(`barSize`)과 6번 줄 아래 손가락 행(`fingers`, TAB 숨김이면 같이 숨김). 시퀀스 연습은 `PlannedNote.finger`로 넘긴다 — E17 리프 데이터, E10 스케일 표, E9 시작 프렛 기준 1-2-3-4, E11 손가락 쌍.
- **말로 읽은 리프**: 마디별 "6번 줄 개방 ×2 → 6번 줄 3프렛(3번 손가락) ×2"를 시작 전 화면에 보이고, TAB 그림(role=img)의 aria-label에도 넣는다.
- **들어 보기(M)**: 준비 단계에서 리프 한 바퀴를 현재 BPM으로 합성(`renderSequence`, karplus-strong; R4 팜뮤트 모델)해 재생한다. `ExerciseOutput.playSamples`가 정지 함수를 돌려주게 바꿨고(기존 호출은 반환값을 무시), 시작·종료·화면 이탈 때 데모를 먼저 멈춰 마이크가 합성음을 판정하지 않는다.

## D-081 홈 "오늘 복습 n개"와 복습 큐 보이기
- **버그(실사용 질문 중 발견)**: 홈의 "오늘 복습 n개"가 루틴 항목 중 `block === 'review'`만 셌다. v1.1은 별도 복습 슬롯을 없애고(D-058) 복습을 같은 종류 블록에 넣으므로(`reviewOf`, 퀴즈의 due 카드) 그런 블록은 없고, 값은 **항상 0**이었다. 진도 화면의 "복습 대기 n개"(due 전체)와 어긋났고, 어떤 항목이 복습인지 화면 어디에도 없었다.
- **결정**: `reviewsServedBy(item, due)` = 항목의 `reviewOf` + Q3/Q4 `focus`의 due 카드 + Q2 `chordClasses`의 due 코드 기억 카드. 홈 수 = 오늘 루틴 항목들의 합(대기가 더 많으면 "(대기 m개)"), 그 항목에 "복습" 배지. 진도 화면은 개수 아래 "지금 복습할 것"(오래 밀린 순, 며칠 지남)과 "다가오는 복습"(다음 5개, 며칠 뒤)을 이름으로 보이고, 복습은 따로 하지 않는다는 안내와 인정 규칙(카드는 어디서 답해도, 나머지는 루틴에서 한 것만 — `derive.ts`의 `reviewOf` 규칙)을 적는다.
- 루틴 생성·복습 간격·판정 규칙은 그대로다.


## D-082 연습곡 숨김 단계: 시작 전엔 악보 보이기, 단계가 오른 첫 실행 안내
- **원인(실사용 보고)**: "세 코드 블루스 할 때마다 바뀌던데 중간에 악보를 가려 버린다". 루틴 곡 블록은 가장 높은 열린 단계를 배정하므로(§7.3-10, §11.10) 학습 → (학습 완주 2회) 연주 → (연주 완주 1회) 숨김으로 곡이 나올 때마다 단계가 바뀌었다. 숨김 단계는 시작 전에도 악보 대신 "악보 숨김"만 보였고, 단계가 올랐다는 안내도, S 하는 법의 숨김 설명도 없었다.
- **결정(사용자 선택)**: 배정 규칙(SPEC)은 그대로 둔다. "숨김 = 연주하는 동안 코드 차트를 가림"으로 읽고, 준비(armed/ready) 단계에서는 악보와 "시작하면 가려져요 · 지금 보고 외워 두세요 · 보며 치려면 H" 한 줄을 보인 뒤 카운트인부터 가린다. 기록은 바뀌지 않는다 — 숨김 판정 `hiddenThroughout`은 원래 `play()` 뒤에 악보가 보였는지만 본다(완주·암기·레퍼토리 그대로).
- **단계가 오른 첫 실행**: `songPlugin.withHistory`가 최근 S 결과 50개(`historyDepth`)에 이 곡·이 단계 실행이 없으면 `firstAtStage`를 켜고(`firstRunAtStage`, v1 결과는 mode·chartHidden으로 단계를 읽음), 준비 단계에 "이번부터 연주/숨김 단계예요" 한 줄을 보인다. H로 단계를 바꾸면 사라진다. 같은 세션의 "이어서 한 번 더"는 방금 실행이 기록에 있으므로 다시 뜨지 않는다. 그 곡의 그 단계 실행이 최근 50개 밖으로 밀렸으면 한 번 더 뜰 수 있다(무해).
- **하는 법**: S `howTo`가 숨김 파라미터면 숨김 단계 문구(시작 전에는 보임)를 쓴다.
- **고르지 않은 대안**: Stage 1–6에서는 숨김을 배정하지 않기(SPEC 배정 규칙 이탈), 단계를 사용자가 고르게 하기(바꿀 곳이 가장 많음).
- **E2E 단언 이동**: `options.mic.spec.ts` S 부분 — H 뒤 "악보 숨김 — 외워서 쳐 봐요" 확인을 Space(카운트인/연주) 뒤로 옮기고, 준비 단계에서는 미리 보기 줄과 악보를 확인한다. 기록 `chartHidden: true` 단언은 그대로다.

## D-083 글자 키는 한글 입력에서도 동작, 숨김 곡 결과 화면에 악보
- **원인(실사용 보고 "H 눌러도 악보가 안 보여")**: `actionForKey`가 `event.key`로만 기본 키를 찾았다. 한글 입력이 켜져 있으면 H는 'ㅗ'(브라우저에 따라 'Process')라서 H·M·B·L·E·V 옵션 키가 모두 무시됐다. E2E는 영문 자판(`keyboard.press('h')`)이라 잡지 못했다. 그리고 숨김 단계 곡을 끝낸 결과 확인 단계에서도 악보가 가려져 있었고 H는 잠겨 있었다(기록 보호, D-065).
- **결정**: 배운 키(`customKeys[code]`) → `DEFAULT_KEYS[key]` → key가 출력 가능한 ASCII가 아니면(자모·'Process'·'Unidentified') 키 위치의 글자(`event.code` KeyH → h)로 찾는다. 라틴 자판은 자기 글자를 그대로 쓴다(Dvorak의 'd'가 KeyH 자리에 있어도 숨김이 아님). 설정의 페달 학습도 같은 `letterOfCode`를 쓴다. 숨김 단계 악보는 연주하는 동안(카운트인·연주·일시정지)만 가리고 결과 확인 단계에서는 보인다 — 숨김 기록은 원래 연주 시간만 본다(`hiddenThroughout`).
- **검사**: `keys.test.ts`(ㅗ/Process/ㅡ/ㅠ + 위치, Dvorak 'd', 배운 키 우선), 곡 `plugin.test.tsx`(결과 화면 악보), E2E `options.mic.spec.ts`가 `KeyboardEvent{key:'ㅗ', code:'KeyH'}`로 단계를 바꾸고 결과 화면 악보를 확인한다.

## D-084 진급 체크리스트: 쌍마다 얼마나 남았는지
- **원인(실사용 보고 "다 만족했는데 진급이 안 됨")**: 체크리스트는 "남은 것: D|E"만 보였고, 홈 "약한 체인지"는 D↔E를 "분당 36회"로 보였다. 앞의 숫자는 최근 실행(짧은 실행 포함)의 가운데값, 진급 규칙은 55초 이상 실행의 날짜별 최고가 30회 이상인 날이 서로 다른 2일(§7.1)이라, 사용자는 조건을 채웠다고 읽었다. 10-16 백업 기준 D↔E는 10-13의 27회 한 번뿐이었다(규칙은 맞게 동작).
- **결정**: 쌍 규칙(`unlockedPairsAtLeast`, `pairsPassedAtLeast`)의 평가에 남은 쌍마다 `{days, needDays, value, best}`를 붙이고, 체크리스트가 "D ↔ E: 30회 넘은 날 1/2일 · 최고 36회 — 다른 날 한 번 더 넘기면 돼요"(1분을 채운 실행이 없으면 그렇게)로 보인다. 홈 "약한 체인지"에는 가운데값이며 진급 기준과 다르다는 한 줄을 단다. 규칙은 그대로다.

## D-085 메트로놈 연습 일시정지 (P)
- **요청(실사용)**: "pause 기능도 있었으면 좋겠어." 범위(사용자 선택): 메트로놈이 도는 연습 전부 — S, E5, E6, E8, E9, E10, E11, E17. 타이머만 있는 연습(E1–E4, E7, E12)은 범위 밖.
- **조작**: P 또는 화면의 "일시정지" 버튼으로 멈추고, P·Space·버튼으로 이어 한다(한 마디 카운트인 뒤). 시퀀스 연습은 일시정지 중 Enter로 그만할 수 있다. 일시정지 버튼에 포커스가 있을 때 Space/Enter는 버튼 자신의 클릭만 일어난다(한 번 누름 = 한 번). 키 표(SPEC v1.1 §12.3)는 고정 파일이라 바꾸지 않고 여기에 적는다: **P = 일시정지/이어 하기, R = 연습곡 처음부터(D-086)**. 키 안내의 "P 일시정지"는 일시정지할 수 있는 연습에서만 보인다. 세션 러너는 실행이 일시정지된 동안 블록 시계를 멈춘다(`holdClock`, 일시정지 화면은 띄우지 않음).
- **시간축**: 한 실행의 마디(시퀀스는 음 칸)를 구간 목록(`exercises/timeline.ts` `Timeline`)으로 둔다. 일시정지 = 메트로놈을 멈추고 구간을 **끊긴 마디(바퀴) 앞에서** 닫는다. 다운비트 뒤 한 박 안에 누르면 앞 마디부터(유예). 이어 하기 = 새 그리드에서 그 마디부터 다시. 마디 번호와 내용(셈여림 짝수/홀수, 시퀀스 묶음·순서·줄)은 실행 전체 기준이라 끊긴 것을 그대로 다시 친다(시퀀스는 끊긴 바퀴의 내용을 새 id로).
- **판정**: 마이크 job은 일시정지 동안에도 켜 둔다 — 워커는 처리 시점의 job을 붙이므로(판정은 스트럼 ~0.4–0.7 s 뒤) 끄면 일시정지 직전의 스트럼을 잃는다. 대신 구간 시간 창으로 거르고, 끊긴 마디에 이미 들어온 이벤트·실시간 마디 표시는 지운다. 채점 슬롯은 각 마디를 그 마디를 친 구간의 그리드에서 한 번씩. 균일도(`ioiCv`)는 구간 안 간격만 모은다(`pooledIoiCv`). 시퀀스 트래커는 `cutAt`으로 끊긴 바퀴를 취소하고 장벽 뒤 첫 청크를 실행의 첫 청크처럼 판정한다(울리던 음·EXTRA 구간이 쉬는 동안을 넘지 않음). 메트로놈 시작이 오디오 컨텍스트를 기다리는 사이의 일시정지·종료는 세대 번호와 epoch로 막는다.
- **기록 규칙(사용자 선택)**: 연습곡 연주·숨김 단계는 **일시정지 1번 = 멈춤 1번**(멈춤 ≤ 2면 완주). 박 1 분석의 멈춤과 합친다(`songStops`: 이미 2마디 넘게 쉬어 멈춤으로 센 직후의 일시정지는 한 번). 그 밖의 연습은 SPEC v1.1 §7.1이 E2에 쓰는 "중간 중단 실행은 기록하되 기준에 쓰지 않는다"를 따라 **일시정지한 실행은 기록·분석하되 사다리 'stay', 통과·졸업·암기 아님**(`countsForCriteria`; E10 `streakBpm` 지표, 졸업 시험 4번, `withHistory`의 previousLow도 제외). 연속 무실수는 일시정지 뒤 첫 바퀴(`resumed`)에서 다시 센다. 요약에 "일시정지한 실행이라 진급 기준에는 쓰지 않아요".
- **기본값(내가 정함)**: 카운트인 중 일시정지는 세지 않는다(친 것이 없음). 일시정지 중 악보·큐·TAB은 연주 중처럼 가리고, 그때 보이게 하면 숨김 기록에서 빠진다. 연습곡 반주는 이어 할 때 그 마디부터 다시 렌더하고(인트로 마디가 카운트인 아래), 측정한 bleed gain을 다시 쓰며, 마스크 도착 시각은 일시정지 시점에서 자른다. E11 하루 상한·시간은 BaseRunner 타이머로 일시정지 시간을 뺀다.
- **범위 밖(제안)**: 화면을 떠나거나 오디오가 끊길 때 자동 일시정지.

## D-086 연습곡 처음부터 (R)
- **요청(실사용)**: 치는 중에 처음부터 다시. R 또는 "처음부터" 버튼(카운트인·연주·일시정지 중). 연주·숨김 단계는 이번 시도를 버리고(멈춤·일시정지·분석 초기화, 기록 안 함) 카운트인부터 다시. 학습 단계는 지금처럼 멈춤을 누적하며, 연주 중에 누른 경우만 멈춤 1번(Space로 멈추고 "다시"와 같은 규칙). 대기 중인 이어 하기는 취소된다.

## D-087 UI 개편: 앰프 톤, 하단 탭바·사이드바, 연습 집중 모드
- **요청(사용자)**: "우리 UI를 좀 더 잘 만들어 보자." 범위(사용자 선택): 디자인 시스템과 앱 셸, 홈, 연습·세션 러너, 커리큘럼·진도. 톤은 "따뜻한 앰프 톤", 내비게이션은 "하단 탭바 + 집중 모드".
- **원인(캡처 18화면 × 4뷰포트)**:
  - 상단 7개 링크가 iPhone에서 두 줄로 줄바꿈되고, 연습 중에도 메뉴가 보였다(손이 기타 위에 있을 때 잘못 누름).
  - 모든 화면이 `max-w-3xl`라 1순위 기기인 iPad 가로(1180)에서 양옆이 비었다.
  - 홈 루틴의 분 칸이 "2 / 분"으로 줄바꿈됐다(flex 자식에 `shrink-0` 없음).
  - 같은 카드 클래스 문자열이 36개 파일에 직접 쓰여 있었다.
- **팔레트(`src/app/styles.css`)**:
  - 다크(기본): 차콜 바탕 #15110e, 앰버 accent #f59e0b. 라이트: 크림 바탕 #faf6f0, 구릿빛 accent #a3480a. 고대비: 이전 값 유지.
  - 새 토큰: `--border`와 상태 tint(`accent-soft`, `ok-soft` 등, `color-mix`로 surface 위에서 만든다).
  - 모든 텍스트 토큰이 bg·surface·surface-2·각 tint 위에서 4.5:1 이상이다. 가장 낮은 값은 라이트 accent on surface-2의 4.87이고, 정한 뒤 계산으로 확인했다.
  - retry(노랑)는 accent(앰버)와 명도로 구별하며, 상태는 늘 문구·아이콘과 함께 쓴다.
  - focus는 앰버 버튼 위에서도 보이도록 하늘색이다.
  - theme-color, 매니페스트, 앱 아이콘(`tools/icons/generate.ts`)도 같은 팔레트로 바꿨다.
- **공통 컴포넌트(`src/ui`)**:
  - `Card`는 `.card` 클래스를 유지한다(고대비 외곽선 훅).
  - `Button` 리프레시. `large`는 여전히 `min-h-16`이다(레이아웃 검사가 이 클래스로 찾는다).
  - `ButtonLink`(같은 모양의 링크 4벌을 대체), `Badge`, `ProgressRing`, `Stat`, `EmptyState`, 인라인 SVG `Icon`(의존성 없음)을 추가했다.
  - `Screen`에 `width`(narrow 3xl / wide 6xl)와 `eyebrow`를 추가했다.
  - 폰트는 시스템 폰트를 유지한다. CSP `font-src 'self'`이고 오프라인 PWA라서다.
- **내비게이션**:
  - 랜드마크 하나(`AppNav`)가 `lg`(1024) 미만에서는 하단 고정 탭바, 이상에서는 왼쪽 사이드바다. 하단 탭바는 iPhone과 iPad 세로, 사이드바는 iPad 가로와 MacBook이다.
  - 탭은 5개: 오늘·커리큘럼·도구·진도·설정. 도구는 새 화면 `/tools`(튜너·메트로놈·코드 라이브러리)이고, 사이드바에는 도구 아래에 세 하위 링크를 바로 둔다.
  - 기존 경로는 그대로다. 하위 화면은 경로 접두어로 부모 탭을 밝힌다(`aria-current="true"`). 브랜드는 h1이 아니다(화면마다 h1은 하나).
- **집중 모드**:
  - `/practice/:type`, `/session`, `/curriculum/:stage/practice/:option`은 내비게이션 없이 `FocusScreen`(나가기 · h1 · 상태 슬롯)으로 그린다.
  - **실행 중에는 "나가기"가 비활성**이다(`onActiveChange`). 잘못 누름 한 번에 실행을 잃지 않게 하려는 것이고, 중단은 지금처럼 Esc 확인이다.
  - 나가기는 단독 연습이면 앱 안 이전 화면(처음 연 화면이면 홈), 단계 연습이면 그 단계, 세션이면 "세션 끝내기"와 같은 자가 평가로 간다.
  - 헤더는 sticky가 아니다. 고정 헤더가 스크롤한 연습 화면의 버튼을 가리지 않게 하려는 것이다.
- **화면**:
  - 홈: 날짜 + "오늘", 배너(분할 이어 하기는 accent), 루틴 히어로(블록 종류 점이 있는 타임라인, 분 칸 줄바꿈 수정, "연습 시작"은 목록 위 — iPhone 첫 화면에서 목록 아래면 탭바에 가린다), Stat 타일 3개(문구는 "이번 주 35분"·"오늘 복습 2개"로 그대로 읽힘), 진급 링.
  - 세션: 항목 진행 막대, 블록 이름, 큰 항목 제목.
  - 연습: 결과 카드, E5·E6·E8 BPM을 vh 크기로 키움.
  - 커리큘럼: 초급 1·2 두 묶음의 세로 로드맵(✓ 통과 / 현재 단계 링 / 예정)과 그 사이 졸업 시험 마일스톤.
  - 진도: Stat 줄, 차트 테마, 빈 상태, 패턴은 id 대신 스트럼 글자, 히트맵 숫자는 바탕색 글자로 tint 양 끝에서 읽힘.
- **고르지 않은 대안**:
  - 지금 슬레이트 팔레트를 정돈만 하기, 미니멀 고대비(라임). 사용자가 앰프 톤을 골랐다.
  - 상단 내비를 압축해 유지하기. 사용자가 탭바를 골랐다.
  - 연습 중 "나가기"를 누르면 확인을 묻기. 비활성 + Esc 확인 쪽이 키 흐름(Space/Enter가 포커스된 버튼을 누르는 규칙)을 바꾸지 않는다.
  - 웹 폰트(Pretendard) 번들. 크기와 오프라인 캐시 부담에 비해 Apple 기기의 시스템 폰트로 충분하다.
- **검사**:
  - `tests/e2e/support/screens.ts`에 `tools` 화면을 더해 레이아웃(가로 스크롤 0, 64 px 버튼)과 axe(3테마) 대상에 넣었다.
  - testid·목록 구조(`routine-items`의 항목당 `li` 하나), `reviews-today` 정확 문구, autofocus 흐름은 그대로다.

## D-088 UI 마감 goal 키트 (`docs/goal/ui/`)

- **요청(사용자)**: "너는 UI 전문가야. 그거에 맞춰서 알아서 해 줘. goal로 세팅해서 돌리자." D-087 위에서 앱 전체 UI를 자율 실행(`/goal`)으로 마감한다.
- **원인 관찰**(키트 작성 중 측정):
  - fullPage 스크린샷만 보면 고정 탭바가 첫 화면에서 가리는 것을 못 본다. 홈 "연습 시작"이 iPhone 첫 화면에서 탭바 밑에 있었다(D-087에서 목록 위로 옮김).
  - 측정한 기준 문제(PROGRESS 표):
    - 주 조작이 첫 화면 밖: 단계 화면, E9·E11 실행 중(iPad 가로), 루틴 편집 저장, iPhone의 E1·E2·E3·S
    - 핵심 숫자가 기준보다 작음: E5 BPM 7–10 %, iPad 세로 타이머 13.6 %
    - 셀렉트 23 px, 슬라이더 16 px
    - `word-break: normal`
    - 넓은 화면의 52–55em 문단
    - 필드 경계 대비 1.4–1.5:1
- **결정**:
  - SPEC(`docs/goal/ui/SPEC.md`)과 고정 테스트 3개(`ui-quality.spec.ts`, Chromium 전용 `ui-quality.chromium.spec.ts`, `ui-rules.test.ts`)를 해시로 묶는다. 기존 `layout.spec.ts`·`a11y.spec.ts`·`support/screens.ts`도 함께 묶는다. 실행자가 게이트를 낮추지 못하게 하기 위해서다.
  - 측정 가능한 것은 테스트로 만든다(UQ-1–UQ-10, UR-1–UR-2):
    - 첫 화면 주 조작(`data-primary-action`)
    - 핵심 숫자 15–25 %(`data-core-number`, `BigTimer`·`BigBpm`에 표식을 미리 단다)
    - 터치 타깃 44 px
    - 한국어 `keep-all`
    - 포커스 표시
    - reduced motion
    - 색·투명도 전환 금지(D-087 교훈)
    - 줄 길이 48em
    - 필드 경계 3:1(WCAG 1.4.11, axe가 보지 않음)
    - 토큰 색만
    - safe area 4면
  - 측정할 수 없는 것(위계, 일관성, 상태 표현, 거리 가독성)은 UI_AUDIT의 휴리스틱 감사와 "fold·full 그림을 둘 다 본다"는 검토 루프로 다룬다.
  - Chromium 전용 검사는 `test.skip` 대신 파일 이름 `*.chromium.spec.ts`와 `playwright.config.ts`의 CHROMIUM_ONLY 목록으로 나눈다(§14.6-3: skip 금지).
  - E2E 포트를 `E2E_PORT`·`PROD_PORT` 환경 변수로 바꿀 수 있게 했다. 다른 체크아웃의 preview가 4173을 쓰고 있어서다(기본값은 그대로).
  - `npm run ui:shots`(`tools/ui/`)를 둔다. SCREENS의 준비 상태를 3테마 × 4뷰포트로 찍고, 첫 화면과 전체를 따로 저장한다.
- **고르지 않은 대안**:
  - 게이트 없이 감사만: 실행자의 판단만으로는 끝 조건이 흐려진다.
  - 실행자가 게이트 테스트를 직접 작성: 자기 작업을 채점하는 테스트는 약해지기 쉽다(vault 교훈 2026-10-07).
  - 시각 회귀 스냅샷(픽셀 비교): 이번 목표는 "바꾸는 것"이라 기준 그림이 계속 바뀐다.
- **고정 전 독립 리뷰**(architect 서브에이전트, 반영함):
  - UQ-1/2 표식은 무엇을 감싸든 통과했다(예: "나가기"를 감싸도 통과). 그래서 화면별로 담아야 할 조작(`PRIMARY`)을 고정하고, 나가기·마치기·세션 끝내기·내비는 담지 못하게 했다. 출력 접두도 UQ-1과 UQ-2로 나눴다.
  - `openScreen`이 h1만 기다려서 두 가지 문제가 있었다. 데이터를 불러오는 화면의 빈 틀을 쟀고, 첫 홈 방문이 온보딩으로 넘어간 것을 홈으로 쟀다.
    - `Screen`·`FocusScreen`에 `busy`(`aria-busy`)를 더해 로딩 틀을 표시한다(홈, 커리큘럼, 단계, 시험, 진도, 설정, 루틴 편집, 세션, 단계 연습).
    - `openScreen`은 busy가 없을 때까지 기다리고, 온보딩으로 넘어가면 다시 연다. 기존 E2E-10·11도 이제 실제 홈을 잰다.
  - UQ-6 수정:
    - box-shadow를 포커스 표시로 인정하지 않는다. 버튼의 상시 그림자가 통과시켰기 때문이다.
    - 세 테마 모두 검사한다.
    - 그 결과 고대비 테마의 결함을 찾았다. `[data-theme="contrast"] button { outline: 1px }`가 `:focus-visible`의 3 px outline을 덮는다.
  - 그 밖의 검사 수정:
    - UQ-3은 표식 안의 가장 큰 글자 크기로 잰다.
    - UQ-8은 속성과 길이를 위치로 짝짓는다.
    - UQ-10은 oklab·oklch 계산값도 읽는다.
  - 조건문 수정:
    - `main` 해시를 고정한다.
    - `feat/practice-feedback`은 다른 체크아웃에서 쓰이는 브랜치라 값을 비교하지 않는다.
    - 마지막 순서를 정했다: 마지막 커밋 → 그 HEAD에서 verify → 추적 파일 수정 없이 출력.
    - UI_AUDIT 범위표 행 수(111)와 ui-rules 결과를 출력하게 했다.
  - 스크린샷은 `ui-shots/`(E2E가 비우는 `test-results/` 밖)에 둔다. 빌드는 `dist-shots/`에 해서 E2E 빌드와 겹치지 않게 했다. 시작 전 그림은 `ui-shots/before/`다.
  - 리뷰 중 찾은 실제 사용 결함: 시퀀스 연습(E9·E10·E11·E17)의 준비 상태는 Space로만 시작된다. iPad 터치로는 시작할 수 없다. `practice-E17-ready`의 UQ-1이 터치 시작 조작을 요구한다(SPEC §4.2).
- **검사**: 키트 기준 측정값은 PROGRESS 표에 있다. UQ-7·8과 UR-1·2는 통과, 나머지는 위 문제를 잡는다. D-087 커밋에서 기존 E2E 83개가 통과했다.

## D-089 UI 마감 U1 기반: 한국어 줄바꿈, 필드, 포커스, 로딩 자리표시
- **맥락**: UI 마감 goal(`docs/goal/ui/SPEC.md` §4.1, §7 U1). 키트 기준 측정에서 UQ-4 36, UQ-5 1093, UQ-6 162, UQ-10 24개 문제(PROGRESS 표). 시작 전 그림은 `ui-shots/before/`, 초기 발견은 `UI_AUDIT.md` §3 F-01–F-20.
- **한국어 줄바꿈**(UQ-5): `body`에 `word-break: keep-all`과 `overflow-wrap: break-word`. 어절 사이에서만 줄이 바뀌고, 한 줄보다 긴 어절만 쪼갠다.
  - `anywhere`를 고르지 않은 이유: min-content 너비까지 줄여서 flex 안의 버튼·칸이 낱말 가운데서 쪼개지며 좁아진다. `break-word`는 낱말 너비를 지킨 채 다음 줄로 넘긴다.
  - 제목·legend·summary는 `text-wrap: balance`, 문단·목록은 `text-wrap: pretty`(한 글자 고아 줄 방지). 둘 다 base 레이어라 유틸리티가 이긴다.
- **문단 폭**(UQ-9): `p { max-inline-size: 48em }`(base 레이어). em은 그 문단 자신의 글자 크기라 큰 글자 문단도 48자 폭에서 끊긴다.
- **타이포 단계**: Tailwind 기본 단계(12·14·16·18·20·24·30·36·48 px)만 쓰고, 그 밖의 크기는 연습 화면의 핵심 숫자(vh 기반 clamp)뿐이다. 새 단계 값을 정의하지 않은 이유: 이미 모든 화면이 이 단계를 쓰고 있어, 값을 바꾸면 화면 전체의 높이가 흔들릴 뿐 위계가 나아지지 않는다. 연습 중 지시문 18 px 이상은 U2에서 화면별로 맞춘다.
- **필드**(UQ-4, UQ-10, `src/ui/Field.tsx`):
  - 새 토큰 `--field-border`(`border-field`): 다크 #8b7a69, 라이트 #857463, 고대비 #ffffff. bg·surface·surface-2 위에서 다크 4.55·4.18·3.56, 라이트 3.84·4.13·3.34:1로 3:1을 넘는다. 장식용 `--border`는 그대로 둔다(카드 경계는 비텍스트 대비 대상이 아니다).
  - `FIELD_CLASS`: 높이 48 px, 바탕은 `bg`(카드 안에서 한 단 들어간 우물), 비활성 50 %, `aria-invalid`면 fail 색 경계.
  - `Select`: WebKit은 기본 모양의 select 높이를 무시한다(iPad·iPhone 23 px). `appearance: none`과 셰브런 아이콘(`chevronDown`)으로 직접 그린다. CSP(`style-src 'self'`) 안에서 테마 색을 따르려고 배경 이미지 대신 아이콘 요소를 겹친다.
  - `Field`(라벨 → 조작 → 도움말), `Choice`(체크박스·라디오 한 줄 전체가 48 px 터치 대상), `TextInput`, `TextArea`. 6개 화면의 셀렉트, 숫자 입력, 체크박스·라디오를 모두 바꿨다. 접근 가능한 이름은 그대로다(라벨 문구·구조 유지).
  - 슬라이더: `appearance: none`, 44 px 높이 히트 영역, 6 px 트랙(`--field-border`), 28 px 앰버 손잡이. 라이트 테마의 시스템 파란 슬라이더(F-13)도 사라진다.
  - 숨긴 파일 입력(설정 → 가져오기)은 `tabIndex=-1`: 1 px짜리 포커스 정거장은 포커스 링을 보여 줄 수 없고, "가져오기" 버튼이 같은 일을 한다.
- **포커스**(UQ-6): 고대비 외곽선 훅을 `[data-theme="contrast"] :where(.card, button)`(특이도 0,1,0)로 낮추고, 포커스 링을 `:root :focus-visible`(0,2,0)로 올렸다. 고대비 훅(카드·버튼 1 px 외곽선)은 그대로 유지된다.
- **로딩 자리표시**: `Screen`·`FocusScreen`이 `busy`이고 내용이 없으면 `LoadingPlaceholder`(카드 모양 블록 3개, 화면 읽기용 "불러오는 중이에요")를 그린다. 움직이지 않는다(반짝임 애니메이션은 UQ-7·8과 충돌). 문구 하나(`ko.app.loading`)를 더했다.
- **아이콘**: `chevronDown`, `pause`, `alert`를 더했다(의존성 없음).

## D-090 UI 마감 U2: 연습 화면 공통 뼈대(`PracticeStage`)
- **맥락**: SPEC §4.2, §7 U2. 시작 전에는 2단이 E1·E2·E3·Q1뿐(`md`, iPad 세로도 2단)이었고, 나머지는 넓은 화면에서 한 줄로 늘어졌다. 주 버튼이 iPhone 첫 화면 밖(E1·E2·E3·S), TAB이 넓은 화면을 가득 채워 자가 평가 버튼이 밀림(E9–E11), 시퀀스 준비 상태는 Space로만 시작(F-01–F-07, F-14).
- **결정**: 모든 연습 뷰와 `ExerciseHost`의 시작 화면을 `src/exercises/ui/PracticeStage.tsx` 하나로 그린다.
  - 슬롯: `figure`(보고 치는 그림: 다이어그램·TAB·패턴·사진·문제) · `children`(패널: 핵심 숫자·지시·상태) · `primary`(다음에 누를 한 결정 = `[data-primary-action]`) · `secondary`(그 옆 조작) · `tools`(가끔 쓰는 조작: TAB 숨기기·시퀀스 마치기) · `notes`(하는 법 요약·모드·키 안내).
  - `lg`(1024) 이상 2단: 왼쪽 그림, 오른쪽 패널 → 행동 막대 → 도구 → 안내. 마지막 행만 `1fr`이라 그림이 길어도 패널과 버튼은 위에 붙는다.
  - `lg` 미만 1단: 행동 막대가 `position: sticky; bottom: 0`(SPEC §2.3이 허용한 방식)으로 화면 아래에 붙는다. 막대가 단(section)의 flex 항목이라야 단 전체 높이에서 붙는다(그리드 칸이나 감싼 div 안에서는 그 칸 안에서만 움직인다). 퀴즈는 답 목록 자체가 내용이라 붙이지 않는다(`stickyActions={false}`, 막대가 화면 절반을 덮는 것을 피함).
  - TAB(시퀀스 E9·E10·E11·E17)은 `figureSpan="full"`: TAB이 위쪽 전폭, 그 아래 2단(왼쪽 하는 법·말로 읽은 리프, 오른쪽 상태·주 조작). TAB은 왼쪽에서 오른쪽으로 읽는 시간축이라 반 폭에 넣으면 E10(20음)의 숫자가 14 px로 줄어든다. 대신 짧은 TAB(E9의 4음)이 화면을 채우지 않도록 `Tab`의 확대를 2.5배로 묶었다(숫자 약 32 px).
  - 일시정지(D-085)는 `RunControlsContext`로 무대에 건넨다: 멈춘 동안은 "이어서"가 다음 단계(주 조작), 진행 중에는 뷰의 조작 옆. 일시정지 배지·마이크 피드백도 패널 안에 둔다.
  - 시작 화면: 왼쪽 "하는 법"(열린 채, D-079), 오른쪽 "준비되면 시작해요"와 마이크 선택 설명, 시작 버튼이 주 조작.
- **핵심 숫자**: `BigTimer` 18vh, `BigBpm` 16vh(둘이 나란히 들어가게), E2 체인지 수 16vh에도 `data-core-number`. clamp의 상한을 15rem·13rem으로 올렸다(iPad 세로 1180에서 10rem은 13.6 %였다). BPM 단위는 숫자의 비율이 아니라 단계 크기(30 px).
- **시퀀스 터치 시작**: 준비 상태에 "시작"(`seq-start`, `toggle` 명령 = Space와 같음)을 더했다(SPEC §2.3이 새 기능이 아니라고 명시). 준비 안내도 "시작 버튼이나 Space로…"로 바꿨다.
- **"마치기" 두 개(F-31)**: 꼬리의 `exercise-finish`는 실제로 `abort`(Esc, 확인 "연습을 중단할까요?")라서 문구를 "중단"으로 바꿨다. 시퀀스 무대의 "마치기"(`seq-finish`, 마지막 바퀴를 판정하고 끝냄)는 그대로다. `finishRunFirst` 안내 문구도 "중단"으로 맞췄다. 동작은 둘 다 그대로다.
- **그 밖**: 다이어그램은 휴대폰에서 192 px(`PRACTICE_DIAGRAM`)로 줄여 그 아래 지시문이 첫 화면에 들어오게 했다. 퀴즈 답은 왼쪽 정렬, 답한 뒤 맞은 답 ✓·고른 오답 ✗를 색과 함께 표시한다(H6). 곡 반주·이어폰·완주·외움 토글은 주 버튼(앰버) 대신 눌림 표시(체크 아이콘 + accent 테두리)로 바꿔 시작 버튼과 경쟁하지 않는다(F-15). 시퀀스 제목의 "· 60 BPM"은 줄바꿈되지 않는 한 덩어리다.
- **고르지 않은 대안**:
  - TAB을 여러 줄로 나눠 반 폭에 넣기: 기존 테스트가 TAB의 줄 번호 6개·마디선 개수를 세고(`howto.spec.ts`, `Tab.test.tsx`), 줄을 나누면 단언을 바꿔야 한다.
  - 휴대폰에서 `fixed` 하단 막대: E2E-10이 `fixed` 막대 안 버튼을 빼고 재므로 SPEC §2.3이 막는다.
  - 결과 화면까지 2단: 결과 → 다음 할 일 순서로 읽히는 요약 카드는 한 단이 더 읽기 쉽다.
- **U2 독립 리뷰**(code-reviewer 서브에이전트, 읽기 전용): 금지된 동작 변화는 없음(모든 버튼→명령 대응, 키, autofocus, testid, aria-live를 옛것과 대조). 지적과 처리:
  1. **High — 일시정지 버튼의 포커스 유실**: 진행 중에는 보조 조작 쪽, 멈춘 동안에는 주 조작 영역으로 부모가 바뀌어 React가 버튼을 다시 만들고 포커스가 `body`로 떨어졌다(곡은 매번, 시퀀스는 카운트인→진행에서). → 행동 막대가 뷰 조작 칸과 일시정지 칸을 **고정된 DOM 자리**에 두고, `data-primary-action` 표식과 `order-first`(보이는 순서)만 옮긴다. 회귀 E2E를 더했다(`pause.spec.ts` "the focused pause button keeps the focus…").
  2. Medium — `cond && <X/>`의 `false`가 `!= null`을 통과해 빈 막대·빈 칸이 생김 → `filled()`로 `false`·`''`도 빈 칸으로 본다.
  3. Medium — 퀴즈에서 답한 뒤 "다음"이 주 영역 밖·답 위에 있어 답이 밀리고 포커스 순서가 거꾸로였다 → 판정과 "다음"을 답 목록 뒤, 같은 주 영역 안에 둔다.
  4. Low — 시퀀스 자가 판정 안내 `selfNote`가 빠졌다 → 되살렸다(v1.1 §12 문구 유지).
  5. Low — 시퀀스의 `primary ??`가 `false`도 덮어쓸 수 있었다 → `primary !== undefined`로 명시.
  6. Low — 중단 확인 카드가 무대 위로 옮겨져 휴대폰에서 화면 밖일 수 있었다 → 열릴 때 `scrollIntoView`와 대화상자 자체에 포커스(“예” 버튼이 아니라: Space가 그 버튼을 누르면 키 흐름의 "계속"과 반대가 된다).
  7. Low — 하는 법이 없거나 E16 위치가 없을 때 빈 왼쪽 칸 → 그림이 없으면 한 단(`max-w-3xl`)으로, E16 카드는 위치가 있을 때만.
  8. Low — 평가 질문(패널)과 답 버튼(막대)이 떨어짐 → 주 영역에 `role="group"`과 질문을 `aria-label`로(`primaryLabel`: E1·E5·E6·E8·E11·E12).
  9. Low — 일관성: `!important` 덮어쓰기 대신 `Button`의 `selected`(accent·ok·fail) 상태를 만들었다. 멈춤 버튼은 곡·시간 연습 모두 보조 모양(연주를 끊는 조작이라 권하지 않음). 연습 화면 키 안내 14 px → 16 px. 반경 규칙: 담는 것(카드·그림 판)은 `rounded-2xl`, 그 안의 칸·버튼은 `rounded-xl`.
  10. Low(기존 동작) — 꼬리 "중단" 버튼은 Esc와 달리 확인 없이 중단한다. U2 이전부터 그렇고 동작 변경은 범위 밖이라 그대로 둔다(FINAL_REPORT 알려진 한계).

## D-091 UI 마감 U3: 세션 러너의 위계
- **맥락**: SPEC §4.3, §7 U3. 세션 준비 상태의 주 조작은 U2의 시작 화면(하는 법 왼쪽, 시작 오른쪽·휴대폰에서는 아래에 붙음)으로 이미 첫 화면에 들어온다(UQ-1 session 0). 남은 것은 실행 사이의 상태들이다.
- **결정**:
  - **실행이 끝난 뒤**: "다음 항목 (Enter)"이 주 조작(앰버, 첫 자리, autofocus 그대로)이고 "이어서 한 번 더"·"같은 템포로 다시"·"n BPM으로 다시"는 보조 모양이다. 키(Space = 다시, Enter = 다음)는 그대로다. autofocus가 "다음 항목"에 있는데 "이어서 한 번 더"도 앰버라 두 개가 다음 할 일처럼 보였다.
  - **블록 전환 화면**: 남은 초를 16vh 핵심 숫자로(카운트인과 같은 역할, `data-core-number`), "다음 블록 · 워밍업"은 accent 강조, "바로 시작"이 주 조작. 문장("5초 뒤 시작")은 화면 읽기용으로 남기고 큰 숫자는 `aria-hidden`.
  - **세션 일시정지**: retry 톤 카드에 일시정지 아이콘과 큰 제목, "계속하기"는 큰 주 버튼(autofocus 그대로).
  - **자가 평가(세션 끝)**: 질문 제목 24 px, 슬라이더 값 라벨 18 px, 위험 증상 legend, "저장하고 끝내기"가 주 조작.
  - 다음 항목 안내·실행 중 안내 16 px.
  - 촬영 도구에 SCREENS 밖 상태용 `tools/ui/states.spec.ts`(+ `states.config.ts`)를 더했다: 연습 결과, 시퀀스 일시정지, 세션 실행 뒤·블록 전환·일시정지·자가 평가. `ui-shots/states/`에 같은 fold·full 쌍을 남긴다.
  - 연습 결과(요약 카드와 다음 할 일)는 넓은 화면에서도 가운데 한 단(`max-w-3xl`)으로 읽힌다(결과 → 다음 할 일).

## D-092 UI 마감 U4: 앱 화면의 다음 할 일
- **맥락**: SPEC §4.4, §7 U4. UQ-2는 앱 화면(온보딩·홈·단계·튜너·메트로놈·루틴 편집)에 주 조작 표식이 없어 28개였다. 감사: F-03(단계 화면의 연습 시작이 맨 아래), F-04(루틴 저장이 첫 화면 밖), F-16(튜너), F-18, F-19, F-21, F-24, F-27, F-29, F-30.
- **결정**:
  - **홈**: "연습 시작"(또는 분할 이어 하기가 있으면 "이어서 하기")만 `data-primary-action`이고 앰버다. 첫 설정 배너의 "처음 설정 시작"은 보조 모양으로 내렸다(F-29). 분할 이어 하기가 있을 때 "연습 시작"은 보조 모양.
  - **단계 화면**: 요약 바로 아래 "먼저 해 볼 연습" 카드 — 그 단계의 연습 목록에서 지금 할 수 있는 첫 항목과 "바로 하기"(`stage-practice-now`). "여러 개 골라 세션으로"는 아래 목록으로 내려 준다(`scrollIntoView`, 부드러운 스크롤 없음). 목록·체크박스·"고른 n개로 세션 시작"은 그대로다. 새 추천 로직을 만들지 않고 목록의 첫 가능 항목을 쓴 이유: 목록 순서가 커리큘럼의 배우는 순서라 그 자체가 추천이고, 판정·진급과 무관한 표시만 바뀐다.
  - **튜너**: lg 이상 2단(왼쪽 큰 음 이름·cents·바늘·방향, 오른쪽 켜기/끄기·줄 선택·레벨). 줄 선택 칩은 주 버튼 모양 대신 눌림 표시(`Button selected`)라 "튜너 켜기"와 경쟁하지 않는다(F-16). 켜기 전에는 빈 막대 대신 안내 한 줄.
  - **메트로놈**: BPM을 16vh 핵심 숫자로(`data-core-number`, 도구 화면에 달았으니 같은 15–25 % 기준), ±5·±1, 슬라이더, 박 점, 시작/정지(주 조작) + 탭 템포를 한 카드에. 설정과 템포 사다리는 오른쪽 단. 사다리의 "통과 — 다음 단계로"는 보조 모양(앰버는 시작/정지 하나).
  - **루틴 편집**: 항목마다 카드(블록 · 이름 · 분, 분은 줄바꿈 없음), 조작 줄. 저장·초기화·취소와 총 시간을 담은 막대가 하단 탭바 바로 위에 붙는다(`sticky`, 탭바 높이 + safe area; 사이드바 화면에서는 창 아래).
  - **온보딩**: 6단계 진행 막대(세션 머리와 같은 모양), "마이크 허용"·"마이크 없이 쓰기"가 주 영역, "나중에 하기"는 밖.
  - **라이브러리**: 단계별 줄 대신 한 격자(단계 순), 타일 아래 "Stage n · 수준". 넓은 화면 첫 화면에 코드 12개가 보인다(F-27).
  - **코드 상세**: 다이어그램 카드 / 기대 음·확인 가능한 줄을 칩으로, "이 코드로 정밀 체크(E1)"가 주 버튼, "코드 목록"은 뒤로 아이콘이 있는 고스트 링크(F-21).
  - **시험**: 항목마다 번호(통과하면 ✓) · 내용 · 시작 버튼을 한 줄로, 실행은 그 아래 전폭(F-24).
  - **진도**: 코드 × 줄 표의 이름 칸 고정 폭(`table-fixed`, F-19).
  - **진급 기준 문구**: 스케일 id 대신 스케일 이름(F-30).
  - 문구 추가(표시 상태용): `curriculum.practice.quickTitle`·`pickMany`, `tuner.idle`, `settingsScreen.groups`, `recording.progress`.
  - 튜너 바늘: 48 px 높이, 통과 구간 tint, −50·0·+50 눈금 글자(방향을 색 없이도 읽음). 레벨 미터 기준선 글자 14 px.

## D-093 UI 마감 U5: 폼·도구 화면과 테마 패리티
- **맥락**: SPEC §4.5, §4.6, §7 U5. 감사 F-23(진단·녹음 키트의 흩어진 모양), F-25(설정 한 카드에 모든 설정), F-28(녹음 진행), F-36(고대비에서 `bg-surface` 칸 경계 사라짐).
- **결정**:
  - **설정**: 위쪽 바로가기(진단·캘리브레이션·녹음 키트)는 `ButtonLink` 줄(`nav`), 마이크 안내는 info 카드. 설정을 "화면"(테마·헤드 모양·왼손잡이), "판정"(엄격도·감도는 넓은 화면에서 2열, x줄 확인·마이크 없이 쓰기), "연습·세션"(시각 전용 메트로놈·블록 전환·세션 길이) 세 카드로 나눴다. 키·페달 표는 줄 구분선과 회색 기본 키, 백업·초기화도 같은 `Card`/`CardHeader`. 라벨·testid·순서(테마 라디오 이름)는 그대로라 테스트와 화면 읽기 흐름이 같다.
  - **진단**: 환경 안내(info 카드) → 마이크 카드(상태·켜기/끄기·레벨·장치 선택) → 트랙 설정 카드 → 캘리브레이션 카드(판정기 버전 포함, 다시 하기 `ButtonLink`). `EnvironmentGuide`는 온보딩과 진단이 같이 쓰는 info 카드가 됐다.
  - **녹음 키트**: "14개 중 n개 녹음했어요" 진행 줄, 녹음한 항목은 ✓ 아이콘(화면 읽기용 ✓ 문자 유지), 항목은 카드.
  - **고대비 칸 경계**(F-36): 고대비의 `--surface`는 바탕과 같은 검정이다. 카드·버튼만 외곽선 훅이 있어 코드 차트·패턴·줄 상태·문제 카드 같은 칸은 경계가 사라졌다. `[data-theme="contrast"] :where(.bg-surface, .bg-surface-2):where(:not(button, a, .card))`(U6 코드 리뷰가 문서와 코드의 차이를 찾아 고침)에 1 px 안쪽 외곽선(`outline-offset: -1px`)을 준다. `:where`라 특이도가 낮고, 포커스 링(`:root :focus-visible`)이 계속 이긴다.
  - **온보딩 단계**: 설명 문단 18 px, 줄·템플릿 진행 칸은 토큰 tint(ok-soft·accent-soft)와 현재 칸 accent 테두리(투명도 덧칠 대신).

## D-094 UI 마감 U6: 독립 리뷰 두 개의 처리와 마감
- **맥락**: SPEC §7 U6, AC-UD2. U5 커밋(`afd095e`)을 기준으로 독립 리뷰 서브에이전트 두 개를 읽기 전용으로 돌렸다: 코드 리뷰(`git diff cae46b0..HEAD -- src tools tests`, U3–U5 중심)와 UI 리뷰(스크린샷, 37화면 iPad 가로 다크 전부 + 연습 화면 iPhone 전부 + 테마·뷰포트 표본 + 상태 그림). 같은 때 실행자의 전 화면 재검토가 F-40–F-43을 찾았다.
- **결정**:
  - **실행 중 "나가기"는 확인을 묻는다**: D-087은 실행 중 "나가기"를 비활성으로 두고 이유를 `title`에만 적었다(터치에서는 안 보임). 이제 실행 중인 연습이 `useExitGuard`로 "그만할까요?"(Esc와 같은 질문)를 등록하고, 잠긴 "나가기"는 그 질문을 연다. 비활성은 가드가 아직 없는 순간(마이크를 켜는 동안)뿐이다. `active`의 뜻(세션의 건너뛰기·끝내기 잠금, `keys.spec.ts` AC-U2)은 그대로다. SPEC §2.3의 "키보드로만 되던 동작에 터치 조작을 더하기"에 해당한다. 회귀 E2E를 더했다(`keys.spec.ts` "during a run "나가기" asks the same question as Esc…").
  - **시작 전 큰 숫자**: 시간 연습(E2·E3·E4·E7·E12)은 runner가 타이머를 시작하기 전 남은 시간이 없어 큰 숫자가 비었다. `BigTimer`가 그때 계획 길이(`params.durationMs`)를 보여 준다. 판정·타이밍은 그대로다(표시만).
  - **결과 머리줄**: 연습 요약의 첫 줄(결과 한 구절)을 `RESULT_HEADLINE`(30–36 px) 하나로. E2는 뜻 한 줄과 "센 횟수 → 고친 횟수"(전에는 "자동 n회 → 보정 n회", 탭 세기에서도 "자동"이라 오해).
  - **한 단 화면은 헤더 왼쪽 끝에**: 결과·기록 안 함·저장 실패·자가 평가·그림 없는 연습 무대가 가운데 정렬이라 헤더("나가기")와 왼쪽 끝이 둘이었다. `max-w-3xl`(자가 평가 `max-w-2xl`) 한 단을 왼쪽에 맞춘다. D-090의 "결과는 가운데 한 단"을 바꾼다.
  - **제목 줄바꿈(`Phrases`)**: 항목 제목("스트러밍 패턴 사다리 · D D D D · 60 BPM")은 " · " 단위로만 줄을 바꾸고 구분점은 줄 끝에 남는다(각 부분이 `inline-block`). 글자 내용은 같은 문자열이라 테스트·화면 읽기에 차이가 없다. 줄임표가 필요한 `FocusScreen` 제목(`truncate`)에는 쓰지 않는다. 문구 안의 한 단위("아래 음 → 위 음", "몇 번")는 줄바꿈 없는 공백.
  - **TAB 최소 배율**(F-34 재분류): UI 리뷰가 E10 iPhone의 TAB 숫자를 약 7 px로 쟀다(감사의 "약 10 px"는 E17 기준). 휴대폰 세로에서 사실상 못 읽어 Medium으로 올리고 고쳤다. TAB은 배율 1.1(숫자 약 14 px) 아래로 줄지 않고, 그보다 긴 TAB은 옆으로 스크롤하며 현재 음을 가운데로 따라간다(즉시 이동, 모션 없음). 스크롤할 때만 키보드 포커스를 받는다(axe `scrollable-region-focusable`). 한 줄 구조(줄 번호 6개·마디선)는 그대로라 기존 테스트가 같다.
  - **아래에 붙은 막대 뒤로 포커스가 숨지 않게**(WCAG 2.4.11): lg 미만에서 `main` 안 조작에 `scroll-margin-bottom: var(--pinned-bottom)`. 탭바 화면은 탭바 높이(`--tabbar-h` 57 px + safe area), 루틴 편집은 저장 막대까지, 연습 무대(sticky 막대)는 7rem. 막대 안 조작은 0으로 되돌려 autofocus가 화면을 밀지 않는다.
  - **루틴 편집 저장 막대는 한 줄**: 저장 + 총 시간만. 확인 없이 저장된 루틴을 지우는 "기본으로 되돌리기"와 "취소"는 목록 아래로(엄지 밑에서 치움). 막대는 카드 폭, 위치는 탭바 높이 토큰.
- **검토한 대안**:

| 대안 | 장점 | 단점 | 판단 |
|---|---|---|---|
| "나가기"를 준비 상태(runner idle)에서만 켜기 | 확인 없이 바로 나감 | `active`가 세션 잠금과 같은 값이라 갈라야 하고, AC-U2(PageDown 뒤 건너뛰기·끝내기 비활성) 단언과 엇갈림 | 기각 |
| "나가기" = 꼬리 "중단"(확인 없이 중단) | 구현 단순 | 실수 터치 하나로 실행이 끝남(D-087이 막으려던 것) | 기각 |
| TAB을 휴대폰에서 여러 줄로 | 스크롤 없음 | 줄 번호·마디선을 세는 기존 테스트 단언을 바꿔야 함(D-090) | 기각 |
| 포커스 가림을 `html { scroll-padding-bottom }` 하나로 | 한 줄 | sticky 막대 안 autofocus가 화면을 밀어 첫 화면 측정(UQ-1/2)이 흔들림 | 기각 |

- **트레이드오프**: 확인을 거치는 "나가기"는 한 번 더 누르게 하지만 실행을 잃지 않는다. 옆으로 스크롤하는 TAB은 한눈에 전체가 안 보이지만, 지금 칠 음 주변을 읽을 수 있는 크기다. 한 단 왼쪽 정렬은 MacBook에서 오른쪽이 비지만 시선이 헤더에서 내려가는 한 줄기다.
- **U6 코드 리뷰**(code-reviewer 서브에이전트, 읽기 전용): 금지 폴더(`src/domain`·`dsp`·`audio`·`data`·`content`) 변경 없음, autofocus·키·aria-live·testid·h1·표식이 그대로임을 확인. 지적과 처리:
  1. Medium — 루틴 편집 저장 막대: 확인 없는 되돌리기가 저장 옆, 저장된 루틴이 있으면 막대 두 줄(약 150 px), 탭바와 1 px 틈 → 위 "저장 막대는 한 줄"(F-44).
  2. Medium — 포커스가 아래 막대 뒤로 숨음(WCAG 2.4.11) → 위 `--pinned-bottom`(F-45).
  3. Low — 다음 조작 표식이 없는 상태(게이트 밖): 마이크 실패 시작 화면, 저장 실패, 세션 휴식, 온보딩 2단계 이후·권한 오류 → 표식을 달았다. 쉬는 날 홈과 할 수 있는 연습이 없는 단계는 누를 조작이 없어 그대로. 단계 화면의 "n개로 세션 시작"은 고르기 전에는 보조 모양(F-46·F-47).
  4. Low — "여러 개 골라 세션으로"가 포커스를 옮기지 않음, "바로 하기" 둘이 같은 이름 → 목록으로 포커스, 링크마다 연습 이름을 `aria-describedby`. 같은 목록 계산이 두 번 도는 것은 그대로(메모된 15개 남짓의 순수 계산, 화면 진입 때만)(F-47).
  5. Low — 진도 히트맵 이름 칸 56 px → 80 px(F-48).
  6. Low — `scaleById`가 모르는 id에서 throw → 체크리스트는 이름을 못 찾으면 id를 보인다(F-49).
  7. Low — `Field` 도움말이 label 안이라 이름이 길어짐 → label 밖, `aria-describedby`(F-50).
  8. Low — 진단의 첫 소제목이 h3 → `EnvironmentGuide level`(F-51).
  9. Low — 블록 전환 카드에서 다음이 E1이면 iPhone에서 "바로 시작"이 첫 화면 끝 → 휴대폰 다이어그램 112 px(F-52).
  10. Low — 작업 트리의 `HomeScreen` 한 줄이 lint 길이 초과 → biome 서식으로 고침.
  11. Low — D-093의 선택자 문구가 코드와 다름(고침), `ko.exercises.sequence.start`가 `common.start`와 중복(지움), 휴식 남은 초가 핵심 숫자가 아님(16vh `data-core-number`, SPEC §5.1 "같은 역할")(F-53).
- **U6 UI 리뷰**(스크린샷 서브에이전트, 읽기 전용): 좋은 점으로 2단 배치, 큰 숫자, iPhone sticky 막대, 일시정지 상태, 고대비 외곽선, 진도 빈 상태를 들었다. 지적과 처리:
  1. Medium — 준비 상태부터 "나가기" 비활성, 이유는 툴팁뿐 → 위 "확인을 묻는다"(F-54).
  2. Medium — 시간 연습마다 시작 전 모양이 다름(E12·E4·E7 빈 오른쪽 단) → 계획 길이(F-55).
  3. Medium — 결과 값 20 px, "자동" 뜻 불명 → 결과 머리줄, E2 뜻 한 줄(F-56).
  4. Medium — 퀴즈 키 안내 "1/2/3"인데 답 4·6개 → `keysHint(n)`: 3개를 넘으면 "앞의 세 답은 1/2/3 키로도"(키 바인딩은 v1.1 §12.3 그대로)(F-57).
  5. Medium — Q1의 물어보는 점이 색으로만 구별 → 점에 테(r 16, 3 px)와 문구 "테두리를 두른 점"(F-58).
  6. Medium — 튜너 맞음 범위 대비 1.04–1.21:1 → 띠 양 끝 2 px ok 경계선(≥ 3:1)(F-59).
  7. Medium — 줄바꿈이 한 단위를 가름(패턴 글자, "· 60 BPM", "아래 음 → 위 음", "쌍·코드") → `Phrases`, 줄바꿈 없는 공백, "쌍, 코드, 템포"(F-60).
  8. Low — E1 "치지 않는 / 줄", 상태 라벨 작음 → "안 침", 16 px(F-61).
  9. Low — 꼬리 키 목록이 화면마다 같음 → WONTFIX: 키 표는 v1.1 §12.3의 전역 바인딩이고 어떤 명령을 쓰는지는 runner가 화면에 알리지 않는다. 화면별 키는 notes에 따로 있다(F-62).
  10. Low — 세션 진행 막대 현재 칸 대비 1.9:1 → 현재 칸은 꽉 찬 accent + 두 배 높이(온보딩 진행도 같게)(F-63).
  11. Low — after-run의 왼쪽 끝 둘, 기록 안 함에 아이콘 없음 → 한 단 왼쪽 정렬, info 아이콘(F-64).
  12. Low — "의학적 조언이 아닙니다."만 다른 말투 → WONTFIX: v1.1 SPEC의 안전 문구가 그 문장을 요구한다(동작 SPEC은 고정)(F-65).
  13. Low — 저장 막대 구분선이 카드보다 넓음, 고대비에서 "빼기"가 "+30"과 같은 상자 → 카드 폭 막대, "빼기" 빨간 글자(F-66).
  14. Low — 튜너 켜기 전 96 px 줄표, 레벨 미터 이름 없음 → 작은 muted 줄표, "입력 레벨"(F-67).
  15. Low — 세션 헤더 "튜닝" 두 번, E17 시작만 아이콘, 메트로놈 빈 박 점 1.2:1, iPhone sticky 막대가 글줄을 자름 → 블록 이름이 항목 이름과 같으면 숨김, 아이콘 제거, 빈 점에 필드 경계 테두리. sticky 막대가 스크롤하는 내용 위에 붙는 것은 막대의 본성이라 그대로(F-68).
  16. — F-34의 크기 기록이 틀림(E10 약 7 px) → 위 "TAB 최소 배율"(F-34 Medium, FIXED).
  - 촬영 도구: 테마 라디오를 누른 마우스가 남아 카드·답이 hover로 "선택됨"처럼 찍혔다 → 촬영 전에 포인터를 (0, 0)으로 옮긴다(`tools/ui/shots.spec.ts`, `states.spec.ts`).
- **U6 전체 재검토**(리뷰 처리 커밋 `2a3d1b0`의 888장): Low 4건을 더 찾아 고쳤다(F-69–F-72: "페달 / 학습", 숫자와 "BPM" 사이 줄바꿈, 키 목록 "E / 이어폰", 고대비 저장 막대 끝 1 px). 고친 26개 화면은 다시 찍어 세 테마 × 네 뷰포트를 다시 봤다.
- **E2E-07의 경쟁 상태**(기존 테스트, 고치지 않음): 한 번의 전체 실행에서 `session.mic.spec.ts` E2E-07이 "마이크 없이 쓰기" 직후 홈 목록 `li` 개수를 기다리지 않고 세어 0을 받아 실패했다(238 ms). 같은 트리에서 그 테스트만 5번 반복하면 5번 모두 통과했고, 이 goal의 이전 전체 실행 11번도 모두 통과했다. 테스트 쪽 대기를 더하는 것은 SPEC §2.4가 허용하는 "DOM·문구 변경을 따라 고치기"가 아니어서 두고, 최종 verify가 이 이유로 실패하면 다시 돌린다.

## D-095 평가 화면 "나가기"는 평가 없이 끝내기, 홈과 회전은 같은 "연습한 세션" 규칙
- **보고(실사용)**: "다시 오늘 했던 연습 안 보임. 바로 다음 연습 세션 보여줌."
- **원인**: D-087 집중 모드에서 평가 화면을 `FocusScreen exit={toHome}`으로 감쌌다. 그래서 위쪽 "나가기"가 `finishSession` 없이 홈으로 가고, 세션이 `endedAt: null`로 남았다.
  - 홈의 `practicedToday`는 끝난 세션만 셌다. 그래서 "오늘 한 연습"과 "마쳤어요"가 숨고 "연습 시작"이 보였다.
  - 회전(`practiceHistory`, D-065)은 시도가 있는 세션을 센다. 그래서 루틴은 이미 다음 세션의 구성이었다.
  - D-078 전의 증상이 다른 경로로 되돌아온 것이다.
- **결정(사용자 선택)**:
  - 평가 화면의 "나가기"는 평가 없이(`selfReport: null`) 세션을 끝내고 홈으로 간다. 저장 버튼 아래에 그렇다고 적는다.
  - 평가가 없는 세션은 다음 날 통증 기반 조정에 쓰이지 않는다. 기한이 지나 닫힌 나눠 하기 앞 절반과 같다.
- **홈 규칙**:
  - `countedSessions`(끝나고 시도가 있음, 또는 끝나지 않았어도 시도가 있음)를 회전과 홈의 `practicedToday`가 함께 쓴다. 두 화면이 다시 어긋나지 않게 하기 위해서다.
  - "오늘 한 연습" 목록은 오늘 시도가 하나라도 있으면 보인다. 세션 밖의 단독 연습, 단계 페이지 연습, 시험도 포함한다. 이때 아래 루틴은 아직 오늘 것이라 "연습 시작"이 그대로다.
  - 나눠 하기의 남은 절반이 있으면 "앞 절반을 마쳤어요"를 보인다.
  - 시험 시도는 "졸업 시험 · n번 항목"으로 보인다(§12.4, 내부 id 숨김).
  - 주간 시간과 연속 주는 지금처럼 끝난 세션만 센다.
- **검토한 대안**:
  - "나가기"에서 한 번 더 묻기: 이미 기록이 저장돼 있어 잃을 것이 없으므로 묻지 않는다.
  - 홈만 끝난 세션으로 두기: 그게 이번 어긋남이다.
  - 다음 로드 때 열린 세션을 자동으로 닫기: 다른 탭에서 진행 중일 수 있어 범위 밖이다.
- **남는 것**: 새로고침이나 탭 종료로 남은 세션은 지금처럼 열린 채 회전과 홈에는 들어가지만, 주간 시간과 연속 주에는 들어가지 않는다.

## D-096 뒤로 가기: 실수로 넘어갔으면 돌아갈 수 있다
- **보고(실사용)**: 실수로 다음으로 넘어가면 돌아갈 길이 없다. 자가 평가 화면에는 "뒤로"가 없고, 연습이 도는 동안은 "이전 항목"이 막혀 있다.
- **원칙**: 돌아가기는 판정을 다시 열지 않는다. 이미 저장된 기록은 그대로 두고, 돌아간 곳에서 새로 하면 새 기록이 하나 더 생긴다.
- **자가 평가에서 돌아가기**:
  - "연습으로 돌아가기"(←, PageUp) 버튼을 저장 버튼 옆에 둔다(주 버튼은 저장 그대로).
  - "세션 끝내기"로 왔으면 그 항목으로, 마지막 항목 뒤에 왔으면 마지막 항목으로 간다.
  - 통증·난이도 슬라이더는 ←로 움직이므로 입력 칸에 포커스가 있으면 ←는 슬라이더 몫이다.
- **연습 중 "이전 항목"**(D-049의 "실행 중 이전 막음"을 이전에 한해 바꾼다):
  - 건너뛰기·일시정지·세션 끝내기는 그대로 막는다. 이전만 연다.
  - 아직 치기 전(대기·첫 스트럼 기다림)이면 바로 앞 항목으로 간다. 잃을 것이 없다.
  - 치는 중이면 "이 연습을 끝내고 이전 항목으로 갈까요?"를 묻는다. 페달은 이전 옆에 다음이 있으므로 ←·→ 어느 쪽이든 확인, Esc를 포함한 다른 키는 취소다(중단 질문은 Esc가 확인이라 다르다).
  - 끝내는 방식은 "중단"과 똑같다(E2는 짧은 부분 기록을 남기고 1분 기준에서 빠짐, E5 도중은 기록 없음, 시퀀스는 그때까지의 사이클). 앞 항목으로는 저장이 끝난 뒤에 간다. 저장이 실패하면 다시 시도 화면에 남는다(기록을 잃지 않는다).
  - 첫 항목에서는 이전이 없다. 단독 연습(/practice)에서도 ←는 지금처럼 연습 자신의 키다.
- **돌아간 항목은 마지막 결과를 보인다**:
  - 세션이 항목마다 마지막으로 저장된 Attempt를 기억한다. 뒤로 가면(이전 항목, 자가 평가에서 돌아가기) 그 결과 화면이 다시 열리고 "다음 항목"에 포커스가 간다. 결과가 없으면 시작 화면이다.
  - 결과는 보여 주기만 한다. 저장된 기록은 바뀌지 않아 E2·E5 등의 확인(review) 단계는 다시 열리지 않고, 다시 하면 새 기록이다.
  - 앞으로 가기(다음 항목, 건너뛰기)와 다시 하기는 늘 새로 시작한다.
  - 뒤로 가기가 결과와 "끝난 실행" 상태를 한 번에 세운다. 결과 화면이 스스로 알리게 하면 한 프레임 늦어, 빠른 Space가 "다음 항목" 버튼을 눌러 넘어갔다(E2E에서 확인).
- **연습 안에서 한 단계 뒤로**(`ExerciseRunner.canStepBack`):
  - 규칙: ←는 실행이 도는 동안 마지막 "넘기기"를 되돌린다. 판정이나 끝난 실행을 다시 열지는 않는다. 되돌릴 것이 있으면 버튼도 같이 보인다.
  - K1: 이전 카드(있던 동작). E0: 앞 줄로, 그 줄은 다시 맞추거나(마이크) 다시 확인(수동)해야 한다.
  - E1: 이 시도에서 Next로 건너뛴 마지막 줄을 다시 판정한다. 그 뒤에 판정된 줄은 그대로다. 건너뛰기로 끝난 시도는 확정이다(E1은 시도의 묶음이라 다음 시도가 다시 하기다).
  - E4·E7·E12: Enter로 일찍 끝냈으면(시간이 남았으면) 남은 시간으로 이어 간다. 고른 값은 남는다. E12는 통증 질문에서 또렷함 질문으로 먼저 돌아간다. 시간이 다 되어 끝난 것은 되돌리지 않는다.
  - 없음: E2·E3(확인은 시간이 다 된 뒤에만, 횟수는 확인 화면에서 ↑↓로 고침), 메트로놈 연습(E5·E6·E8·시퀀스·S — 친 마디와 사이클이 판정), E16·Q2(다음 넘기기가 없음). 세션 안에서 이들의 ←는 위의 "이전 항목" 질문이다.
- **퀴즈는 앞 문제를 보기만 한다**(Q1·Q3·Q4·Q5, `ChoiceQuizRunner`):
  - ←(또는 "← 앞 문제 보기")는 이미 답한 문제를 내 답과 정답 표시 그대로 보여 준다. 여러 번 누르면 더 앞으로 간다. Enter(→, "지금 문제로")는 지금 문제로 바로 돌아온다(설계는 한 문제씩 앞으로였으나, 버튼 문구 "지금 문제로"와 맞춰 한 번에 돌아오게 했다).
  - 보는 동안 답할 수 없다(Q3에서 들린 음도 답이 되지 않는다). 점수·카드 기록·반응 시간은 바뀌지 않는다.
  - 지금 문제의 반응 시간은 보는 동안 멈춘다. 답한 뒤 피드백이 떠 있을 때 봤으면, 돌아온 뒤 피드백 시간이 새로 흐르고 다음 문제로 간다.
  - Q4의 M(다시 듣기)은 화면의 문제, 곧 보고 있는 앞 문제의 소리를 들려준다.
- **블록 시간 버그**: 항목을 옮길 때 "블록 끝" 표시를 지우지 않아, 돌아간 항목이 바로 "블록 끝"으로 보이고 끝 신호가 다시 울리지 않았다. 이제 모든 이동이 표시를 지운다(같은 항목 다시 하기는 블록 시간이 이어지므로 그대로).
- **검토한 대안**:
  - 연습 중 이전을 계속 막고 안내만 고치기: 페달만 쓰는 사람은 Esc 두 번 뒤 ←로 세 번 눌러야 한다.
  - 묻지 않고 바로 끝내기: 페달을 잘못 밟으면 도는 연습이 끝난다.

## D-097 처음 설정과 졸업 시험의 뒤로 가기
- **처음 설정**:
  - 마이크 단계를 뺀 모든 단계(소음·튜닝·줄 소리·지연·요약)에 "이전 단계"(ghost 버튼, 주 버튼 밖)를 둔다. 앞 단계는 새로 열리고 다시 한다. 줄 소리에서 돌아가면 튜닝이 처음부터라 튜닝의 실수 "건너뛰기"를 되돌릴 수 있다.
  - 뒤 단계의 결과는 상태에 남지만 앞으로 가며 단계마다 다시 하고, 각 단계의 결과가 덮어쓴다. 캘리브레이션은 요약에서만 저장하므로 데이터 문제가 없다.
  - 소음 측정 중, 지연 측정(루프백·클릭에 맞춰 치기) 중에는 비활성이다. `metronome.stop()`은 `end`를 내지 않아, 치기 측정 중에 떠나면 그 약속이 끝나지 않고 리스너가 남는다. 루프백 반복도 프로브를 계속 예약한다.
  - ← 키는 두지 않는다. 일반 화면이고 선택 상자가 있으며, 버튼으로 충분하다.
- **졸업 시험**:
  - 여러 단계로 된 항목(3: 다섯 쌍의 1분 체인지, 4: 시각 큐 있음·없음 E5)은 마지막이 아닌 단계가 끝나면 결과 화면을 그대로 두고 "다음 단계 n/N (Enter)"로 넘어간다. 전에는 결과 없이 바로 다음 단계 시작 화면이었다.
  - 다음 단계의 시작 화면(아직 시작 전)에는 "← 앞 단계 결과 보기"가 있어 앞 단계들의 결과를 읽기만 한다. 시작 전 화면이라 내리고 다시 열어도 잃을 것이 없다.
  - 마지막 단계와 중단한 단계는 지금처럼 바로 판정을 기록한다. 판정은 항목마다 한 번이다.
- **검토한 대안**:
  - 시험 한 단계만 다시 하고 결과를 바꾸기: 항목 3의 "무작위 5쌍 각각 30회 이상"(§7.6)이 쌍마다 여러 번 중 최고로 느슨해진다. 항목 전체 다시 하기는 제한이 없어 그대로 다시 하는 길이다.
  - 세션의 "마지막 결과 다시 보기"(D-096) 방식을 시험에 쓰기: 같은 결과를 다시 알리면 단계가 두 번 기록될 수 있어 쓰지 않고, 시험은 자기 단계 기록에서 요약을 그린다.

## D-098 사다리는 저절로 느려지지 않고, 템포는 시작 화면에서 고른다
- **요청(실사용)**: "잘 못했다고 BPM 낮추지 마, 내가 처음 시작할 때 선택할 수 있게 해."
- **결정(사용자 선택)**: 자동 감속만 끈다. 범위는 템포 사다리 연습 전부 — E5 패턴, E9 크로매틱, E10 스케일, E17 리프.
  - 못 친 실행은 템포를 내리지 않는다(사다리 'stay'). 통과하면 다음 기본값은 지금처럼 +5다.
  - 사다리 판정은 'up' 또는 'stay'만 낸다(`ladderDecision`, `chromaticLadder`, `sequenceLadder`). "직전 실행도 낮았음"(`previousLow`)을 계산하던 `withHistory`는 E5·E17에서 없앴고, E9·E10은 지난 기록의 템포만 이어받는다.
- **SPEC과 다른 점**(고정 파일이라 여기에 적는다):
  - §11.6 "2회 연속 < 70% → −5 BPM", v1.1 §11.13(E10)·§11.14(E9)의 "2회 연속 → −5 BPM", §11.19(E17) "−5 규칙은 E10과 같다"는 적용하지 않는다.
  - v1.1 §7.4 정체 표의 "패턴·스케일·리프·교대 피킹 → 1주 동안 시작 BPM −10"은 이제 **교대 피킹(E8)만**이다. 패턴·스케일·리프·크로매틱(`strum:`·`scale:`·`riff:`·`chromatic:`, `isUserPacedLadder`)은 정체 판정에서 빼고, 이미 저장된 이 subject들의 −10 처방은 다음 세션 준비 때 끝난다(`prescriptionExpired`).
  - v1.1 §7.3-10 "활성 −10 처방이 있는 subject는 사다리 현재 BPM − 10"은 이 subject들에 더는 해당하지 않는다(처방이 생기지 않는다).
- **남기는 것**:
  - 결과 스키마의 `'down'`과 요약 문구 `ladder.down`: 예전 기록이 그대로 읽히고, 그 기록의 다음 템포(−5)도 그대로다.
  - `ladderBase`: 예전 기록과 E6·E8의 −10 처방에 쓴다. 새 E5·E9·E10·E17 실행에는 붙지 않으므로, 저장되는 사다리는 그 실행의 템포(통과면 +5)다.
  - `previousLow`: 저장된 파라미터가 계속 읽히도록 스키마에 남기고 쓰지 않는다.
  - E6 박 1 체인지와 E8 교대 피킹은 바뀌지 않는다.
- **템포 고르기(사용자 선택)**: 시작하기 전(E5는 armed·ready, 시퀀스는 ready)에 ↑/↓(+/−) 키나 화면의 −5/+5 버튼으로 템포를 고른다. 기본값은 사다리 현재 BPM(지난번 템포, 통과했으면 +5)이다.
  - 키 표(SPEC v1.1 §12.3)는 고정 파일이라 여기에 적는다: **E5·E9·E10·E17 대기 중 ↑↓ = 템포 고르기**(연습곡 대기 중 ↑↓와 같은 키, 5 BPM씩).
  - 고른 템포가 그 실행의 템포다. 메트로놈·채점 격자·결과 `bpm`·기록된 파라미터(`effectiveParams`)가 모두 그 값이고, 사다리는 그 값에서 머물거나 +5로 오른다. E10 졸업(80 이상 4바퀴)과 암기도 실제로 친 템포로 판정한다.
  - 버튼은 주 버튼 막대 밖(`tools` 칸)에 둔다. 넓은 화면에서는 "시작" 아래 줄이라 주 버튼 위치가 바뀌지 않고, 휴대폰에서는 큰 BPM 아래로 흐르며 아래 막대는 그대로다. Tab으로 포커스한 버튼의 Space/Enter는 그 버튼만 누른다(D-085 일시정지 버튼과 같은 방식). 터치·마우스로 누르면 포커스를 놓아서 다음 Space는 늘 시작이다.
- **설계값(내가 정함)**:
  - 범위 30–240 BPM. 6/8 패턴은 메트로놈이 bpm × 3으로 8분음표를 치므로 80에서 멈춘다.
  - **조용한 창 0.6 s**: 고른 직후 0.6초 동안은 마이크가 들은 첫 소리로 armed 실행을 시작하지 않는다. iPad 유리를 두드리는 소리가 스트럼처럼 들릴 수 있어서다.
- **고르지 않는 경우**:
  - 졸업 시험 4번(E5)은 템포가 정해져 있다(`tempoLocked`). `exam4Passed`가 이미 80 BPM 이상을 요구하므로 구멍을 막는 것이 아니라 헷갈림을 막는 것이다.
  - E10 복습은 정의상 졸업 템포로 친다(§7.5). E11 해머온은 자기 사다리를 그대로 쓴다.
- **세션에서 다시 하기**: E5·E9·E10·E17의 "같은 템포로 다시"·"다시 하기"·"한 번 더"(제안이 없을 때)·Space는 방금 실행의 파라미터로 다시 한다(`sameRunParams`). 그래서 고른 템포가 이어지고, 사다리가 'stay'면 같은 템포다. 연습곡과 다른 연습은 지금처럼 항목의 파라미터로 다시 한다(연습곡의 기록된 악보 숨김·구간 반복을 다시 쓰면 단계가 바뀔 수 있다).
- **알려진 점(고치지 않음)**: E9·E10의 `withHistory`는 시작할 때 템포를 지난 기록의 다음 템포로 다시 정한다. 그래서 통과한 실행 뒤 "같은 템포로 다시"는 +5에서 시작하고, 시작 화면에서 다시 내려 고를 수 있다.

## D-099 새 단계의 새 코드는 "새 코드를 배워봅시다"로 먼저 연습한다
- **요청(실사용)**: "스테이지 넘어가서 새 코드 배울 때는, 새 코드를 배워봅시다 하고 먼저 그 코드들 연습하고 시작했으면 좋겠어."
- **전에는**: 템플릿의 "새 코드" 칸(`chordNew`, 60초)이 그 단계 새 코드 중 하루 하나만 돌아가며 넣었다. Stage 8(5개)·10·11(6개)은 새 코드를 다 처음 쳐 보기까지 여러 세션이 걸렸고, 안내도 없었다. v1.1 §7.3-4의 "신규 코드의 첫 노출은 짧은 blocked 연습 후 교대"는 구현돼 있지 않았다.
- **결정(사용자 선택)**:
  - **언제**: 그 단계 새 코드(`newChords`, 코드 클래스로 묶고 지금 G 운지로) 중 E1 기록(`chord:<voicing>`)이 아직 없는 코드가 있을 때마다다. 진급 뒤 첫 세션에 나오고, 건너뛰거나 못 한 코드는 다음 세션에 다시 나온다. Stage 6은 G 하나(지금 운지), Stage 8의 G-4f는 자기 클래스라 그대로 나온다.
  - **어디**: 튜닝 바로 다음, 새 블록 `newChord`("새 코드")다. 스트레칭(Stage 4–6)·레퍼토리(Stage 8–11)보다 앞이다. 단 3일 넘게 쉰 날은 규칙 5대로 "지난 단계 복습"이 첫 블록이고, 소개는 그 바로 뒤다.
  - **시간**: 그날 루틴에 이미 그 코드의 E1이 있으면(Stage 1의 D·A 고정 칸, 새 코드·약한 코드 칸이 고른 코드) 그 항목을 시간째 앞으로 옮긴다. 없으면 코드마다 60초(`NEW_CHORD_INTRO_SEC`)를 더하고, 그날 세션은 그만큼 길어진다(`applySessionLength`의 목표 = L + 더한 시간). 처음 4주 20분 상한이 걸린 날(Stage 0–7, 규칙 1)만은 늘리지 않고 연습곡이 내준다.
- **보이는 것**:
  - 홈 루틴 카드 안내 `newChords`: "새 코드를 배워봅시다: Em · Am. 튜닝 다음에 먼저 연습해요(오늘은 n분 더)." 늘어난 시간은 안내의 `extraSec`이다.
  - 세션: 소개 블록이 시작될 때 블록 전환 화면이 "새 코드를 배워봅시다"와 그 블록 코드 이름을 보여 준다(다이어그램은 지금 코드, 소개일 때는 한 단계 작게 — iPad 가로에서 "바로 시작"이 첫 화면에 들어오게).
  - 이 화면은 설정에서 블록 전환 화면을 꺼도, 앞 항목을 건너뛰어 들어와도 나온다(`opensNewChordIntro`). 새 단계에서 한 번 나오는 안내라서다. 블록 안의 코드 사이에는 나오지 않는다.
- **SPEC과 다른 점**(고정 파일이라 여기에 적는다):
  - v1.1 §7.3-4 첫 노출 blocked 연습의 구현 방식(위)과 위치(튜닝 다음, 워밍업보다 앞)는 내 설계다.
  - v1.1 §7.3-1·§14.9-4 "블록 시간 합 = T(또는 L)"는 소개가 시간을 더한 날 `extraSec`만큼 넘는다. 시뮬레이션 합계 검사가 그 값을 더해서 본다.
  - §7.3-13 블록 전환 화면은 설정으로 끌 수 있지만, 새 코드 소개만은 꺼지지 않는다.
- **넣지 않는 곳**: 사용자 편집 루틴(`userTemplate`, §7.3-9)과 커리큘럼 "이 단계 연습"(일회용 userTemplate)이다. 고른 구성을 그대로 둔다.
- **알려진 점**: 소개가 약한 코드 칸이 고른 새 코드를 앞으로 옮기면 그날은 옛 코드 약점 연습이 없다(하루뿐이다).

## D-100 스트럼 판정을 너그럽게: 놓침 몇 개는 통과, 80 BPM 미만 허용 범위 ±80 ms
- **요청(실사용)**: "P2 뮤트 70 BPM 통과 … 이거 판정 좀 너그럽게 못하나?"
- **전에는**:
  - E5 통과(사다리 +5)는 `적중률 ≥ 90 % & 놓침 0 & 8마디`였다. 놓침이 0이면 적중률은 늘 100 %라서 실제 기준은 "8마디 스트럼 전부 적중"이었다(P2는 48번). 90 % 조건과 개인 선행 보정(`hitRateCorrected`)은 판정에 쓰이지 않았다. 놓침은 보정 전 값으로 셌기 때문이다.
  - 뮤트 업스트로크처럼 작은 소리를 마이크가 하나만 놓쳐도 실패였다.
  - 박자 허용 범위는 80 BPM 미만에서 ±60 ms였다.
- **결정(사용자 선택: "둘 다")**:
  - **놓침 0 조건 삭제**: `ladderDecision(hitRate, bars)` = 보정 적중률 ≥ 90 % & 8마디 이상. P2 8마디는 48번 중 4번까지 놓쳐도 통과한다. 자가 평가(1 = 100 %, 2 = 80 %, 3 = 50 %)는 그대로다.
  - **80 BPM 미만 창 ±60 → ±80 ms**(`timingWindowMs`). 80–100 BPM ±50, 100+ ±40은 그대로다. 80 BPM 미만에서 가장 가까운 두 슬롯(스윙 2/3 박, 6/8 8분)도 ≥ 250 ms 떨어져 있어서 창 둘(160 ms)이 겹치지 않는다.
- **같이 바뀌는 곳**: 창은 Mode D를 쓰는 모든 연습이 같이 쓴다. E5, E6 박 1 체인지, E8 교대 피킹, 연습곡 박 1, 마디별 즉시 피드백(`liveTiming`, 끝 점수와 같은 창)이 80 BPM 미만에서 함께 너그러워진다.
- **SPEC과 다른 점**(고정 파일이라 여기에 적는다):
  - §11.6과 v1.1 §7.1 "패턴 N BPM 통과"의 "hit_rate ≥ 90 % & 누락 0"에서 "누락 0"을 적용하지 않는다.
  - §10.8 창 설계값 "60–80 BPM ±60 ms"는 ±80 ms다.
- **알려진 점**:
  - 80 BPM에서 창이 ±80에서 ±50으로 한 번에 좁아진다. P3·P4 졸업 템포(80 BPM)는 예전과 같은 기준이다.
  - 이미 실패로 저장된 실행은 다시 계산하지 않는다(결과의 `passed`를 그대로 쓴다).

## D-101 곡 반주의 이어폰/스피커 선택은 출력 장치별 기기 설정으로 저장한다
- **백로그**: "이어폰 선택을 기기 설정으로 저장(현재 곡 기록 50개 안의 출력 장치별 마지막 선택)".
- **전에는**: 곡 연습의 이어폰 기본값은 그 곡 기록 최근 50개(`historyDepth: 50`) 안에서 출력 장치 라벨별 마지막 반주 실행의 선택이었다. 그 장치로 반주를 50번 넘게(다른 장치·학습 실행 포함) 안 치면 선택을 잊고 스피커로 돌아갔다.
- **결정**:
  - 기기 설정에 `earphonesByOutput`(출력 장치 라벨 → true = 이어폰, false = 스피커)을 둔다. 이 필드가 없는 예전 설정·백업은 `normalizeSettings`가 빈 값 `{}`로 채운다(설정 스키마 버전은 그대로).
  - 반주를 켠 곡 실행이 끝나면(결과가 있을 때, 출력 장치 라벨이 있을 때) 그 장치의 선택을 설정에 쓴다. 플러그인 선택 항목 `earphoneChoice(결과)`가 고르고 호스트가 저장한다. 학습 실행, 반주 끈 실행, 결과 없이 끝난 실행은 쓰지 않는다.
  - 기본값 순서: 설정의 그 장치 선택 → 최근 곡 기록 50개의 그 장치 선택(D-101 전에 고른 장치를 위해 남긴다) → 스피커.
- **범위**: 곡 연습(반주)만이다. E10 "반주와 함께"의 이어폰 선택은 지금처럼 실행 파라미터에만 있다.
- **알려진 점**: 설정은 백업에 같이 들어가지만 출력 장치 라벨은 기기마다 다르므로 다른 기기로 옮기면 대개 쓰이지 않는다. 설정 화면에는 이 값을 보거나 지우는 UI가 없다(E 키로 바꾸면 다음 실행부터 바뀐다).

## D-102 E10 "반주와 함께" 스피커 실행을 기록으로 (D-067 E10 스피커 정책 대체)
- **전에는(D-067)**: 단음 판정 경로에 반주 마스킹이 없어 스피커 누출이 놓친 음을 OK로 만들 수 있었다. 그래서 스피커 실행은 사이클을 보여 주되 "참고"로 표시하고(`backingAudible: true`) 졸업·암기·사다리·지표·다음 실행 계산에서 뺐다.
- **결정**: 단음 시퀀스 판정에도 곡과 같은 반주 마스킹(§10.12, `backingMask.ts`)을 넣고 스피커 실행을 이어폰 실행과 똑같이 기록한다.
  - DSP: `verifySequence`의 `backing`(반주 도착·템플릿 상승·누출 이득) → `detectSequenceOnsets`가 정밀화 뒤·그룹 앞에서 `backingKeepFlags`로 반주 onset을 뺀다(재정밀화 포함, 스트럼 경로 `detectStrums`와 같은 순서). 빠진 onset은 슬롯 매칭에도 EXTRA에도 들어가지 않는다 — 치지 않은 슬롯은 MISSED. 마스크 계약값(±15 ms, +6 dB)은 그대로다.
  - worker 작업: 시퀀스 range 요청에 `backing { arrivalsS, templateRises, gain? }`(range 시작 기준 초)를 더했다(선택 필드, 다른 요청은 그대로). `SequenceRequest.backing`(오디오 시각) → 어댑터가 range 기준으로 바꾼다.
  - 러너: `ScaleRunner`가 반주를 그리드에 올릴 때 곡과 같은 방식으로 전주(카운트인 마디)에서 누출 이득을 한 번 잰다(`BLEED_PRE_S`·`BLEED_WINDOW_S` 공유). 재는 동안 `SequenceTracker`는 구간을 보내지 않고(`setBacking(null, pending)`), 이득이 오면 모든 구간에 그 구간 ± 0.1 s 안의 반주 이벤트를 붙인다. 일시정지·끝내기는 재생되지 않을 도착을 마스크에서 빼고(카운트인 안에서 멈춰 전주를 다 못 들었으면 이득을 다시 잰다), 이어 하기는 새 반주의 도착을 더한다.
  - 이득 측정 실패: 구간 안 이벤트로 이득을 추정하지 않는다. 사용자가 함께 친 구간의 비 중앙값은 사용자 음을 누출로 삼아, 친 음을 MISSED로 만든다(매 박 반주 위 두 음 구간에서 재현). 그래서 시퀀스 요청의 `gain`은 필수다(곡 경로의 `BackingSchedule.gain`과 `bleedGain` 대체값은 그대로).
    - 다시 재기: 전주가 캡처 링에 남은 동안(`from` + 3.7 s 안) 0.5 s 뒤에 다시 잰다. 한 전주에 최대 3번이다. 링을 벗어난 전주는 무음으로 읽혀 이득이 0이 되므로 다시 재지 않는다 — 엔진의 타임아웃(전주 끝 + 5 s)은 이미 이 경우다. 링 조건은 예약할 때와 재시도를 실행하기 직전에 두 번 본다. tick이 늦어 그 사이 전주가 링을 벗어났으면 요청을 보내지 않고 실패로 센다(이득 0을 성공으로 받지 않는다).
    - 그래도 이득이 없으면: 구간을 보내지 않는다. 슬롯은 오디오가 링에 있을 만큼(슬롯 시각 + 2.5 s) 기다린 뒤 UNCLEAR가 된다 — 트래커가 분석 못 한 구간을 다루는 기존 규칙과 같다. 그 사이클은 "불확실"이라 연속 기록을 늘리지도 끊지도 않는다. 치지 않은 음이 OK가 되지도, 친 음이 MISSED가 되지도 않지만, 친 음이 OK로 기록되지도 않는다 — 전주 없이는 둘을 구별할 수 없다.
    - **완료 기준 예외(사람 결정, 2026-11-08)**: 이득을 끝내 못 재면 실제로 친 음도 그대로 판정되지 않고 UNCLEAR로 남는다. "친 음은 그대로 판정된다"의 예외로 허용한다. UNCLEAR 사이클의 `okRatio`가 0이라 평균을 낮추는 것도 기존 분석 실패 구간과 같아 그대로 둔다.
    - 화면 안내: 재시도까지 끝나 이득을 못 재게 되면(횟수를 다 썼거나 전주가 링을 벗어남) 스피커 실행 화면에 "반주 소리를 재지 못했어요. 일시정지 뒤 이어 하면 다시 재요."(`ko.exercises.e10.gainLost`, `view.gainLost`)를 띄운다. 이어 하기의 새 전주가 재기 시작하면 사라진다.
    - 늦은 답과 다음 전주: 늦게 온 이득은 그때부터의 구간에 쓴다. 일시정지 뒤 이어 하면 새 전주에서 다시 잰다. 카운트인에서 멈춰 전주를 다 못 들었으면 그 전주의 답은 버린다. 이득을 모르는 동안 마스크 없이 판정되는 구간은 없다.
  - 결과: 새 실행은 `backingAudible`를 저장하지 않는다(스피커/이어폰은 실행 파라미터 `earphones`에 남는다). 저장 형식은 바뀌지 않았다 — `backingAudible: true`는 D-102 이전의 마스크 없는 참고 실행에만 있고, 추출기(빈 목록)와 `nextScaleRun`(제외)은 그 옛 기록을 계속 뺀다. 화면의 `view.backingAudible`은 스피커 안내("반주 소리는 걸러 내고 판정해요", `speakerNote`)에만 쓴다. 옛 참고 실행의 요약 문구(`speakerReference`)는 "이전 방식"으로 바꿔 남겼다.
- **SPEC과의 관계**: SPEC은 E10 스피커 정책을 정하지 않았다(D-067이 보수적으로 고른 것). 곡(S)의 정책(§8.6-3: 박 1은 마스킹해 판정, 코드 확인은 "참고")은 그대로다.
- **이유**: 마스크 없이 확인한 실패 두 가지 — 반주 코드 음을 뺀 슬롯이 OK가 되거나, 코드 소리로 UNCLEAR가 되어 사이클이 "불확실"(연속 기록 유지)로 넘어가는 것 — 를 마스크가 MISSED로 바꾼다. 같은 마스크 아래 반주 스트럼과 같은 박에 친 사용자 음은 그대로 OK다(매 박 반주 스트럼, −10/−18 dB까지).
- **테스트**: `src/dsp/sequenceBacking.test.ts`(마스크 없이 뺀 음이 MISSED가 아님, 마스크로 MISSED·실수 사이클, 친 음 OK, 다 친 사이클 무실수, 빈 일정은 그대로), `src/audio/dspWorker.test.ts` "test_sequenceRange_withSpeakerBacking…", `src/exercises/e10/runner.test.ts` 스피커 단언(졸업·지표·다음 실행, 전주 이득 1회, 구간마다 반주 이벤트) + 이득을 기다리는 동안 구간 없음·재시도 횟수와 링 조건·tick이 늦으면 재시도를 보내지 않고 실패로 셈·안내가 마지막 시도 뒤에만 뜨고 새 전주에서 사라짐·이득 없는 사이클은 불확실·이어 하면 다시 잼·일시정지 마스크 자르기. 이득 실패는 `src/exercises/e10/runner.gainFailure.test.ts`가 실제 어댑터와 실제 DSP로 확인한다(한 번 실패 뒤 친 음 OK·뺀 음 MISSED, 늦은 답에도 링을 벗어난 오디오를 읽지 않음, 끝내 실패하면 OK도 MISSED도 없음). `src/exercises/sequence/tracker.test.ts`는 대기와 UNCLEAR 처리를, `src/dsp/sequenceBacking.test.ts`는 전주 이득이면 OK·이득 없는 짧은 구간이면 MISSED인 재현을 확인한다. E2E-16b `tests/e2e/e10.mic.spec.ts`(온보딩으로 잰 루프백 RTT, §14.8 척도 −12 dB 누출, 1사이클에서 B2·E3를 빼고 침 → 그 두 음 MISSED·불확실 아님, 2–5사이클 무실수·졸업·지표). 트래커에서 마스크를 끈 변이로 E2E-16b가 실패함을 확인했다(뺀 음이 UNCLEAR → `uncertain: true`).
- **알려진 점**: 반주 도착 예측은 실측 RTT에 기댄다. RTT가 어긋나면(보정이 오래됨, 블루투스) 반주 onset이 창 밖에 남아 마스크 없을 때처럼 판정될 수 있다. 실기기에서는 아직 재지 않았다(MANUAL_VALIDATION 5a). `detectorVersion`은 올리지 않았다 — 기존 입력(반주 일정 없는 판정)의 알고리즘·파라미터는 바뀌지 않았고, 새 경로는 기존 §10.12 마스크를 그대로 쓴다.

## D-103 통합 백업: 백업 JSON과 녹음 오디오를 zip 하나로
- **요청(BACKLOG 데이터·플랫폼 첫 줄)**: 녹음 키트 오디오를 백업 JSON과 함께 묶는 통합 백업.
- **전에는**: 설정 > 백업의 내보내기는 Dexie 테이블만 JSON으로 썼다. `recordings` 행은 들어가지만 OPFS의 WAV는 빠져서, 다른 기기나 초기화 뒤 가져온 녹음은 오디오가 없어 녹음 키트 zip에서 빠졌다.
- **결정**:
  - **파일**: 설정 > 백업에 "내보내기(녹음 오디오 포함 zip)" 버튼을 더한다. 파일 이름은 `guitar-hero-full-backup-YYYY-MM-DD.zip`이다. 안은 `backup.json`(JSON 내보내기와 같은 envelope, 같은 `schemaVersion`)과 `recordings/<fileName>`(녹음 행의 `fileName`마다 WAV 하나)이다. 녹음 키트와 같은 store 방식 zip(`src/data/zip.ts`)이고, 새 의존성은 없다. JSON 내보내기 버튼과 파일은 그대로 둔다.
  - **읽기**: `readZip`은 store 방식만 읽는다. central directory를 따라가며 항목마다 CRC-32를 확인하고, 압축된 항목·ZIP64·암호화·잘린 파일은 거부한다. end record는 disk 번호 둘이 0이고, 두 항목 수가 같고, comment가 파일 끝에 정확히 닿아야 한다. central directory는 end record 바로 앞에서 끝나야 하고, 항목 수만큼 읽었을 때 크기를 정확히 다 써야 한다. local header의 method·flags·이름·CRC·두 크기는 central directory와 같아야 하고, 데이터는 central directory 앞에서 끝나야 한다. 이 앱이 만든 zip만 읽으면 되기 때문이다(다른 도구로 다시 압축한 zip은 거부된다).
  - **가져오기**: 같은 "가져오기" 버튼이 JSON과 zip을 모두 받는다. 파일 앞 4바이트가 zip 서명이면 통합 백업, 아니면 JSON으로 읽는다. `backup.json`은 JSON 가져오기와 같은 `parseImport`(zod 검사, migration, 기본 키 검사)를 거치고, 미리보기·합치기·바꾸기(2단계 확인)도 같다. 미리보기에 "녹음 오디오 n개"를 더 보인다.
  - **오디오 규칙**: 합치기는 이 기기에 이미 있는 오디오 파일을 건너뛴다(같은 키 건너뜀과 같은 뜻). 없는 파일만 쓴다. 그래서 JSON에서 가져와 오디오가 없던 행도 오디오가 채워진다. 바꾸기는 백업의 오디오로 덮어쓴다. 바꾸기가 백업에 없는 OPFS 파일을 지우지는 않는다(지금 JSON 바꾸기와 같다; 녹음 키트는 행이 가리키는 파일만 읽는다).
  - **거부**: 깨진 zip, `backup.json`이 없는 zip(예: 녹음 키트 zip), 다른 앱의 envelope, `recordings/` 아래 이름에 `/`·`\`·`..`가 든 항목은 오류로 거부하고 화면에 기존 가져오기 오류 문구("이 앱에서 내보낸 JSON 또는 zip 파일인지")를 보인다. 어떤 녹음 행도 가리키지 않는 오디오 항목은 버린다.
  - **OPFS를 못 쓸 때**(OPFS 없음, Playwright WebKit·사생활 보호 창처럼 `getDirectory`가 거부): 내보내기는 읽은 오디오만 담고 나머지는 행만 담은 채 끝나며 "녹음 n개는 오디오를 읽지 못해 기록만 담았어요"를 보인다. 가져오기는 테이블을 다 복원하고 "녹음 오디오 n개는 저장하지 못했어요"를 보인다. 둘 다 실패로 끝나지 않는다.
- **시험**: `src/data/zip.test.ts`(읽기, 깨진 파일), `src/data/fullBackup.test.ts`(만들기·풀기 왕복, 합치기, 다른 앱 파일), `tests/e2e/backup-full.chromium.spec.ts`(내보내기 → 초기화 → 가져오기로 테이블과 OPFS 오디오가 돌아오고 녹음 키트 zip에 다시 들어감, 합치기 규칙; Chromium 전용), `tests/e2e/backup-no-opfs.spec.ts`(`getDirectory` 거부를 모든 엔진에서 강제).
- **SPEC과 다른 점**(고정 파일이라 여기에 적는다): §13.3은 "녹음 오디오는 포함하지 않는다(별도 내보내기)"고 적었다. JSON 내보내기는 그대로 두고, 오디오를 담는 통합 백업 zip을 두 번째 형식으로 더한다.
- **알려진 점**: zip은 메모리에서 한 번에 만든다. 녹음이 아주 많으면(수백 MB) 기기 메모리가 모자랄 수 있다. 지금 녹음 키트 계획은 수십 개 짧은 클립이다.

## D-104 30분 세션 분할: 블록 사이 어디서나, 여러 번
- **요청(BACKLOG 연습·루틴)**: "세션 분할을 3개 이상으로(현재 30분 = 2 × 15 한 지점), 분할 지점 직접 고르기".
- **전에는(D-069 "세션 분할")**: Stage 8–11 30분 루틴에서 템플릿의 `splitAfterRow`(리듬 블록 뒤) 한 지점에서만 "여기서 나눠 하기" 카드가 나왔다. 이어서 한 두 번째 절반은 다시 나눌 수 없었다.
- **결정**:
  - **고르는 방법**: 세션 화면 아래 버튼 줄(이전 항목·건너뛰기·멈춤·세션 끝내기 옆)에 "여기서 나눠 하기"(`split-session`)를 둔다. 블록 사이 어디서나 누를 수 있고, 누른 그 자리가 분할 지점이다. 따로 지점을 고르는 화면은 두지 않는다. 연습하다가 그만하고 싶은 곳에서 누르는 게 고르는 일이라서다. 조건은 `canSplit`이다: 나눌 수 있는 세션이고, 남은 항목이 있으며, 남길 부분의 첫 항목이 새 블록을 연다(`atBlockBoundary`: 앞 항목과 `block`이 다르다). 연습이 도는 중에는 다른 버튼처럼 막힌다.
  - **블록 사이에서만(사람 지시, 2026-11-08)**: "분할 지점은 블록 사이에서만 고르게 해 줘(블록 중간은 안 됨)." 처음 구현(항목 사이 어디서나)을 이 지시로 좁혔다. 블록은 루틴 항목의 `block` 필드다(템플릿 줄이 정하고, 생성기가 채운다 — 예: Stage 8 `tuning`, `newChord`×n, `repertoire`, `chord`, `changes`, `rhythm`, `scale`, (`selfCheck`), `technique`, `recall`, `knowledge`, `song`). 체인지 사이의 30초 휴식(`rest`)은 블록 전환 화면(§7.3-13, `opensNewBlock`)과 같이 둘레 블록의 일부로 본다. 그래서 체인지 블록 안(체인지↔휴식)과 새 코드 E1 사이에서는 버튼이 없다. 블록 하나를 반쯤 하고 남기면 그 블록의 시간 배분과 복습 순서가 다음 조각에서 끊기기 때문이다.
  - 한 항목의 실행이 끝나 결과가 보이는 중에 누르면 그 항목은 한 것으로 치고, 남은 부분은 다음 항목에서 시작한다(`splitHere(..., currentDone)`). 그래서 이때 버튼은 그 항목이 블록의 마지막일 때만 나온다(`canSplit(..., currentDone)`이 다음 항목 자리를 본다). 아직 치기 전이면 그 항목부터이고, 그 항목이 블록의 첫 항목일 때만 나온다.
  - **템플릿 지점은 안내로 남긴다**: 리듬 블록 다음 첫 항목에서 "앞 절반 끝 — 30분 루틴은 여기서 나눠 하기 좋아요 …" 카드(`split-point`)가 나온다. 버튼은 카드에 없고 버튼 줄의 것을 쓴다. 이어서 하는 조각에는 이 안내를 보이지 않는다(그 지점 정보를 기록에 두지 않는다).
  - **여러 번**: 이어서 하는 조각도 나눌 수 있다. 다시 나누면 같은 `meta.splitResume` 기록을 새 상태로 덮어쓴다(같은 세션 id, 전체 항목, 다음 할 항목에 멈춘 러너 상태). 그래서 조각 수에 제한이 없고, 기록은 늘 하나다. 끝까지 하면 자가 평가가 세션을 한 번 닫는다.
  - **조각마다 같은 규칙**(D-069·D-071 그대로): 날짜가 바뀌면 남은 부분을 자가 평가 없이 닫아 세션으로 세고, 홈 "시작"으로 새 세션을 열면 남은 부분을 닫는다. 이어 하는 조각의 진행(현재 항목·기록 수·연습 시간)은 항목마다 기록에 되써서 새로고침 뒤 그 자리로 돌아온다.
  - **나눌 수 있는 세션**: 전과 같다. Stage 8–11 오늘의 루틴(`splitAfterIndex`가 있는 계획)만이다. Stage 0–7 20분 세션, 사용자 편집 루틴(`userTemplate`), 나만의 세션(`routineId: 'custom'`), 휴식 계획에는 버튼이 없다.
- **저장 형식**: `SplitResume`의 필드는 그대로다(`sessionId, day, stage, items, state`). 바뀐 것은 뜻뿐이다: "첫 절반"이 아니라 "지금까지 한 부분, 다음 할 항목에서 멈춤"이다. D-104 전에 저장된 기록(한 지점 분할의 첫 절반)도 같은 모양이라 그대로 이어서 하기·닫기가 된다(`splitResume.test.ts`).
- **문구**: 홈 "오늘 나눠 한 세션의 남은 부분이 있어요." / "나눠 한 앞부분을 마쳤어요. …"("절반" → "부분").
- **SPEC과 다른 점**(고정 파일이라 여기에 적는다): v1.1 §7.3-11의 "2 × 15분, 리듬 블록 뒤 한 지점"을 "블록 사이 어디서나, 여러 번"으로 넓힌다. 리듬 블록 뒤는 권하는 지점으로만 남는다.
- **알려진 점**: 세션 첫 항목 앞에서는 나눌 수 없다(나눌 것이 없다). 블록이 하나뿐인 경우는 Stage 8–11 템플릿에 없다. 이어서 하는 조각은 시작한 그 항목에서 바로 다시 나눌 수 있다(한 것 없이 기록만 덮어쓴다 — 해가 없어 막지 않았다).
- 테스트: `session.test.ts`(D-104 describe: 블록 사이에서만, 블록 중간·결과가 보이는 블록 중간 항목에서는 없음), `splitResume.test.ts`(예전 기록·두 번 나눈 기록 닫기), `routine.test.ts`(나눌 수 있는 세션), E2E-18(블록 사이 두 곳에서 나눠 3조각·블록 중간에 버튼 없음·한 세션), E2E-15·E2E-23(20분·나만의 세션에 버튼 없음).
