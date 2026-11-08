# 아키텍처 (ARCHITECTURE)

완전 초보 어쿠스틱 기타 학습용 local-first PWA. 서버가 없고, 모든 기록은 브라우저(IndexedDB, OPFS)에 남는다.
설계 결정의 근거와 이력은 [`docs/goal/DECISIONS.md`](goal/DECISIONS.md), DSP 파라미터는 [`docs/DSP.md`](DSP.md), 측정 결과는 [`docs/BENCHMARK.md`](BENCHMARK.md).

## 1. 계층

```
UI (React 19, main thread)      src/app · src/features/* · src/ui · src/i18n/ko.ts
  │  판정 이벤트(초당 수 회)만 React state로. 레벨 미터·비트 펄스는 rAF가 직접 그린다.
  ▼
연습 러너·세션·진급              src/exercises (플러그인)  src/features/session|home|curriculum
  │  ExerciseMic / ExerciseOutput 인터페이스로만 오디오를 본다(테스트는 가짜 구현)
  ▼
AudioEngine (main, 싱글턴)        src/audio/engine.ts  (+ metronomeRuntime, ticker worker)
  ├─ AudioWorklet capture-processor   src/audio/worklet  → CaptureCore(링 버퍼·레벨·onset)
  └─ DSP Worker                       src/audio/worker    → src/dsp 순수 함수 호출
  ▼
순수 모듈 (Node에서 그대로 실행)   src/dsp (신호 처리)  src/domain (음악 이론·규칙·지표)
데이터                             src/data (Dexie·저장소·내보내기/가져오기)  src/content (시드·zod 스키마)
```

- `src/dsp/**`, `src/domain/**`는 `window`·`document`·`AudioContext`·`indexedDB`·React를 쓰지 않는다. 시간은 인자로 받는다. `tests/integrity/`가 import를 스캔해 강제한다.
- 한국어 문자열은 `src/i18n/ko.ts`(와 `src/content` 시드)에만 있다. 무결성 테스트가 나머지 파일의 한글을 막는다.

## 2. 오디오 경로

```
마이크 ─ MediaStreamSource ─ capture worklet ──MessageChannel──▶ DSP worker ──▶ main(판정 이벤트)
                               │  128샘플 블록: 4 s 링, ~30 Hz 레벨, 스트리밍 spectral-flux onset
                               │  onset 구간 [−500, +400 ms] · 튜너 프레임 · 요청 구간 → 풀 버퍼 transfer
메트로놈 클릭·RTT 프로브·합성 재생 ─▶ ctx.destination
```

- **시계 하나**: worklet이 첫 블록의 `currentFrame`을 알리고, 캡처 샘플 n = 컨텍스트 프레임 `startFrame + n`. 브라우저가 렌더 블록을 건너뛰면(부하) 빈 프레임을 0으로 채워 이 정렬을 지킨다(D-037). 메트로놈 예약 시각, onset 시각, RTT, 그리드가 모두 같은 오디오 시계다.
- **판정 작업(job)**은 worker의 상태다: onsets(베타 판독 포함 가능) / pluck(Mode A, 버징 베타) / template / strum(Mode B) / pair·set(Mode C) / pfc(E3: Mode C + Mode B 베타) / songStrum(곡: Mode C 집합 점수 + 반주 유지 플래그). 튜너는 따로 켜고 끈다. 구간 분석(noise, rtt, raw, pluck fallback, v1.1 `sequence`·`bleedGain`)과 Mode D `analyzeTiming`은 id로 짝을 맞춘 요청/응답. 모든 응답에 `detectorVersion`·`processingMs`.
- **단음 시퀀스(v1.1 §10.10)**: 스케일·크로매틱·해머온·리프는 onset마다가 아니라 **구간**으로 판정한다. `exercises/sequence/tracker.ts`가 판정할 수 있게 된 슬롯을 ≤ 3.2 s 구간(캡처 링 ~3.9 s 안)으로 묶어 worker에 보내고(앞 구간에서 울리던 음·EXTRA 구간·중복 검출 경계를 넘김), 사이클이 다 판정되면 결과를 낸다. 청크 판정 = 통째 판정을 테스트가 보장한다.
- **반주(v1.1 §8.6)**: 곡 연주 단계의 반주는 합성기(`dsp/synth/backing.ts`)로 카운트인 전에 렌더해 그리드 − 1마디(전주)에 예약한다(`engine.scheduleBacking`: 지난 시각이면 그만큼 건너뛰어 그리드를 지킴). 스피커면 전주 동안 누출 이득을 재고(`bleedGain`), 녹음기 작업에 반주 도착 시각·템플릿을 넣어 worker가 스트럼마다 반주인지 가린다(`backingMask.ts`). 이어폰이면 그대로 판정한다.
- 메시지는 zod 판별 유니온으로 검증한다. CSP(`script-src 'self'`)를 위해 Zod JIT는 끈다.
- **메트로놈**: Worker 안 25 ms 타이머 + 0.1 s lookahead, 앵커 기반 시각(10분 누적 오차 없음). 판정기와 클릭 시각을 공유한다(클릭 누출 마스킹, 그리드).
- **iOS**: AudioContext는 탭 안에서 만들고 재개하며, `getUserMedia` 전에 `audioSession.type = 'play-and-record'`.

