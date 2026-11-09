# BENCHMARK — 합성 DSP 벤치마크 (생성 파일)

> `npm run bench:dsp`(test split)가 생성한다. 손으로 고치지 않는다. GuitarSet 결과는 `npm run bench:guitarset`가 아래 별도 절에 쓴다.

- 실행: 2026-11-09T09:50:09.260Z · split **test** · detectorVersion **1.6.0** · 14406 cases · 261 s
- 결과: **ALL THRESHOLDS MET** (임계값: `docs/goal/v1.1/thresholds.json` — v1 계약을 그대로 포함, 무결성 11)

## 지표 요약

| 영역 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| modeA | okFalseRejectMax | 0.0000 | 0.0300 | PASS | 429 |
| modeA | okRetryMax | 0.0000 | 0.1000 | PASS | 429 |
| modeA | wrongNoteFalseAcceptMax | 0.0000 | 0.0200 | PASS | 1716 |
| modeA | mutedFalseAcceptMax | 0.0023 | 0.0500 | PASS | 429 |
| modeA | weakFundamentalOkMin | 1.000 | 0.9500 | PASS | 429 |
| modeA | mutedDetectRateMin | 0.9790 | 0.8000 | PASS | 429 |
| modeA | wrongNoteDetectRateMin | 0.9936 | 0.9000 | PASS | 1716 |
| modeB | cleanFailMax | 0.0100 | 0.0300 | PASS | 600 |
| modeB | cleanRetryMax | 0.0625 | 0.1500 | PASS | 400 |
| modeB | verifiableMutedPassMax | 0.0025 | 0.1000 | PASS | 400 |
| modeB | verifiableMutedCorrectFlagMin | 0.9025 | 0.8500 | PASS | 400 |
| modeB | xStringRingingUnexpectedFailMin | 0.9250 | 0.8500 | PASS | 400 |
| modeB | xStringRingingPassMax | 0.0625 | 0.1000 | PASS | 400 |
| modeB | wrongFretVerifiablePassMax | 0.0050 | 0.1000 | PASS | 400 |
| modeB | dependentMutedMisattributionMax | 0.0100 | 0.0500 | PASS | 400 |
| modeC | absErrLe1RateMin | 1.000 | 0.9500 | PASS | 120 |
| modeC | overcountGe2RateMax | 0.0000 | 0.0100 | PASS | 120 |
| modeC | meanAbsErrMax | 0.0000 | 0.6000 | PASS | 120 |
| modeCSet | top1AccuracyMin | 0.9970 | 0.9000 | PASS | 1000 |
| modeD | onsetF1At25msMin | 0.9911 | 0.9500 | PASS | 3772 |
| modeD | timingAbsErrP95MsMax | 8.277 | 15.000 | PASS | 3771 |
| modeD | timingAbsErrMedianMsMax | 0.8163 | 6.000 | PASS | 3771 |
| modeD | sustainFalseOnsetRateMax | 0.0075 | 0.0200 | PASS | 400 |
| modeD | clickBleedRejectRateMin | 0.9851 | 0.9800 | PASS | 134 |
| modeD | patternMissExtraAccuracyMin | 0.9963 | 0.9500 | PASS | 5152 |
| tuner | medianAbsCentsMax | 0.0873 | 1.000 | PASS | 1000 |
| tuner | p95AbsCentsMax | 2.170 | 3.000 | PASS | 1000 |
| tuner | octaveErrorRateMax | 0.0010 | 0.0050 | PASS | 1000 |
| tuner | timeToStableMsP95Max | 125.3 | 300.0 | PASS | 1000 |
| rtt | absErrP95MsMax | 0.0278 | 2.000 | PASS | 200 |
| rtt | silentFailureReportRateMin | 1.000 | 1.000 | PASS | 60 |
| sequence | noteOnsetF1At30msMin | 0.9994 | 0.9500 | PASS | 5027 |
| sequence | cleanNoteOkRateMin | 0.9978 | 0.9700 | PASS | 5027 |
| sequence | wrongNoteDetectRateMin | 1.000 | 0.9000 | PASS | 480 |
| sequence | missedDetectRateMin | 1.000 | 0.9000 | PASS | 240 |
| sequence | extraDetectRateMin | 0.9875 | 0.8500 | PASS | 240 |
| sequence | faultyCycleFlawlessRateMax | 0.0021 | 0.0200 | PASS | 960 |
| sequence | cleanCycleFlawlessRateMin | 1.000 | 0.9000 | PASS | 136 |
| sequence | cleanCycleUncertainRateMax | 0.0000 | 0.0500 | PASS | 157 |
| modeCSetStage8to11 | top1AccuracyMin | 0.9990 | 0.9000 | PASS | 1000 |
| swing | onsetF1At25msMin | 0.9924 | 0.9500 | PASS | 3008 |
| swing | timingAbsErrP95MsMax | 9.229 | 15.000 | PASS | 3008 |
| swing | slotAssignmentAccuracyMin | 0.9724 | 0.9500 | PASS | 3008 |
| backingBleed | strumOnsetF1At25msMin | 0.9863 | 0.9000 | PASS | 2672 |
| backingBleed | backingHitFalseStrumRateMax | 0.0049 | 0.0500 | PASS | 2022 |
| perf | verifyStrumMedianMsMax | 9.871 | 20.000 | PASS | 1 |
| perf | verifyPluckMedianMsMax | 2.269 | 10.000 | PASS | 1 |
| perf | workletBlockAvgMsMax | 0.0367 | 0.3000 | PASS | 1 |
| coverage | modeBVerifiableRatioAtLeastDefaultRule | 0.4565 | 0.4565 | PASS | 9 |

## 베타 — 게이트 아님

> 정답 데이터가 없는 판정기(SPEC v1.1 §10.11)를 합성 조건으로 잰 값이다. 목표치는 `thresholds.json.beta.targets`(보고 전용)이고, 못 미쳐도 verify는 통과한다(무결성 10). 앱은 이 결과를 "참고(베타)"로만 보여 주고 지표·진급에 쓰지 않는다.

| 지표 | 값 | 목표 | 목표 충족 | n |
|---|---|---|---|---|
| buzzDetectRateMin | 0.6200 | 0.7000 | 아니오 | 500 |
| buzzFalseAlarmRateMax | 0.1080 | 0.1000 | 아니오 | 500 |
| directionAccuracyMin | 0.5500 | 0.8500 | 아니오 | 500 |
| legatoOnsetRecallMin | 0.9920 | 0.7000 | 예 | 500 |
| legatoFalseOnsetRateMax | 0.0000 | 0.1000 | 예 | 500 |
| palmMuteAccuracyMin | 0.9990 | 0.8000 | 예 | 1000 |
| dynamicsAccuracyMin | 1.000 | 0.8500 | 예 | 500 |
| modeCUnderBleedAbsErrLe1RateMin | 0.7333 | 0.8500 | 아니오 | 120 |

## 스트럼 모드 검증 가능 줄 커버리지 (Stage 0–7, §6.3 기본 규칙)

| 보이싱 | 연주 줄 | verifiable 줄 | 비율 | verifiable idx (0=6번 줄) |
|---|---|---|---|---|
| D | 4 | 3 | 0.75 | 2, 3, 5 |
| A | 5 | 2 | 0.40 | 2, 4 |
| E | 6 | 2 | 0.33 | 1, 3 |
| Em | 6 | 2 | 0.33 | 1, 3 |
| Am | 5 | 2 | 0.40 | 2, 4 |
| Dm | 4 | 3 | 0.75 | 2, 3, 5 |
| C | 5 | 3 | 0.60 | 1, 2, 3 |
| G-2f | 5 | 2 | 0.40 | 2, 4 |
| G-3f | 6 | 2 | 0.33 | 1, 2 |
| **전체** | | | **0.457** | |

## 제외한 불가능 조합 (§14.3-5)

- A:wrong-1: 46
- A:wrong-2: 62
- B:dependent-muted: 2
- B:x-string-ringing: 8

## 조건별 분해

<details><summary>modeA.okFalseRejectMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 140 |
| 25 | 0.0000 | 140 |
| 40 | 0.0000 | 149 |

</details>

<details><summary>modeA.okFalseRejectMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 143 |
| 100 | 0.0000 | 140 |
| 150 | 0.0000 | 146 |

</details>

<details><summary>modeA.okFalseRejectMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 221 |
| karplus-strong | 0.0000 | 208 |

</details>

<details><summary>modeA.okFalseRejectMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 213 |
| 48000 | 0.0000 | 216 |

</details>

<details><summary>modeA.okFalseRejectMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 225 |
| small-room | 0.0000 | 204 |

</details>

<details><summary>modeA.okFalseRejectMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 13 |
| A5 | 0.0000 | 16 |
| A7 | 0.0000 | 13 |
| A7sus4 | 0.0000 | 17 |
| Am | 0.0000 | 16 |
| B7 | 0.0000 | 19 |
| C | 0.0000 | 15 |
| C5 | 0.0000 | 16 |
| C7 | 0.0000 | 17 |
| Cadd9 | 0.0000 | 15 |
| D | 0.0000 | 17 |
| D5 | 0.0000 | 15 |
| D7 | 0.0000 | 15 |
| Dm | 0.0000 | 13 |
| Dsus4 | 0.0000 | 19 |
| E | 0.0000 | 12 |
| E5 | 0.0000 | 16 |
| E7 | 0.0000 | 15 |
| Em | 0.0000 | 19 |
| Em7 | 0.0000 | 9 |
| F | 0.0000 | 12 |
| F-small | 0.0000 | 14 |
| F5 | 0.0000 | 15 |
| Fmaj7 | 0.0000 | 15 |
| G-2f | 0.0000 | 13 |
| G-3f | 0.0000 | 11 |
| G-4f | 0.0000 | 19 |
| G5 | 0.0000 | 11 |
| G7 | 0.0000 | 12 |

</details>

<details><summary>modeA.okRetryMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 140 |
| 25 | 0.0000 | 140 |
| 40 | 0.0000 | 149 |

</details>

<details><summary>modeA.okRetryMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 143 |
| 100 | 0.0000 | 140 |
| 150 | 0.0000 | 146 |

</details>

<details><summary>modeA.okRetryMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 221 |
| karplus-strong | 0.0000 | 208 |

</details>

<details><summary>modeA.okRetryMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 213 |
| 48000 | 0.0000 | 216 |

</details>

<details><summary>modeA.okRetryMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 225 |
| small-room | 0.0000 | 204 |

</details>

<details><summary>modeA.okRetryMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 13 |
| A5 | 0.0000 | 16 |
| A7 | 0.0000 | 13 |
| A7sus4 | 0.0000 | 17 |
| Am | 0.0000 | 16 |
| B7 | 0.0000 | 19 |
| C | 0.0000 | 15 |
| C5 | 0.0000 | 16 |
| C7 | 0.0000 | 17 |
| Cadd9 | 0.0000 | 15 |
| D | 0.0000 | 17 |
| D5 | 0.0000 | 15 |
| D7 | 0.0000 | 15 |
| Dm | 0.0000 | 13 |
| Dsus4 | 0.0000 | 19 |
| E | 0.0000 | 12 |
| E5 | 0.0000 | 16 |
| E7 | 0.0000 | 15 |
| Em | 0.0000 | 19 |
| Em7 | 0.0000 | 9 |
| F | 0.0000 | 12 |
| F-small | 0.0000 | 14 |
| F5 | 0.0000 | 15 |
| Fmaj7 | 0.0000 | 15 |
| G-2f | 0.0000 | 13 |
| G-3f | 0.0000 | 11 |
| G-4f | 0.0000 | 19 |
| G5 | 0.0000 | 11 |
| G7 | 0.0000 | 12 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 565 |
| 25 | 0.0000 | 578 |
| 40 | 0.0000 | 573 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 570 |
| 100 | 0.0000 | 580 |
| 150 | 0.0000 | 566 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 832 |
| karplus-strong | 0.0000 | 884 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 847 |
| 48000 | 0.0000 | 869 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 856 |
| small-room | 0.0000 | 860 |

