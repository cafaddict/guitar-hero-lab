/**
 * All user-facing Korean strings live here (SPEC §12.4). Components must not hard-code Korean text;
 * tests/integrity enforces this. Parameterized strings are functions.
 */
import { GENERAL_TIPS } from '../content/tips';
import type { CoachingHint } from '../domain/coaching';

const fingerName = (finger: number | 'T') => (finger === 'T' ? '엄지' : `${finger}번 손가락`);
/** Subject form: '1번 손가락이' / '엄지가'. */
const fingerSubject = (finger: number | 'T') => (finger === 'T' ? '엄지가' : `${fingerName(finger)}이`);
/** Object form: '1번 손가락을' / '엄지를'. */
const fingerObject = (finger: number | 'T') => (finger === 'T' ? '엄지를' : `${fingerName(finger)}을`);

export const NOT_MEDICAL_ADVICE = '의학적 조언이 아닙니다.';

export type RetryReasonCode =
  | 'LOW_LEVEL'
  | 'CLIPPING'
  | 'NOISY'
  | 'AMBIGUOUS'
  | 'NO_ONSET'
  | 'MULTIPLE_ONSETS'
  | 'DETUNED'
  | 'NOT_STRING';

export const ko = {
  app: {
    title: '기타 연습',
    skipToContent: '본문으로 건너뛰기',
    loading: '불러오는 중이에요',
  },
  nav: {
    home: '오늘',
    curriculum: '커리큘럼',
    library: '코드',
    tools: '도구',
    tuner: '튜너',
    metronome: '메트로놈',
    progress: '진도',
    settings: '설정',
    diagnostics: '진단',
    session: '연습',
    onboarding: '처음 설정',
    main: '주 메뉴',
  },
  focus: {
    exit: '나가기',
    exitWhileRunning: '연습 중에는 나갈 수 없어요. 끝내거나 Esc로 중단하세요.',
  },
  tools: {
    title: '도구',
    tunerText: '줄마다 맞추거나 크로매틱으로 음높이를 봐요.',
    metronomeText: '탭 템포, 박자·세분, 카운트인, 템포 사다리.',
    library: '코드 라이브러리',
    libraryText: '다이어그램, 기대 음, 들어 보기.',
  },
  common: {
    next: '다음',
    retry: '다시 시도',
    start: '시작',
    stop: '정지',
    on: '켜짐',
    off: '꺼짐',
    unknown: '알 수 없음',
    withoutMic: '마이크 없이 쓰기',
    later: '나중에 하기',
    stringLabel: (stringNo: number, note: string) => `${stringNo}번 줄 (${note})`,
    cents: (cents: number) => `${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents`,
    ms: (ms: number) => `${ms.toFixed(1)} ms`,
    dbfs: (db: number) => `${db.toFixed(1)} dBFS`,
  },
  pwa: {
    updateReady: '새 버전이 있어요. 연습을 마친 뒤 업데이트하세요.',
    update: '지금 업데이트',
    later: '나중에',
    offlineReady: '이제 인터넷 없이도 쓸 수 있어요.',
  },
  home: {
    title: '오늘',
    date: (ms: number) =>
      new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(ms),
    firstRun: '처음이라면 마이크와 튜닝부터 맞춰요.',
    startOnboarding: '처음 설정 시작',
    todayRoutine: '오늘의 루틴',
    totalTime: (minutes: number) => `총 ${minutes}분`,
    itemMinutes: (minutes: number) => `${minutes}분`,
    start: '연습 시작',
    doneToday: '오늘 연습을 마쳤어요. 잘했어요!',
    splitHalfDone: '앞 절반을 마쳤어요. 나머지는 위의 "이어서 하기"로 해요.',
    examLine: (item: string) => `졸업 시험 · ${item}번 항목`,
    again: '한 번 더 하기',
    doneItems: '오늘 한 연습',
    doneCount: (n: number) => `×${n}`,
    nextRoutine: '한 번 더 하면',
    rotationNote: '리듬·기술 칸은 세션마다 돌아가며 바뀌어요. 그래서 방금 한 것과 다를 수 있어요.',
    stage: (stage: number, name: string) => `Stage ${stage} · ${name}`,
    checklist: '진급 체크리스트',
    weakPairs: '약한 체인지 Top 3',
    weakPairsNote:
      '최근 1분 체인지 기록의 가운데값이에요. 진급은 체크리스트 기준(55초 이상 실행, 날짜별 최고)으로 봐요.',
    notPracticed: '아직 안 함',
    noPairs: '코드를 두 개 배우면 체인지 쌍이 생겨요.',
    perMinute: (v: number) => `분당 ${v.toFixed(0)}회`,
    // Stat tiles: label + value read as one phrase ("이번 주 35분", "오늘 복습 2개 (대기 5개)").
    weekLabel: '이번 주',
    weekValue: (minutes: number) => `${minutes}분`,
    streakLabel: '주간 스트릭',
    streakValue: (weeks: number) => `${weeks}주`,
    reviewsLabel: '오늘 복습',
    reviewsValue: (served: number) => `${served}개`,
    reviewsWaiting: (waiting: number) => `(대기 ${waiting}개)`,
    currentStage: '지금 단계',
    stageProgress: (percent: string) => `진급 기준 ${percent} 채움`,
    reviewBadge: (n: number) => (n > 1 ? `복습 ${n}` : '복습'),
    reviewKinds: {
      chord: '코드',
      pair: '체인지',
      pattern: '패턴',
      song: '곡',
      scale: '스케일',
      riff: '리프',
      recall: '코드 기억 카드',
      note: '음이름 카드',
      ear: '귀 훈련 카드',
    },
    backupReminder: '마지막 백업 후 7일이 지났어요. 기록을 잃지 않게 백업해 두세요.',
    backupNow: '백업하러 가기',
    longer: '그래도 더 길게 하기',
    blocks: {
      tuning: '튜닝',
      repertoire: '레퍼토리',
      warmup: '워밍업',
      selfCheck: '자가 체크',
      stageReview: '지난 단계 복습',
      newChord: '새 코드',
      chord: '코드',
      changes: '체인지',
      rest: '휴식',
      drill: '드릴',
      rhythm: '리듬',
      scale: '스케일',
      technique: '기술',
      recall: '코드 기억',
      knowledge: '지식',
      review: '복습',
      song: '연습곡',
    },
    restItem: '휴식',
    notices: {
      gapReview: (days: number) => `${days}일 만이에요. 지난 단계를 먼저 복습해요.`,
      capApplied: (minutes: number) => `처음 4주는 하루 ${minutes}분으로 맞췄어요.`,
      changesCapReached: '오늘 1분 체인지는 충분히 했어요(하루 6회).',
      userTemplate: '내가 편집한 루틴 구성으로 짰어요.',
      newChords: (names: string, extraMinutes: number) =>
        `새 코드를 배워봅시다: ${names}. 튜닝 다음에 먼저 연습해요${extraMinutes > 0 ? `(오늘은 ${extraMinutes}분 더)` : ''}.`,
    },
    editRoutine: '루틴 편집',
    recommendations: '추천',
    prescription: {
      omcToPfc: (pair: string) =>
        `${pair}: 2주째 제자리예요. 앵커·공중 드릴과 정확 빠른 체인지로 바꿔 연습해요.`,
      pfcToOmc: (pair: string) =>
        `${pair}: 정확 빠른 체인지가 제자리예요. 1분 체인지로 돌아가 속도를 올려요.`,
      pluckMode: (chord: string) =>
        `${chord}: 2주째 제자리예요. 한 줄씩 튕겨 확인하며 코칭 팁을 따라 해 보세요.`,
      slowerTempo: (subject: string) =>
        `${subject}: 2주째 템포가 그대로예요. 일주일 동안 10 BPM 낮춰 시작해요.`,
    },
    gSwitch: (to: string) =>
      to === 'G-3f'
        ? '두 손가락 G를 익혔어요. 세 손가락 G로 바꿔 볼까요?'
        : '세 손가락 G를 익혔어요. 네 손가락 G로 바꿔 볼까요?',
    gSwitchYes: '바꾸기',
    subjects: {
      altpick: (stringNo: number) => `${stringNo}번 줄 교대 피킹`,
      riff: (id: string) => `리프 ${id}`,
      notePosition: (stringNo: number, fret: number) => `${stringNo}번 줄 ${fret}프렛`,
      earKind: { majmin: '메이저/마이너', interval: '인터벌', progression: '진행' } as Record<string, string>,
      scale: (id: string, step: string) => `스케일 ${id}${step ? ` ${step.replace('s', '')}단계` : ''}`,
    },
    promote: (stage: number) => `진급 조건을 모두 채웠어요! Stage ${stage}(으)로 올라갈까요?`,
    promoteConditional:
      '쌍 몇 개가 3주째 제자리예요. 앵커·공중 체인지 드릴을 처방받고 조건부로 진급할 수 있어요.',
    promoteYes: '진급하기',
    completedBeginner: '초급 1 수료! 축하해요.',
    completedBeginner2: (at: number | null) =>
      `초급 2 수료! 축하해요.${at === null ? '' : ` (${new Date(at).toLocaleDateString('ko-KR')})`} 이제 레퍼토리·복습·약점 위주로 이어 가요.`,
    completeBeginner2: 'Stage 11 기준을 모두 채웠어요! 초급 2 수료를 기록할까요?',
    completeBeginner2Yes: '수료 기록하기',
    splitResume: '오늘 나눠 한 세션의 남은 절반이 있어요.',
    resumeSession: '이어서 하기',
  },
  rules: {
    countAtLeast: (subject: string, count: number) =>
      subject === 'tuning:session'
        ? `튜너로 6줄 튜닝 완료 ${count}회`
        : subject === 'song:*'
          ? `연습곡 ${count}곡 완주`
          : subject.startsWith('strum:P5')
            ? 'P5(6/8) 패턴 시도 기록'
            : `${subject} ${count}회`,
    metricAtLeast: (subject: string, value: number) => {
      if (subject === 'quiz:diagram') return `다이어그램 퀴즈 ${(value * 100).toFixed(0)}% 이상`;
      if (subject === 'altpick:any') return `한 줄 교대 피킹 ${value}\u00a0BPM 통과`;
      const m = /^strum:(P\d)(?::(\w+))?$/.exec(subject);
      if (m) {
        const mode =
          m[2] === 'mute'
            ? ' 뮤트'
            : m[2] === 'progression'
              ? ' 코드 진행'
              : m[2] === 'single'
                ? ' 단일 코드'
                : '';
        return `${m[1]}${mode} ${value}\u00a0BPM 통과`;
      }
      return `${subject} ≥ ${value}`;
    },
    distinctDaysAtLeast: (subject: string, value: number, days: number) =>
      `${subject} ${value} 이상, 서로 다른 ${days}일`,
    unlockedPairsAtLeast: (value: number, days: number) =>
      `배운 코드 쌍 모두 1분 체인지 ${value}회 이상(서로 다른 ${days}일)`,
    recallPassed: (chords: string) => `코드 기억 퀴즈 3초 안에 정답(서로 다른 2일): ${chords}`,
    pairsPassedAtLeast: (count: number, total: number) =>
      `이 단계 쌍 ${total}개 중 ${count}개 이상 1분 체인지 30회(서로 다른 2일)`,
    daysInStageAtLeast: (days: number) => `이 단계에서 ${days}일 이상`,
    songsCompletedAtLeast: (count: number, stage: number | null) =>
      stage === null
        ? `F가 들어간 곡 ${count}곡 연주 모드 완주`
        : `Stage ${stage} 곡 ${count}곡 연주 모드 완주`,
    scaleStepGraduated: (scale: string, step: number, bpm: number) =>
      `${scale} ${step}단계 ${bpm}\u00a0BPM 졸업`,
    scaleMemorized: (scale: string) => `${scale} 외워서 치기(TAB 숨김)`,
    chordCleanRatioAtLeast: (chords: string, ratio: number) =>
      `${chords} 중 하나 최근 10회 깨끗한 비율 ${(ratio * 100).toFixed(0)}% 이상`,
    quizRunAtLeast: (questions: number, accuracy: number) =>
      `6·5번 줄 음이름 ${questions}문항 정답률 ${(accuracy * 100).toFixed(0)}% 이상, 응답 3초 안`,
    sessionsInStageAtLeast: (count: number) => `이 단계에서 ${count}세션 이상 연습`,
    examPassed: '초급 1 졸업 시험 통과',
    missing: (items: string) => `남은 것: ${items}`,
    pairProgress: (pair: string, days: number, needDays: number, value: number, best: number | null) =>
      best === null
        ? `${pair}: 아직 1분을 채운 실행이 없어요(55초 이상만 셈)`
        : `${pair}: ${value}회 넘은 날 ${days}/${needDays}일 · 최고 ${best.toFixed(0)}회` +
          (best >= value ? ' — 다른 날 한 번 더 넘기면 돼요' : ''),
    met: '달성:',
    notMet: '아직:',
  },
  mic: {
    errors: {
      PERMISSION_DENIED:
        '마이크 권한이 거부됐어요. 주소창의 자물쇠 아이콘(iPad는 설정 > Safari > 마이크)에서 허용한 뒤 다시 시도하세요.',
      NO_DEVICE: '마이크를 찾지 못했어요. 마이크가 연결돼 있는지 확인하고 다시 시도하세요.',
      DEVICE_BUSY: '다른 앱이 마이크를 쓰고 있어요. 그 앱을 닫고 다시 시도하세요.',
      DEVICE_LOST: '마이크 연결이 끊겼어요. 다시 연결한 뒤 다시 시도하세요.',
      UNSUPPORTED: '이 브라우저는 마이크 입력을 지원하지 않아요. 최신 Safari나 Chrome을 써 주세요.',
      UNKNOWN: '마이크를 켜지 못했어요. 다시 시도해 주세요.',
    },
    interrupted: '다른 앱 때문에 소리가 멈췄어요. 버튼을 눌러 다시 시작하세요.',
    resume: '소리 다시 시작',
    bluetoothInput: '블루투스 마이크는 지연이 크고 음질이 낮아요. 기기 내장 마이크를 권장해요.',
    processingOn: (names: string) => `브라우저가 ${names} 기능을 끄지 않았어요. 판정이 덜 정확할 수 있어요.`,
    processingNames: {
      echoCancellation: '에코 제거',
      noiseSuppression: '잡음 제거',
      autoGainControl: '자동 음량',
    },
    noWorkaround: '마이크 없이도 수동 카운트와 자가 판정으로 연습할 수 있어요.',
  },
  diagnostics: {
    title: '진단',
    micStart: '마이크 켜기',
    micStop: '마이크 끄기',
    level: '입력 레벨',
    status: '마이크 상태',
    statusLabels: {
      idle: '꺼짐',
      starting: '켜는 중',
      running: '켜짐',
      interrupted: '중단됨',
      error: '오류',
    },
    device: '입력 장치',
    chooseDevice: '입력 장치 선택',
    defaultDevice: '기본 장치',
    trackSettings: '브라우저가 적용한 설정 (getSettings)',
    sampleRate: '샘플레이트',
    contextRate: (hz: number) => `오디오 컨텍스트 ${hz} Hz`,
    trackRate: (hz: number | null) => `마이크 트랙 ${hz === null ? '알 수 없음' : `${hz} Hz`}`,
    latency: '출력 지연 (base / output)',
    calibration: '최근 캘리브레이션',
    noCalibration: '아직 캘리브레이션을 하지 않았어요.',
    calibrationSummary: (rttMs: number, method: string, noiseDb: number) =>
      `지연 ${rttMs.toFixed(1)} ms (${method}), 주변 소음 ${noiseDb.toFixed(1)} dBFS`,
    rerunOnboarding: '캘리브레이션 다시 하기',
    detectorVersion: (version: string) => `판정기 버전 ${version}`,
    allOff: '에코 제거·잡음 제거·자동 음량이 모두 꺼져 있어요.',
    gaps: (count: number, ms: number) =>
      count === 0 ? '오디오 끊김 없음' : `오디오 끊김 ${count}회 (${ms.toFixed(0)} ms, 시간은 보정됨)`,
  },
  tuner: {
    title: '튜너',
    start: '튜너 켜기',
    idle: '튜너를 켜고 줄을 하나 튕겨 보세요.',
    stop: '튜너 끄기',
    auto: '자동(크로매틱)',
    listening: '줄을 하나 튕겨 주세요.',
    inTune: '맞음',
    tuneUp: '낮아요 — 줄을 조금 조이세요',
    tuneDown: '높아요 — 줄을 조금 푸세요',
    judgingOff: '튜너를 켜 둔 동안에는 마이크 판정을 쓰지 않아요.',
    stringMode: '줄 선택',
  },
  metronome: {
    title: '메트로놈',
    start: '시작',
    stop: '정지',
    bpm: 'BPM',
    tap: '탭 템포',
    meter: '박자',
    subdivision: '세분',
    subdivisionNames: { 1: '4분음표', 2: '8분음표', 3: '셋잇단', 4: '16분음표' } as Record<number, string>,
    countIn: '카운트인',
    countInBars: (n: number) => (n === 0 ? '없음' : `${n}마디`),
    mutedBars: '음소거 마디',
    mutedOff: '끔',
    mutedPattern: (play: number, mute: number) => `${play}마디 소리 + ${mute}마디 무음`,
    visualOnly: '시각 전용 (소리 없이 깜빡임만)',
    limit: '자동 정지',
    limitOff: '없음',
    limitBars: (n: number) => `${n}마디 후`,
    limitMinutes: (n: number) => `${n}분 후`,
    ladder: '템포 사다리',
    ladderStart: '시작 BPM',
    ladderTarget: '목표 BPM',
    ladderStep: '증분',
    ladderUp: '통과 — 다음 단계로',
    countingIn: '카운트인',
    barBeat: (bar: number, beat: number) => `${bar + 1}마디 ${beat + 1}박`,
    ended: '설정한 길이만큼 연주했어요.',
    decrease: (n: number) => `BPM ${n} 내리기`,
    increase: (n: number) => `BPM ${n} 올리기`,
  },
  session: {
    title: '연습',
    itemOf: (index: number, total: number) => `${index}/${total}`,
    itemBudget: (seconds: number) =>
      `이 항목 남은 시간 ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`,
    budgetOver: '계획한 시간이 지났어요. 마무리하고 다음으로 가요.',
    next: (title: string) => `다음: ${title}`,
    lastItem: '마지막 항목이에요.',
    nextItem: '다음 항목 (Enter)',
    retry: '다시 하기 (Space)',
    retrySameTempo: '같은 템포로 다시 (Space)',
    retryAtBpm: (bpm: number) => `${bpm} BPM으로 다시`,
    repeat: '이어서 한 번 더 (Space)',
    sameTempo: '같은 템포로 다시',
    repeatAtBpm: (bpm: number) => `이어서 한 번 더 · ${bpm} BPM (Space)`,
    nextRepertoireSong: (title: string) => `이어서 다음 레퍼토리 곡 · ${title} (Space)`,
    blockEnd: '블록 끝',
    transitionNext: (block: string) => `다음 블록 · ${block}`,
    transitionIn: (seconds: number) => `${seconds}초 뒤 시작`,
    transitionStart: '바로 시작 (Enter)',
    newChordsIntro: '새 코드를 배워봅시다',
    skip: '건너뛰기',
    previous: '이전 항목',
    pause: '일시정지',
    resume: '계속하기',
    paused: '일시정지 중',
    end: '세션 끝내기',
    splitPoint: '앞 절반 끝 — 30분 루틴은 여기서 나눠 해도 돼요. 오늘 안에 홈에서 이어서 할 수 있어요.',
    splitHere: '여기서 나눠 하기',
    finishRunFirst:
      '건너뛰기와 세션 끝내기는 연습이 끝나면 할 수 있어요. 지금 그만두려면 Esc를 두 번 누르거나 "중단"을 눌러요. "이전 항목"(←)은 이 연습을 끝내고 돌아가요.',
    rest: (seconds: number) => `잠깐 쉬어요 · ${seconds}초`,
    restSkip: '바로 다음으로',
    breakReminder: '30분 동안 연습했어요. 잠깐 손을 쉬고 스트레칭해요.',
    breakOk: '알겠어요',
    reportTitle: '오늘 연습은 어땠나요?',
    pain: (n: number) => `손가락·손목 통증 ${n}/10`,
    difficulty: (n: number) => `난이도 ${n}/5`,
    danger: { sharp: '날카로운 통증', numbness: '저림', joint: '관절·손목 통증' },
    dangerLegend: '이런 증상이 있었나요?',
    note: '메모 (선택)',
    save: '저장하고 끝내기',
    exitWithoutReport: '평가 없이 끝내려면 위의 "나가기"를 눌러요. 오늘 한 연습은 그대로 남아요.',
    backToPractice: '연습으로 돌아가기 (←)',
    saved: '세션을 저장했어요.',
    noRoutine: '오늘은 쉬는 날이에요.',
  },
  micFeedback: {
    noiseFloor: '잡음',
    minLevel: '판정 최소',
    waiting: '판정 확신도: 아직 없음',
    confidence: {
      sure: '판정 확신도: 확실',
      likely: '판정 확신도: 아마도',
      unsure: '판정 확신도: 불확실 — 한 번 더 또렷하게',
      beta: '판정: 참고(베타)',
    },
  },
  environmentGuide: {
    title: '마이크 판정이 잘 되는 환경',
    items: [
      '기기를 기타에서 30–60 cm 떨어진 곳에 두고, 마이크가 사운드홀과 12프렛 사이를 향하게 해요.',
      'iPhone·iPad는 제어 센터 → 마이크 모드를 "표준"으로 두세요("음성 분리"는 기타 소리를 지워요).',
      '반주·메트로놈 소리가 큰 곳에서는 유선 이어폰을 쓰세요(스피커 소리가 마이크로 새면 판정이 흔들려요).',
    ],
  },
  tuningGuide: {
    inTune: '맞아요',
    tighten: '조이세요(음을 올려요)',
    loosen: '푸세요(음을 내려요)',
    peg: (turn: 'cw' | 'ccw') =>
      `헤드 앞에서 볼 때 줄감개를 ${turn === 'cw' ? '시계 방향' : '시계 반대 방향'}으로 조금씩 돌려요`,
    skip: '다른 튜너로 이미 맞췄어요(건너뛰기)',
    skipped: '건너뜀',
  },
  routineEditor: {
    title: '루틴 편집',
    intro:
      '항목을 빼거나 더하고 블록 시간을 바꿔 저장하면, 다음 세션부터 이 단계에서 이 구성으로 짜요. 쌍, 코드, 템포는 앱이 그날 맞게 채워요.',
    seconds: (sec: number) => `${Math.round(sec / 60) >= 1 && sec % 60 === 0 ? `${sec / 60}분` : `${sec}초`}`,
    moveUp: '위로',
    moveDown: '아래로',
    shorter: '30초 줄이기',
    longer: '30초 늘리기',
    remove: '빼기',
    addLabel: '항목 더하기',
    add: '더하기',
    save: '이 구성으로 저장',
    reset: '기본으로 되돌리기',
    cancel: '취소',
    rotation: {
      rhythm: '리듬(순환)',
      scales: '스케일·크로매틱(순환)',
      technique: '기술(순환)',
      knowledge: '지식 퀴즈(순환)',
    },
    change: { slot1: '1분 체인지(새 코드 쌍)', slot2: '1분 체인지(약한 쌍·복습)', pfc: '정확 빠른 체인지' },
    slots: {
      tuning: '튜닝',
      repertoire: '레퍼토리',
      strumFixed: '스트러밍(뮤트)',
      stretch: '손가락 스트레칭',
      selfCheck: '자가 체크',
      chordFixed: '코드 정밀 체크',
      chordNew: '코드 정밀 체크(새 코드)',
      chordWeak: '코드 정밀 체크(약한 코드·복습)',
      rest: '휴식',
      drillFixed: '앵커·공중 체인지 드릴',
      oneBeatFixed: '박 1 체인지',
      recall: '코드 기억 퀴즈',
      song: '연습곡',
      songMemorize: '연습곡 외워서 치기',
    },
  },
  selfChecks: {
    posture: {
      title: '자세',
      body: '허리를 펴고 앉아요. 기타 몸통은 오른 허벅지에, 넥은 수평보다 조금 위로. 왼손 엄지는 넥 뒤 가운데에 두고, 손목을 심하게 꺾지 않아요.',
    },
    pick: {
      title: '피크 잡기',
      body: '피크를 엄지 끝과 검지 옆면 사이에 잡고, 끝이 2–3 mm만 나오게 해요. 힘은 빼요.',
    },
    countAloud: { title: '박 소리 내어 세기', body: '"하나, 둘, 셋, 넷"을 소리 내어 세면서 쳐요.' },
    footTap: { title: '발로 박 세기', body: '발뒤꿈치는 바닥에 두고, 앞꿈치로 박마다 바닥을 가볍게 쳐요.' },
    deliberateMute: {
      title: '의도적 뮤트',
      body: '왼손 힘을 살짝 빼서 소리를 끊어요. 줄에서 손가락을 떼지는 않아요.',
    },
    palmMute: { title: '팜뮤트', body: '오른손 날을 브리지 바로 앞 줄 위에 살짝 대고 쳐요.' },
  },
  curriculum: {
    title: '커리큘럼',
    practicedBy: (names: string) => `연습: ${names}`,
    variantDynamics: '셈여림',
    locked: '다음 버전에서 열립니다',
    current: '현재 단계',
    passed: '통과',
    learn: '배울 것',
    tips: '팁',
    criteria: '진급 기준',
    newChords: '새 코드',
    /** Roadmap groups (D-087): Beginner 1 = Stage 0–7, Beginner 2 = Stage 8–11. */
    group: (level: 1 | 2) => `초급 ${level}`,
    groupRange: (from: number, to: number) => `Stage ${from}–${to}`,
    examMilestone: '초급 1을 마무리하는 시험이에요. 통과하면 Stage 8로 올라가요.',
    /** "이 단계 연습" (D-072): pick exercises of any stage and play them now. */
    practice: {
      title: '이 단계 연습하기',
      intro:
        '하나를 골라 바로 하거나, 여러 개를 골라 순서대로 세션으로 할 수 있어요. 기록은 평소처럼 남아요.',
      now: '바로 하기',
      quickTitle: '먼저 해 볼 연습',
      pickMany: '여러 개 골라 세션으로',
      add: '세션에 넣기',
      start: (n: number) => (n === 0 ? '세션에 넣을 연습을 골라요' : `고른 ${n}개로 세션 시작`),
      none: '지금은 없음',
      noneHint: '지금은 할 항목이 없어요(배운 코드·카드가 아직 없거나 오늘 상한에 닿았어요).',
      otherStage: '지금 단계가 아닌 단계로 한 세션은 지금 단계의 최소 세션 수에는 들어가지 않아요.',
      back: '단계로',
      next: '다음 연습',
      order: (n: number) => `${n}번째`,
    },
    exam: '졸업 시험',
    examIntro: '항목별로 따로 통과해도 돼요. 통과한 항목은 기록돼요.',
    examItems: {
      '1': '튜너로 6줄 튜닝(±5 cents)',
      '2': '무작위 8코드: 이름을 보고 3초 안에 스트럼 + 코드별 정확 체크 깨끗 50% 이상',
      '3': '무작위 5쌍 1분 체인지 각 30회 이상',
      '4': '표준 패턴 D DU UDU 80 BPM 8마디 적중 90% (시각 큐 숨김 포함)',
      '5': '연습곡 5곡 악보 숨김 완주',
    } as Record<string, string>,
    examPassedAt: (date: string) => `통과 (${date})`,
    examStart: '시작',
    examChordClean: (chord: string, pct: number) => `${chord} 깨끗 ${pct}%`,
    examSongs: (n: number) => `악보 숨김 완주 ${n}/5곡`,
    examCheck: '결과 확인',
    examNotYet: '아직 기준에 못 미쳤어요. 다시 해 봐요.',
    examNextStep: (n: number, total: number) => `다음 단계 ${n}/${total} (Enter)`,
    examPrevResult: '← 앞 단계 결과 보기',
    examBackToStep: '지금 단계로 돌아가기',
    examStepResult: (n: number) => `${n}단계 결과`,
  },
  progressScreen: {
    title: '진도',
    weekly: '주간 연습 시간(분)',
    pairs: '쌍별 1분 체인지 (점: 기록, 선: 이동 중앙값)',
    heatmap: '코드 × 줄 깨끗 비율',
    patterns: '패턴별 최고 통과 BPM',
    timing: '타이밍 평균·흔들림(ms)',
    reviews: (n: number) => `복습 대기 ${n}개`,
    reviewHow:
      '복습은 따로 하지 않아요. 오늘의 루틴이 같은 종류의 칸(코드·체인지·리듬·기술·퀴즈·곡)에 오래 밀린 것부터 넣어요. 퀴즈 카드는 어디서 답해도, 나머지는 루틴에서 한 것만 복습으로 쳐요.',
    reviewDueTitle: '지금 복습할 것',
    reviewUpcomingTitle: '다가오는 복습',
    reviewOverdue: (days: number) => (days <= 0 ? '오늘' : `${days}일 지남`),
    reviewIn: (days: number) => (days <= 1 ? '내일' : `${days}일 뒤`),
    sessions: '세션 기록',
    noData: '아직 기록이 없어요.',
    weeklyEmpty: '연습을 마치면 주마다 막대가 쌓여요.',
    goPractice: '오늘 연습하러 가기',
    sessionsLabel: '마친 세션',
    sessionsValue: (n: number) => `${n}회`,
    sessionRow: (date: string, minutes: number, done: number, planned: number) =>
      `${date} · ${minutes}분 · ${done}/${planned}항목`,
    mean: '평균',
    sd: '흔들림',
  },
  library: {
    title: '코드',
    stage: (n: number) => `Stage ${n}`,
    expected: '기대 음',
    verifiable: '스트럼으로 확인 가능한 줄',
    notVerifiable: '스트럼으로 확인 불가(한 줄씩 확인)',
    listen: '들어 보기',
    practice: '이 코드로 정밀 체크(E1)',
    level: { none: '처음', learning: '익히는 중', acquired: '습득', mastered: '숙달' } as Record<
      string,
      string
    >,
    back: '코드 목록',
  },
  settingsScreen: {
    /** Setting groups (D-093): one card each. */
    groups: { display: '화면', judging: '판정', practice: '연습·세션', more: '설정 더 보기' },
    title: '설정',
    devices: '입력 장치·진단',
    recalibrate: '캘리브레이션 다시 하기',
    theme: '테마',
    themes: { dark: '다크', light: '라이트', contrast: '고대비' },
    leftHanded: '왼손잡이(다이어그램 좌우 반전)',
    strictness: '판정 엄격도',
    strictnessNames: { lenient: '관대', normal: '보통', strict: '엄격' },
    sensitivity: '판정 감도(줄 하나씩 확인)',
    sensitivityNames: {
      low: '둔감 — 작은 소리·잡음은 무시',
      normal: '보통',
      high: '민감 — 작은 소리도 판정',
    },
    sensitivityHelp: '몸통을 친 소리처럼 줄 소리가 아닌 건 어느 감도에서나 다시 쳐 달라고 해요.',
    visualOnly: '시각 전용 메트로놈(소리 없이)',
    xStringCheck: 'x줄 확인(치지 않는 줄이 조용한지 확인)',
    sessionMinutes: '세션 길이(분)',
    sessionLengthTemplate: '세션 길이는 단계 기본값(20분, 단계 8부터 30분)',
    blockTransition: '블록 사이 5초 전환 화면(다음 항목 미리 보기)',
    headStyle: '기타 헤드 모양(튜닝 줄감개 방향 그림)',
    headStyles: { '3+3': '양쪽 3개씩(3+3)', inline6: '한쪽에 6개(일렬)' },
    micDisabled: '마이크 없이 쓰기',
    micNotice: '마이크 판정은 보조 수단이에요. 내 귀가 먼저예요.',
    backup: '백업',
    exportData: '내보내기(JSON 파일)',
    importData: '가져오기',
    importPreview: (rows: string) => `가져올 데이터: ${rows}`,
    importMerge: '합치기(같은 기록은 건너뜀)',
    importReplace: '바꾸기(지금 데이터를 지우고 가져오기)',
    importReplaceConfirm: '정말 지금 데이터를 모두 지우고 바꿀까요? 되돌릴 수 없어요.',
    importDone: '가져왔어요.',
    importError: '파일을 읽지 못했어요. 이 앱에서 내보낸 JSON 또는 zip 파일인지 확인해 주세요.',
    exported: (name: string) => `${name} 파일로 내보냈어요.`,
    exportFull: '내보내기(녹음 오디오 포함 zip)',
    exportedFullWithout: (name: string, n: number) =>
      `${name} 파일로 내보냈어요. 녹음 ${n}개는 오디오를 읽지 못해 기록만 담았어요(이 브라우저에서 기기 내 저장을 쓸 수 없거나 파일이 없어요).`,
    importAudio: (n: number) => `녹음 오디오 ${n}개`,
    importDoneWithoutAudio: (n: number) =>
      `가져왔어요. 녹음 오디오 ${n}개는 저장하지 못했어요(이 브라우저에서 기기 내 저장을 쓸 수 없어요). 녹음 기록은 가져왔어요.`,
    exportError: '내보내지 못했어요. 저장 공간을 확인하고 다시 해 주세요.',
    lastBackup: (date: string | null) => (date ? `마지막 백업: ${date}` : '아직 백업하지 않았어요.'),
    persist: (granted: boolean) =>
      granted
        ? '브라우저가 기록을 지우지 않도록 보호했어요.'
        : '저장소 보호를 받지 못했어요. 자주 백업해 주세요.',
    homeScreenTip:
      'iPad·iPhone에서는 Safari 공유 버튼 → "홈 화면에 추가"로 설치하면 기록이 더 안전하게 보관돼요.',
    recording: '녹음 키트',
    reset: '데이터 초기화',
    resetConfirm1: '모든 연습 기록·설정을 지울까요?',
    resetConfirm2: '정말 지울까요? 되돌릴 수 없어요. (백업을 먼저 권장해요)',
    resetDone: '모든 데이터를 지웠어요.',
    yes: '네',
    no: '아니요',
    cancel: '취소',
    keys: '키·페달',
  },
  recording: {
    progress: (done: number, total: number) => `${total}개 중 ${done}개 녹음했어요`,
    title: '녹음 키트',
    intro: '내 기타·내 방 소리로 판정기를 확인하는 데 쓰는 짧은 녹음이에요. 녹음은 기기 안에만 저장돼요.',
    record: '녹음',
    stop: '멈춤',
    recording: (s: number) => `녹음 중… ${s.toFixed(0)}초`,
    saved: '저장했어요.',
    save: '저장',
    count: '직접 센 횟수',
    exportAll: '모두 내보내기(zip)',
    exported: '내보냈어요.',
    exportedWithout: (n: number) =>
      `내보냈어요. 오디오 파일이 없는 기록 ${n}개는 뺐어요(백업에서 가져온 녹음 기록에는 오디오가 없어요).`,
    noFiles: '내보낼 오디오 파일이 없어요. 백업에서 가져온 녹음 기록에는 오디오가 들어 있지 않아요.',
    failed:
      '녹음하거나 저장하지 못했어요. 저장 공간이 부족하거나 브라우저가 막았을 수 있어요. 다시 해 주세요.',
    gap: '녹음이 중간에 끊겼어요(화면이 꺼졌거나 다른 앱으로 넘어갔을 수 있어요). 이 녹음은 버리고 다시 녹음해 주세요.',
    empty: '아직 녹음이 없어요.',
    unsupported: '이 브라우저는 기기 내 저장(OPFS)을 지원하지 않아요.',
    kinds: {
      'chord-clean-strum': (chord: string) => `${chord} 깨끗한 스트럼 1번`,
      'chord-pluck': (chord: string) => `${chord} 한 줄씩 저음부터 튕기기`,
      'chord-muted': (chord: string, stringNo: number) => `${chord} ${stringNo}번 줄 일부러 막고 스트럼`,
      'x-string': (chord: string, stringNo: number) => `${chord} ${stringNo}번 줄(x)까지 울리며 스트럼`,
      'one-minute': (from: string, to: string) => `${from}↔${to} 30초 체인지(끝나고 센 횟수 입력)`,
      'strum-grid': (bpm: number) => `메트로놈 ${bpm} BPM에 맞춰 8마디 스트럼`,
    },
  },
  keys: {
    actions: {
      toggle: '시작/정지',
      next: '다음·확인',
      prev: '이전',
      inc: '올리기·+1 보정',
      dec: '내리기·−1 보정',
      abort: '중단',
      mark: '표시·다시 듣기',
      manual1: '1 깨끗',
      manual2: '2 막힘',
      manual3: '3 버징',
      ear: '귀 먼저 켜기·끄기',
      cues: '시각 큐 숨기기',
      loop: '구간 반복',
      hide: '악보·TAB 숨기기',
      backing: '반주 켜기·끄기',
      pause: '일시정지·이어서',
      restart: '노래 처음부터',
    } as Record<string, string>,
    keyNames: {
      ' ': 'Space',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Escape: 'Esc',
    } as Record<string, string>,
    learn: '페달 학습',
    learnPrompt: (action: string) => `"${action}"에 쓸 페달이나 키를 눌러 주세요… (Esc 취소)`,
    learned: (key: string, action: string) => `${key} → ${action}`,
    replaced: (key: string, action: string) =>
      `${key} 키는 원래 "${action}"에 쓰여요. 이제 배운 동작이 먼저예요(목록에서 지우면 되돌아가요).`,
    defaults: '기본 키',
    custom: '학습한 키',
    remove: '지우기',
    pedalTip: '블루투스 페이지 터너 페달은 키보드처럼 동작해요. 페달 버튼을 원하는 동작에 연결하세요.',
    /** Key hint under a run; P only where the run can pause (D-085). */
    hint: (pausable: boolean) =>
      [
        'Space 시작/정지',
        'Enter 다음',
        '↑↓ 보정',
        '1/2/3 수동 판정',
        ...(pausable ? ['P 일시정지'] : []),
        'Esc 중단',
      ].join(' · '),
    confirmAbort: '연습을 중단할까요? 지금까지 한 것은 기록돼요.',
    abortYes: '중단하기',
    abortNo: '계속하기',
    confirmPrevious: '이 연습을 끝내고 이전 항목으로 갈까요? 지금까지 한 것은 기록돼요.',
    previousYes: '이전 항목으로',
  },
  exercises: {
    titles: {
      E0: '튜닝',
      E1: '코드 정밀 체크',
      E2: '1분 코드 체인지',
      E4: '앵커·공중 체인지 드릴',
      E5: '스트러밍 패턴 사다리',
      E6: '박 1 체인지',
      E7: '손가락 스트레칭',
      E8: '한 줄 교대 피킹',
      Q1: '다이어그램 읽기 퀴즈',
      Q2: '코드 기억 퀴즈',
      Q3: '개방현 음이름 퀴즈',
      Q4: '메이저/마이너 귀 훈련',
      S: '연습곡',
      E3: '정확 빠른 체인지',
      E9: '크로매틱 1-2-3-4',
      E10: '스케일 사다리',
      E11: '해머온 손가락 운동',
      E12: '새끼손가락 운동',
      E16: '프렛 위치 비교',
      E17: '단음 리프',
      K1: '자가 체크',
      Q5: 'TAB 읽기 퀴즈',
    },
    /**
     * "하는 법" panel (D-079): shown open before every run and folded while it runs. Steps say what each hand does,
     * what the clicks mean, how the run is judged and what moves the tempo; terms are the shared glossary.
     */
    guide: {
      title: '하는 법',
      termsTitle: '알아 둘 말',
      terms: {
        stringNumbers: {
          name: '줄 번호',
          text: '1번 줄이 가장 가는 줄(바닥 쪽), 6번 줄이 가장 굵은 줄(얼굴 쪽)이에요.',
        },
        fingerNumbers: {
          name: '손가락 번호',
          text: '왼손 1 검지 · 2 중지 · 3 약지 · 4 새끼. 0(또는 o)은 아무 손가락도 누르지 않는 개방현이에요.',
        },
        tab: {
          name: 'TAB 읽기',
          text: '가로선 6개가 기타 줄이에요. 맨 위 선이 1번 줄(가는 줄), 맨 아래 선이 6번 줄(굵은 줄). 선 위 숫자는 누를 프렛 번호이고 0은 개방현이에요. 왼쪽부터 차례로 쳐요.',
        },
        diagram: {
          name: '코드 다이어그램',
          text: '세로선이 줄(왼쪽이 6번 줄), 가로선이 프렛이에요. 동그라미 안 숫자는 누를 손가락 번호, 위의 x는 치지 않는 줄, o는 누르지 않고 치는 줄이에요. 네모·마름모 점은 그 코드의 바탕음(루트)이에요.',
        },
        muteStrum: {
          name: '뮤트 스트럼',
          text: '왼손을 줄 위에 가볍게 얹기만 해서(누르지 않고) 소리가 "칙" 하고 막히게 쳐요. 음 대신 오른손 리듬만 연습하는 방법이에요.',
        },
        strumLetters: {
          name: '패턴 글자',
          text: 'D(↓)는 다운 — 위에서 아래로, U(↑)는 업 — 아래에서 위로 쳐요. 빈칸에서도 손은 계속 위아래로 움직이고 줄만 치지 않아요.',
        },
        mutedBuzz: {
          name: '막힘 · 버징',
          text: '막힘: 소리가 "툭" 하고 바로 끊겨요(옆 손가락이 줄에 닿음). 버징: "지잉" 떨리는 소리(너무 약하게 눌렀거나 프렛에서 멀리 누름).',
        },
        noteNames: {
          name: '음 이름',
          text: 'C D E F G A B = 도 레 미 파 솔 라 시. #은 반음 높게, ♭은 반음 낮게. E2·B3처럼 붙은 숫자는 높이(옥타브)예요 — 숫자가 클수록 높은 소리.',
        },
      },
      perClick: (notes: number) =>
        notes === 1
          ? '메트로놈 클릭 한 번에 한 음씩 쳐요.'
          : '클릭 한 번에 두 음: 클릭에 다운(↓), 클릭 사이에 업(↑).',
      ladderUp: (rule: string, step: number) => `${rule}이면 다음엔 ${step}\u00a0BPM 올려요.`,
      tempoPick:
        '템포는 시작 화면에서 ↑↓나 −5/+5로 직접 골라요. 처음에는 지난번 템포(통과했으면 +5)로 맞춰져 있어요.',
      E0: [
        '6번 줄(가장 굵은 줄)부터 1번 줄까지 차례로 맞춰요.',
        '줄을 한 번 튕기고, 화면 바늘이 가운데(맞음)에 오도록 그 줄의 줄감개를 천천히 돌려요. 화면이 조일지 풀지 알려 줘요.',
        '맞으면 다음 줄로 저절로 넘어가요. 건너뛰려면 다음(→), 앞 줄로 돌아가려면 ←를 눌러요.',
        '마이크 없이 할 때는 다른 튜너로 맞추고 줄마다 Enter로 확인해요.',
      ],
      K1: [
        '카드의 설명과 그림을 보고 그대로 직접 해 봐요.',
        '할 수 있으면 1(됐어요), 아직 어려우면 2(아직)를 눌러요.',
        '점수는 없어요. 마이크가 들을 수 없는 기본기를 스스로 확인하는 연습이에요.',
      ],
      E1: {
        place:
          '다이어그램대로 손가락을 놓아요. 동그라미 안 숫자가 그 자리를 누를 손가락이에요. 손끝을 세워 프렛 바로 뒤를 눌러요.',
        pluck:
          '화면이 밝게 표시하는 줄을 낮은 줄(6번 쪽)부터 하나씩 튕겨요. 마이크가 줄마다 깨끗한지, 막혔는지, 버징인지 들어요.',
        strum: '모든 줄을 한 번 천천히 스트럼해요. 마이크가 코드 소리를 확인해요(참고·베타).',
        manual: '줄을 하나씩 튕겨 보고 스스로 1 깨끗 · 2 막힘 · 3 버징을 눌러요.',
        skipX: 'x 표시 줄은 치지 않아요.',
        repeat:
          '다 확인하면 손을 떼었다가 다시 잡아요. 막힌 줄이 있으면 화면의 팁대로 고쳐서 다시 잡아요 — 다시 잡는 것 자체가 연습이에요.',
      },
      E2: {
        start: (from: string) => `${from} 코드를 잡고 기다려요. 첫 스트럼(또는 Space)으로 1분이 시작돼요.`,
        go: (from: string, to: string) =>
          `${from} ↔ ${to}를 계속 오가며, 코드에 도착할 때마다 한 번 스트럼해요. 도착할 때마다 1회예요.`,
        sound: '소리가 깨끗하지 않아도 괜찮아요. 손 모양을 빨리 만드는 연습이라 소리는 채점하지 않아요.',
        count: {
          auto: '마이크가 바꾼 횟수를 세요. 틀리게 세면 ↑/↓로 고쳐요.',
          tap: '바꿀 때마다 Enter(또는 페달)를 눌러 1회씩 세요.',
          manual: '끝난 뒤 바꾼 횟수를 직접 입력해요.',
        },
        goal: (n: number, days: number) => `진급 목표: 쌍마다 1분에 ${n}회 이상(서로 다른 날 ${days}번).`,
      },
      E3: {
        start: '1분 체인지처럼 첫 스트럼으로 시작해요.',
        check: '코드에 도착할 때마다 천천히 스트럼(또는 한 줄씩)해서 모든 줄을 확인해요.',
        mark: '깨끗하면 Enter, 막히거나 버징이면 ↓. 표시하지 않은 도착은 깨끗하지 않은 것으로 세요.',
        pass: (rate: number, perMin: number) => `통과: 깨끗한 도착 ${rate}% 이상, 1분에 ${perMin}회 이상.`,
      },
      E4: {
        anchor:
          "화면에 '앵커 체인지'가 나오면: 표시된 앵커 손가락은 줄에서 떼지 말고, 나머지 손가락만 천천히 옮겨요. 스트럼은 하지 않아요.",
        air: "'공중 체인지'가 나오면: 줄 위 공중에서 다음 코드 손 모양을 먼저 만들고, 모든 손가락을 한꺼번에 내려놓아요.",
        report:
          '타이머가 끝나면 10번 중 몇 번 손가락이 동시에 깔끔하게 내려앉았는지 입력해요. 점수는 없어요 — 천천히, 정확하게.',
      },
      E5: {
        bar: (clicks: number) =>
          `메트로놈 클릭 ${clicks}번이 한 마디예요. 한 마디를 세고(카운트인) 시작해요.`,
        cells: (perClick: number) =>
          perClick === 2
            ? '패턴 칸은 클릭 하나에 두 칸씩이에요. 1·3·5·7번째 칸이 클릭과 같은 순간, 그 사이 칸은 클릭과 클릭 사이예요.'
            : `패턴 칸은 클릭 하나에 ${perClick}칸씩이에요. 클릭마다 첫 칸이 클릭과 같은 순간이에요.`,
        mode: {
          mute: '뮤트 스트럼으로 리듬만 연습해요.',
          single: '코드 하나를 잡고 패턴대로 쳐요.',
          progression: '마디마다 화면에 나오는 코드로 바꾸며 쳐요.',
        },
        keepGoing: '놓쳐도 멈추지 말고 계속 쳐요.',
        ladder: (up: number, bars: number, step: number) =>
          `${bars}마디 이상 쳐서 ${up}% 이상 맞추면 다음엔 ${step}\u00a0BPM 올려요. 못 맞춰도 템포를 저절로 내리지 않아요.`,
      },
      E6: {
        chords: (progression: string) =>
          `마디마다 코드 하나: ${progression}를 반복해요. 클릭 4번이 한 마디예요.`,
        pattern: (label: string) => `한 마디 안에서는 패턴 ${label}로 쳐요.`,
        change:
          '다음 마디 첫 박에 새 코드가 울리도록 앞 마디 마지막 박에 미리 손을 옮겨요. 멈추지 말고 계속 쳐요.',
        live: '마이크를 켜면 마디가 끝날 때마다 제때 바꿨는지 바로 보여 줘요.',
        pass: (ok: number, bars: number, step: number) =>
          `${bars}마디 중 ${ok}마디 이상 첫 박을 제때 치고 멈춘 마디가 없으면 다음엔 ${step}\u00a0BPM 올려요.`,
      },
      E7: {
        report:
          '타이머가 끝나면 통증을 0–10으로 입력해요. 세 번 연속 2 이하면 시작 프렛을 한 칸 내려 더 벌려요.',
      },
      E8: {
        string: (stringNo: number) => `${stringNo}번 줄 하나만 쳐요. 왼손은 누르지 않아요(개방현).`,
        start: '한 마디를 세고 바로 시작해요. 손목을 작게 움직이고 피크 끝만 줄에 닿게 해요.',
        pass: (hit: number, cv: number, bars: number, step: number) =>
          `${bars}마디 동안 ${hit}% 이상 맞추고 간격 흔들림이 ${cv}% 이하면 다음엔 ${step}\u00a0BPM 올려요.`,
      },
      E9: {
        ladder: (streak: number, goal: number, step: number) =>
          `${streak}묶음 연속 실수 없으면 ${step}\u00a0BPM 올려요. 목표는 ${goal}\u00a0BPM이에요. 실수가 많아도 템포를 저절로 내리지 않아요.`,
      },
      E10: {
        fingers: 'TAB 아래 숫자가 누를 손가락이에요. 한 프렛에 한 손가락을 써요.',
        ladder: (streak: number, graduate: number, step: number) =>
          `TAB 끝까지가 한 바퀴예요. ${streak}바퀴 연속 실수 없으면 ${step}\u00a0BPM 올리고, ${graduate}\u00a0BPM 이상에서 ${streak}바퀴 연속이면 이 단계를 졸업해요. 실수가 많아도 템포를 저절로 내리지 않아요.`,
      },
      E11: {
        ladder: (hit: number, max: number, step: number) =>
          `피킹한 음을 ${hit}% 이상 맞추고 "고르게"(3)를 고르면 다음엔 ${step}\u00a0BPM 올려요(최대 ${max}\u00a0BPM).`,
      },
      E12: {
        report: '끝나면 새끼손가락 음이 또렷했는지(1–3)와 통증(0–10)을 입력해요.',
      },
      E16: {
        place: '2번 줄(두 번째로 가는 줄) 1프렛을 1번 손가락(검지)으로 짚어요.',
        compare:
          '같은 힘으로 세 위치 — 프렛 바로 뒤 · 칸 가운데 · 프렛 위 — 에서 두 번씩 튕겨 소리를 비교해요.',
        noScore: '점수는 없어요. 어디서 누를 때 가장 깨끗한지 직접 들어 보는 연습이에요.',
      },
      E17: {
        left: 'TAB 아래 숫자가 누를 손가락이에요. 프렛 바로 뒤를 손끝으로 눌러요. 0은 손가락을 떼고 개방현으로 쳐요.',
        right: (eighths: boolean) =>
          eighths
            ? '오른손은 피크로 한 음씩, 다운(↓)·업(↑)을 번갈아 쳐요. 치지 않는 줄은 건드리지 않게 해요.'
            : '오른손은 피크로 한 음씩 다운(↓)으로 쳐요. 치지 않는 줄은 건드리지 않게 해요.',
        cycle:
          'TAB 끝까지가 한 바퀴예요. 끝나면 멈추지 말고 바로 처음으로 돌아가 반복해요. 색칠된 칸이 지금 칠 음이에요.',
        listen: '시작하기 전에 "들어 보기"(M)로 어떻게 들리는지 먼저 들어 봐요.',
        judge: (streak: number, step: number) =>
          `바퀴마다 마이크가 음과 박을 확인해요(마이크 없이는 1\u00a0실수\u00a0없음\u00a0· 2\u00a0실수\u00a0있음). ${streak}바퀴 연속 실수 없으면 다음엔 ${step}\u00a0BPM 올려요. 실수가 많아도 템포를 저절로 내리지 않아요.`,
      },
      Q1: [
        '다이어그램을 보고 맞는 답을 1/2/3(또는 버튼)으로 골라요.',
        '정확하게 고르는 것이 먼저예요. 익숙해지면 빨리 답해요.',
      ],
      Q2: [
        '시작하면 바로 코드 이름이 나오고 3초를 세요.',
        '3초 안에 그 코드를 잡고 한 번 스트럼해요. 마이크가 어떤 코드인지 들어요(마이크 없이는 1 잡았어요 · 2 못 잡았어요).',
        '3초 안에 맞게 잡는 날이 서로 다른 날 2번이면 진급 조건 "코드 기억"을 채워요.',
      ],
      Q3: {
        name: '줄과 프렛 위치를 보고 그 음 이름을 1/2/3(또는 버튼)으로 골라요.',
        pluck: '음 이름을 보고 그 음을 직접 쳐요. 같은 음이면 어느 줄에서 쳐도 맞아요.',
      },
      Q4: {
        majmin: '코드 소리를 듣고 밝게 들리면 메이저, 어둡게 들리면 마이너를 골라요.',
        interval:
          '두 음을 차례로 듣고 얼마나 떨어져 있는지 골라요. 보기의 짧은 설명(예: 힘찬 도약)을 기억 단서로 써요.',
        progression:
          '첫 코드(I)를 듣고, 다음 코드가 떠나는 느낌(IV)인지, 돌아오고 싶은 긴장(V)인지, 그대로 머무는지(I) 골라요.',
        replay: 'M(다시 듣기)으로 몇 번이든 다시 들을 수 있어요.',
      },
      Q5: ['TAB의 숫자가 어느 줄 몇 프렛인지 골라요.'],
      S: {
        grid: (beats: number) =>
          `악보 한 칸이 한 마디(클릭 ${beats}번)예요. 칸에 적힌 코드를 그 마디 동안 쳐요.`,
        pattern: (label: string) => `이 곡은 패턴 ${label}로 쳐요.`,
        listen: 'M으로 먼저 들어 볼 수 있어요. ↑↓로 템포를 바꿔요.',
        mode: {
          learn: '배우기: 틀리면 멈추고 다시 해도 돼요. L로 한 구간만 반복할 수 있어요.',
          perform: '연주: 틀려도 멈추지 말고 끝까지 가요. 두 마디 넘게 첫 박을 치지 않으면 멈춤으로 세요.',
          hidden:
            '숨김: 연주와 같지만 시작하면 악보가 가려지고 몇 번째 마디인지만 보여요. 시작 전에는 악보를 볼 수 있어요.',
        },
        goal: '진급 조건: 이 단계 곡 하나를 연주 모드로 끝까지 치기(완주).',
        pause:
          'P로 잠깐 멈출 수 있어요: 멈춘 마디부터 한 마디 세고 다시 쳐요(멈춤 1회로 세요). R은 처음부터 다시 해요.',
      },
    },
    common: {
      start: '시작',
      startWithMic: '마이크 켜고 시작',
      /** The run's stop control (Esc): what was done so far is kept (D-090). */
      finish: '중단',
      readyTitle: '준비되면 시작해요',
      readyMic: '마이크를 켜면 앱이 소리를 듣고 판정해요. 마이크 없이 쓰면 스스로 판정해요.',
      readyKeys: 'Space나 Enter로도 시작할 수 있어요.',
      remaining: '남은 시간',
      saved: '기록했어요.',
      nothingToSave: '시작 전에 멈췄거나 채점할 수 없어서 기록하지 않았어요.',
      saveFailed: '기록하지 못했어요. 다시 시도해 주세요.',
      saving: '기록하는 중…',
      again: '한 번 더',
      home: '홈으로',
      beta: '베타',
      noMic: '마이크 없이 진행해요(수동·자가 판정).',
      unknownExercise: '알 수 없는 연습이에요.',
      paused: '일시정지했어요. P나 Space를 누르면 한 마디 세고 이어서 해요.',
      pause: '일시정지 (P)',
      resume: '이어서 (P)',
      pausedRun: '일시정지한 실행이라 진급 기준에는 쓰지 않아요.',
      /** Takes back an early "그만하기" while time is left (D-096). */
      resumeTimer: '아직 안 끝났어요 · 이어서 하기 (←)',
      /** The −5/+5 steppers before the start of a ladder exercise (D-098). */
      tempoPick: '템포',
      tempoPickNote: '시작하기 전에 ↑↓ 키나 −5/+5로 템포를 골라요.',
    },
    /** Live per-bar feedback while playing (D-077). */
    live: {
      title: '마디별 결과(바로 보기)',
      status: { good: '제때', off: '조금 어긋남', miss: '많이 놓침', stop: '멈춤' },
      icon: { good: '✓', off: '±', miss: '✗', stop: '■' },
      pending: '아직',
      slot: { hit: '✓', miss: '✗', extra: '+', empty: '' },
      cell: (bar: number, status: string) => `${bar}마디 ${status}`,
      timing: (ms: number) =>
        Math.abs(ms) < 1 ? '정확' : `${ms > 0 ? '늦게' : '빨리'} ${Math.abs(Math.round(ms))} ms`,
      chord: { right: '코드 맞음', wrong: '앞 코드 소리 같아요' },
      beatOne: (bar: number, status: string, timing: string | null, chord: string | null) =>
        [`${bar}마디: ${status}`, timing, chord].filter(Boolean).join(' · '),
      counts: (bar: number, hits: number, expected: number, misses: number, extras: number) =>
        [
          `${bar}마디: ${hits}/${expected} 맞음`,
          misses > 0 ? `놓침 ${misses}` : null,
          extras > 0 ? `더 친 것 ${extras}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      note: '마디가 끝나면 1초 안에 결과가 떠요. 기록은 끝난 뒤 다시 계산한 값이에요.',
    },
    stringStatus: {
      OK: '깨끗',
      MUTED: '막힘',
      WRONG_NOTE: '다른 음',
      UNEXPECTED: '울리면 안 돼요',
      WEAK: '약함',
      UNVERIFIABLE: '확인 불가',
      NOT_PLAYED: '안 침',
      pending: '대기',
      hidden: '내 판단 먼저',
    },
    selfStatus: { clean: '깨끗', muted: '막힘', buzz: '버징' },
    e1: {
      modes: { pluck: '한 줄씩', strum: '스트럼 (베타)', manual: '수동' },
      place: '다이어그램을 보고 손가락 번호 순서대로 놓으세요. 준비되면 "준비됐어요"(Space/Enter).',
      placeReady: '준비됐어요',
      pluckString: (stringNo: number) => `${stringNo}번 줄을 튕기세요`,
      silentString: (stringNo: number) => `${stringNo}번 줄(x)을 튕겨 보세요 — 소리가 나지 않아야 해요`,
      strum: '저음 줄부터 전체를 한 번 스트럼하세요',
      selfPrompt: '먼저 내 귀로 판단해 보세요: 1 깨끗 · 2 막힘 · 3 버징',
      manualPrompt: (stringNo: number) =>
        `${stringNo}번 줄을 튕기고 소리를 골라 주세요: 1 깨끗 · 2 막힘 · 3 버징`,
      release: '전체를 한 번 스트럼해 들어 본 뒤, 손을 떼었다가 다시 잡아요.',
      nextAttempt: '다시 잡기',
      clean: '깨끗해요!',
      suggestPluck: '스트럼으로는 판단이 어려워요. "한 줄씩" 모드로 줄마다 확인해 보세요.',
      skip: '이 줄 건너뛰기',
      unskip: '건너뛴 줄 다시 (←)',
      notClean: '아직 깨끗하지 않은 줄이 있어요.',
      stats: (clean: number, total: number) => `깨끗한 시도 ${clean}/${total}`,
      cleanRatio: (ratio: number) => `깨끗한 비율 ${(ratio * 100).toFixed(0)}%`,
      selfAgreement: (ratio: number) => `내 귀와 앱 판정 일치 ${(ratio * 100).toFixed(0)}%`,
      rootStrings: (strings: string) => `루트음: ${strings}번 줄`,
      tendency: (stringNo: number, attempts: number, count: number, kind: 'muted' | 'wrong') =>
        `${stringNo}번 줄이 ${attempts}번 중 ${count}번 ${kind === 'muted' ? '막힘' : '다른 음'}`,
      optionKeys: 'M 모드 바꾸기(한 줄씩 → 스트럼 → 수동) · E 귀 먼저 켜기·끄기',
      diagramLabel: (symbol: string) => `${symbol} 코드 다이어그램`,
      fingerAt: (stringNo: number, fret: number, finger: string) => `${stringNo}번 줄 ${fret}프렛 ${finger}`,
      openString: (stringNo: number) => `${stringNo}번 줄 개방`,
      mutedString: (stringNo: number) => `${stringNo}번 줄 치지 않음`,
      fingerName: (finger: number | 'T') => (finger === 'T' ? '엄지' : `${finger}번 손가락`),
      baseFret: (fret: number) => `${fret}프렛`,
    },
    song: {
      modes: { learn: '학습 모드(멈추고 다시 해도 돼요)', perform: '연주 모드(멈추지 않기)' },
      stages: {
        learn: '학습 단계(멈추고 다시 해도 돼요)',
        perform: '연주 단계(멈추지 않기)',
        hidden: '숨김 단계(악보 없이 멈추지 않기)',
      },
      optionKeys:
        '↑↓ 템포 · L 구간 반복(학습) · H 악보 숨기기 · M 들어 보기 · B 반주(연주) · E 이어폰/스피커 · P 일시정지 · R 처음부터',
      backingOn: '반주 켜짐 (B)',
      backingOff: '반주 꺼짐 (B)',
      earphones: '이어폰(유선 권장)을 쓰고 있어요 (E)',
      speakers: '스피커로 들어요 (E)',
      bluetooth: '블루투스 출력은 지연이 커요. 유선 이어폰을 권장해요.',
      iosNote: 'iPhone·iPad에서는 마이크를 켜면 반주 소리가 작아지거나 거칠어질 수 있어요.',
      speakerNote: '스피커 반주: 박자는 그대로 재고, 코드 판정은 참고로만 보여 줘요.',
      chordCheck: (ratio: number) => `코드 맞음 ${(ratio * 100).toFixed(0)}%`,
      chordCheckReference: (ratio: number) => `코드 맞음 ${(ratio * 100).toFixed(0)}% (참고)`,
      listen: '들어 보기',
      again: '처음부터 다시 (Space)',
      start: '시작',
      stop: '멈추기',
      restart: '처음부터 (R)',
      pausedAt: (bar: number, bars: number) => `${bar}/${bars}마디에서 멈췄어요. 이 마디부터 다시 쳐요.`,
      section: (name: string) => `${name} 부분`,
      loop: (name: string) => `${name} 부분 반복`,
      hidden: '악보 숨김 — 외워서 쳐 봐요',
      hiddenPreview:
        '시작하면 악보가 가려지고 몇 번째 마디인지만 보여요. 지금 보고 외워 두세요. 악보를 보며 치려면 H.',
      stageNew: {
        perform: '이번부터 연주 단계예요: 틀려도 멈추지 말고 끝까지 가요.',
        hidden: '이번부터 숨김 단계예요: 악보 없이 끝까지 쳐 봐요.',
      },
      bar: (bar: number, bars: number) => `${bar}/${bars}마디`,
      reviewPrompt: '어땠나요? 맞는 것을 고르고 확인(Enter)을 누르세요.',
      completed: '끝까지 쳤어요 (1)',
      memorized: '외워서 쳤어요 (2)',
      stops: (n: number) => `멈춘 횟수 ${n} (↑↓)`,
      confirm: '확인',
      beat1: (rate: number) => `마디 첫 박 적중률 ${(rate * 100).toFixed(0)}%`,
      summary: (completed: boolean, stops: number) => `${completed ? '완주' : '중간까지'} · 멈춤 ${stops}회`,
      memorizedTag: '외워서',
    },
    quiz: {
      progress: (index: number, total: number) => `${index}/${total}`,
      correct: '정답!',
      wrong: (answer: string) => `아쉬워요. 정답: ${answer}`,
      next: '다음 문제',
      lookBack: '← 앞 문제 보기',
      lookingBack: (n: number) => `${n}번 문제를 다시 보고 있어요. 답은 바꿀 수 없어요.`,
      backToCurrent: '지금 문제로 (Enter)',
      score: (correct: number, total: number) => `${total}문제 중 ${correct}개 정답`,
      reaction: (ms: number) => `평균 반응 ${(ms / 1000).toFixed(1)}초`,
      // Keys 1/2/3 pick the first three answers only (v1.1 SPEC §12.3): say so when there are more.
      keysHint: (options: number) =>
        options > 3
          ? '앞의 세 답은 1/2/3 키로도 고를 수 있어요.'
          : `답은 ${Array.from({ length: options }, (_, i) => i + 1).join('/')} 키로도 고를 수 있어요.`,
    },
    q1: {
      // No-break spaces keep "몇 번" and "몇 프렛" on one line each (H9).
      positionPrompt: '테두리를 두른 점은 몇\u00a0번 줄, 몇\u00a0프렛, 몇\u00a0번 손가락인가요?',
      position: (stringNo: number, fret: number, finger: string) =>
        `${stringNo}번 줄 · ${fret}프렛 · ${finger}`,
      symbolPrompt: (stringNo: number) => `${stringNo}번 줄 위의 표시는 무슨 뜻인가요?`,
      symbolX: '치지 않는 줄(x)',
      symbolO: '누르지 않고 치는 개방현(o)',
      symbolPress: '1프렛을 누르고 침',
    },
    q2: {
      prompt: (chord: string) => `${chord} 코드를 잡고 한 번 스트럼하세요`,
      countdown: (s: number) => `${s}초`,
      heard: (chord: string) => `들린 코드: ${chord}`,
      tooSlow: '맞았지만 3초를 넘겼어요.',
      timeout: '시간이 지났어요.',
      selfPrompt: '3초 안에 잡았나요? 1 잡았어요 · 2 못 잡았어요',
      self: { manual1: '잡았어요', manual2: '못 잡았어요' },
      passed: (n: number, total: number) => `3초 안에 정확히 잡은 코드 ${n}/${total}`,
    },
    q3: {
      namePrompt: (stringNo: number) => `${stringNo}번 줄 개방현의 음이름은?`,
      pluckPrompt: (note: string) => `${note} 음이 나는 개방현을 튕기세요`,
      positionNamePrompt: (stringNo: number, fret: number) => `${stringNo}번 줄 ${fret}프렛의 음이름은?`,
      positionPluckPrompt: (stringNo: number, note: string) =>
        `${stringNo}번 줄에서 ${note} 음을 짚어 튕기세요 (다른 줄의 같은 음도 정답)`,
      heard: (note: string) => `들린 음: ${note}`,
    },
    q5: {
      topLine: 'TAB의 맨 위 선이 1번 줄(가장 얇은 줄)이에요. 숫자는 누를 프렛, 0은 개방현이에요.',
      tabToPosPrompt: '이 TAB은 어디를 누르라는 뜻일까요?',
      posToTabPrompt: (stringNo: number, fret: number) =>
        `${stringNo}번 줄 ${fret === 0 ? '개방현' : `${fret}프렛`}을 TAB으로 쓰면?`,
      position: (stringNo: number, fret: number) =>
        `${stringNo}번 줄 ${fret === 0 ? '개방현' : `${fret}프렛`}`,
      tabCell: (stringNo: number, fret: number) => `위에서 ${stringNo}번째 선에 ${fret}`,
    },
    k1: {
      progress: (n: number, total: number) => `${n} / ${total}`,
      done: '1 됐어요',
      notYet: '2 아직',
      keys: '키 1 = 됐어요, 2 = 아직, ← = 이전 카드',
      previous: '이전 카드 (←)',
    },
    e16: {
      intro: '2번 줄 1프렛(도)을 같은 가벼운 힘으로, 세 위치에서 두 번씩 튕겨 소리를 비교해요.',
      instruction: (position: string, pluck: number, total: number) =>
        `${position} — ${pluck}/${total}번째 튕기기`,
      positions: { behind: '프렛 바로 뒤', middle: '칸 가운데', onFret: '프렛 쇠 위' },
      position: '위치',
      result: '판정',
      clarity: '명료도',
      buzzBeta: '버징 의심(참고·베타)',
      retry: '잘 안 들렸어요. 같은 위치에서 한 번 더 튕겨 주세요.',
      status: {
        OK: '깨끗',
        WEAK: '약함',
        MUTED: '막힘',
        WRONG_NOTE: '다른 음',
        clean: '깨끗',
        muted: '막힘',
        buzz: '버징',
      },
      self: { clean: '1 깨끗', muted: '2 막힘', buzz: '3 버징' },
      takeaway: '프렛 바로 뒤를 누를 때 가장 적은 힘으로 깨끗하게 울려요.',
    },
    sequence: {
      bpm: (bpm: number) => `${bpm} BPM`,
      tabTopLine: 'TAB의 맨 위 선이 1번 줄, 왼쪽 숫자가 줄 번호예요.',
      fingerRow: '손',
      countIn: '한 마디 세고 시작해요…',
      readyMic:
        '시작 버튼이나 Space로 메트로놈을 켜고 클릭에 맞춰 쳐요. 한 바퀴가 끝날 때마다 마이크가 음을 확인해요.',
      readySelf:
        '시작 버튼이나 Space로 메트로놈을 켜고 클릭에 맞춰 쳐요. 한 바퀴가 끝날 때마다 1(실수 없음) 또는 2(실수 있음)를 눌러요.',
      cycles: (n: number, flawless: number, streak: number) =>
        `${n}바퀴 · 실수 없음 ${flawless} · 연속 ${streak}`,
      cycleNumber: (n: number) => `${n}바퀴째`,
      flawless: '1 실수 없음',
      mistake: '2 실수 있음',
      showTab: 'TAB 보이기 (H)',
      hideTab: 'TAB 숨기기 (H)',
      finish: '마치기',
      analyzing: '마지막 바퀴를 확인하고 있어요…',
      lastCycle: {
        flawless: '방금 바퀴: 실수 없음',
        uncertain: '방금 바퀴: 소리가 불분명해서 판정하지 않았어요(연속 기록은 이어져요)',
        mistake: '방금 바퀴: 실수 있음',
      },
      extra: (n: number) => `기대하지 않은 음 ${n}개`,
      summary: (n: number, flawless: number) => `${n}바퀴 중 실수 없이 ${flawless}바퀴`,
      micNote: '마이크로 음높이와 박을 확인해요.',
      selfNote: '마이크 없이 스스로 판단해요.',
      ladder: {
        up: (bpm: number) => `연속 실수 없음! 다음엔 ${bpm} BPM으로 올려요.`,
        /** Results stored before D-098 only: runs no longer step down. */
        down: (bpm: number) => `실수가 많았어요. 다음엔 ${bpm} BPM으로 낮춰요.`,
        stay: (bpm: number) => `다음에도 ${bpm} BPM으로 해요.`,
      },
    },
    e10: {
      title: (scale: string, step: number) => `${scale} · ${step}단계`,
      tabLabel: (scale: string, step: number) => `${scale} ${step}단계 TAB`,
      steps: {
        1: '위아래로: 모든 음을 올라갔다가 내려와요.',
        2: '방향 바꾸기: 한 음씩 움직이다 가끔 방향을 바꿔요.',
        3: '무작위 음: TAB에 나오는 다음 음을 미리 보고 쳐요.',
        4: '3도: 한 음 건너 짝지어 올라갔다 내려와요.',
        5: '4음씩: 네 음씩 묶어 한 칸씩 올라갔다 내려와요.',
      } as Record<number, string>,
      graduated: (step: number) => `${step}단계 졸업! 다음 단계가 60 BPM으로 열려요.`,
      memorized: '암기 완료: TAB 없이 4바퀴 연속 실수 없음.',
      withBacking: '반주와 함께 1단계',
      backingNote: '반주와 함께 쳐요. 이어폰이면 시작 전에 E를 누르세요.',
      speakerNote:
        '스피커 반주: 마이크에 들어온 반주 소리는 걸러 내고 판정해요. 기록·졸업에도 그대로 들어가요.',
      gainLost: '반주 소리를 재지 못했어요. 일시정지 뒤 이어 하면 다시 재요.',
      /** Summary of a stored reference run from before D-102 (unmasked speaker backing). */
      speakerReference: '스피커 반주(이전 방식): 이 실행은 참고로만 보여 주고 기록·졸업에는 넣지 않았어요.',
    },
    e3: {
      how: '코드에 도착할 때마다 천천히 스트럼(또는 아르페지오)해서 모든 줄을 확인해요. 깨끗하면 Enter, 먹히거나 버징이면 ↓. 표시하지 않은 도착은 깨끗하지 않은 것으로 세요.',
      normal: '1분 체인지보다 점수가 낮은 게 정상이에요.',
      arrivals: (n: number, clean: number) => `도착 ${n} · 깨끗 ${clean}`,
      clean: '깨끗 (Enter)',
      unclean: '깨끗하지 않음 (↓)',
      unmarked: '이번 도착을 표시해 주세요',
      strumBeta: (verdict: string) => `스트럼 판정(참고·베타): ${verdict}`,
      verdict: { PASS: '깨끗', FAIL: '문제 있음', RETRY: '불확실' } as Record<string, string>,
      review: '시간 끝! 확인(Enter)을 누르세요.',
      score: (perMin: number, rate: number) =>
        `분당 깨끗한 체인지 ${perMin.toFixed(1)}회 · 깨끗 비율 ${Math.round(rate * 100)}%`,
      passed: '통과! (깨끗 비율 80% 이상, 분당 20회 이상)',
      notYet: '아직이에요. 천천히 정확하게 도착하는 데 집중해요.',
    },
    e9: {
      title: (fret: number) => `크로매틱 ${fret}프렛부터`,
      tabLabel: (fret: number) => `크로매틱 ${fret}프렛 TAB`,
      how: '줄마다 1-2-3-4번 손가락으로 한 프렛씩, 다운·업 교대 피킹. 6번 줄에서 1번 줄로 올라간 뒤 4-3-2-1로 돌아와요. 네 음이 한 묶음이에요.',
      // No-break space: a number and its unit never split across lines ("5 / BPM", H9).
      goal: '목표 100\u00a0BPM. 10묶음 연속 실수 없으면 5\u00a0BPM 올려요.',
    },
    e11: {
      title: (pair: string) => `해머온 ${pair}번 손가락`,
      tabLabel: (pair: string) => `해머온 ${pair} TAB`,
      how: (a: string, b: string) =>
        `한 박에 두 음: ${a}번 손가락으로 누르고 피킹, ${b}번 손가락으로 해머온(피킹 없이 손가락으로 때려 소리 내기). 줄마다 4박, 6번 줄에서 1번 줄까지.`,
      daily: '하루 5분이면 충분해요. 같은 날 10분을 넘기면 오늘은 쉬어요.',
      capped: '오늘 해머온 운동은 10분을 채웠어요. 내일 다시 해요.',
      legato: (heard: number, total: number) => `해머온 소리 ${heard}/${total} (참고·베타)`,
      ratePrompt: '해머온 간격이 고르게 들렸나요? 1 아니요 · 2 조금 · 3 고르게',
      rate: { 1: '1 아니요', 2: '2 조금', 3: '3 고르게' } as Record<number, string>,
    },
    e12: {
      how: '6번 줄 7프렛 3번 손가락 + 8프렛 4번 손가락 → 1번 줄까지 → 4·3번 순서로 돌아와요. 그다음 2-4, 1-4 조합을 반복해요.',
      notSpeed: '속도 연습이 아니에요. 한 음씩 깨끗하게.',
      safety: '늘어나는 느낌까지만, 아프면 멈추세요. 3번 손가락이 대신 힘을 쓰면 쉬어 가세요.',
      clarityPrompt: '새끼손가락 음이 또렷했나요? 1 아니요 · 2 조금 · 3 또렷함',
      clarity: { 1: '1 아니요', 2: '2 조금', 3: '3 또렷함' } as Record<number, string>,
      stop: '그만하기',
      backToClarity: '또렷함 다시 고르기 (←)',
    },
    e17: {
      tabLabel: (id: string) => `리프 ${id} TAB`,
      palmMute: '팜뮤트: 오른손 날을 브리지 바로 앞 줄 위에 살짝 대고 쳐요.',
      spelledTitle: '말로 읽은 리프',
      spell: {
        open: (stringNo: number) => `${stringNo}번 줄 개방`,
        fretted: (stringNo: number, fret: number, finger: number) =>
          `${stringNo}번 줄 ${fret}프렛(${finger}번 손가락)`,
        times: (n: number) => ` ×${n}`,
        bar: (n: number, notes: string) => `${n}마디: ${notes}`,
        joiner: ' → ',
      },
      listen: '들어 보기 (M)',
      listening: '들려주는 중이에요. 시작하면 멈춰요.',
      summary: (n: number, flawless: number) => `${n}바퀴 중 실수 없이 ${flawless}바퀴`,
      ladder: {
        up: (bpm: number) => `4바퀴 연속 실수 없음! 다음엔 ${bpm} BPM으로 올려요.`,
        /** Results stored before D-098 only: runs no longer step down. */
        down: (bpm: number) => `실수가 많았어요. 다음엔 ${bpm} BPM으로 낮춰요.`,
        stay: (bpm: number) => `다음에도 ${bpm} BPM으로 해요.`,
      },
    },
    q4: {
      prompt: '들려준 코드는 메이저일까요, 마이너일까요?',
      major: '메이저(밝은 소리)',
      minor: '마이너(어두운 소리)',
      replay: '다시 듣기',
      prompts: {
        majmin: '들려준 코드는 메이저일까요, 마이너일까요?',
        // No-break spaces: "아래 음 → 위 음" reads as one unit and never splits across lines (H9).
        interval: '두 음은 얼마나 떨어져 있을까요? (아래\u00a0음\u00a0→\u00a0위\u00a0음)',
        progression: '첫 코드(I) 다음에 온 코드는 무엇일까요?',
      },
      // App-made memory aids only (no song titles or melodies, §3.2, §11.21).
      intervals: {
        2: '장2도 (한 걸음 위)',
        3: '단3도 (어둡게 조금 위)',
        4: '장3도 (밝게 조금 위)',
        5: '완전4도 (차분한 도약)',
        7: '완전5도 (힘찬 도약)',
        12: '옥타브 (같은 음, 높게)',
      } as Record<number, string>,
      degrees: { IV: 'IV (밝게 떠나는 느낌)', V: 'V (돌아오고 싶은 긴장)', I: 'I (그대로 머묾)' },
    },
    e6: {
      how: '마디마다 코드 하나. 다음 마디 첫 박에 맞춰 바꾸고, 멈추지 말고 계속 쳐요.',
      now: (chord: string) => `지금 ${chord}`,
      next: (chord: string) => `다음 ${chord}`,
      selfPrompt: '어땠나요? 1 모두 제때 · 2 한두 번 늦음 · 3 멈춘 적 있음',
      self: { manual1: '모두 제때', manual2: '한두 번 늦음', manual3: '멈춤 있음' },
      bars: (inWindow: number, bars: number) => `제때 바꾼 마디 ${inWindow}/${bars}`,
      stops: (n: number) => `멈춤 ${n}회`,
      delay: (ms: number) => `첫 박 평균 ${ms >= 0 ? '+' : ''}${ms.toFixed(0)} ms`,
      passed: (bpm: number) => `통과! 다음엔 ${bpm} BPM`,
      notYet: '14/16마디 이상 제때 + 멈춤 0이면 다음 빠르기로 가요.',
    },
    e8: {
      how: (stringNo: number) => `${stringNo}번 줄 하나만, 다운·업을 번갈아 8분음표로 고르게 쳐요.`,
      selfPrompt: '어땠나요? 1 고르게 다 침 · 2 가끔 놓침 · 3 자주 놓침',
      self: { manual1: '고르게 다 침', manual2: '가끔 놓침', manual3: '자주 놓침' },
      hitRate: (rate: number) => `적중률 ${(rate * 100).toFixed(0)}%`,
      evenness: (cv: number) => `고르기(간격 변동) ${(cv * 100).toFixed(0)}%`,
      passed: (bpm: number) => `통과! 다음엔 ${bpm} BPM`,
      notYet: '적중률 90% 이상 + 간격 변동 10% 이하면 +5 BPM.',
    },
    e0: {
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note})을 튕기고 맞춰요`,
      manual: (stringNo: number, note: string) =>
        `${stringNo}번 줄 (${note})을 다른 튜너로 맞춘 뒤 다음(Enter)`,
      skip: '이 줄 건너뛰기',
      next: '맞췄어요',
      previous: '이전 줄 (←)',
      inTune: '맞음',
      done: (n: number) => `${n}/6줄 맞음`,
      complete: '6줄 모두 맞췄어요!',
    },
    e4: {
      anchorTitle: '앵커 체인지',
      airTitle: '공중 체인지',
      anchor: (finger: string, stringNo: number, fret: number) =>
        `${finger}(${stringNo}번 줄 ${fret}프렛)은 떼지 마세요.`,
      slide: (finger: string, stringNo: number, from: number, to: number) =>
        `${finger}은 ${stringNo}번 줄에서 ${from}프렛 → ${to}프렛으로 미끄러뜨려요.`,
      anchorHow: '나머지 손가락만 천천히 옮겨요. 스트럼은 하지 않아요.',
      airHow: '줄 위 공중에서 손 모양을 먼저 만들고, 모든 손가락을 동시에 내려놓아요.',
      start: '시작',
      stop: '그만하기',
      review: '동시에 깔끔하게 착지한 횟수는 10번 중 몇 번이었나요? (↑↓, 확인 Enter)',
      confirm: '확인',
      success: (n: number) => `${n}/10`,
      noScore: '점수는 없어요. 천천히, 정확하게.',
    },
    e7: {
      startFret: (fret: number) => `${fret}프렛에서 시작해요`,
      how: '1번 손가락부터 4번 손가락까지 한 프렛씩 벌려 짚어요. 손가락을 떼지 않고 차례로 더하고, 각각 1초씩 유지해요. 손바닥은 지판과 평행하게 두고 한 줄씩 옮겨 가요.',
      start: '시작',
      stop: '그만하기',
      painPrompt: '지금 손가락·손목 통증은 0–10 중 얼마인가요? (↑↓, 확인 Enter)',
      pain: (n: number) => `통증 ${n}/10`,
      confirm: '확인',
    },
    e5: {
      modes: { mute: '뮤트 스트럼', single: '코드 하나', progression: '코드 진행' },
      countIn: '카운트인 — 다음 마디부터 쳐요',
      bar: (bar: number, bars: number) => `${bar}/${bars}마디`,
      keepGoing: '놓쳐도 멈추지 말고 계속 쳐요. 손은 쉼표에서도 계속 움직여요.',
      cuesHidden: '시각 큐 숨김',
      countAloud: '"하나, 둘, 셋, 넷" 박을 소리 내어 세어 보세요.',
      footTap: '발로도 박을 세어 보세요.',
      optionKeys: 'V 시각 큐 숨기기·보이기',
      dynamicsHow: '1–4마디는 여리게, 5–8마디는 세게 쳐요.',
      soft: '여리게 (p)',
      loud: '세게 (f)',
      dynamicsPrompt: '여리게·세게가 잘 구분됐나요? 1 잘 구분됨 · 2 조금 · 3 거의 안 됨',
      dynamicsSelf: { manual1: '잘 구분됨', manual2: '조금', manual3: '거의 안 됨' },
      beta: {
        direction: (down: number, up: number, unknown: number) =>
          `스트럼 방향(참고·베타): 다운 ${down} · 업 ${up} · 모름 ${unknown}`,
        palmMute: (share: number) => `팜뮤트로 들린 스트럼(참고·베타): ${Math.round(share * 100)}%`,
        dynamics: (bars: string) => `마디별 셈여림(참고·베타): ${bars}`,
        bar: { soft: 'p', loud: 'f', even: '–' } as Record<string, string>,
      },
      analyzing: '채점하는 중…',
      analysisFailed: '채점하지 못했어요. 이번 연주는 기록하지 않았어요.',
      armed: '첫 스트럼이나 Space로 시작해요(카운트인 1마디).',
      ready: '시작 버튼이나 Space로 시작해요(카운트인 1마디).',
      start: '시작',
      selfPrompt: '어땠나요? 1 놓친 박 없음 · 2 가끔 놓침 · 3 자주 놓침',
      self: { manual1: '놓친 박 없음', manual2: '가끔 놓침', manual3: '자주 놓침' },
      hitRate: (rate: number) => `적중률 ${(rate * 100).toFixed(0)}%`,
      corrected: (rate: number) => `내 버릇(일정한 앞/뒤 쏠림) 보정 시 ${(rate * 100).toFixed(0)}%`,
      mean: (ms: number) => `평균 ${ms >= 0 ? '+' : ''}${ms.toFixed(0)} ms (${ms >= 0 ? '늦게' : '일찍'})`,
      sd: (ms: number) => `흔들림(표준편차) ${ms.toFixed(0)} ms`,
      counts: (hits: number, misses: number, extras: number) =>
        `맞음 ${hits} · 놓침 ${misses} · 추가 ${extras}`,
      ladder: {
        up: (bpm: number) => `잘했어요! 다음엔 ${bpm} BPM으로 올려 보세요.`,
        /** Results stored before D-098 only: runs no longer step down. */
        down: (bpm: number) => `${bpm} BPM으로 내려서 다져 봐요.`,
        stay: (bpm: number) => `${bpm} BPM으로 한 번 더 해 봐요.`,
      },
      direction: { D: '↓', U: '↑', X: '✕', d: '↓', '-': '·' },
      directionLabel: { D: '다운', U: '업', X: '끊기', d: '약한 다운', '-': '쉼' },
      directionNote: '방향(다운/업)은 아직 판정하지 않아요.',
    },
    e2: {
      modes: { auto: '자동 카운트', tap: '탭 카운트', manual: '직접 입력' },
      armed: (from: string) => `${from} 코드를 잡고 기다리세요. 첫 스트럼으로 시작해요(Space로도 시작).`,
      ready: '준비되면 시작(Space).',
      start: '시작',
      count: '체인지',
      lowConfidence: (n: number) => `애매한 스트럼 ${n}`,
      next: (chord: string) => `다음: ${chord}`,
      tap: '+1 바꿨어요',
      plus: '+1 보정',
      minus: '−1 보정',
      review: '시간 끝! 개수가 맞는지 확인하고 ↑↓로 고친 뒤 확인(Enter)을 누르세요.',
      manualReview: '바꾼 횟수를 ↑↓(또는 버튼)로 입력하고 확인(Enter)을 누르세요.',
      confirm: '확인',
      soundNote: '소리 품질은 채점하지 않아요. 손이 얼마나 빨리 옮겨 가는지만 세요.',
      perMinute: (cpm: number) => `분당 ${cpm.toFixed(1)}회`,
      perMinuteMeaning: '1분 동안 코드를 바꾼 횟수예요.',
      detail: (detected: number, corrected: number | null) =>
        corrected === null ? `센 횟수 ${detected}회` : `센 횟수 ${detected}회 → 고친 횟수 ${corrected}회`,
    },
  },
  onboarding: {
    title: '처음 설정',
    intro: '정확한 판정을 위해 마이크·환경·튜닝·지연을 한 번 맞춰요. 5분쯤 걸려요.',
    stepNames: {
      permission: '마이크',
      noise: '환경',
      tuning: '튜닝',
      templates: '줄 소리',
      rtt: '지연',
      summary: '요약',
    },
    stepOf: (index: number, total: number, name: string) => `${index}/${total} ${name}`,
    back: '이전 단계',
    permission: {
      explain: '기기를 기타에서 30–60cm 떨어진 곳에 두세요. 기기 내장 마이크를 권장해요.',
      allow: '마이크 허용',
      granted: '마이크가 켜졌어요.',
      device: (label: string) => `입력 장치: ${label || '알 수 없음'}`,
    },
    noise: {
      explain: '2초 동안 조용히 있어 주세요. 주변 소음을 잽니다.',
      measure: '소음 측정',
      measuring: '측정 중…',
      result: (db: number) => `주변 소음 ${db.toFixed(1)} dBFS`,
      noisy: '주변이 시끄러워요. 판정이 덜 정확할 수 있지만 계속할 수 있어요.',
      quiet: '조용해요. 좋아요!',
      again: '다시 측정',
    },
    tuning: {
      explain: '6번 줄부터 차례로 개방현을 튕겨 주세요. ±15 cents 안이면 통과해요.',
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note}) 개방현을 튕기세요`,
      passed: (stringNo: number, cents: number) =>
        `${stringNo}번 줄 통과 (${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents)`,
      tooLow: '낮아요 — 줄을 조금 조이세요.',
      tooHigh: '높아요 — 줄을 조금 푸세요.',
      otherNote: '다른 음이 들려요. 맞는 줄인지 확인하세요.',
      done: '6줄 모두 맞췄어요!',
    },
    templates: {
      explain: '각 줄의 개방현을 3번씩 튕겨 주세요. 줄마다 소리 특성을 기억해 뮤트 판정에 써요.',
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note}) 개방현을 3번 튕기세요`,
      count: (k: number, total: number) => `${k}/${total}`,
      retry: '잘 안 들렸어요. 한 번 더 또렷하게 튕겨 주세요.',
      done: '줄 소리를 모두 기록했어요!',
    },
    rtt: {
      explain: '스피커에서 나는 짧은 소리 8개를 마이크로 들어 지연을 재요. 볼륨을 키우고 조용히 있어 주세요.',
      measure: '지연 측정',
      measuring: (attempt: number) => `측정 중… (${attempt}회째)`,
      result: (ms: number) => `지연 ${ms.toFixed(1)} ms`,
      agreeing: (a: number, b: number) => `두 번 측정: ${a.toFixed(1)} ms, ${b.toFixed(1)} ms`,
      failed: '스피커 소리를 충분히 듣지 못했어요. 클릭에 맞춰 치는 방식으로 잴게요.',
      bluetooth: '블루투스 출력은 스피커 측정이 어려워요. 클릭에 맞춰 치는 방식으로 잴게요.',
      tapExplain: '클릭 4번을 들은 뒤, 이어지는 클릭 8번에 맞춰 아무 줄이나 쳐 주세요.',
      tapStart: '탭 보정 시작',
      tapRunning: '클릭에 맞춰 쳐 주세요…',
      tapFailed: '클릭에 맞춘 소리를 충분히 찾지 못했어요. 다시 해 볼까요?',
      tryLoopback: '스피커 측정 다시 하기',
      again: '다시 측정',
    },
    summary: {
      noise: '주변 소음',
      tuning: '튜닝 (δ)',
      rtt: '지연',
      methods: { loopback: '스피커 루프백', tap: '탭 보정' },
      warnings: '주의',
      none: '없음',
      save: '저장하고 시작하기',
    },
    warnings: {
      NOISY: '주변 소음이 커요.',
      PROCESSING_ON: '브라우저 오디오 처리가 켜져 있어요.',
      BLUETOOTH_INPUT: '블루투스 마이크를 쓰고 있어요.',
      BLUETOOTH_OUTPUT: '블루투스 출력 장치를 쓰고 있어요.',
      SAMPLE_RATE_SUSPECT:
        '음높이가 전체적으로 1% 넘게 어긋나 있어요. 오디오 설정(샘플레이트)을 확인해 주세요.',
      RTT_TAP: '지연을 탭 보정으로 쟀어요(사람 반응 시간이 섞여 있어요).',
    },
  },
  coaching: {
    render(hint: CoachingHint): string {
      switch (hint.code) {
        case 'mutedOpenAdjacentFinger':
          return `${fingerSubject(hint.finger)} ${hint.stringNo}번 줄에 닿고 있을 수 있어요. 손끝을 세워 보세요.`;
        case 'mutedOpenGeneric':
          return `${hint.stringNo}번 줄은 누르지 않는 줄이에요. 손바닥이나 손가락이 닿지 않게 해 보세요.`;
        case 'mutedFretted':
          return `${fingerObject(hint.finger)} 프렛 바로 뒤에 붙이고 손끝으로 눌러 보세요.`;
        case 'wrongFret': {
          const n = Math.abs(hint.semitones);
          const amount = n === 1 ? '한 칸' : `${n}칸`;
          return hint.semitones > 0
            ? `${hint.stringNo}번 줄에서 ${amount} 높은 프렛을 누르고 있어요.`
            : `${hint.stringNo}번 줄에서 ${amount} 낮은 프렛을 누르고 있어요.`;
        }
        case 'openStringPressed':
          return `${hint.stringNo}번 줄은 누르지 않아요(개방현).`;
        case 'openStringFlat':
          return `${hint.stringNo}번 줄 소리가 낮아요. 튜닝을 다시 확인해 보세요.`;
        case 'unexpectedXString':
          return `${hint.stringNo}번 줄은 치지 않아요(x). ${hint.lowestStringNo}번 줄부터 스트럼하세요.`;
        case 'weak':
          return '조금 더 세게, 또는 기기를 기타 가까이(30–60cm) 두세요.';
        case 'generalTip':
          return GENERAL_TIPS[hint.tipIndex % GENERAL_TIPS.length] ?? '';
        case 'mutedBarre':
          return `${hint.stringNo}번 줄이 막혔어요. 1번 손가락을 프렛 바로 뒤에 두고, 손가락을 엄지 쪽으로 살짝 굴려 뼈 쪽으로 누르세요.`;
        case 'sequenceWrongNote': {
          const n = Math.abs(hint.semitones);
          const dir = hint.semitones > 0 ? '높아요' : '낮아요';
          return `${hint.position}번째 음이 반음 ${n}개 ${dir} — ${hint.stringNo}번 줄 ${hint.fret}프렛인지 TAB을 다시 보세요.`;
        }
        case 'sequenceStopped':
          return '멈췄어요. 틀려도 손은 계속 박에 맞춰 움직여요.';
        case 'buzzSuspect':
          return '버징 소리가 섞였을 수 있어요(참고). 프렛 가까이 누르기를 확인해 보세요.';
      }
    },
  },
  verdict: {
    pass: '깨끗해요!',
    /** FAIL always says what went wrong and how to fix it (SPEC §12.4). */
    fail(what: string, how: string): string {
      return `${what} — ${how}`;
    },
    stringMuted: (stringNo: number) => `${stringNo}번 줄이 막혔어요`,
    stringWrong: (stringNo: number) => `${stringNo}번 줄 음이 달라요`,
    stringUnexpected: (stringNo: number) => `${stringNo}번 줄이 울렸어요`,
    retry(reason: RetryReasonCode): string {
      switch (reason) {
        case 'LOW_LEVEL':
          return '잘 안 들렸어요. 조금 더 크게 한 번 더 쳐 주세요.';
        case 'CLIPPING':
          return '소리가 너무 커서 찌그러졌어요. 기기를 조금 떨어뜨려 주세요.';
        case 'NOISY':
          return '주변 소리가 커요. 조용한 곳에서 다시 해 볼까요?';
        case 'AMBIGUOUS':
          return '확실히 판단하기 어려워요. 한 번 더 쳐 주세요.';
        case 'NO_ONSET':
          return '튕기는 소리를 못 찾았어요. 한 번만 또렷하게 쳐 주세요.';
        case 'MULTIPLE_ONSETS':
          return '여러 번 친 것 같아요. 한 번만 쳐 주세요.';
        case 'DETUNED':
          return '튜닝이 많이 벗어났어요. 튜너로 먼저 맞춰 주세요.';
        case 'NOT_STRING':
          return '줄 소리가 아닌 것 같아요(몸통 소리 등). 그 줄을 한 번 더 쳐 주세요.';
      }
    },
    unverifiable: '확인 불가',
    unverifiableStrum: '스트럼으로는 확인 불가 — 한 줄씩 튕겨서 확인',
    micAssistNotice: '마이크 판정은 보조 수단이에요. 내 귀가 먼저예요.',
  },
  safety: {
    notMedicalAdvice: NOT_MEDICAL_ADVICE,
    restDay: `오늘은 쉬어 가요. 날카로운 통증, 저림, 관절이나 손목 통증이 있으면 연습을 멈추고 쉬세요. 계속되면 전문가와 상담하세요. ${NOT_MEDICAL_ADVICE}`,
    painReduced: `지난번 통증이 컸어요. 오늘은 손끝에 부담이 큰 연습 시간을 절반으로 줄였어요. ${NOT_MEDICAL_ADVICE}`,
    breakReminder: '30분 동안 연습했어요. 잠깐 손을 쉬고 스트레칭해요.',
    stretchNotice: `스트레칭이지 통증 운동이 아니에요. 늘어나는 느낌까지만 하세요. ${NOT_MEDICAL_ADVICE}`,
    capConfirm: (minutes: number) =>
      `처음 4주는 하루 ${minutes}분 이내를 권장해요. 그래도 더 길게 연습할까요?`,
  },
} as const;