## 3. 연습 플러그인

`src/exercises/types.ts`의 `ExercisePlugin<P, R, V>`: params/result zod 스키마, 순수 러너, View, Summary, `toMetrics`.
코어(호스트·세션 러너·기록·차트)는 연습 종류를 모른다. `registry.tsx`의 `definePlugin`이 제네릭을 지우고 경계에서 검증한다.

- `ExerciseRunner`: `start / command(키) / tick(rAF) / finish / hasResult / dspStats`. 마이크가 없으면 모든 러너가 수동·자가 판정으로 끝까지 간다(테스트로 보장).
- `ExerciseHost`: 마이크 시작(탭 안), 키·페달, Wake Lock, 끝나면 Attempt 저장. 아무것도 하지 않았거나 채점하지 못한 실행은 저장하지 않는다. `content`를 넘기면 그 단계 콘텐츠로 실행한다(커리큘럼 직접 연습, D-072). 시작 전 화면에 플러그인의 필수 `howTo(params)`("하는 법": 단계 + 공용 용어)를 펼쳐 보이고, 실행 중에는 접어 둔다(D-079).
- 단일 테이크 선택(`take.ts`)은 벤치마크와 같은 규칙: 무장 후 첫 onset, 400 ms 안의 두 번째 onset은 MULTIPLE, 오래 조용하면 energy fallback. 자동으로 다음 줄로 넘어갈 때는 직전 take 구간 끝부터 무장한다(D-076). E1은 이번 시도에서 소리 난 줄을 pluck job의 `ringing`으로 넘겨 Mode A가 그 울림을 상쇄한다(D-074).
- 즉시 피드백(`liveTiming.ts`, D-077): E5·E6·E8 러너가 tick마다 판정이 다 도착한 마디를 최종 분석과 같은 `analyzeTiming`으로 그 마디만 판정해 view에 싣는다(보기 전용, `ui/LiveBars.tsx`).
- 커리큘럼 직접 연습(`features/curriculum/stagePracticeModel.ts`): 고른 연습을 그 단계의 일회용 사용자 템플릿으로 `generateRoutine`에 넣어 루틴과 같은 파라미터로 만든다. 바로 하기는 단독 실행, 여러 개는 세션 화면의 custom 분기(`routineId: 'custom'`, 세션 단계 = 그 단계, 현재 단계가 아니면 최소 체류에 세지 않음).
- `withHistory(params, 최근 결과)`: 플러그인이 자기 최근 결과로 다음 실행을 고친다(사다리 −5 규칙, E10 단계·템포, E11 쌍, 곡 단계 첫 실행 안내·설정에 없는 장치의 이어폰 기억). 호스트가 실행마다 적용하고, 보는 깊이는 플러그인이 정한다(`historyDepth`, 기본 5, 주제가 순환하는 E9·E10·E11은 30). 루틴이 정하는 템포(E5·E6·E8·E17)는 루틴이, 이력으로 정하는 템포(E9·E10·E11)는 이 경로가 사다리 현재 BPM을 쓴다.
- **곡 이어폰 기억(D-101)**: 곡 반주의 이어폰/스피커 선택은 기기 설정 `earphonesByOutput`(출력 장치 라벨 → 이어폰인가)에 저장한다. 반주를 켠 실행이 끝나면 호스트가 플러그인의 `earphoneChoice(결과)`로 그 실행의 출력 장치 라벨과 선택을 받아 설정에 쓴다(`src/exercises/ui/earphoneSetting.ts`의 `saveEarphoneChoice` → `rememberEarphones` → 설정 저장소 `update`). 다음 실행은 `ctx.settings.earphonesByOutput[출력 장치]`를 기본값으로 쓰고, 설정에 없는 장치만 예전처럼 최근 곡 기록 50개(`historyDepth`, `withHistory`의 `params.earphonesByOutput`)에서 찾는다. 그 다음은 `params.earphones`(기본 스피커)다. 그래서 오래 안 쓴 장치도 선택을 잊지 않는다.
- **일시정지(D-085)**: 메트로놈 연습(S·E5·E6·E8은 `GridRecorder`, 시퀀스는 `SequenceRunner`)은 한 실행을 `Timeline` 구간 목록으로 둔다. 일시정지는 구간을 끊긴 마디(바퀴) 앞에서 닫고 메트로놈을 멈추며, 이어 하기는 새 그리드에 다음 구간을 연다. 마디·음 번호는 실행 전체 기준이고, 시각이 필요한 곳(채점 슬롯, 실시간 마디, 현재 마디)은 `timeline.start/position/starts`로 읽는다. job은 끄지 않고 구간 시간 창으로 이벤트를 거른다. 공통 조작은 `BaseRunner.handlePause`(phase `paused`, 타이머 정지)와 `ExerciseHost`의 일시정지 버튼(`pausable` 플러그인만).
- 시퀀스 연습(E9·E10·E11·E17)은 공용 `SequenceRunner`(메트로놈·계획·트래커·자가 보고)를 상속한다. 베타 판독(방향·팜뮤트·셈여림·버징·레가토)은 화면에 "참고(베타)"로만 보이고 결과·지표의 판정에 쓰지 않는다(무결성 10).