</details>

<details><summary>modeA.wrongNoteFalseAcceptMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 65 |
| A5 | 0.0000 | 59 |
| A7 | 0.0000 | 64 |
| A7sus4 | 0.0000 | 62 |
| Am | 0.0000 | 55 |
| B7 | 0.0000 | 62 |
| C | 0.0000 | 59 |
| C5 | 0.0000 | 56 |
| C7 | 0.0000 | 55 |
| Cadd9 | 0.0000 | 61 |
| D | 0.0000 | 60 |
| D5 | 0.0000 | 49 |
| D7 | 0.0000 | 65 |
| Dm | 0.0000 | 57 |
| Dsus4 | 0.0000 | 55 |
| E | 0.0000 | 57 |
| E5 | 0.0000 | 58 |
| E7 | 0.0000 | 61 |
| Em | 0.0000 | 60 |
| Em7 | 0.0000 | 58 |
| F | 0.0000 | 64 |
| F-small | 0.0000 | 60 |
| F5 | 0.0000 | 66 |
| Fmaj7 | 0.0000 | 54 |
| G-2f | 0.0000 | 59 |
| G-3f | 0.0000 | 61 |
| G-4f | 0.0000 | 50 |
| G5 | 0.0000 | 64 |
| G7 | 0.0000 | 60 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0064 | 157 |
| 25 | 0.0000 | 143 |
| 40 | 0.0000 | 129 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 151 |
| 100 | 0.0000 | 129 |
| 150 | 0.0067 | 149 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 224 |
| karplus-strong | 0.0049 | 205 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 229 |
| 48000 | 0.0050 | 200 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0047 | 213 |
| small-room | 0.0000 | 216 |

</details>

<details><summary>modeA.mutedFalseAcceptMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 17 |
| A5 | 0.0000 | 12 |
| A7 | 0.0000 | 13 |
| A7sus4 | 0.0000 | 13 |
| Am | 0.0000 | 20 |
| B7 | 0.0000 | 13 |
| C | 0.0000 | 17 |
| C5 | 0.0000 | 15 |
| C7 | 0.0000 | 20 |
| Cadd9 | 0.0000 | 16 |
| D | 0.0000 | 14 |
| D5 | 0.0000 | 18 |
| D7 | 0.0000 | 10 |
| Dm | 0.0000 | 15 |
| Dsus4 | 0.0000 | 14 |
| E | 0.0000 | 15 |
| E5 | 0.0000 | 17 |
| E7 | 0.0000 | 10 |
| Em | 0.0000 | 7 |
| Em7 | 0.0000 | 18 |
| F | 0.0000 | 14 |
| F-small | 0.0667 | 15 |
| F5 | 0.0000 | 12 |
| Fmaj7 | 0.0000 | 17 |
| G-2f | 0.0000 | 16 |
| G-3f | 0.0000 | 21 |
| G-4f | 0.0000 | 18 |
| G5 | 0.0000 | 9 |
| G7 | 0.0000 | 13 |

</details>

<details><summary>modeA.weakFundamentalOkMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 1.000 | 139 |
| 25 | 1.000 | 140 |
| 40 | 1.000 | 150 |

</details>

<details><summary>modeA.weakFundamentalOkMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 137 |
| 100 | 1.000 | 152 |
| 150 | 1.000 | 140 |

</details>

<details><summary>modeA.weakFundamentalOkMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 224 |
| karplus-strong | 1.000 | 205 |

</details>

<details><summary>modeA.weakFundamentalOkMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 213 |
| 48000 | 1.000 | 216 |

</details>

<details><summary>modeA.weakFundamentalOkMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 208 |
| small-room | 1.000 | 221 |

</details>

<details><summary>modeA.weakFundamentalOkMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 1.000 | 9 |
| A5 | 1.000 | 16 |
| A7 | 1.000 | 13 |
| A7sus4 | 1.000 | 11 |
| Am | 1.000 | 13 |
| B7 | 1.000 | 10 |
| C | 1.000 | 13 |
| C5 | 1.000 | 16 |
| C7 | 1.000 | 12 |
| Cadd9 | 1.000 | 12 |
| D | 1.000 | 13 |
| D5 | 1.000 | 21 |
| D7 | 1.000 | 13 |
| Dm | 1.000 | 19 |
| Dsus4 | 1.000 | 16 |
| E | 1.000 | 20 |
| E5 | 1.000 | 12 |
| E7 | 1.000 | 17 |
| Em | 1.000 | 18 |
| Em7 | 1.000 | 18 |
| F | 1.000 | 13 |
| F-small | 1.000 | 15 |
| F5 | 1.000 | 10 |
| Fmaj7 | 1.000 | 17 |
| G-2f | 1.000 | 16 |
| G-3f | 1.000 | 11 |
| G-4f | 1.000 | 17 |
| G5 | 1.000 | 20 |
| G7 | 1.000 | 18 |

</details>

<details><summary>modeA.mutedDetectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9745 | 157 |
| 25 | 0.9930 | 143 |
| 40 | 0.9690 | 129 |

</details>

<details><summary>modeA.mutedDetectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9801 | 151 |
| 100 | 0.9690 | 129 |
| 150 | 0.9866 | 149 |

</details>

<details><summary>modeA.mutedDetectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9688 | 224 |
| karplus-strong | 0.9902 | 205 |

</details>

<details><summary>modeA.mutedDetectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9738 | 229 |
| 48000 | 0.9850 | 200 |

</details>

<details><summary>modeA.mutedDetectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9906 | 213 |
| small-room | 0.9676 | 216 |

</details>

<details><summary>modeA.mutedDetectRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 1.000 | 17 |
| A5 | 1.000 | 12 |
| A7 | 0.9231 | 13 |
| A7sus4 | 1.000 | 13 |
| Am | 1.000 | 20 |
| B7 | 1.000 | 13 |
| C | 1.000 | 17 |
| C5 | 1.000 | 15 |
| C7 | 1.000 | 20 |
| Cadd9 | 1.000 | 16 |
| D | 1.000 | 14 |
| D5 | 0.9444 | 18 |
| D7 | 0.9000 | 10 |
| Dm | 1.000 | 15 |
| Dsus4 | 1.000 | 14 |
| E | 1.000 | 15 |
| E5 | 0.8824 | 17 |
| E7 | 1.000 | 10 |
| Em | 0.8571 | 7 |
| Em7 | 1.000 | 18 |
| F | 1.000 | 14 |
| F-small | 0.9333 | 15 |
| F5 | 1.000 | 12 |
| Fmaj7 | 0.9412 | 17 |
| G-2f | 1.000 | 16 |
| G-3f | 0.9524 | 21 |
| G-4f | 1.000 | 18 |
| G5 | 1.000 | 9 |
| G7 | 1.000 | 13 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9823 | 565 |
| 25 | 0.9983 | 578 |
| 40 | 1.000 | 573 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9965 | 570 |
| 100 | 0.9931 | 580 |
| 150 | 0.9912 | 566 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9940 | 832 |
| karplus-strong | 0.9932 | 884 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9929 | 847 |
| 48000 | 0.9942 | 869 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9942 | 856 |
| small-room | 0.9930 | 860 |

</details>

<details><summary>modeA.wrongNoteDetectRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.9846 | 65 |
| A5 | 0.9831 | 59 |
| A7 | 1.000 | 64 |
| A7sus4 | 0.9839 | 62 |
| Am | 0.9818 | 55 |
| B7 | 1.000 | 62 |
| C | 1.000 | 59 |
| C5 | 1.000 | 56 |
| C7 | 1.000 | 55 |
| Cadd9 | 0.9836 | 61 |
| D | 1.000 | 60 |
| D5 | 1.000 | 49 |
| D7 | 0.9846 | 65 |
| Dm | 0.9825 | 57 |
| Dsus4 | 1.000 | 55 |
| E | 1.000 | 57 |
| E5 | 1.000 | 58 |
| E7 | 1.000 | 61 |
| Em | 0.9833 | 60 |
| Em7 | 1.000 | 58 |
| F | 0.9844 | 64 |
| F-small | 1.000 | 60 |
| F5 | 1.000 | 66 |
| Fmaj7 | 1.000 | 54 |
| G-2f | 1.000 | 59 |
| G-3f | 0.9836 | 61 |
| G-4f | 0.9800 | 50 |
| G5 | 1.000 | 64 |
| G7 | 1.000 | 60 |

</details>

<details><summary>modeB.cleanFailMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0100 | 200 |
| 25 | 0.0150 | 200 |
| 40 | 0.0050 | 200 |

</details>

<details><summary>modeB.cleanFailMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0139 | 216 |
| 100 | 0.0052 | 191 |
| 150 | 0.0104 | 193 |

</details>

<details><summary>modeB.cleanFailMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0099 | 304 |
| karplus-strong | 0.0101 | 296 |

</details>

<details><summary>modeB.cleanFailMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0068 | 294 |
| 48000 | 0.0131 | 306 |

</details>

<details><summary>modeB.cleanFailMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 283 |
| small-room | 0.0189 | 317 |

</details>

<details><summary>modeB.cleanFailMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 20 |
| A5 | 0.0417 | 24 |
| A7 | 0.0000 | 25 |
| A7sus4 | 0.0000 | 24 |
| Am | 0.0000 | 18 |
| B7 | 0.0000 | 19 |
| C | 0.0476 | 21 |
| C5 | 0.0000 | 20 |
| C7 | 0.0000 | 23 |
| Cadd9 | 0.0800 | 25 |
| D | 0.0417 | 24 |
| D5 | 0.0000 | 23 |
| D7 | 0.0000 | 13 |
| Dm | 0.0000 | 18 |
| Dsus4 | 0.0000 | 23 |
| E | 0.0000 | 25 |
| E5 | 0.0000 | 17 |
| E7 | 0.0000 | 19 |
| Em | 0.0000 | 21 |
| Em7 | 0.0000 | 21 |
| F | 0.0000 | 22 |
| F-small | 0.0000 | 22 |
| F5 | 0.0000 | 21 |
| Fmaj7 | 0.0000 | 23 |
| G-2f | 0.0000 | 15 |
| G-3f | 0.0000 | 15 |
| G-4f | 0.0000 | 22 |
| G5 | 0.0476 | 21 |
| G7 | 0.0000 | 16 |

</details>

<details><summary>modeB.cleanRetryMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0950 | 200 |
| 40 | 0.0300 | 200 |

</details>

<details><summary>modeB.cleanRetryMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0272 | 147 |
| 100 | 0.1120 | 125 |
| 150 | 0.0547 | 128 |

</details>

<details><summary>modeB.cleanRetryMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0355 | 197 |
| karplus-strong | 0.0887 | 203 |

</details>

<details><summary>modeB.cleanRetryMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0784 | 204 |
| 48000 | 0.0459 | 196 |

</details>

<details><summary>modeB.cleanRetryMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0421 | 190 |
| small-room | 0.0810 | 210 |

</details>