## 4. 데이터

Dexie(IndexedDB) 스키마 v1: `voicings, routines, sessions, attempts, metrics, skills, progression, reviews, calibrations, recordings, meta`. v2(v1.1)는 복습 종류(`reviews.kind`)를 색인하고, 진도에 처방 목록·`completedBeginner2`를 더한다(마이그레이션 테스트).

- **사실(append-only)**: Attempt(파라미터 스냅샷·결과·detectorVersion·processingMs), Session, Calibration, Recording. 수정·삭제 API가 없다(초기화만 예외).
- **캐시(재계산 가능)**: metrics·skills·reviews는 `applyAttempt`로 증분 갱신하고, `rebuildDerived()`가 Attempt 전체에서 다시 만든다(증분 = 재계산을 테스트).
- 내보내기/가져오기: JSON 봉투(zod 검증·마이그레이션 골격) → 미리보기 → 합치기 또는 2단계 확인 바꾸기. 녹음 오디오는 OPFS, 따로 zip 내보내기(`labels.json` = `bench:real` 스키마).

## 5. 커리큘럼·루틴·진급

- 커리큘럼(Stage 0–11)과 진급 규칙은 **데이터**(`src/content/curriculum.ts`, `UnlockRule[]`)이고 `domain/progression.ts`가 평가한다(스테이지별 if문 없음). Stage 7 졸업 시험 → 초급 1 수료 + Stage 8, Stage 11 기준 충족 → 초급 2 수료. 각 learn 항목은 그것을 연습시키는 연습(`practicedBy`)을 가리킨다(무결성 8).
- 오늘의 루틴은 순수·결정적 생성기(`domain/routine.ts`, 시드 = 날짜). 스테이지 시간 템플릿(`routineTemplates.ts`, 20분 / Stage 8+ 30분)의 칸을 규칙(쌍 슬롯·순환 3세션 보장·처방·복습·레퍼토리·규칙 10 파라미터)으로 채운다. 세션 시작 때 `sessionPrep.ts`가 처방을 만료·추가한다(2주 정체 감지, 조건부 진급). 세션 러너는 루틴 항목을 플러그인 params로 바꿔(`features/session/routineParams.ts`) 차례로 실행한다. 30분 세션은 리듬 블록 뒤에서 나눠 같은 날 이어서 할 수 있다(`meta.splitResume`, 같은 세션 id).
- 복습 큐(간격 반복: 졸업한 코드·쌍·패턴·곡·스케일 단계·리프 + 지식 카드)와 주간 스트릭은 `domain/srs.ts`·`derive.ts`. 졸업 시험 5항목은 `features/curriculum/examModel.ts`.
- **커리큘럼 시뮬레이션**(`domain/simulate.ts`, v1.1 §14.9): 가상 학습자(`simLearners.ts`)가 하루 한 세션씩 실제 루틴·진급·복습 코드를 따라간다. 플러그인 params·`withHistory`·`toMetrics`·`applyAttempt`는 테스트가 실제 것을 주입한다. learn 항목·순환·규칙→연습·필요 쌍·복습 FIFO·합계·파라미터 의미와 Stage 0 → 초급 2 수료 도달(교착 0)을 단언한다.