<details><summary>modeB.cleanRetryMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0714 | 14 |
| A5 | 0.0556 | 18 |
| A7 | 0.0476 | 21 |
| A7sus4 | 0.1176 | 17 |
| Am | 0.0000 | 9 |
| B7 | 0.0000 | 15 |
| C | 0.0000 | 14 |
| C5 | 0.0000 | 11 |
| C7 | 0.0000 | 16 |
| Cadd9 | 0.0000 | 20 |
| D | 0.0769 | 13 |
| D5 | 0.0000 | 13 |
| D7 | 0.0000 | 9 |
| Dm | 0.0714 | 14 |
| Dsus4 | 0.0769 | 13 |
| E | 0.1500 | 20 |
| E5 | 0.0714 | 14 |
| E7 | 0.0909 | 11 |
| Em | 0.1333 | 15 |
| Em7 | 0.2500 | 16 |
| F | 0.0000 | 12 |
| F-small | 0.1250 | 16 |
| F5 | 0.0000 | 11 |
| Fmaj7 | 0.1667 | 12 |
| G-2f | 0.0000 | 9 |
| G-3f | 0.0000 | 10 |
| G-4f | 0.0714 | 14 |
| G5 | 0.0000 | 12 |
| G7 | 0.0909 | 11 |

</details>

<details><summary>modeB.verifiableMutedPassMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0000 | 200 |
| 40 | 0.0050 | 200 |

</details>

<details><summary>modeB.verifiableMutedPassMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 130 |
| 100 | 0.0000 | 151 |
| 150 | 0.0084 | 119 |

</details>

<details><summary>modeB.verifiableMutedPassMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 195 |
| karplus-strong | 0.0049 | 205 |

</details>

<details><summary>modeB.verifiableMutedPassMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0050 | 202 |
| 48000 | 0.0000 | 198 |

</details>

<details><summary>modeB.verifiableMutedPassMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 206 |
| small-room | 0.0052 | 194 |

</details>

<details><summary>modeB.verifiableMutedPassMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 9 |
| A5 | 0.0000 | 14 |
| A7 | 0.0000 | 15 |
| A7sus4 | 0.0000 | 8 |
| Am | 0.0000 | 16 |
| B7 | 0.0000 | 17 |
| C | 0.0000 | 15 |
| C5 | 0.0000 | 14 |
| C7 | 0.0000 | 14 |
| Cadd9 | 0.0000 | 10 |
| D | 0.0833 | 12 |
| D5 | 0.0000 | 13 |
| D7 | 0.0000 | 11 |
| Dm | 0.0000 | 19 |
| Dsus4 | 0.0000 | 14 |
| E | 0.0000 | 17 |
| E5 | 0.0000 | 12 |
| E7 | 0.0000 | 15 |
| Em | 0.0000 | 14 |
| Em7 | 0.0000 | 7 |
| F | 0.0000 | 15 |
| F-small | 0.0000 | 14 |
| F5 | 0.0000 | 17 |
| Fmaj7 | 0.0000 | 10 |
| G-2f | 0.0000 | 17 |
| G-3f | 0.0000 | 11 |
| G-4f | 0.0000 | 18 |
| G5 | 0.0000 | 10 |
| G7 | 0.0000 | 22 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.8700 | 200 |
| 40 | 0.9350 | 200 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.8923 | 130 |
| 100 | 0.9073 | 151 |
| 150 | 0.9076 | 119 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9333 | 195 |
| karplus-strong | 0.8732 | 205 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.8960 | 202 |
| 48000 | 0.9091 | 198 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.8883 | 206 |
| small-room | 0.9175 | 194 |

</details>

<details><summary>modeB.verifiableMutedCorrectFlagMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 1.000 | 9 |
| A5 | 0.9286 | 14 |
| A7 | 1.000 | 15 |
| A7sus4 | 0.7500 | 8 |
| Am | 0.9375 | 16 |
| B7 | 0.9412 | 17 |
| C | 0.9333 | 15 |
| C5 | 1.000 | 14 |
| C7 | 1.000 | 14 |
| Cadd9 | 0.8000 | 10 |
| D | 0.8333 | 12 |
| D5 | 1.000 | 13 |
| D7 | 1.000 | 11 |
| Dm | 1.000 | 19 |
| Dsus4 | 0.7143 | 14 |
| E | 1.000 | 17 |
| E5 | 1.000 | 12 |
| E7 | 1.000 | 15 |
| Em | 0.5714 | 14 |
| Em7 | 1.000 | 7 |
| F | 0.9333 | 15 |
| F-small | 0.9286 | 14 |
| F5 | 0.9412 | 17 |
| Fmaj7 | 1.000 | 10 |
| G-2f | 0.9412 | 17 |
| G-3f | 0.9091 | 11 |
| G-4f | 0.9444 | 18 |
| G5 | 0.9000 | 10 |
| G7 | 0.4545 | 22 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.8850 | 200 |
| 40 | 0.9650 | 200 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9375 | 128 |
| 100 | 0.9265 | 136 |
| 150 | 0.9118 | 136 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9670 | 212 |
| karplus-strong | 0.8777 | 188 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9442 | 197 |
| 48000 | 0.9064 | 203 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9401 | 217 |
| small-room | 0.9071 | 183 |

</details>

<details><summary>modeB.xStringRingingUnexpectedFailMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.9200 | 25 |
| A5 | 0.9231 | 13 |
| A7 | 0.7895 | 19 |
| A7sus4 | 0.7273 | 11 |
| Am | 0.9412 | 17 |
| B7 | 0.9333 | 15 |
| C | 0.7600 | 25 |
| C5 | 1.000 | 18 |
| C7 | 1.000 | 16 |
| Cadd9 | 0.8095 | 21 |
| D | 1.000 | 20 |
| D5 | 1.000 | 18 |
| D7 | 0.8889 | 18 |
| Dm | 1.000 | 17 |
| Dsus4 | 0.9615 | 26 |
| E5 | 1.000 | 20 |
| F-small | 0.9500 | 20 |
| F5 | 1.000 | 14 |
| Fmaj7 | 0.8696 | 23 |
| G-2f | 0.9600 | 25 |
| G5 | 1.000 | 19 |

</details>

<details><summary>modeB.xStringRingingPassMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0900 | 200 |
| 40 | 0.0350 | 200 |

</details>

<details><summary>modeB.xStringRingingPassMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0547 | 128 |
| 100 | 0.0588 | 136 |
| 150 | 0.0735 | 136 |

</details>

<details><summary>modeB.xStringRingingPassMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0330 | 212 |
| karplus-strong | 0.0957 | 188 |

</details>

<details><summary>modeB.xStringRingingPassMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0457 | 197 |
| 48000 | 0.0788 | 203 |

</details>

<details><summary>modeB.xStringRingingPassMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0553 | 217 |
| small-room | 0.0710 | 183 |

</details>

<details><summary>modeB.xStringRingingPassMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0800 | 25 |
| A5 | 0.0769 | 13 |
| A7 | 0.2105 | 19 |
| A7sus4 | 0.2727 | 11 |
| Am | 0.0588 | 17 |
| B7 | 0.0667 | 15 |
| C | 0.2000 | 25 |
| C5 | 0.0000 | 18 |
| C7 | 0.0000 | 16 |
| Cadd9 | 0.1429 | 21 |
| D | 0.0000 | 20 |
| D5 | 0.0000 | 18 |
| D7 | 0.0000 | 18 |
| Dm | 0.0000 | 17 |
| Dsus4 | 0.0385 | 26 |
| E5 | 0.0000 | 20 |
| F-small | 0.0000 | 20 |
| F5 | 0.0000 | 14 |
| Fmaj7 | 0.1304 | 23 |
| G-2f | 0.0400 | 25 |
| G5 | 0.0000 | 19 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0050 | 200 |
| 40 | 0.0050 | 200 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0072 | 138 |
| 100 | 0.0000 | 127 |
| 150 | 0.0074 | 135 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0051 | 195 |
| karplus-strong | 0.0049 | 205 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0049 | 204 |
| 48000 | 0.0051 | 196 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0051 | 196 |
| small-room | 0.0049 | 204 |

</details>

<details><summary>modeB.wrongFretVerifiablePassMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 14 |
| A5 | 0.0000 | 10 |
| A7 | 0.0769 | 13 |
| A7sus4 | 0.0000 | 11 |
| Am | 0.0000 | 16 |
| B7 | 0.0000 | 10 |
| C | 0.0000 | 17 |
| C5 | 0.0000 | 22 |
| C7 | 0.0000 | 14 |
| Cadd9 | 0.0000 | 12 |
| D | 0.0000 | 19 |
| D5 | 0.0000 | 11 |
| D7 | 0.0526 | 19 |
| Dm | 0.0000 | 15 |
| Dsus4 | 0.0000 | 11 |
| E | 0.0000 | 12 |
| E5 | 0.0000 | 14 |
| E7 | 0.0000 | 15 |
| Em | 0.0000 | 10 |
| Em7 | 0.0000 | 14 |
| F | 0.0000 | 12 |
| F-small | 0.0000 | 13 |
| F5 | 0.0000 | 16 |
| Fmaj7 | 0.0000 | 13 |
| G-2f | 0.0000 | 13 |
| G-3f | 0.0000 | 16 |
| G-4f | 0.0000 | 13 |
| G5 | 0.0000 | 11 |
| G7 | 0.0000 | 14 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0100 | 200 |
| 40 | 0.0100 | 200 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0169 | 118 |
| 100 | 0.0148 | 135 |
| 150 | 0.0000 | 147 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0049 | 205 |
| karplus-strong | 0.0154 | 195 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0050 | 200 |
| 48000 | 0.0150 | 200 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 197 |
| small-room | 0.0197 | 203 |

</details>

<details><summary>modeB.dependentMutedMisattributionMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 16 |
| A5 | 0.1111 | 18 |
| A7 | 0.0000 | 15 |
| A7sus4 | 0.0000 | 20 |
| Am | 0.0000 | 14 |
| B7 | 0.0000 | 14 |
| C | 0.0833 | 12 |
| C5 | 0.0000 | 16 |
| C7 | 0.0000 | 15 |
| Cadd9 | 0.0000 | 19 |
| D | 0.0000 | 15 |
| D5 | 0.0000 | 15 |
| Dm | 0.0000 | 12 |
| Dsus4 | 0.0000 | 16 |
| E | 0.0000 | 16 |
| E5 | 0.0000 | 19 |
| E7 | 0.0000 | 18 |
| Em | 0.0000 | 12 |
| Em7 | 0.0000 | 13 |
| F | 0.0000 | 11 |
| F-small | 0.0556 | 18 |
| F5 | 0.0000 | 19 |
| G-2f | 0.0000 | 16 |
| G-3f | 0.0000 | 7 |
| G-4f | 0.0000 | 13 |
| G5 | 0.0000 | 10 |
| G7 | 0.0000 | 11 |

</details>

<details><summary>modeC.absErrLe1RateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 1.000 | 40 |
| 25 | 1.000 | 40 |
| 40 | 1.000 | 40 |

</details>

<details><summary>modeC.absErrLe1RateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 40 |
| 100 | 1.000 | 40 |
| 150 | 1.000 | 40 |

</details>

<details><summary>modeC.absErrLe1RateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 60 |
| karplus-strong | 1.000 | 60 |

</details>

<details><summary>modeC.absErrLe1RateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 60 |
| 48000 | 1.000 | 60 |

</details>

<details><summary>modeC.absErrLe1RateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 60 |
| small-room | 1.000 | 60 |

</details>

<details><summary>modeC.overcountGe2RateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 40 |
| 25 | 0.0000 | 40 |
| 40 | 0.0000 | 40 |

</details>

<details><summary>modeC.overcountGe2RateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 40 |
| 100 | 0.0000 | 40 |
| 150 | 0.0000 | 40 |

</details>

<details><summary>modeC.overcountGe2RateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 60 |
| karplus-strong | 0.0000 | 60 |

</details>

<details><summary>modeC.overcountGe2RateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 60 |
| 48000 | 0.0000 | 60 |

</details>

<details><summary>modeC.overcountGe2RateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 60 |
| small-room | 0.0000 | 60 |

</details>

<details><summary>modeC.meanAbsErrMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 40 |
| 25 | 0.0000 | 40 |
| 40 | 0.0000 | 40 |

</details>

<details><summary>modeC.meanAbsErrMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 40 |
| 100 | 0.0000 | 40 |
| 150 | 0.0000 | 40 |

</details>

<details><summary>modeC.meanAbsErrMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 60 |
| karplus-strong | 0.0000 | 60 |

</details>

<details><summary>modeC.meanAbsErrMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 60 |
| 48000 | 0.0000 | 60 |

</details>

<details><summary>modeC.meanAbsErrMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 60 |
| small-room | 0.0000 | 60 |

</details>

<details><summary>modeCSet.top1AccuracyMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.9960 | 500 |
| 40 | 0.9980 | 500 |

</details>

<details><summary>modeCSet.top1AccuracyMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9970 | 334 |
| 100 | 0.9970 | 333 |
| 150 | 0.9970 | 333 |

</details>

<details><summary>modeCSet.top1AccuracyMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9980 | 500 |
| karplus-strong | 0.9960 | 500 |

</details>

<details><summary>modeCSet.top1AccuracyMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9980 | 500 |
| 48000 | 0.9960 | 500 |

</details>

<details><summary>modeCSet.top1AccuracyMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9960 | 500 |
| small-room | 0.9980 | 500 |

</details>

<details><summary>modeCSet.top1AccuracyMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.9910 | 111 |
| Am | 0.9910 | 111 |
| C | 1.000 | 111 |
| D | 1.000 | 112 |
| Dm | 1.000 | 111 |
| E | 1.000 | 111 |
| Em | 0.9910 | 111 |
| G-2f | 1.000 | 111 |
| G-3f | 1.000 | 111 |

</details>

<details><summary>modeD.onsetF1At25msMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9919 | 1293 |
| 25 | 0.9882 | 1433 |
| 40 | 0.9943 | 1046 |

</details>

<details><summary>modeD.onsetF1At25msMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9860 | 1138 |
| 100 | 0.9929 | 1258 |
| 150 | 0.9938 | 1376 |

</details>

<details><summary>modeD.onsetF1At25msMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9824 | 1820 |
| karplus-strong | 0.9992 | 1952 |

</details>

<details><summary>modeD.onsetF1At25msMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9873 | 1890 |
| 48000 | 0.9950 | 1882 |

</details>

<details><summary>modeD.onsetF1At25msMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9903 | 1799 |
| small-room | 0.9919 | 1973 |

</details>

<details><summary>modeD.onsetF1At25msMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| P0 | 0.9860 | 285 |
| P0+bleed | 0.9965 | 282 |
| P1 | 0.9974 | 380 |
| P1+bleed | 1.000 | 241 |
| P2 | 0.9853 | 305 |
| P2+bleed | 0.9958 | 353 |
| P3 | 1.000 | 189 |
| P3+bleed | 0.9908 | 380 |
| P4 | 0.9798 | 396 |
| P4+bleed | 0.9918 | 425 |
| P5 | 0.9863 | 291 |
| P5+bleed | 0.9898 | 245 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 8.866 | 1293 |
| 25 | 9.932 | 1433 |
| 40 | 4.853 | 1045 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 9.093 | 1137 |
| 100 | 7.917 | 1258 |
| 150 | 8.875 | 1376 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 13.688 | 1819 |
| karplus-strong | 1.995 | 1952 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 9.751 | 1889 |
| 48000 | 5.750 | 1882 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 8.957 | 1798 |
| small-room | 8.027 | 1973 |

</details>

<details><summary>modeD.timingAbsErrP95MsMax × condition</summary>

| condition | 값 | n |
|---|---|---|
| P0 | 4.422 | 285 |
| P0+bleed | 2.646 | 282 |
| P1 | 4.535 | 380 |
| P1+bleed | 2.813 | 241 |
| P2 | 7.256 | 305 |
| P2+bleed | 8.980 | 353 |
| P3 | 6.396 | 189 |
| P3+bleed | 4.399 | 380 |
| P4 | 15.011 | 396 |
| P4+bleed | 12.521 | 425 |
| P5 | 10.625 | 291 |
| P5+bleed | 8.875 | 244 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.8333 | 1293 |
| 25 | 0.8390 | 1433 |
| 40 | 0.7937 | 1045 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.7708 | 1137 |
| 100 | 0.8617 | 1258 |
| 150 | 0.8390 | 1376 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.104 | 1819 |
| karplus-strong | 0.7083 | 1952 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.8844 | 1889 |
| 48000 | 0.7708 | 1882 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.8163 | 1798 |
| small-room | 0.8333 | 1973 |

</details>

<details><summary>modeD.timingAbsErrMedianMsMax × condition</summary>

| condition | 값 | n |
|---|---|---|
| P0 | 0.8844 | 285 |
| P0+bleed | 0.6803 | 282 |
| P1 | 0.7917 | 380 |
| P1+bleed | 0.7256 | 241 |
| P2 | 0.6576 | 305 |
| P2+bleed | 0.8750 | 353 |
| P3 | 0.9297 | 189 |
| P3+bleed | 0.7500 | 380 |
| P4 | 0.9524 | 396 |
| P4+bleed | 0.8617 | 425 |
| P5 | 0.8163 | 291 |
| P5+bleed | 0.9297 | 244 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0149 | 134 |
| 25 | 0.0079 | 126 |
| 40 | 0.0000 | 140 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0072 | 138 |
| 100 | 0.0000 | 132 |
| 150 | 0.0154 | 130 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0147 | 204 |
| karplus-strong | 0.0000 | 196 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0099 | 202 |
| 48000 | 0.0051 | 198 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0098 | 204 |
| small-room | 0.0051 | 196 |

</details>

<details><summary>modeD.sustainFalseOnsetRateMax × condition</summary>

| condition | 값 | n |
|---|---|---|
| sustain | 0.0075 | 400 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 1.000 | 83 |
| 25 | 0.9333 | 30 |
| 40 | 1.000 | 21 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 40 |
| 100 | 1.000 | 36 |
| 150 | 0.9655 | 58 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9655 | 58 |
| karplus-strong | 1.000 | 76 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9710 | 69 |
| 48000 | 1.000 | 65 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 56 |
| small-room | 0.9744 | 78 |

</details>

<details><summary>modeD.clickBleedRejectRateMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| P0+bleed | 1.000 | 12 |
| P1+bleed | 1.000 | 12 |
| P2+bleed | 1.000 | 14 |
| P3+bleed | 0.9730 | 74 |
| P4+bleed | 1.000 | 17 |
| P5+bleed | 1.000 | 5 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9964 | 1688 |
| 25 | 0.9960 | 1984 |
| 40 | 0.9966 | 1480 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9955 | 1568 |
| 100 | 0.9977 | 1760 |
| 150 | 0.9956 | 1824 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9939 | 2440 |
| karplus-strong | 0.9985 | 2712 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9969 | 2544 |
| 48000 | 0.9958 | 2608 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9959 | 2464 |
| small-room | 0.9967 | 2688 |

</details>

<details><summary>modeD.patternMissExtraAccuracyMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| P0 | 0.9963 | 544 |
| P0+bleed | 1.000 | 512 |
| P1 | 0.9984 | 608 |
| P1+bleed | 1.000 | 384 |
| P2 | 1.000 | 416 |
| P2+bleed | 0.9979 | 480 |
| P3 | 1.000 | 256 |
| P3+bleed | 0.9883 | 512 |
| P4 | 0.9928 | 416 |
| P4+bleed | 1.000 | 448 |
| P5 | 0.9936 | 312 |
| P5+bleed | 0.9848 | 264 |

</details>

<details><summary>tuner.medianAbsCentsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0897 | 500 |
| 40 | 0.0862 | 500 |

</details>

<details><summary>tuner.medianAbsCentsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0858 | 334 |
| 100 | 0.0783 | 333 |
| 150 | 0.1029 | 333 |

</details>

<details><summary>tuner.medianAbsCentsMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0732 | 500 |
| karplus-strong | 0.0949 | 500 |

</details>

<details><summary>tuner.medianAbsCentsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0949 | 500 |
| 48000 | 0.0792 | 500 |

</details>

<details><summary>tuner.medianAbsCentsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0166 | 500 |
| small-room | 0.5705 | 500 |

</details>

<details><summary>tuner.medianAbsCentsMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| midi40 | 0.1732 | 28 |
| midi41 | 0.1391 | 27 |
| midi42 | 0.6022 | 27 |
| midi43 | 0.6032 | 27 |
| midi44 | 0.0990 | 27 |
| midi45 | 0.1581 | 27 |
| midi46 | 0.1408 | 27 |
| midi47 | 0.5507 | 27 |
| midi48 | 0.0644 | 27 |
| midi49 | 0.0782 | 27 |
| midi50 | 0.1435 | 27 |
| midi51 | 0.0853 | 27 |
| midi52 | 0.1116 | 27 |
| midi53 | 0.3840 | 27 |
| midi54 | 0.0783 | 27 |
| midi55 | 0.0607 | 27 |
| midi56 | 0.0356 | 27 |
| midi57 | 0.0337 | 27 |
| midi58 | 0.1964 | 27 |
| midi59 | 0.0318 | 27 |
| midi60 | 0.0309 | 27 |
| midi61 | 0.0268 | 27 |
| midi62 | 0.1302 | 27 |
| midi63 | 0.0430 | 27 |
| midi64 | 0.2746 | 27 |
| midi65 | 0.1384 | 27 |
| midi66 | 0.0620 | 27 |
| midi67 | 0.0949 | 27 |
| midi68 | 0.0669 | 27 |
| midi69 | 0.0571 | 27 |
| midi70 | 0.0202 | 27 |
| midi71 | 0.0754 | 27 |
| midi72 | 0.0464 | 27 |
| midi73 | 0.0774 | 27 |
| midi74 | 0.0371 | 27 |
| midi75 | 0.0891 | 27 |
| midi76 | 0.0849 | 27 |

</details>

<details><summary>tuner.p95AbsCentsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 1.985 | 500 |
| 40 | 2.325 | 500 |

</details>

<details><summary>tuner.p95AbsCentsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 2.124 | 334 |
| 100 | 2.190 | 333 |
| 150 | 2.197 | 333 |

</details>

<details><summary>tuner.p95AbsCentsMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 2.308 | 500 |
| karplus-strong | 2.065 | 500 |

</details>

<details><summary>tuner.p95AbsCentsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 2.197 | 500 |
| 48000 | 2.132 | 500 |

</details>

<details><summary>tuner.p95AbsCentsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.1086 | 500 |
| small-room | 2.975 | 500 |

</details>