## 6. 품질 장치

| 층 | 무엇 | 위치 |
|---|---|---|
| 단위 | 순수 모듈·러너(가짜 시계·스크립트된 판정 이벤트)·엔진(가짜 플랫폼)·worklet 모듈(Node) | `src/**/*.test.ts` |
| 합성 벤치 | 결정적 합성기 + 채널 모델, dev/test split, 임계값 판정 | `tools/bench/`, `npm run bench:dsp` |
| 실녹음 벤치 | GuitarSet(Zenodo, MD5), dev 00–03 / test 04–05 | `tools/guitarset/`, `npm run bench:guitarset` |
| 실기기 | 녹음 키트 내보내기 → `tests/fixtures/real/<기기>/` | `npm run bench:real` |
| E2E | 가짜 마이크 하네스(같은 AudioContext), 실제 getUserMedia, WebKit iPad/iPhone | `tests/e2e/`, `npm run test:e2e` |
| 시뮬레이션 | Stage 0–11 루틴·진급·복습을 가상 학습자로 28일/도달 실행(§14.9) | `src/domain/simulate.test.ts` |
| 무결성 | 순수성, skip/only 금지, TS 억제 금지, 한글 위치, 테스트 훅 동결, `Math.random` 금지, 임계값 계약(v1 ⊆ v1.1), learn 항목 연결, SPEC 요구 함수의 프로덕션 호출, 베타 계약(게이트 아님), 리서치 추적표 완전성, git 추적 누락 | `tests/integrity/` |
| 게이트 | 위 전부 + 라이선스·타입·린트·빌드 → 요약표 | `npm run verify` |

## 7. 빌드·배포

Vite 8 + React 19 + TypeScript(strict) + Tailwind 4. `vite-plugin-pwa`(prompt 업데이트), 해시 라우팅, `VITE_BASE` 하위 경로.
E2E 전용 빌드(`dist-e2e`)에만 테스트 훅(`window.__gh_test`)과 시간 압축 파라미터가 남고 프로덕션 번들에서는 dead-code 제거된다(E2E-14가 번들 문자열을 검사).
보안 헤더와 호스팅 절차는 [`docs/DEPLOY.md`](DEPLOY.md).