<details><summary>tuner.p95AbsCentsMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| midi40 | 2.325 | 28 |
| midi41 | 3.056 | 27 |
| midi42 | 3.162 | 27 |
| midi43 | 3.435 | 27 |
| midi44 | 2.520 | 27 |
| midi45 | 2.065 | 27 |
| midi46 | 3.513 | 27 |
| midi47 | 4.236 | 27 |
| midi48 | 3.089 | 27 |
| midi49 | 2.831 | 27 |
| midi50 | 2.081 | 27 |
| midi51 | 2.390 | 27 |
| midi52 | 2.197 | 27 |
| midi53 | 2.311 | 27 |
| midi54 | 2.123 | 27 |
| midi55 | 1.448 | 27 |
| midi56 | 2.338 | 27 |
| midi57 | 2.093 | 27 |
| midi58 | 1.920 | 27 |
| midi59 | 1.240 | 27 |
| midi60 | 1.110 | 27 |
| midi61 | 1.077 | 27 |
| midi62 | 1.700 | 27 |
| midi63 | 1.773 | 27 |
| midi64 | 1.407 | 27 |
| midi65 | 1.985 | 27 |
| midi66 | 1.794 | 27 |
| midi67 | 0.8763 | 27 |
| midi68 | 0.8262 | 27 |
| midi69 | 0.7254 | 27 |
| midi70 | 1.305 | 27 |
| midi71 | 1.232 | 27 |
| midi72 | 0.5394 | 27 |
| midi73 | 1.209 | 27 |
| midi74 | 0.9203 | 27 |
| midi75 | 0.8591 | 27 |
| midi76 | 0.3223 | 27 |

</details>

<details><summary>tuner.octaveErrorRateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0020 | 500 |
| 40 | 0.0000 | 500 |

</details>

<details><summary>tuner.octaveErrorRateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 334 |
| 100 | 0.0030 | 333 |
| 150 | 0.0000 | 333 |

</details>

<details><summary>tuner.octaveErrorRateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 500 |
| karplus-strong | 0.0020 | 500 |

</details>

<details><summary>tuner.octaveErrorRateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 500 |
| 48000 | 0.0020 | 500 |

</details>

<details><summary>tuner.octaveErrorRateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 500 |
| small-room | 0.0020 | 500 |

</details>

<details><summary>tuner.octaveErrorRateMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| midi40 | 0.0000 | 28 |
| midi41 | 0.0000 | 27 |
| midi42 | 0.0000 | 27 |
| midi43 | 0.0000 | 27 |
| midi44 | 0.0000 | 27 |
| midi45 | 0.0000 | 27 |
| midi46 | 0.0000 | 27 |
| midi47 | 0.0000 | 27 |
| midi48 | 0.0000 | 27 |
| midi49 | 0.0000 | 27 |
| midi50 | 0.0000 | 27 |
| midi51 | 0.0000 | 27 |
| midi52 | 0.0000 | 27 |
| midi53 | 0.0000 | 27 |
| midi54 | 0.0000 | 27 |
| midi55 | 0.0000 | 27 |
| midi56 | 0.0000 | 27 |
| midi57 | 0.0000 | 27 |
| midi58 | 0.0000 | 27 |
| midi59 | 0.0000 | 27 |
| midi60 | 0.0000 | 27 |
| midi61 | 0.0000 | 27 |
| midi62 | 0.0000 | 27 |
| midi63 | 0.0000 | 27 |
| midi64 | 0.0000 | 27 |
| midi65 | 0.0000 | 27 |
| midi66 | 0.0000 | 27 |
| midi67 | 0.0370 | 27 |
| midi68 | 0.0000 | 27 |
| midi69 | 0.0000 | 27 |
| midi70 | 0.0000 | 27 |
| midi71 | 0.0000 | 27 |
| midi72 | 0.0000 | 27 |
| midi73 | 0.0000 | 27 |
| midi74 | 0.0000 | 27 |
| midi75 | 0.0000 | 27 |
| midi76 | 0.0000 | 27 |

</details>

<details><summary>tuner.timeToStableMsP95Max × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 125.3 | 500 |
| 40 | 125.3 | 500 |

</details>

<details><summary>tuner.timeToStableMsP95Max × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 125.3 | 334 |
| 100 | 136.0 | 333 |
| 150 | 125.3 | 333 |

</details>

<details><summary>tuner.timeToStableMsP95Max × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 136.0 | 500 |
| karplus-strong | 125.3 | 500 |

</details>

<details><summary>tuner.timeToStableMsP95Max × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 125.3 | 500 |
| 48000 | 125.3 | 500 |

</details>

<details><summary>tuner.timeToStableMsP95Max × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 114.7 | 500 |
| small-room | 136.0 | 500 |

</details>

<details><summary>tuner.timeToStableMsP95Max × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| midi40 | 146.7 | 28 |
| midi41 | 136.0 | 27 |
| midi42 | 136.0 | 27 |
| midi43 | 136.0 | 27 |
| midi44 | 125.3 | 27 |
| midi45 | 157.3 | 27 |
| midi46 | 146.7 | 27 |
| midi47 | 146.7 | 27 |
| midi48 | 125.3 | 27 |
| midi49 | 136.0 | 27 |
| midi50 | 125.3 | 27 |
| midi51 | 157.3 | 27 |
| midi52 | 146.7 | 27 |
| midi53 | 125.3 | 27 |
| midi54 | 125.3 | 27 |
| midi55 | 114.7 | 27 |
| midi56 | 146.7 | 27 |
| midi57 | 125.3 | 27 |
| midi58 | 125.3 | 27 |
| midi59 | 114.7 | 27 |
| midi60 | 125.3 | 27 |
| midi61 | 125.3 | 27 |
| midi62 | 125.3 | 27 |
| midi63 | 125.3 | 27 |
| midi64 | 125.3 | 27 |
| midi65 | 114.7 | 27 |
| midi66 | 114.7 | 27 |
| midi67 | 125.3 | 27 |
| midi68 | 125.3 | 27 |
| midi69 | 125.3 | 27 |
| midi70 | 114.7 | 27 |
| midi71 | 125.3 | 27 |
| midi72 | 114.7 | 27 |
| midi73 | 114.7 | 27 |
| midi74 | 125.3 | 27 |
| midi75 | 114.7 | 27 |
| midi76 | 114.7 | 27 |

</details>

<details><summary>rtt.absErrP95MsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 20.003312681138944 | 0.0267 | 1 |
| 20.9110988027846 | 0.0002 | 1 |
| 20.13626403784236 | 0.0015 | 1 |
| 20.97347371108257 | 0.0071 | 1 |
| 20.167465918643686 | 0.0081 | 1 |
| 20.279530412445848 | 0.0092 | 1 |
| 20.360680105075097 | 0.0009 | 1 |
| 20.510899039057012 | 0.0037 | 1 |
| 20.630720557644963 | 0.0169 | 1 |
| 20.764431073312434 | 0.0097 | 1 |
| 21.13873203843832 | 0.0146 | 1 |
| 21.23794957040809 | 0.0017 | 1 |
| 21.56571767735295 | 0.0080 | 1 |
| 21.198160809858773 | 0.0002 | 1 |
| 21.471387127485986 | 0.0057 | 1 |
| 21.810467613090832 | 0.0252 | 1 |
| 21.858828440523492 | 0.0079 | 1 |
| 22.17807119142694 | 0.0085 | 1 |
| 22.25715641501861 | 0.0009 | 1 |
| 22.056840363388453 | 0.0076 | 1 |
| 22.89503450675581 | 0.0059 | 1 |
| 22.094927509064572 | 0.0002 | 1 |
| 22.510497896269392 | 0.0056 | 1 |
| 22.683064529851364 | 0.0048 | 1 |
| 22.762730623935706 | 0.0018 | 1 |
| 22.840623657971335 | 0.0062 | 1 |
| 22.944080871225406 | 0.0041 | 1 |
| 23.09748725885024 | 0.0014 | 1 |
| 23.38703106590905 | 0.0089 | 1 |
| 23.96081332728052 | 0.0034 | 1 |
| 23.229527606575104 | 0.0026 | 1 |
| 23.360666493437467 | 0.0077 | 1 |
| 23.520083231170876 | 0.0074 | 1 |
| 23.763887555750372 | 0.0080 | 1 |
| 23.771092165171957 | 0.0067 | 1 |
| 23.874841981495802 | 0.0052 | 1 |
| 24.30408144941052 | 0.0215 | 1 |
| 24.37077795715931 | 0.0025 | 1 |
| 24.41983833914408 | 0.0063 | 1 |
| 24.68023801725716 | 0.0051 | 1 |
| 24.546353976743724 | 0.0060 | 1 |
| 24.827500281533084 | 0.0219 | 1 |
| 24.896114964503795 | 0.0265 | 1 |
| 24.989200052679877 | 0.0058 | 1 |
| 25.30790401970108 | 0.0202 | 1 |
| 25.060495878319042 | 0.0048 | 1 |
| 25.68587155516546 | 0.0216 | 1 |
| 25.87359562775908 | 0.0050 | 1 |
| 25.94797348197048 | 0.0054 | 1 |
| 25.144537040032446 | 0.0016 | 1 |
| 25.210264881607145 | 0.0046 | 1 |
| 25.386469431955796 | 0.0050 | 1 |
| 25.474121549972693 | 0.0044 | 1 |
| 25.701731023575682 | 0.0096 | 1 |
| 25.821727607954436 | 0.0015 | 1 |
| 26.16897454716337 | 0.0216 | 1 |
| 26.024315671744542 | 0.0164 | 1 |
| 26.75878953364176 | 0.0239 | 1 |
| 26.87971511352449 | 0.0058 | 1 |
| 26.100874355761334 | 0.0036 | 1 |
| 26.251422770267638 | 0.0158 | 1 |
| 26.391380502663267 | 0.0004 | 1 |
| 26.646564052314858 | 0.0103 | 1 |
| 26.820167345693335 | 0.0311 | 1 |
| 26.971360036010783 | 0.0209 | 1 |
| 27.1021005053503 | 0.0230 | 1 |
| 27.03723417697116 | 0.0111 | 1 |
| 27.42591641241541 | 0.0047 | 1 |
| 27.64378707952654 | 0.0024 | 1 |
| 27.87748077013888 | 0.0012 | 1 |
| 27.200842996683114 | 0.0031 | 1 |
| 27.297693272909292 | 0.0049 | 1 |
| 27.528674670369725 | 0.0035 | 1 |
| 27.615373256061083 | 0.0017 | 1 |
| 27.714501730399206 | 0.0073 | 1 |
| 27.817754157836763 | 0.0073 | 1 |
| 27.984624529275326 | 0.0007 | 1 |
| 28.0340311854827 | 0.0031 | 1 |
| 28.10220779833169 | 0.0049 | 1 |
| 28.20991876936303 | 0.0042 | 1 |
| 28.83087290193026 | 0.0092 | 1 |
| 28.84715428056482 | 0.0103 | 1 |
| 28.245988543270727 | 0.0073 | 1 |
| 28.318783894611094 | 0.0045 | 1 |
| 28.525750163924666 | 0.0096 | 1 |
| 28.641774543847603 | 0.0098 | 1 |
| 28.715089046056022 | 0.0046 | 1 |
| 28.943434497914637 | 0.0005 | 1 |
| 29.3557501045199 | 0.0011 | 1 |
| 29.64900900484421 | 0.0286 | 1 |
| 29.88272980837008 | 0.0054 | 1 |
| 29.118199870742572 | 0.0160 | 1 |
| 29.160824255999895 | 0.0083 | 1 |
| 29.303173133494475 | 0.0166 | 1 |
| 29.500430337744405 | 0.0018 | 1 |
| 29.748161964082662 | 0.0088 | 1 |
| 29.827172776666256 | 0.0060 | 1 |
| 30.2468334107409 | 0.0096 | 1 |
| 30.8824863246857 | 0.0022 | 1 |
| 30.31685076910071 | 0.0024 | 1 |
| 30.050636328380698 | 0.0056 | 1 |
| 30.53924368497414 | 0.0070 | 1 |
| 30.147622301189514 | 0.0079 | 1 |
| 30.181176053467563 | 0.0088 | 1 |
| 30.486002420433437 | 0.0079 | 1 |
| 30.624244096832207 | 0.0075 | 1 |
| 30.697519234757728 | 0.0082 | 1 |
| 30.808031362947077 | 0.0099 | 1 |
| 30.981758976194005 | 0.0051 | 1 |
| 31.2017192025848 | 0.0080 | 1 |
| 31.06684434507042 | 0.0038 | 1 |
| 31.44312432560568 | 0.0056 | 1 |
| 31.46371593987211 | 0.0012 | 1 |
| 31.58356707512688 | 0.0100 | 1 |
| 31.68487382073027 | 0.0222 | 1 |
| 31.84557604035721 | 0.0049 | 1 |
| 31.89032149579949 | 0.0002 | 1 |
| 31.732985415657122 | 0.0309 | 1 |
| 32.4503428590878 | 0.0332 | 1 |
| 32.08024859007519 | 0.0036 | 1 |
| 32.20474689398319 | 0.0114 | 1 |
| 32.67875673340705 | 0.0029 | 1 |
| 32.75705641970182 | 0.0010 | 1 |
| 32.82112447698959 | 0.0039 | 1 |
| 32.89724005185641 | 0.0080 | 1 |
| 32.249778534106625 | 0.0072 | 1 |
| 33.2243929209116 | 0.0003 | 1 |
| 33.12939142389223 | 0.0164 | 1 |
| 33.30352291072575 | 0.0332 | 1 |
| 33.031989173229356 | 0.0064 | 1 |
| 33.36660326032255 | 0.0170 | 1 |
| 33.65780525052777 | 0.0087 | 1 |
| 33.74313360178628 | 0.0282 | 1 |
| 33.78433916502847 | 0.0021 | 1 |
| 33.95751764388898 | 0.0082 | 1 |
| 33.404179640830705 | 0.0048 | 1 |
| 33.577283066446675 | 0.0000 | 1 |
| 33.875193689502055 | 0.0093 | 1 |
| 34.02177029267813 | 0.0043 | 1 |
| 34.25264451530977 | 0.0086 | 1 |
| 34.126301038687906 | 0.0114 | 1 |
| 34.358576178102965 | 0.0018 | 1 |
| 34.444117829382705 | 0.0301 | 1 |
| 34.540282296912316 | 0.0328 | 1 |
| 34.722945590736344 | 0.0096 | 1 |
| 34.890928210404056 | 0.0019 | 1 |
| 35.0117056866069 | 0.0086 | 1 |
| 35.13890347953957 | 0.0164 | 1 |
| 35.33386218277379 | 0.0021 | 1 |
| 35.49330884843277 | 0.0084 | 1 |
| 35.58389024577963 | 0.0086 | 1 |
| 35.67292207533207 | 0.0178 | 1 |
| 35.75663869188597 | 0.0004 | 1 |
| 35.76999399846849 | 0.0017 | 1 |
| 35.163002860911476 | 0.0089 | 1 |
| 35.287180646394305 | 0.0021 | 1 |
| 35.422175492321216 | 0.0132 | 1 |
| 35.878641211678485 | 0.0288 | 1 |
| 35.933163171651984 | 0.0082 | 1 |
| 36.01130775186735 | 0.0089 | 1 |
| 36.18677618381424 | 0.0014 | 1 |
| 36.37397591805515 | 0.0015 | 1 |
| 36.45113375043282 | 0.0201 | 1 |
| 36.53879208979197 | 0.0013 | 1 |
| 36.63595577401037 | 0.0008 | 1 |
| 36.74395685225654 | 0.0278 | 1 |
| 36.84390511920747 | 0.0016 | 1 |
| 36.87300896886378 | 0.0250 | 1 |
| 36.121423847919615 | 0.0008 | 1 |
| 36.244522941442064 | 0.0259 | 1 |
| 36.463026448958914 | 0.0013 | 1 |
| 37.4743052745023 | 0.0214 | 1 |
| 37.14407196313215 | 0.0043 | 1 |
| 37.24880889792425 | 0.0017 | 1 |
| 37.39106161240488 | 0.0078 | 1 |
| 37.62668134730596 | 0.0148 | 1 |
| 37.77141472192194 | 0.0073 | 1 |
| 37.86231646095761 | 0.0015 | 1 |
| 37.375850878996204 | 0.0003 | 1 |
| 37.587233540852765 | 0.0049 | 1 |
| 37.987308413506696 | 0.0316 | 1 |
| 38.478348251468 | 0.0174 | 1 |
| 38.25847290488533 | 0.0272 | 1 |
| 38.37817792092952 | 0.0105 | 1 |
| 38.42675273872625 | 0.0027 | 1 |
| 38.048329401994124 | 0.0108 | 1 |
| 38.54700200657288 | 0.0022 | 1 |
| 38.88179308926472 | 0.0052 | 1 |
| 38.120657596540134 | 0.0046 | 1 |
| 38.198048777466354 | 0.0180 | 1 |
| 38.649161530443685 | 0.0061 | 1 |
| 39.00857400278059 | 0.0112 | 1 |
| 39.11043132766365 | 0.0078 | 1 |
| 39.19609733049471 | 0.0076 | 1 |
| 39.30985308859426 | 0.0170 | 1 |
| 39.46258472375428 | 0.0075 | 1 |
| 39.62480947957374 | 0.0093 | 1 |
| 39.69337905191172 | 0.0002 | 1 |
| 39.85468914494133 | 0.0110 | 1 |
| 39.238626453327015 | 0.0059 | 1 |

</details>

<details><summary>rtt.absErrP95MsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0259 | 67 |
| 100 | 0.0282 | 70 |
| 150 | 0.0278 | 63 |

</details>

<details><summary>rtt.absErrP95MsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0301 | 102 |
| 48000 | 0.0230 | 98 |

</details>

<details><summary>rtt.absErrP95MsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0282 | 98 |
| small-room | 0.0278 | 102 |

</details>

<details><summary>rtt.silentFailureReportRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 20.42884838772723 | 1.000 | 1 |
| 20.550573168913477 | 1.000 | 1 |
| 20.769441915067056 | 1.000 | 1 |
| 21.000490022823215 | 1.000 | 1 |
| 21.9625129833316 | 1.000 | 1 |
| 21.45233536033461 | 1.000 | 1 |
| 21.70826543855051 | 1.000 | 1 |
| 21.316997088062074 | 1.000 | 1 |
| 21.664491260907827 | 1.000 | 1 |
| 22.32935800874391 | 1.000 | 1 |
| 22.55602647598761 | 1.000 | 1 |
| 22.415888167290877 | 1.000 | 1 |
| 23.27319799413761 | 1.000 | 1 |
| 23.055579197127372 | 1.000 | 1 |
| 23.58243654906535 | 1.000 | 1 |
| 23.615979408737843 | 1.000 | 1 |
| 24.03349389239716 | 1.000 | 1 |
| 24.16987391976783 | 1.000 | 1 |
| 24.134496080563764 | 1.000 | 1 |
| 24.534788596497563 | 1.000 | 1 |
| 24.768513378364823 | 1.000 | 1 |
| 25.289044450968504 | 1.000 | 1 |
| 25.607953613785167 | 1.000 | 1 |
| 26.37360142590478 | 1.000 | 1 |
| 26.47833083347919 | 1.000 | 1 |
| 26.558065217615177 | 1.000 | 1 |
| 27.374281535444496 | 1.000 | 1 |
| 28.413417803929548 | 1.000 | 1 |
| 28.555458512372123 | 1.000 | 1 |
| 29.6095421126184 | 1.000 | 1 |
| 29.008916485535266 | 1.000 | 1 |
| 29.432789128631924 | 1.000 | 1 |
| 29.949209838532482 | 1.000 | 1 |
| 30.412474575685337 | 1.000 | 1 |
| 31.328255122026 | 1.000 | 1 |
| 31.26567792992752 | 1.000 | 1 |
| 31.151863236714586 | 1.000 | 1 |
| 31.931373497936875 | 1.000 | 1 |
| 32.020635060500354 | 1.000 | 1 |
| 32.31725872551593 | 1.000 | 1 |
| 32.60908995002795 | 1.000 | 1 |
| 32.493993204284024 | 1.000 | 1 |
| 32.928021434676616 | 1.000 | 1 |
| 33.516135323559865 | 1.000 | 1 |
| 34.18438481057707 | 1.000 | 1 |
| 34.47888921280033 | 1.000 | 1 |
| 34.63676125158628 | 1.000 | 1 |
| 34.782733608234246 | 1.000 | 1 |
| 34.987188832332876 | 1.000 | 1 |
| 36.99977903522981 | 1.000 | 1 |
| 37.7638401998601 | 1.000 | 1 |
| 37.20861841673748 | 1.000 | 1 |
| 37.054943468367966 | 1.000 | 1 |
| 38.80760132233039 | 1.000 | 1 |
| 38.749415295467216 | 1.000 | 1 |
| 38.971047495008236 | 1.000 | 1 |
| 39.7917173639513 | 1.000 | 1 |
| 39.39507632885272 | 1.000 | 1 |
| 39.584401345686416 | 1.000 | 1 |
| 39.989287304297946 | 1.000 | 1 |

</details>

<details><summary>rtt.silentFailureReportRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 20 |
| 100 | 1.000 | 17 |
| 150 | 1.000 | 23 |

</details>

<details><summary>rtt.silentFailureReportRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 28 |
| 48000 | 1.000 | 32 |

</details>

<details><summary>rtt.silentFailureReportRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 32 |
| small-room | 1.000 | 28 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9982 | 1672 |
| 25 | 1.000 | 1497 |
| 40 | 1.000 | 1858 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9993 | 2082 |
| 100 | 0.9993 | 1384 |
| 150 | 0.9997 | 1561 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9993 | 2797 |
| karplus-strong | 0.9996 | 2230 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9998 | 2454 |
| 48000 | 0.9990 | 2573 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9993 | 2271 |
| small-room | 0.9995 | 2756 |

</details>

<details><summary>sequence.noteOnsetF1At30msMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 0.9913 | 115 |
| am-pent-pos1#2 | 1.000 | 161 |
| am-pent-pos1#3 | 1.000 | 64 |
| am-pent-pos1#4 | 0.9982 | 280 |
| am-pent-pos1#5 | 1.000 | 360 |
| c-major-open#1 | 1.000 | 105 |
| c-major-open#2 | 1.000 | 75 |
| c-major-open#3 | 1.000 | 64 |
| c-major-open#4 | 1.000 | 96 |
| c-major-open#5 | 1.000 | 240 |
| chromatic | 1.000 | 84 |
| em-pent-open#1 | 1.000 | 138 |
| em-pent-open#2 | 1.000 | 69 |
| em-pent-open#3 | 1.000 | 96 |
| em-pent-open#4 | 0.9975 | 200 |
| em-pent-open#5 | 0.9986 | 720 |
| R1 | 1.000 | 528 |
| R2 | 1.000 | 528 |
| R3 | 1.000 | 608 |
| R4 | 1.000 | 496 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9934 | 1672 |
| 25 | 1.000 | 1497 |
| 40 | 1.000 | 1858 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9966 | 2082 |
| 100 | 0.9986 | 1384 |
| 150 | 0.9987 | 1561 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9971 | 2797 |
| karplus-strong | 0.9987 | 2230 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9996 | 2454 |
| 48000 | 0.9961 | 2573 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9991 | 2271 |
| small-room | 0.9967 | 2756 |

</details>

<details><summary>sequence.cleanNoteOkRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 1.000 | 115 |
| am-pent-pos1#2 | 1.000 | 161 |
| am-pent-pos1#3 | 1.000 | 64 |
| am-pent-pos1#4 | 0.9964 | 280 |
| am-pent-pos1#5 | 0.9972 | 360 |
| c-major-open#1 | 0.9810 | 105 |
| c-major-open#2 | 1.000 | 75 |
| c-major-open#3 | 1.000 | 64 |
| c-major-open#4 | 1.000 | 96 |
| c-major-open#5 | 1.000 | 240 |
| chromatic | 1.000 | 84 |
| em-pent-open#1 | 1.000 | 138 |
| em-pent-open#2 | 1.000 | 69 |
| em-pent-open#3 | 1.000 | 96 |
| em-pent-open#4 | 0.9950 | 200 |
| em-pent-open#5 | 0.9917 | 720 |
| R1 | 1.000 | 528 |
| R2 | 1.000 | 528 |
| R3 | 1.000 | 608 |
| R4 | 1.000 | 496 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 1.000 | 161 |
| 25 | 1.000 | 161 |
| 40 | 1.000 | 158 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 159 |
| 100 | 1.000 | 153 |
| 150 | 1.000 | 168 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 245 |
| karplus-strong | 1.000 | 235 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 248 |
| 48000 | 1.000 | 232 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 231 |
| small-room | 1.000 | 249 |

</details>

<details><summary>sequence.wrongNoteDetectRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 1.000 | 12 |
| am-pent-pos1#2 | 1.000 | 12 |
| am-pent-pos1#3 | 1.000 | 13 |
| am-pent-pos1#4 | 1.000 | 9 |
| am-pent-pos1#5 | 1.000 | 13 |
| c-major-open#1 | 1.000 | 10 |
| c-major-open#2 | 1.000 | 11 |
| c-major-open#3 | 1.000 | 10 |
| c-major-open#4 | 1.000 | 12 |
| c-major-open#5 | 1.000 | 11 |
| chromatic | 1.000 | 75 |
| em-pent-open#1 | 1.000 | 10 |
| em-pent-open#2 | 1.000 | 14 |
| em-pent-open#3 | 1.000 | 11 |
| em-pent-open#4 | 1.000 | 14 |
| em-pent-open#5 | 1.000 | 11 |
| R1 | 1.000 | 62 |
| R2 | 1.000 | 55 |
| R3 | 1.000 | 57 |
| R4 | 1.000 | 58 |

</details>

<details><summary>sequence.missedDetectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 1.000 | 81 |
| 25 | 1.000 | 89 |
| 40 | 1.000 | 70 |

</details>

<details><summary>sequence.missedDetectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 72 |
| 100 | 1.000 | 94 |
| 150 | 1.000 | 74 |

</details>

<details><summary>sequence.missedDetectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 115 |
| karplus-strong | 1.000 | 125 |

</details>

<details><summary>sequence.missedDetectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 118 |
| 48000 | 1.000 | 122 |

</details>

<details><summary>sequence.missedDetectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 130 |
| small-room | 1.000 | 110 |

</details>

<details><summary>sequence.missedDetectRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 1.000 | 5 |
| am-pent-pos1#2 | 1.000 | 6 |
| am-pent-pos1#3 | 1.000 | 4 |
| am-pent-pos1#4 | 1.000 | 10 |
| am-pent-pos1#5 | 1.000 | 6 |
| c-major-open#1 | 1.000 | 8 |
| c-major-open#2 | 1.000 | 3 |
| c-major-open#3 | 1.000 | 7 |
| c-major-open#4 | 1.000 | 8 |
| c-major-open#5 | 1.000 | 1 |
| chromatic | 1.000 | 29 |
| em-pent-open#1 | 1.000 | 3 |
| em-pent-open#2 | 1.000 | 9 |
| em-pent-open#3 | 1.000 | 7 |
| em-pent-open#4 | 1.000 | 8 |
| em-pent-open#5 | 1.000 | 5 |
| R1 | 1.000 | 23 |
| R2 | 1.000 | 36 |
| R3 | 1.000 | 29 |
| R4 | 1.000 | 33 |

</details>

<details><summary>sequence.extraDetectRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9867 | 75 |
| 25 | 1.000 | 77 |
| 40 | 0.9773 | 88 |

</details>

<details><summary>sequence.extraDetectRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 80 |
| 100 | 1.000 | 80 |
| 150 | 0.9625 | 80 |

</details>

<details><summary>sequence.extraDetectRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 111 |
| karplus-strong | 0.9767 | 129 |

</details>

<details><summary>sequence.extraDetectRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9821 | 112 |
| 48000 | 0.9922 | 128 |

</details>

<details><summary>sequence.extraDetectRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9921 | 127 |
| small-room | 0.9823 | 113 |

</details>

<details><summary>sequence.extraDetectRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 1.000 | 5 |
| am-pent-pos1#2 | 1.000 | 4 |
| am-pent-pos1#3 | 1.000 | 9 |
| am-pent-pos1#4 | 1.000 | 6 |
| am-pent-pos1#5 | 0.8750 | 8 |
| c-major-open#1 | 1.000 | 13 |
| c-major-open#2 | 1.000 | 10 |
| c-major-open#3 | 1.000 | 7 |
| c-major-open#4 | 1.000 | 6 |
| c-major-open#5 | 1.000 | 7 |
| chromatic | 1.000 | 25 |
| em-pent-open#1 | 1.000 | 6 |
| em-pent-open#2 | 1.000 | 6 |
| em-pent-open#3 | 1.000 | 8 |
| em-pent-open#4 | 1.000 | 1 |
| em-pent-open#5 | 1.000 | 7 |
| R1 | 1.000 | 32 |
| R2 | 1.000 | 26 |
| R3 | 0.9615 | 26 |
| R4 | 0.9643 | 28 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0000 | 317 |
| 25 | 0.0000 | 327 |
| 40 | 0.0063 | 316 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 311 |
| 100 | 0.0000 | 327 |
| 150 | 0.0062 | 322 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 471 |
| karplus-strong | 0.0041 | 489 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0021 | 478 |
| 48000 | 0.0021 | 482 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 488 |
| small-room | 0.0042 | 472 |

</details>

<details><summary>sequence.faultyCycleFlawlessRateMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 0.0000 | 22 |
| am-pent-pos1#2 | 0.0000 | 22 |
| am-pent-pos1#3 | 0.0000 | 26 |
| am-pent-pos1#4 | 0.0000 | 25 |
| am-pent-pos1#5 | 0.0000 | 27 |
| c-major-open#1 | 0.0000 | 31 |
| c-major-open#2 | 0.0000 | 24 |
| c-major-open#3 | 0.0000 | 24 |
| c-major-open#4 | 0.0000 | 26 |
| c-major-open#5 | 0.0000 | 19 |
| chromatic | 0.0000 | 129 |
| em-pent-open#1 | 0.0000 | 19 |
| em-pent-open#2 | 0.0000 | 29 |
| em-pent-open#3 | 0.0000 | 26 |
| em-pent-open#4 | 0.0000 | 23 |
| em-pent-open#5 | 0.0000 | 23 |
| R1 | 0.0000 | 117 |
| R2 | 0.0000 | 117 |
| R3 | 0.0089 | 112 |
| R4 | 0.0084 | 119 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 1.000 | 65 |
| 40 | 1.000 | 71 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 50 |
| 100 | 1.000 | 42 |
| 150 | 1.000 | 44 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 1.000 | 72 |
| karplus-strong | 1.000 | 64 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 1.000 | 70 |
| 48000 | 1.000 | 66 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 61 |
| small-room | 1.000 | 75 |

</details>

<details><summary>sequence.cleanCycleFlawlessRateMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 1.000 | 3 |
| am-pent-pos1#2 | 1.000 | 5 |
| am-pent-pos1#3 | 1.000 | 2 |
| c-major-open#1 | 1.000 | 1 |
| c-major-open#2 | 1.000 | 5 |
| c-major-open#3 | 1.000 | 2 |
| c-major-open#4 | 1.000 | 4 |
| chromatic | 1.000 | 12 |
| em-pent-open#1 | 1.000 | 5 |
| em-pent-open#2 | 1.000 | 2 |
| em-pent-open#3 | 1.000 | 4 |
| R1 | 1.000 | 26 |
| R2 | 1.000 | 25 |
| R3 | 1.000 | 18 |
| R4 | 1.000 | 22 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.0000 | 73 |
| 40 | 0.0000 | 84 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0000 | 60 |
| 100 | 0.0000 | 47 |
| 150 | 0.0000 | 50 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0000 | 86 |
| karplus-strong | 0.0000 | 71 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0000 | 81 |
| 48000 | 0.0000 | 76 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0000 | 71 |
| small-room | 0.0000 | 86 |

</details>

<details><summary>sequence.cleanCycleUncertainRateMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| am-pent-pos1#1 | 0.0000 | 3 |
| am-pent-pos1#2 | 0.0000 | 5 |
| am-pent-pos1#3 | 0.0000 | 2 |
| am-pent-pos1#4 | 0.0000 | 3 |
| am-pent-pos1#5 | 0.0000 | 3 |
| c-major-open#1 | 0.0000 | 1 |
| c-major-open#2 | 0.0000 | 5 |
| c-major-open#3 | 0.0000 | 2 |
| c-major-open#4 | 0.0000 | 4 |
| c-major-open#5 | 0.0000 | 4 |
| chromatic | 0.0000 | 12 |
| em-pent-open#1 | 0.0000 | 5 |
| em-pent-open#2 | 0.0000 | 2 |
| em-pent-open#3 | 0.0000 | 4 |
| em-pent-open#4 | 0.0000 | 3 |
| em-pent-open#5 | 0.0000 | 8 |
| R1 | 0.0000 | 26 |
| R2 | 0.0000 | 25 |
| R3 | 0.0000 | 18 |
| R4 | 0.0000 | 22 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 25 | 0.9980 | 500 |
| 40 | 1.000 | 500 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 1.000 | 334 |
| 100 | 1.000 | 333 |
| 150 | 0.9970 | 333 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9980 | 500 |
| karplus-strong | 1.000 | 500 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9980 | 500 |
| 48000 | 1.000 | 500 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 1.000 | 500 |
| small-room | 0.9980 | 500 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 1.000 | 22 |
| A5 | 1.000 | 29 |
| A7 | 1.000 | 22 |
| A7sus4 | 1.000 | 33 |
| Am | 1.000 | 58 |
| B7 | 1.000 | 30 |
| C | 1.000 | 62 |
| C5 | 1.000 | 22 |
| C7 | 1.000 | 28 |
| Cadd9 | 1.000 | 57 |
| D | 1.000 | 33 |
| D5 | 1.000 | 28 |
| D7 | 1.000 | 29 |
| Dm | 1.000 | 21 |
| Dsus4 | 1.000 | 69 |
| E | 1.000 | 25 |
| E5 | 1.000 | 30 |
| E7 | 1.000 | 30 |
| Em | 1.000 | 33 |
| Em7 | 1.000 | 39 |
| F | 1.000 | 28 |
| F-small | 1.000 | 23 |
| F5 | 1.000 | 26 |
| Fmaj7 | 1.000 | 32 |
| G-2f | 1.000 | 36 |
| G-3f | 1.000 | 27 |
| G-4f | 0.9857 | 70 |
| G5 | 1.000 | 31 |
| G7 | 1.000 | 27 |

</details>

<details><summary>modeCSetStage8to11.top1AccuracyMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| set0 | 0.9940 | 167 |
| set1 | 1.000 | 167 |
| set2 | 1.000 | 167 |
| set3 | 1.000 | 167 |
| set4 | 1.000 | 166 |
| set5 | 1.000 | 166 |

</details>

<details><summary>swing.onsetF1At25msMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9873 | 1024 |
| 25 | 0.9940 | 992 |
| 40 | 0.9960 | 992 |

</details>

<details><summary>swing.onsetF1At25msMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9873 | 1024 |
| 100 | 0.9970 | 992 |
| 150 | 0.9929 | 992 |

</details>

<details><summary>swing.onsetF1At25msMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9847 | 1504 |
| karplus-strong | 1.000 | 1504 |

</details>

<details><summary>swing.onsetF1At25msMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9934 | 1504 |
| 48000 | 0.9914 | 1504 |

</details>

<details><summary>swing.onsetF1At25msMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9924 | 1504 |
| small-room | 0.9924 | 1504 |

</details>

<details><summary>swing.onsetF1At25msMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| P7 | 0.9919 | 928 |
| P7+bleed | 0.9844 | 576 |
| P8 | 0.9965 | 576 |
| P8+bleed | 0.9952 | 928 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 12.426 | 1024 |
| 25 | 6.333 | 992 |
| 40 | 8.000 | 992 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 10.229 | 1024 |
| 100 | 8.000 | 992 |
| 150 | 9.569 | 992 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 15.479 | 1504 |
| karplus-strong | 1.950 | 1504 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 7.732 | 1504 |
| 48000 | 10.646 | 1504 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 8.254 | 1504 |
| small-room | 10.146 | 1504 |

</details>

<details><summary>swing.timingAbsErrP95MsMax × condition</summary>

| condition | 값 | n |
|---|---|---|
| P7 | 10.658 | 928 |
| P7+bleed | 12.721 | 576 |
| P8 | 8.604 | 576 |
| P8+bleed | 7.771 | 928 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9785 | 1024 |
| 25 | 0.9768 | 992 |
| 40 | 0.9617 | 992 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9580 | 1024 |
| 100 | 0.9808 | 992 |
| 150 | 0.9788 | 992 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9654 | 1504 |
| karplus-strong | 0.9794 | 1504 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9741 | 1504 |
| 48000 | 0.9707 | 1504 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9754 | 1504 |
| small-room | 0.9694 | 1504 |

</details>

<details><summary>swing.slotAssignmentAccuracyMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| P7 | 0.9666 | 928 |
| P7+bleed | 0.9635 | 576 |
| P8 | 0.9826 | 576 |
| P8+bleed | 0.9774 | 928 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.9860 | 896 |
| 25 | 0.9877 | 896 |
| 40 | 0.9852 | 880 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.9872 | 896 |
| 100 | 0.9844 | 896 |
| 150 | 0.9875 | 880 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.9793 | 1328 |
| karplus-strong | 0.9933 | 1344 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.9847 | 1344 |
| 48000 | 0.9880 | 1328 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.9862 | 1344 |
| small-room | 0.9865 | 1328 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.9948 | 96 |
| A5 | 1.000 | 80 |
| A7 | 0.9938 | 80 |
| A7sus4 | 0.9684 | 96 |
| Am | 0.9534 | 96 |
| B7 | 1.000 | 96 |
| C | 0.9948 | 96 |
| C5 | 0.9634 | 96 |
| C7 | 0.9948 | 96 |
| Cadd9 | 0.9789 | 96 |
| D | 0.9896 | 96 |
| D5 | 0.9620 | 80 |
| D7 | 0.9875 | 80 |
| Dm | 0.9948 | 96 |
| Dsus4 | 1.000 | 96 |
| E | 0.9843 | 96 |
| E5 | 0.9896 | 96 |
| E7 | 0.9938 | 80 |
| Em | 0.9948 | 96 |
| Em7 | 1.000 | 96 |
| F | 0.9794 | 96 |
| F-small | 1.000 | 96 |
| F5 | 0.9875 | 80 |
| Fmaj7 | 1.000 | 96 |
| G-2f | 0.9948 | 96 |
| G-3f | 1.000 | 96 |
| G-4f | 0.9792 | 96 |
| G5 | 0.9271 | 96 |
| G7 | 1.000 | 80 |

</details>

<details><summary>backingBleed.strumOnsetF1At25msMin × condition</summary>

| condition | 값 | n |
|---|---|---|
| rel-10 | 0.9764 | 448 |
| rel-15 | 0.9858 | 880 |
| rel-20 | 0.9961 | 896 |
| rel-25 | 0.9777 | 448 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × snrDb</summary>

| snrDb | 값 | n |
|---|---|---|
| 15 | 0.0044 | 679 |
| 25 | 0.0059 | 677 |
| 40 | 0.0045 | 666 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × micHighpassHz</summary>

| micHighpassHz | 값 | n |
|---|---|---|
| 0 | 0.0074 | 680 |
| 100 | 0.0029 | 681 |
| 150 | 0.0045 | 661 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × model</summary>

| model | 값 | n |
|---|---|---|
| additive | 0.0050 | 1002 |
| karplus-strong | 0.0049 | 1020 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × sampleRate</summary>

| sampleRate | 값 | n |
|---|---|---|
| 44100 | 0.0049 | 1017 |
| 48000 | 0.0050 | 1005 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × reverb</summary>

| reverb | 값 | n |
|---|---|---|
| none | 0.0029 | 1024 |
| small-room | 0.0070 | 998 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × voicing</summary>

| voicing | 값 | n |
|---|---|---|
| A | 0.0000 | 73 |
| A5 | 0.0000 | 60 |
| A7 | 0.0164 | 61 |
| A7sus4 | 0.0137 | 73 |
| Am | 0.0139 | 72 |
| B7 | 0.0000 | 75 |
| C | 0.0000 | 73 |
| C5 | 0.0000 | 72 |
| C7 | 0.0000 | 72 |
| Cadd9 | 0.0000 | 72 |
| D | 0.0139 | 72 |
| D5 | 0.0000 | 60 |
| D7 | 0.0164 | 61 |
| Dm | 0.0137 | 73 |
| Dsus4 | 0.0000 | 72 |
| E | 0.0135 | 74 |
| E5 | 0.0000 | 72 |
| E7 | 0.0000 | 62 |
| Em | 0.0000 | 72 |
| Em7 | 0.0000 | 72 |
| F | 0.0278 | 72 |
| F-small | 0.0000 | 72 |
| F5 | 0.0000 | 60 |
| Fmaj7 | 0.0000 | 74 |
| G-2f | 0.0000 | 72 |
| G-3f | 0.0000 | 72 |
| G-4f | 0.0139 | 72 |
| G5 | 0.0000 | 72 |
| G7 | 0.0000 | 63 |

</details>

<details><summary>backingBleed.backingHitFalseStrumRateMax × condition</summary>

| condition | 값 | n |
|---|---|---|
| rel-10 | 0.0147 | 339 |
| rel-15 | 0.0075 | 665 |
| rel-20 | 0.0000 | 679 |
| rel-25 | 0.0000 | 339 |

</details>

<!-- guitarset:start -->
## GuitarSet 실녹음 벤치마크 (`npm run bench:guitarset`, 생성)

- 실행: 2026-11-09T10:07:34.298Z · detector **1.6.0** · 360 clips · 데이터: Zenodo 3371780 (GuitarSet 1.1.0, **CC BY 4.0**, Xi et al. 2018) — `audio_mono-mic` + `annotation`
- 판정은 **test 플레이어(04, 05)**, 튜닝은 dev 플레이어(00–03)만 썼다.
- Funk comp 클립은 주석 없는 뮤트 "칙" 소리가 많아 onset F1에서 제외했다(SPEC §14.4).
- solo 단음 시퀀스(SPEC v1.1 §14.4): 인접 onset 간격·음 지속 ≥ 120 ms, onset + 60 ms에 다른 줄 음이 울리는 중이면 제외, [+30, +130 ms] 윤곽 ±35 cents. 검출 onset(시퀀스 경로)과 ±50 ms 짝지은 음만 하드 지표에 쓰고, test 플레이어의 짝지은 음이 1000개 미만이면 FAIL. onset F1(소프트)은 해머온·슬라이드를 포함한 모든 solo 음 onset(60 ms 묶음)이 정답이다.
- **한계**: GuitarSet 마이크는 스튜디오 콘덴서(근접, 조용한 방)라 휴대폰·노트북 내장 마이크보다 깨끗하다. 실기기 성능은 `bench:real`(녹음 키트)로 확인해야 한다.

### test (판정)

| 구분 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| **하드** | modeAOkRateMin | 1.0000 | 0.9500 | PASS | 17 |
| **하드** | modeAPerturbedFalseAcceptMax | 0.0000 | 0.0300 | PASS | 17 |
| **하드** | modeCPairAccuracyMin | 0.9799 | 0.9000 | PASS | 299 |
| **하드** | strumOnsetF1At50msMin | 0.8771 | 0.8500 | PASS | 4996 |
| **하드** | soloSequencePitchOkRateMin | 0.9868 | 0.9500 | PASS | 2654 |
| **하드** | soloSequencePerturbedFalseAcceptMax | 0.0004 | 0.0300 | PASS | 2654 |
| 소프트 | modeBFalseRejectMax | 0.0641 | 0.1000 | PASS | 312 |
| 소프트 | modeBPerturbedFalseAcceptMax | 0.0033 | 0.1500 | PASS | 306 |
| 소프트 | soloSequenceOnsetF1At50msMin | 0.8101 | 0.7500 | PASS | 4625 |

### dev (참고)

| 구분 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| **하드** | modeAOkRateMin | 1.0000 | 0.9500 | PASS | 39 |
| **하드** | modeAPerturbedFalseAcceptMax | 0.0000 | 0.0300 | PASS | 39 |
| **하드** | modeCPairAccuracyMin | 0.9802 | 0.9000 | PASS | 555 |
| **하드** | strumOnsetF1At50msMin | 0.8521 | 0.8500 | PASS | 10014 |
| **하드** | soloSequencePitchOkRateMin | 0.9726 | 0.9500 | PASS | 5874 |
| **하드** | soloSequencePerturbedFalseAcceptMax | 0.0010 | 0.0300 | PASS | 5874 |
| 소프트 | modeBFalseRejectMax | 0.0376 | 0.1000 | PASS | 585 |
| 소프트 | modeBPerturbedFalseAcceptMax | 0.0000 | 0.1500 | PASS | 582 |
| 소프트 | soloSequenceOnsetF1At50msMin | 0.8559 | 0.7500 | PASS | 11211 |

### 장르별 이벤트 수(전체 플레이어)

| 장르 | 단음 | 스트럼 | 쌍 | 시퀀스 음(짝지음) |
|---|---|---|---|---|
| BN | 16 | 108 | 98 | 1622 |
| Funk | 6 | 148 | 137 | 1606 |
| Jazz | 6 | 204 | 187 | 1402 |
| Rock | 8 | 321 | 319 | 1794 |
| SS | 20 | 116 | 113 | 2104 |

<!-- guitarset:end -->

## test-run log

- 2026-10-07T15:38:22.554Z · detector 1.0.0 · split test · PASS (all thresholds met)
- 2026-10-07T17:02:11.045Z · detector 1.1.0 · split test · PASS (all thresholds met)
- 2026-10-07T17:08:59.103Z · detector 1.2.0 · split test · PASS (all thresholds met)
- 2026-10-07T17:13:21.953Z · detector 1.3.0 · split test · PASS (all thresholds met)
- 2026-10-07T17:19:11.702Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T17:55:10.843Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T18:07:03.770Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T18:57:31.772Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T19:23:14.090Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T19:42:09.547Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T20:08:17.876Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-07T20:13:07.863Z · detector 1.3.1 · split test · PASS (all thresholds met)
- 2026-10-09T01:07:49.773Z · detector 1.4.0 · split test · PASS (all thresholds met)
- 2026-10-12T14:39:02.005Z · detector 1.5.0 · split test · PASS (all thresholds met)
- 2026-11-09T09:50:09.260Z · detector 1.6.0 · split test · PASS (all thresholds met)
