(() => {
  "use strict";

  const DATA = window.QURAN_APP_DATA;
  const ALPHABET = window.QURAN_ALPHABET_DATA;
  const PRONUNCIATION = window.QURAN_PRONUNCIATION_DATA;
  if (!DATA || !ALPHABET || !PRONUNCIATION) {
    document.body.innerHTML = "<main style='max-width:720px;margin:64px auto;padding:32px;font-family:system-ui;line-height:1.7'><h1>社区源码已就绪</h1><p>公开仓库不附带生产课程、教材和音频内容。请按照 <code>web/data/README.md</code> 接入你拥有或已获授权的内容包。</p></main>";
    return;
  }

  const IS_NATIVE_ANDROID = Boolean(window.AndroidBridge?.isNativeApp?.());
  if (IS_NATIVE_ANDROID) {
    document.documentElement.style.setProperty("--safe-top", `${Math.max(0, Number(window.AndroidBridge.getSafeTop?.()) || 0)}px`);
    document.documentElement.style.setProperty("--safe-bottom", "0px");
  }

  const STORAGE_KEY = "quran-learning-app-v1-state";
  const DB_NAME = "quran-learning-app-v1-audio";
  const STATE_VERSION = 5;
  const MIN_RECORDING_DURATION_MS = 1000;
  const DIMENSIONS = ["发音准确", "音长节奏", "有无加音", "整体自然"];
  const REVIEW_INTERVALS = DATA.meta.reviewIntervals;
  const $ = (id) => document.getElementById(id);
  const mainView = $("mainView");
  const appShell = document.querySelector(".app-shell");
  const sessionLayer = $("sessionLayer");
  const sessionContent = $("sessionContent");
  const sessionTitle = $("sessionTitle");
  const sessionCount = $("sessionCount");
  const sessionProgress = $("sessionProgress");
  const sessionFavorite = $("sessionFavorite");
  const modelAudio = $("modelAudio");
  const recordingAudio = $("recordingAudio");
  const toastNode = $("toast");
  const allWords = DATA.lessons.flatMap((lesson) => lesson.words);
  const allVerses = DATA.lessons.flatMap((lesson) => lesson.verses);
  const wordById = new Map(allWords.map((word) => [word.id, word]));
  const verseById = new Map(allVerses.map((verse) => [verse.id, verse]));
  const lessonById = new Map(DATA.lessons.map((lesson) => [lesson.index, lesson]));
  const pronunciationTaskById = new Map(DATA.pronunciationDays.flatMap((day) => day.tasks).map((task) => [task.id, task]));
  const alphabetLetterById = new Map(ALPHABET.letters.map((letter) => [letter.id, letter]));
  const alphabetGroupById = new Map(ALPHABET.groups.map((group) => [group.id, group]));
  const wordPronunciationById = new Map(PRONUNCIATION.pronunciations.map((item) => [item.id, item]));
  const wordPronunciationFormsByEntryId = new Map(Object.entries(PRONUNCIATION.entryForms || {}));
  const DAY_COUNT = Math.max(1, Number(DATA.meta?.dayCount) || DATA.schedule.length || 1);
  const WORD_COUNT = allWords.length;
  const UNIT_COUNT = DATA.lessons.length;
  const ALPHABET_COUNT = ALPHABET.letters.length;
  const REVIEW_DAY_LIMIT = DAY_COUNT + Math.max(30, ...(DATA.meta?.reviewIntervals || [30]));
  const HAS_PRONUNCIATION = DATA.pronunciationDays.length > 0;
  const HAS_ALPHABET_AUDIO = ALPHABET.letters.some((letter) => Object.values(letter.audio || {}).some(Boolean));

  const pronunciationNav = document.querySelector('[data-view="pronunciation"]');
  if (pronunciationNav) pronunciationNav.hidden = !HAS_PRONUNCIATION;
  const mainNavigation = document.querySelector(".main-nav");
  if (mainNavigation && !HAS_PRONUNCIATION) mainNavigation.style.gridTemplateColumns = "repeat(4, 1fr)";

  const icon = (name) => {
    const paths = {
      arrow: '<path d="m9 5 7 7-7 7"/>',
      back: '<path d="m15 5-7 7 7 7"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      play: '<path d="m8 5 11 7-11 7V5Z"/>',
      pause: '<path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z"/>',
      volume: '<path d="M5 10v4h3l4 4V6L8 10H5Zm10-1c1.4 1.7 1.4 4.3 0 6m2.7-8.5c3 3 3 8 0 11"/>',
      mic: '<path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm7-4a7 7 0 0 1-14 0M12 18v4m-4 0h8"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
      book: '<path d="M4 5.5c3.3-.5 6 .4 8 2.7 2-2.3 4.7-3.2 8-2.7v13c-3.2-.4-5.9.5-8 2.5-2.1-2-4.8-2.9-8-2.5v-13ZM12 8.2V21"/>',
      refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.5 8a7 7 0 0 1 11.4-1.2L20 12M4 12l2.1 5.2A7 7 0 0 0 17.5 16"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-7 8.5 7 4 7-4M5 15l7 4 7-4"/>',
      user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"/>',
      download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/>',
      upload: '<path d="M12 17V5m0 0 4 4m-4-4L8 9M5 20h14"/>',
      star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
      file: '<path d="M7 3h7l4 4v14H7V3Zm7 0v5h5"/>',
      calendar: '<path d="M5 5h14v15H5V5Zm3-2v4m8-4v4M5 10h14"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.check}</svg>`;
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const defaultState = () => ({
    version: STATE_VERSION,
    currentDay: 1,
    view: "today",
    courseStage: 0,
    courseUnit: null,
    courseMode: "lessons",
    alphabetTab: "overview",
    alphabetGroup: null,
    alphabetProgress: {},
    alphabetSpecialComplete: false,
    libraryFilter: "all",
    libraryQuery: "",
    libraryUnit: null,
    favorites: [],
    wordProgress: {},
    verseProgress: {},
    pronunciationProgress: {},
    dayProgress: {},
    activeDates: [],
    settings: {
      sessionMinutes: 35,
      reviewLimit: 12,
      pronunciation: HAS_PRONUNCIATION,
      audioRate: 0.85,
      wordAudioRepeats: 3,
    },
  });

  const VALID_VIEWS = ["today", "course", "library", "pronunciation", "profile"];
  const VALID_COURSE_MODES = ["lessons", "alphabet"];
  const VALID_ALPHABET_TABS = ["overview", "articulation", "joining"];
  const VALID_LIBRARY_FILTERS = ["all", "learned", "due", "favorite"];
  const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const boundedInteger = (value, minimum, maximum, fallback = 0) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
  };
  const safeText = (value, maximum = 300) => typeof value === "string" ? value.slice(0, maximum) : "";
  const validTimestamp = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "";

  function normalizeWordProgress(value) {
    return Object.fromEntries(Object.entries(isPlainObject(value) ? value : {}).flatMap(([id, item]) => {
      if (!wordById.has(id) || !isPlainObject(item)) return [];
      const history = (Array.isArray(item.history) ? item.history : []).flatMap((entry) => {
        if (!isPlainObject(entry)) return [];
        const rating = boundedInteger(entry.rating, 0, 2, -1);
        if (rating < 0) return [];
        return [{ day: boundedInteger(entry.day, 1, REVIEW_DAY_LIMIT, 1), rating, at: validTimestamp(entry.at) || new Date(0).toISOString() }];
      }).slice(-20);
      const dictationHistory = (Array.isArray(item.dictationHistory) ? item.dictationHistory : []).flatMap((entry) => {
        if (!isPlainObject(entry) || typeof entry.correct !== "boolean") return [];
        return [{
          day: boundedInteger(entry.day, 1, REVIEW_DAY_LIMIT, 1),
          correct: entry.correct,
          at: validTimestamp(entry.at) || new Date(0).toISOString(),
        }];
      }).slice(-50);
      const dictationAttempts = boundedInteger(item.dictationAttempts, 0, 999999, dictationHistory.length);
      const dictationCorrect = Math.min(dictationAttempts, boundedInteger(item.dictationCorrect, 0, 999999, dictationHistory.filter((entry) => entry.correct).length));
      return [[id, {
        seen: item.seen === true,
        lastDay: boundedInteger(item.lastDay, 1, REVIEW_DAY_LIMIT, 1),
        dueDay: boundedInteger(item.dueDay, 1, REVIEW_DAY_LIMIT, 1),
        lastRating: boundedInteger(item.lastRating, 0, 2, 0),
        successStreak: boundedInteger(item.successStreak, 0, 999, 0),
        history,
        dictationAttempts,
        dictationCorrect,
        lastDictationCorrect: typeof item.lastDictationCorrect === "boolean" ? item.lastDictationCorrect : null,
        dictationHistory,
      }]];
    }));
  }

  function normalizeVerseProgress(value) {
    return Object.fromEntries(Object.entries(isPlainObject(value) ? value : {}).flatMap(([id, item]) => {
      if (!verseById.has(id) || !isPlainObject(item)) return [];
      return [[id, {
        attempts: boundedInteger(item.attempts, 0, 999999, 0),
        correct: typeof item.correct === "boolean" ? item.correct : null,
        lastDay: boundedInteger(item.lastDay, 1, REVIEW_DAY_LIMIT, 1),
      }]];
    }));
  }

  function normalizePronunciationProgress(value) {
    return Object.fromEntries(Object.entries(isPlainObject(value) ? value : {}).flatMap(([id, item]) => {
      if (!pronunciationTaskById.has(id) || !isPlainObject(item)) return [];
      const scores = Object.fromEntries(DIMENSIONS.flatMap((dimension) => {
        const score = boundedInteger(item.scores?.[dimension], 0, 2, -1);
        return score < 0 ? [] : [[dimension, score]];
      }));
      const history = (Array.isArray(item.history) ? item.history : []).flatMap((entry) => {
        if (!isPlainObject(entry)) return [];
        const comparisonResult = boundedInteger(entry.comparisonResult, 0, 2, -1);
        const average = Number(entry.average);
        return [{
          at: validTimestamp(entry.at) || new Date(0).toISOString(),
          average: Number.isFinite(average) ? Math.max(0, Math.min(2, average)) : 0,
          comparisonResult: comparisonResult < 0 ? null : comparisonResult,
          selectedIssue: safeText(entry.selectedIssue),
        }];
      }).slice(-20);
      const comparisonResult = boundedInteger(item.comparisonResult, 0, 2, -1);
      const average = Number(item.average);
      return [[id, {
        completed: item.completed === true,
        day: boundedInteger(item.day, 1, REVIEW_DAY_LIMIT, 1),
        scores,
        average: Number.isFinite(average) ? Math.max(0, Math.min(2, average)) : 0,
        attempts: boundedInteger(item.attempts, 0, 999999, 0),
        selectedIssue: safeText(item.selectedIssue),
        comparisonResult: comparisonResult < 0 ? null : comparisonResult,
        comparisonResultLabel: safeText(item.comparisonResultLabel, 30),
        history,
        updatedAt: validTimestamp(item.updatedAt),
      }]];
    }));
  }

  function normalizeAlphabetProgress(value) {
    return Object.fromEntries(Object.entries(isPlainObject(value) ? value : {}).flatMap(([id, item]) => {
      if (!alphabetLetterById.has(id) || !isPlainObject(item)) return [];
      return [[id, {
        seen: item.seen === true,
        mastered: item.mastered === true,
        attempts: boundedInteger(item.attempts, 0, 999999, 0),
        correct: boundedInteger(item.correct, 0, 999999, 0),
        listenedKinds: Array.isArray(item.listenedKinds)
          ? [...new Set(item.listenedKinds)].filter((kind) => ["name", "fatha", "kasra", "damma", "example"].includes(kind))
          : [],
        soundAttempts: boundedInteger(item.soundAttempts, 0, 999999, 0),
        soundCorrect: boundedInteger(item.soundCorrect, 0, 999999, 0),
        shapeAttempts: boundedInteger(item.shapeAttempts, 0, 999999, boundedInteger(item.attempts, 0, 999999, 0)),
        shapeCorrect: boundedInteger(item.shapeCorrect, 0, 999999, boundedInteger(item.correct, 0, 999999, 0)),
        updatedAt: validTimestamp(item.updatedAt),
      }]];
    }));
  }

  function normalizeDayProgress(value, verseProgress, savedVersion) {
    return Object.fromEntries(Object.entries(isPlainObject(value) ? value : {}).flatMap(([day, item]) => {
      const dayNumber = Number(day);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > DAY_COUNT || !isPlainObject(item)) return [];
      const record = {
        review: item.review === true,
        learn: item.learn === true,
        verse: item.verse === true,
        pronunciation: item.pronunciation === true,
      };
      if (savedVersion < STATE_VERSION && record.verse) {
        const requiredVerseIds = DATA.schedule[dayNumber - 1]?.verseIds || [];
        record.verse = requiredVerseIds.length > 0 && requiredVerseIds.every((id) => verseProgress[id]?.attempts > 0);
      }
      return [[String(dayNumber), record]];
    }));
  }

  function normalizeState(value) {
    const base = defaultState();
    const saved = isPlainObject(value) ? value : {};
    const settings = isPlainObject(saved.settings) ? saved.settings : {};
    const unitValue = Number(saved.libraryUnit);
    const courseUnitValue = Number(saved.courseUnit);
    const stageValue = Number(saved.courseStage);
    const sessionMinutes = Number(settings.sessionMinutes);
    const reviewLimit = Number(settings.reviewLimit);
    const audioRate = Number(settings.audioRate);
    const wordAudioRepeats = Number(settings.wordAudioRepeats);
    const savedVersion = boundedInteger(saved.version, 0, STATE_VERSION, 0);
    const wordProgress = normalizeWordProgress(saved.wordProgress);
    const verseProgress = normalizeVerseProgress(saved.verseProgress);
    const pronunciationProgress = normalizePronunciationProgress(saved.pronunciationProgress);
    return {
      ...base,
      version: STATE_VERSION,
      currentDay: Math.max(1, Math.min(DAY_COUNT, Number(saved.currentDay) || 1)),
      view: VALID_VIEWS.includes(saved.view) ? saved.view : base.view,
      courseStage: [0, 1, 2, 3].includes(stageValue) ? stageValue : base.courseStage,
      courseUnit: lessonById.has(courseUnitValue) ? courseUnitValue : null,
      courseMode: VALID_COURSE_MODES.includes(saved.courseMode) ? saved.courseMode : base.courseMode,
      alphabetTab: VALID_ALPHABET_TABS.includes(saved.alphabetTab) ? saved.alphabetTab : base.alphabetTab,
      alphabetGroup: alphabetGroupById.has(Number(saved.alphabetGroup)) ? Number(saved.alphabetGroup) : null,
      alphabetProgress: normalizeAlphabetProgress(saved.alphabetProgress),
      alphabetSpecialComplete: saved.alphabetSpecialComplete === true,
      libraryFilter: VALID_LIBRARY_FILTERS.includes(saved.libraryFilter) ? saved.libraryFilter : base.libraryFilter,
      libraryQuery: typeof saved.libraryQuery === "string" ? saved.libraryQuery.slice(0, 300) : "",
      libraryUnit: lessonById.has(unitValue) ? unitValue : null,
      favorites: Array.isArray(saved.favorites) ? [...new Set(saved.favorites)].filter((id) => wordById.has(id)) : [],
      wordProgress,
      verseProgress,
      pronunciationProgress,
      dayProgress: normalizeDayProgress(saved.dayProgress, verseProgress, savedVersion),
      activeDates: Array.isArray(saved.activeDates)
        ? [...new Set(saved.activeDates.filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))].slice(-180)
        : [],
      settings: {
        sessionMinutes: [25, 35, 45].includes(sessionMinutes) ? sessionMinutes : base.settings.sessionMinutes,
        reviewLimit: [8, 12, 20].includes(reviewLimit) ? reviewLimit : base.settings.reviewLimit,
        pronunciation: HAS_PRONUNCIATION && (typeof settings.pronunciation === "boolean" ? settings.pronunciation : base.settings.pronunciation),
        audioRate: [0.75, 0.85, 1].includes(audioRate) ? audioRate : base.settings.audioRate,
        wordAudioRepeats: boundedInteger(wordAudioRepeats, 1, 10, base.settings.wordAudioRepeats),
      },
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const normalized = normalizeState(saved);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      return defaultState();
    }
  }

  let state = loadState();
  let currentSession = null;
  let deferredInstallPrompt = null;
  let toastTimer = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordingChunks = [];
  let recordingStartedAt = 0;
  let recordingTimer = null;
  let currentRecordingUrl = "";
  let confirmCallback = null;
  let wordAudioPlayToken = 0;
  let wordAudioPrimeToken = 0;
  let wordAudioPlaying = false;
  let wordAudioProgress = null;
  const warmedWordAudio = new Set();
  let pronunciationModelPlayToken = 0;
  let pronunciationRecordingPlayToken = 0;
  let pronunciationPlayback = { kind: "", audio: null };
  let alphabetAudioPlayToken = 0;
  let sessionReturnView = "today";
  let sessionOpener = null;

  function saveState(trackLearning = false) {
    state = normalizeState(state);
    if (trackLearning) {
      const date = new Date();
      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!state.activeDates.includes(today)) state.activeDates.push(today);
      state.activeDates = state.activeDates.slice(-180);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2600);
  }

  function dayRecord(day = state.currentDay) {
    const key = String(day);
    state.dayProgress[key] ||= { review: false, learn: false, verse: false, pronunciation: false };
    return state.dayProgress[key];
  }

  function daySchedule(day = state.currentDay) {
    return DATA.schedule[Math.max(0, Math.min(DAY_COUNT - 1, day - 1))] || DATA.schedule[0];
  }

  function requiredSteps() {
    return state.settings.pronunciation && HAS_PRONUNCIATION ? ["review", "learn", "verse", "pronunciation"] : ["review", "learn", "verse"];
  }

  function dayCompletion(day = state.currentDay) {
    const record = dayRecord(day);
    const steps = requiredSteps();
    return Math.round((steps.filter((key) => record[key]).length / steps.length) * 100);
  }

  function learnedWords() {
    return Object.values(state.wordProgress).filter((item) => item.seen).length;
  }

  function masteredWords() {
    return Object.values(state.wordProgress).filter((item) => item.successStreak >= 2).length;
  }

  function masteredAlphabetLetters() {
    return Object.values(state.alphabetProgress).filter((item) => item.mastered).length;
  }

  function alphabetGroupProgress(group) {
    const mastered = group.letterIds.filter((id) => state.alphabetProgress[id]?.mastered).length;
    return { mastered, total: group.letterIds.length };
  }

  const ALPHABET_AUDIO_KINDS = [
    { key: "name", label: "字母名" },
    { key: "fatha", label: "开口音", vowelIndex: 0 },
    { key: "kasra", label: "齐齿音", vowelIndex: 1 },
    { key: "damma", label: "合口音", vowelIndex: 2 },
  ];

  function alphabetAudioText(letter, kind) {
    if (kind === "name") return letter.name;
    if (kind === "example") return letter.example.word;
    const unit = ALPHABET_AUDIO_KINDS.find((item) => item.key === kind);
    return unit && Number.isInteger(unit.vowelIndex) ? letter.vowels[unit.vowelIndex] : letter.letter;
  }

  function alphabetContrast(letter) {
    return ALPHABET.contrastGroups.find((group) => group.letterIds.includes(letter.id)) || null;
  }

  function alphabetStepRail(active) {
    const labels = HAS_ALPHABET_AUDIO ? ["认识", "跟读", "听辨", "辨形"] : ["认识", "辨形"];
    const normalizedActive = HAS_ALPHABET_AUDIO ? active : (active >= 3 ? 1 : 0);
    return `<ol class="alphabet-step-rail" aria-label="字母学习步骤">${labels.map((label, index) => `<li class="${index < normalizedActive ? "done" : index === normalizedActive ? "active" : ""}" aria-current="${index === normalizedActive ? "step" : "false"}"><span>${index < normalizedActive ? icon("check") : index + 1}</span><b>${label}</b></li>`).join("")}</ol>`;
  }

  function dueWordIds(day = state.currentDay) {
    return Object.entries(state.wordProgress)
      .filter(([, progress]) => progress.seen && Number(progress.dueDay || 0) <= day)
      .sort((a, b) => Number(a[1].dueDay || 0) - Number(b[1].dueDay || 0))
      .slice(0, state.settings.reviewLimit)
      .map(([id]) => id)
      .filter((id) => wordById.has(id));
  }

  function lessonProgress(lesson) {
    const completed = lesson.words.filter((word) => state.wordProgress[word.id]?.seen).length;
    return { completed, total: lesson.words.length, percent: Math.round((completed / lesson.words.length) * 100) };
  }

  function setView(view) {
    state.view = view;
    saveState();
    renderView();
  }

  function renderView() {
    if (!VALID_VIEWS.includes(state.view)) state.view = "today";
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
    $("topbarSubtitle").textContent = `第 ${state.currentDay} / ${DAY_COUNT} 天`;
    if (state.view === "today") renderToday();
    if (state.view === "course") renderCourse();
    if (state.view === "library") renderLibrary();
    if (state.view === "pronunciation") renderPronunciation();
    if (state.view === "profile") renderProfile();
    mainView.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderToday() {
    const schedule = daySchedule();
    const progress = dayRecord();
    const due = dueWordIds();
    const newWords = schedule.wordIds.map((id) => wordById.get(id)).filter(Boolean);
    const lessonNames = schedule.unitIds.map((id) => lessonById.get(id)?.title).filter(Boolean).join("、");
    const pronId = HAS_PRONUNCIATION ? (schedule.pronunciationDay || ((state.currentDay - 1) % DATA.pronunciationDays.length) + 1) : null;
    const pronDay = pronId ? DATA.pronunciationDays.find((day) => Number(day.id) === Number(pronId)) : null;
    const completion = dayCompletion();
    const allDone = completion === 100;
    const firstPending = requiredSteps().find((step) => !progress[step]);
    const steps = [
      { key: "review", title: "复习旧词", detail: due.length ? `${due.length} 个词到期，先回忆再看答案` : "当前无到期词，用最近词条热身", icon: "refresh" },
      { key: "learn", title: schedule.reviewOnly ? "巩固词汇" : "学习新词", detail: `${newWords.length} 个词 · ${lessonNames || "按课程顺序"}`, icon: "book" },
      { key: "verse", title: "经文实战", detail: `${schedule.verseIds.length} 条语境，先找词再看中文`, icon: "layers" },
      ...(state.settings.pronunciation && pronDay ? [{ key: "pronunciation", title: "发音训练", detail: `第 ${pronId} 天 · ${pronunciationDayTitle(pronDay)}`, icon: "mic" }] : []),
    ];

    mainView.innerHTML = `<div class="page today-page">
      <div class="greeting"><div class="arabic" lang="ar">السَّلَامُ عَلَيْكُمْ</div><p>愿今天的学习清楚、稳定、可回忆。</p></div>
      <section class="today-panel">
        <div class="today-progress-head">
          <div class="today-progress-copy"><h1>第 ${state.currentDay} / ${DAY_COUNT} 天</h1><span>今日学习进度</span></div>
          <div class="today-progress-ring" style="--progress:${completion}" role="img" aria-label="今日完成 ${completion}%"><strong>${completion}%</strong></div>
        </div>
        <div class="progress-track" aria-label="今日完成 ${completion}%"><span style="width:${completion}%"></span></div>
        <div class="today-meta"><span>已学 ${learnedWords()} / ${WORD_COUNT} 词</span><span>今日约 ${state.settings.sessionMinutes} 分钟</span></div>
        <button class="primary-button wide" type="button" data-action="${allDone ? "next-day" : "start-step"}" ${allDone ? "" : `data-step="${firstPending}"`}>
          ${icon(allDone ? "calendar" : "book")}${allDone ? (state.currentDay === DAY_COUNT ? "课程已完成" : "进入下一学习日") : "继续今日学习"}
        </button>
      </section>
      <div class="section-title"><h2>今日学习路径</h2><span>按顺序完成</span></div>
      <div class="path-list">
        ${steps.map((step, index) => `<button class="path-item ${progress[step.key] ? "done" : ""}" type="button" data-action="start-step" data-step="${step.key}">
          <span class="path-number">${progress[step.key] ? icon("check") : index + 1}</span>
          <span class="path-copy"><strong>${step.title}</strong><small>${escapeHtml(step.detail)}</small></span>
          <span class="path-arrow">${icon("arrow")}</span>
        </button>`).join("")}
      </div>
      ${schedule.weeklyTest ? `<div class="gate-note"><b>本日含第 ${schedule.weeklyTest} 次周测。</b> 完成今日步骤后，从“课程”抽查本周词条；先闭卷作答，再核对答案。</div>` : ""}
      ${schedule.gate ? `<div class="gate-note"><b>阶段复习 ${schedule.gate}。</b> 请完成词义回忆、经文定位和发音练习。</div>` : ""}
      <div class="summary-strip">
        <div class="summary-item"><strong>${due.length}</strong><span>今日待复习</span></div>
        <div class="summary-item"><strong>${masteredWords()}</strong><span>稳定掌握</span></div>
        <div class="summary-item"><strong>${state.activeDates.length}</strong><span>累计学习日</span></div>
      </div>
    </div>`;
  }

  function renderCourse(selectedUnit = null) {
    if (state.courseMode === "alphabet") {
      renderAlphabetCourse();
      return;
    }
    const requestedUnit = Number(selectedUnit || state.courseUnit);
    if (lessonById.has(requestedUnit)) {
      if (state.courseUnit !== requestedUnit) {
        state.courseUnit = requestedUnit;
        saveState();
      }
      renderLessonDetail(requestedUnit);
      return;
    }
    const lessons = DATA.lessons.filter((lesson) => !state.courseStage || lesson.stage === state.courseStage);
    const stageNames = ["全部", "句子骨架", "主题词汇", "动词词形"];
    mainView.innerHTML = `<div class="page course-page">
      <div class="page-heading"><h1>${DAY_COUNT} 天课程</h1><p>${UNIT_COUNT} 课按词汇、完整经文语境和主动回忆依次推进。</p></div>
      <button class="alphabet-course-entry" type="button" data-action="open-alphabet">
        <span class="alphabet-entry-glyph arabic" lang="ar">ا ب ت</span>
        <span class="alphabet-entry-copy"><strong>先学阿拉伯语字母</strong><small>${HAS_ALPHABET_AUDIO ? "逐音发音 · 易混对比 · 听辨与辨形练习" : "发音部位 · 字形位置 · 辨形练习"}</small></span>
        <span class="alphabet-entry-progress">${masteredAlphabetLetters()} / ${ALPHABET_COUNT}${icon("arrow")}</span>
      </button>
      <div class="tabs" role="tablist">${stageNames.map((name, index) => `<button class="tab ${state.courseStage === index ? "active" : ""}" type="button" data-action="set-stage" data-stage="${index}">${name}</button>`).join("")}</div>
      <div class="lesson-list">${lessons.map((lesson) => {
        const progress = lessonProgress(lesson);
        return `<button class="lesson-row" type="button" data-action="open-unit" data-unit="${lesson.index}">
          <span class="row-index">${String(lesson.index).padStart(2, "0")}</span>
          <span class="row-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.words.length} 词 · ${lesson.verses.length} 条经文实战</small></span>
          <span class="row-status ${progress.percent === 100 ? "done" : ""}">${progress.completed}/${progress.total}<br>${progress.percent}%</span>
        </button>`;
      }).join("")}</div>
    </div>`;
  }

  function renderAlphabetCourse() {
    if (state.alphabetGroup === 8) {
      renderAlphabetSpecial();
      return;
    }
    const mastered = masteredAlphabetLetters();
    const percent = ALPHABET_COUNT ? Math.round((mastered / ALPHABET_COUNT) * 100) : 0;
    const nextLetter = ALPHABET.letters.find((letter) => !state.alphabetProgress[letter.id]?.mastered) || ALPHABET.letters[0];
    const tabs = [
      { id: "overview", label: "学习路径" },
      { id: "articulation", label: "发音地图" },
      { id: "joining", label: "连写规则" },
    ];
    const overview = `<div class="alphabet-group-list">${ALPHABET.groups.map((group) => {
      const progress = alphabetGroupProgress(group);
      const glyphs = group.special ? ["ء", "ة", "ى", "لا"] : group.letterIds.map((id) => alphabetLetterById.get(id)?.letter);
      const status = group.special ? (state.alphabetSpecialComplete ? "已复习" : "综合") : `${progress.mastered} / ${progress.total}`;
      return `<button class="alphabet-group-row" type="button" data-action="open-alphabet-group" data-alphabet-group="${group.id}">
        <span class="alphabet-group-glyphs" lang="ar" dir="rtl">${glyphs.map((glyph) => `<i class="arabic">${glyph}</i>`).join("")}</span>
        <span class="row-copy"><strong>${group.special ? "特殊形体复习" : `第 ${group.id} 组 · ${escapeHtml(group.title)}`}</strong><small>${escapeHtml(group.subtitle)}</small></span>
        <span class="row-status ${(!group.special && progress.mastered === progress.total) || (group.special && state.alphabetSpecialComplete) ? "done" : ""}">${status}${icon("arrow")}</span>
      </button>`;
    }).join("")}</div>`;
    const articulation = `<div class="alphabet-zone-list">${ALPHABET.articulationZones.map((zone) => `<section class="alphabet-zone"><div class="alphabet-zone-copy"><h2>${escapeHtml(zone.title)}</h2><p>${escapeHtml(zone.subtitle)}</p></div><div class="alphabet-zone-letters">${zone.letterIds.map((id) => {
      const letter = alphabetLetterById.get(id);
      return `<button type="button" data-action="open-alphabet-letter" data-letter-id="${id}" aria-label="学习 ${letter.name}"><span class="arabic" lang="ar">${letter.letter}</span><small>${escapeHtml(letter.category)}</small></button>`;
    }).join("")}</div></section>`).join("")}</div>`;
    const joining = `<div class="alphabet-rule-list">${ALPHABET.joiningRules.map((rule) => `<section class="alphabet-rule-section"><h2>${escapeHtml(rule.title)}</h2><div class="arabic" lang="ar">${rule.glyphs}</div><p>${escapeHtml(rule.explanation)}</p></section>`).join("")}
      <section class="alphabet-form-example"><h2>四种位置形示例</h2><div>${["isolated", "initial", "medial", "final"].map((key, index) => `<span><small>${["独立", "词首", "词中", "词尾"][index]}</small><b class="arabic" lang="ar">${alphabetLetterById.get("a02").forms[key]}</b></span>`).join("")}</div><p>ب 可以双向连接；ا、د、ذ、ر、ز、و 不能继续连接左侧后一个字母。</p></section>
    </div>`;
    mainView.innerHTML = `<div class="page alphabet-page">
      <div class="alphabet-page-head"><button class="back-button" type="button" data-action="close-alphabet">${icon("back")}返回 ${DAY_COUNT} 天课程</button><div><h1>阿拉伯语字母</h1><p>${HAS_ALPHABET_AUDIO ? "逐音听清，再做听辨与辨形练习" : "学习发音部位、字形位置与辨形"}</p></div></div>
      <section class="alphabet-overview">
        <div class="alphabet-overview-progress"><span>已掌握 <b>${mastered}</b> / ${ALPHABET_COUNT}</span><div role="progressbar" aria-valuemin="0" aria-valuemax="${ALPHABET_COUNT}" aria-valuenow="${mastered}"><i style="width:${percent}%"></i></div><small>${HAS_ALPHABET_AUDIO ? "每个字母须完成逐音跟读、听辨和辨形" : "演示包通过发音部位说明和辨形练习完成学习"}</small></div>
        <button class="primary-button" type="button" data-action="open-alphabet-letter" data-letter-id="${nextLetter.id}">${mastered === ALPHABET_COUNT ? "重新复习" : "继续学习"}${icon("arrow")}</button>
      </section>
      ${alphabetStepRail(mastered ? 1 : 0)}
      <div class="tabs alphabet-tabs" role="tablist">${tabs.map((tab) => `<button class="tab ${state.alphabetTab === tab.id ? "active" : ""}" type="button" data-action="set-alphabet-tab" data-alphabet-tab="${tab.id}">${tab.label}</button>`).join("")}</div>
      ${state.alphabetTab === "overview" ? overview : state.alphabetTab === "articulation" ? articulation : joining}
    </div>`;
  }

  function renderAlphabetSpecial() {
    mainView.innerHTML = `<div class="page alphabet-special-page">
      <div class="back-line"><button class="back-button" type="button" data-action="back-alphabet">${icon("back")}返回字母总表</button><span>${state.alphabetSpecialComplete ? "已复习" : "综合"}</span></div>
      <div class="page-heading"><h1>特殊字形与总复习</h1><p>这些写法很常见，但不能错误地计入 28 个基础字母。</p></div>
      <div class="special-form-list">${ALPHABET.specialForms.map((item) => `<section class="special-form-row"><span class="arabic" lang="ar">${item.glyph}</span><div><strong>${item.name}</strong><small>${escapeHtml(item.title)}</small><p>${escapeHtml(item.explanation)}</p></div></section>`).join("")}</div>
      <section class="alphabet-rule-section"><h2>识读练习</h2><p>能说清哈姆宰（ء）与艾利夫（ا）的区别；看到 ة、ى、لا 时能说明它们的真实构成和常见读法。</p></section>
      <button class="primary-button wide" type="button" data-action="complete-alphabet-special">${state.alphabetSpecialComplete ? "已完成，可再次复习" : "完成特殊字形复习"}</button>
    </div>`;
  }

  function renderLessonDetail(unitId) {
    const lesson = lessonById.get(Number(unitId));
    if (!lesson) return renderCourse();
    const progress = lessonProgress(lesson);
    mainView.innerHTML = `<div class="page lesson-page">
      <div class="back-line"><button class="back-button" type="button" data-action="back-course">${icon("back")}返回课程</button><span class="row-status">${progress.percent}%</span></div>
      <section class="lesson-hero">
        <p class="eyebrow">第 ${lesson.index} 课 · 第 ${lesson.stage} 阶段</p>
        <h1>${escapeHtml(lesson.title)}</h1>
        <p>${escapeHtml(lesson.overview || "按词类与语境建立识别路线，再用闭卷回忆验证掌握。")}</p>
        <div class="lesson-meta"><span>${lesson.words.length} 个词条</span><span>${lesson.verses.length} 条经文</span><span>${escapeHtml(lesson.sourceRange || `来源第 ${lesson.first}–${lesson.last} 页`)}</span></div>
        <button class="primary-button wide" type="button" data-action="start-unit" data-unit="${lesson.index}">${icon("book")}开始本课词汇</button>
      </section>
      <div class="section-title"><h2>本课全部词汇</h2><span>${progress.completed}/${progress.total} 已学习</span></div>
      <div class="lesson-preview">${lesson.words.map((word) => `<button class="mini-word word-row" type="button" data-action="open-word" data-word="${word.id}"><span class="arabic" lang="ar">${escapeHtml(word.arabic)}</span><span><b>${escapeHtml(word.meaning)}</b><small>${escapeHtml(word.pos)}</small></span></button>`).join("")}</div>
    </div>`;
  }

  function libraryWords() {
    const query = state.libraryQuery.trim().toLowerCase();
    return allWords.filter((word) => {
      if (state.libraryUnit && word.unit !== state.libraryUnit) return false;
      if (state.libraryFilter === "learned" && !state.wordProgress[word.id]?.seen) return false;
      if (state.libraryFilter === "due" && !(state.wordProgress[word.id]?.seen && state.wordProgress[word.id]?.dueDay <= state.currentDay)) return false;
      if (state.libraryFilter === "favorite" && !state.favorites.includes(word.id)) return false;
      if (!query) return true;
      return [word.arabic, word.meaning, word.pos, word.phrase, lessonById.get(word.unit)?.title].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function renderLibrary() {
    const words = libraryWords();
    const filters = [{ id: "all", label: "全部" }, { id: "learned", label: "已学" }, { id: "due", label: "待复习" }, { id: "favorite", label: "收藏" }];
    mainView.innerHTML = `<div class="page library-page">
      <div class="page-heading"><h1>词库</h1><p>${state.libraryUnit ? `第 ${state.libraryUnit} 课 · ` : ""}共 ${WORD_COUNT} 个学习词条，全部显示，可按中文、阿拉伯文或词性检索。</p></div>
      <label class="search-box">${icon("search")}<input id="librarySearch" type="search" value="${escapeHtml(state.libraryQuery)}" placeholder="搜索词义、阿拉伯词或词性" autocomplete="off"></label>
      <div class="tabs">${filters.map((filter) => `<button class="tab ${state.libraryFilter === filter.id ? "active" : ""}" type="button" data-action="set-library-filter" data-filter="${filter.id}">${filter.label}</button>`).join("")}</div>
      ${state.libraryUnit ? `<div class="back-line"><button class="back-button" type="button" data-action="clear-unit-filter">${icon("back")}查看全部课程</button><span>${words.length} 词</span></div>` : ""}
      <div class="word-list">${words.map((word) => `<button class="word-row" type="button" data-action="open-word" data-word="${word.id}">
        <span class="arabic" lang="ar">${escapeHtml(word.arabic)}</span>
        <span class="word-meaning"><strong>${escapeHtml(word.meaning)}</strong><small>第 ${word.unit} 课 · ${escapeHtml(word.pos)}</small></span>
        <span class="${state.favorites.includes(word.id) ? "favorite-mark" : "row-chevron"}">${state.favorites.includes(word.id) ? icon("star") : icon("arrow")}</span>
      </button>`).join("")}</div>
      ${!words.length ? `<div class="empty-state">${icon("search")}<p>没有符合条件的词条。</p></div>` : ""}
    </div>`;
  }

  const PRONUNCIATION_DAY_TITLES = {
    "喉音：ح / ه": "喉音辨析（一）",
    "喉音：ء / ع": "喉音辨析（二）",
    "喉音：خ / غ": "喉音辨析（三）",
    "舌后：ق / ك": "舌后音辨析",
    "Gate A": "阶段测评一",
    "薄厚：س / ص": "薄厚音辨析（一）",
    "薄厚：ت / ط": "薄厚音辨析（二）",
    "舌尖/舌侧：د / ض": "舌尖与舌侧辨析",
    "齿间：ث / ذ / ظ": "齿间音辨析",
    "sukūn 静音": "静音符训练",
    "shaddah 叠音": "叠音符训练",
    "Gate B": "阶段测评二",
    "ghunnah 鼻音": "鼻音训练",
    "nūn 与 tanwīn": "词尾鼻音规则",
    "mīm sākinah": "双唇静音规则",
    "qalqalah 回弹": "回弹音训练",
    "太阳/月亮字母": "太阳字母与月亮字母",
    "lām / rāʾ 厚薄": "舌尖音厚薄",
    "Gate C": "阶段测评三",
    "madd 基础": "长音基础",
    "Gate D": "综合测评",
  };
  const PRONUNCIATION_TAGS = {
    "P-时值": "音长与节奏",
    "P-部位": "发音部位",
    "P-静音": "静音与停读",
    "P-厚薄": "厚薄共鸣",
    "P-规则": "诵读规则",
    "P-叠音": "叠音完整性",
    "P-连读": "连续诵读",
  };
  const PRONUNCIATION_FOCUS = {
    "lām 与同化": "定冠词与同化",
  };

  function pronunciationDayTitle(day) {
    return day ? (PRONUNCIATION_DAY_TITLES[day.title] || day.title) : "";
  }

  function pronunciationTag(task) {
    return PRONUNCIATION_TAGS[task.tag] || String(task.tag || "发音训练").replace(/^P[-－]/i, "");
  }

  function pronunciationFocus(day) {
    return day ? (PRONUNCIATION_FOCUS[day.focus] || day.focus) : "";
  }

  function resolvedPronunciationTask(task) {
    if (task.reviewMode !== "lowest-three") return task;
    const completed = [...pronunciationTaskById.values()]
      .filter((candidate) => candidate.id !== task.id && state.pronunciationProgress[candidate.id]?.completed)
      .sort((a, b) => {
        const scoreA = Number(state.pronunciationProgress[a.id]?.average ?? 99);
        const scoreB = Number(state.pronunciationProgress[b.id]?.average ?? 99);
        return scoreA - scoreB || a.id.localeCompare(b.id, undefined, { numeric: true });
      });
    const fallback = (task.reviewFallbackIds || []).map((id) => pronunciationTaskById.get(id)).filter(Boolean);
    const selected = [...completed, ...fallback]
      .filter((candidate, index, items) => items.findIndex((item) => item.id === candidate.id) === index)
      .slice(0, 3);
    return {
      ...task,
      resolvedReviewTasks: selected,
      audioSequence: selected.flatMap((candidate) => candidate.audioSequence?.length ? candidate.audioSequence : [candidate.audio]),
      resolvedSource: selected.length ? `当前复测：${selected.map((candidate) => candidate.id).join("、")}` : "当前复测：请先完成前 27 天训练",
    };
  }

  function pronunciationArabicTarget(task) {
    if (task.resolvedReviewTasks?.length) {
      return task.resolvedReviewTasks.map((candidate) => pronunciationArabicTarget(candidate)).join(" ۝ ");
    }
    if (/[\u0600-\u06ff]/.test(task.target)) return task.target;
    const combined = `${task.target} ${task.source}`;
    const match = combined.match(/(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?/);
    if (match) {
      const chapter = Number(match[1]);
      const start = Number(match[2]);
      const end = Number(match[3] || start);
      const matches = allVerses.filter((verse) => {
          const parts = String(verse.reference || "").match(/(\d{1,3}):(\d{1,3})/);
          return parts && Number(parts[1]) === chapter && Number(parts[2]) >= start && Number(parts[2]) <= end;
        });
      const verses = [...new Map(matches.map((verse) => [verse.reference, verse])).values()]
        .sort((a, b) => Number(a.reference.split(":")[1]) - Number(b.reference.split(":")[1]));
      if (verses.length) return verses.map((verse) => verse.arabic).join(" ۝ ");
    }
    if (task.target.includes("完整盲录")) {
      const verses = [...new Map(allVerses
        .filter((verse) => String(verse.reference || "").startsWith("112:"))
        .map((verse) => [verse.reference, verse])).values()]
        .sort((a, b) => Number(a.reference.split(":")[1]) - Number(b.reference.split(":")[1]));
      if (verses.length) return verses.map((verse) => verse.arabic).join(" ۝ ");
    }
    if (task.target.includes("随机三节")) return "سُورَةُ ٱلْفَاتِحَةِ";
    const sameAudioArabicTask = DATA.pronunciationDays.flatMap((day) => day.tasks)
      .find((candidate) => candidate.audio === task.audio && /[\u0600-\u06ff]/.test(candidate.target));
    return sameAudioArabicTask?.target || "ٱلْقُرْآنُ";
  }

  function renderPronunciation() {
    if (!HAS_PRONUNCIATION) {
      mainView.innerHTML = `<div class="page pronunciation-page"><div class="page-heading"><h1>发音训练</h1><p>当前公开演示版不含任何音频；词汇、完整经文、字母辨形和复习功能仍可正常使用。</p></div></div>`;
      return;
    }
    const completedTasks = Object.values(state.pronunciationProgress).filter((item) => item.completed).length;
    const pronunciationTaskCount = pronunciationTaskById.size;
    const percent = pronunciationTaskCount ? Math.round((completedTasks / pronunciationTaskCount) * 100) : 0;
    const recentResults = Object.values(state.pronunciationProgress)
      .filter((item) => item.completed && Number.isFinite(item.average))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const latest = recentResults[0];
    const todayPronId = daySchedule().pronunciationDay || ((state.currentDay - 1) % 28) + 1;
    const todayPron = DATA.pronunciationDays[todayPronId - 1];
    mainView.innerHTML = `<div class="page pronunciation-page">
      <div class="page-heading"><h1>发音训练</h1><p>先独立录 A，再听标准音；选择一个重点改进，录 B 后对比两次发音。</p></div>
      <section class="pron-overview">
        <div class="day-row"><h2>28 天发音路线</h2><strong>${percent}%</strong></div>
        <div class="progress-track"><span style="width:${percent}%"></span></div>
        <button class="primary-button wide" type="button" data-action="start-pron-day" data-pron-day="${todayPronId}">${icon("mic")}继续第 ${todayPronId} 天 · ${escapeHtml(pronunciationDayTitle(todayPron))}</button>
        ${latest ? `<div class="pron-latest"><span>最近一次</span><strong>${Math.round((latest.average / 2) * 100)} 分</strong><small>${escapeHtml(latest.comparisonResultLabel || "已完成 A/B 对比")}</small></div>` : ""}
      </section>
      <div class="section-title"><h2>完整路线</h2><span>${pronunciationTaskCount} 项录音任务</span></div>
      <div class="pron-list">${DATA.pronunciationDays.map((day) => {
        const completed = day.tasks.filter((task) => state.pronunciationProgress[task.id]?.completed).length;
        return `<button class="pron-row" type="button" data-action="start-pron-day" data-pron-day="${day.id}">
          <span class="row-index">${day.gate ? `<span class="gate-badge">测评</span>` : day.id}</span>
          <span class="row-copy"><strong>${escapeHtml(pronunciationDayTitle(day))}</strong><small>${escapeHtml(pronunciationFocus(day))} · 3 项训练</small></span>
          <span class="row-status ${completed === 3 ? "done" : ""}">${completed}/3</span>
        </button>`;
      }).join("")}</div>
    </div>`;
  }

  function renderProfile() {
    const completedDays = Object.values(state.dayProgress).filter((day) => requiredSteps().every((key) => day[key])).length;
    mainView.innerHTML = `<div class="page profile-page">
      <div class="page-heading"><h1>我的学习</h1><p>进度、学习强度和数据都由你控制。</p></div>
      <div class="profile-grid">
        <div class="profile-stat"><strong>${learnedWords()}</strong><span>已学词条</span></div>
        <div class="profile-stat"><strong>${masteredWords()}</strong><span>稳定掌握</span></div>
        <div class="profile-stat"><strong>${completedDays}</strong><span>完整学习日</span></div>
      </div>
      <button class="alphabet-profile-progress" type="button" data-action="open-alphabet"><span class="arabic" lang="ar">ا ب ت ث</span><span><strong>字母基础 ${masteredAlphabetLetters()} / ${ALPHABET_COUNT}</strong><small>${HAS_ALPHABET_AUDIO ? "继续逐音跟读、易混对比与听辨练习" : "继续发音部位学习与辨形练习"}</small></span>${icon("arrow")}</button>
      <div class="section-title"><h2>学习设置</h2><span>自动保存</span></div>
      <div class="settings-list">
        <label class="setting-row"><span class="setting-copy"><strong>每日学习时长</strong><small>用于首页显示，不强制倒计时</small></span><select data-setting="sessionMinutes"><option value="25" ${state.settings.sessionMinutes === 25 ? "selected" : ""}>25 分钟</option><option value="35" ${state.settings.sessionMinutes === 35 ? "selected" : ""}>35 分钟</option><option value="45" ${state.settings.sessionMinutes === 45 ? "selected" : ""}>45 分钟</option></select></label>
        <label class="setting-row"><span class="setting-copy"><strong>每次复习上限</strong><small>超过上限的词顺延到下次</small></span><select data-setting="reviewLimit"><option value="8" ${state.settings.reviewLimit === 8 ? "selected" : ""}>8 词</option><option value="12" ${state.settings.reviewLimit === 12 ? "selected" : ""}>12 词</option><option value="20" ${state.settings.reviewLimit === 20 ? "selected" : ""}>20 词</option></select></label>
        ${HAS_PRONUNCIATION ? `<label class="setting-row"><span class="setting-copy"><strong>每日发音训练</strong><small>关闭后今日路径只保留三步</small></span><span class="switch"><input type="checkbox" data-setting="pronunciation" ${state.settings.pronunciation ? "checked" : ""}><span></span></span></label>` : ""}
        ${HAS_PRONUNCIATION || HAS_ALPHABET_AUDIO ? `<label class="setting-row"><span class="setting-copy"><strong>范读速度</strong><small>影响词汇与发音练习的播放速度</small></span><select data-setting="audioRate"><option value="0.75" ${state.settings.audioRate === 0.75 ? "selected" : ""}>0.75×</option><option value="0.85" ${state.settings.audioRate === 0.85 ? "selected" : ""}>0.85×</option><option value="1" ${state.settings.audioRate === 1 ? "selected" : ""}>1×</option></select></label>` : ""}
      </div>
      ${IS_NATIVE_ANDROID ? "" : `<div class="section-title"><h2>安装</h2></div><div class="button-row"><button class="secondary-button" type="button" data-action="install-app">${icon("download")}安装到设备</button></div>`}
      <div class="section-title"><h2>数据</h2><span>成绩仅保存在本机</span></div>
      <div class="button-row">
        <button class="secondary-button" type="button" data-action="export-data">${icon("download")}导出学习备份</button>
        <button class="secondary-button" type="button" data-action="import-data">${icon("upload")}导入学习备份</button>
        <button class="danger-button" type="button" data-action="reset-data">${icon("trash")}清空学习数据</button>
      </div>
      <div class="source-note">学习进度只保存在本机，不会自动上传。建议定期导出学习备份。</div>
    </div>`;
  }

  function startStep(step) {
    const schedule = daySchedule();
    if (step === "review") {
      let ids = dueWordIds();
      if (!ids.length) {
        const learned = Object.keys(state.wordProgress).filter((id) => wordById.has(id));
        ids = learned.slice(-Math.min(6, learned.length));
      }
      if (!ids.length) {
        dayRecord().review = true;
        saveState(true);
        toast("今天还没有旧词，复习步骤已完成。");
        renderToday();
        return;
      }
      openWordSession(ids, "review", "review");
    }
    if (step === "learn") openWordSession(schedule.wordIds, "learn", "learn");
    if (step === "verse") openVerseSession(schedule.verseIds, "verse");
    if (step === "pronunciation" && HAS_PRONUNCIATION) {
      const pronId = schedule.pronunciationDay || ((state.currentDay - 1) % 28) + 1;
      openPronunciationSession(pronId, "pronunciation");
    }
  }

  function openLayer() {
    sessionReturnView = state.view;
    const opener = document.activeElement;
    sessionOpener = opener instanceof HTMLElement ? {
      action: opener.dataset.action || "",
      pronDay: opener.dataset.pronDay || "",
      view: state.view,
    } : null;
    appShell.inert = true;
    appShell.setAttribute("aria-hidden", "true");
    sessionLayer.hidden = false;
    document.body.style.overflow = "hidden";
    sessionLayer.scrollTop = 0;
    requestAnimationFrame(() => $("sessionBack")?.focus({ preventScroll: true }));
  }

  function openWordSession(ids, mode = "learn", stepKey = null) {
    const items = ids.map((id) => wordById.get(id)).filter(Boolean);
    if (!items.length) return toast("当前没有可学习的词条。");
    currentSession = {
      type: "words", items, index: 0, revealed: false, mode, stepKey, completed: 0,
      wordMode: "study", dictationInput: "", dictationResult: null, dictationAttempts: 0,
      pronunciationFormIndex: 0, wordAudioLayer: "natural", activeSyllableIndex: -1,
    };
    openLayer();
    renderSession();
  }

  function openVerseSession(ids, stepKey = null) {
    const items = ids.map((id) => verseById.get(id)).filter(Boolean);
    if (!items.length) return toast("当前学习日没有经文实战数据。");
    currentSession = { type: "verses", items, index: 0, answered: {}, stepKey, completed: 0 };
    openLayer();
    renderSession();
  }

  function openPronunciationSession(dayId, stepKey = null) {
    const day = DATA.pronunciationDays[Number(dayId) - 1];
    if (!day) return;
    currentSession = {
      type: "pronunciation", day, items: day.tasks, index: 0, scores: {},
      takeA: null, takeB: null, durationA: 0, durationB: 0,
      activeRecordingTake: "", modelPlayed: false, selectedIssue: "",
      replayed: { A: false, B: false }, comparisonResult: null,
      records: [], recordsLoadedFor: "", stepKey, completed: 0,
    };
    openLayer();
    renderSession();
    loadPronunciationRecords();
  }

  function openAlphabetSession(ids) {
    const items = ids.map((id) => alphabetLetterById.get(id)).filter(Boolean);
    if (!items.length) return toast("当前没有可学习的字母。");
    state.view = "course";
    state.courseMode = "alphabet";
    state.courseUnit = null;
    saveState();
    currentSession = { type: "alphabet", items, index: 0, completed: 0 };
    resetAlphabetLetterSession();
    openLayer();
    renderSession();
  }

  function resetAlphabetLetterSession() {
    const letter = currentSession.items[currentSession.index];
    const progress = state.alphabetProgress[letter.id] || {};
    currentSession.alphabetStep = "learn";
    currentSession.heardKinds = Array.isArray(progress.listenedKinds) ? [...progress.listenedKinds] : [];
    currentSession.activeAudioKind = "";
    currentSession.listeningQuizKind = ["fatha", "kasra", "damma"][(letter.order - 1) % 3];
    currentSession.listeningQuizAudioPlayed = false;
    currentSession.listeningQuizAnswer = "";
    currentSession.listeningQuizCorrect = false;
    currentSession.quizAnswer = "";
    currentSession.quizCorrect = false;
  }

  function renderSession() {
    if (!currentSession) return;
    const total = currentSession.items.length;
    const current = Math.min(currentSession.index + 1, total);
    sessionCount.textContent = `${current} / ${total}`;
    sessionProgress.style.width = `${Math.round((current / total) * 100)}%`;
    sessionFavorite.hidden = currentSession.type !== "words";
    if (currentSession.type === "words") renderWordSession();
    if (currentSession.type === "verses") renderVerseSession();
    if (currentSession.type === "pronunciation") renderPronunciationSession();
    if (currentSession.type === "alphabet") renderAlphabetSession();
  }

  function renderAlphabetSession() {
    const letter = currentSession.items[currentSession.index];
    sessionTitle.textContent = "字母学习";
    sessionFavorite.hidden = true;
    if (currentSession.alphabetStep === "listening") {
      renderAlphabetListeningQuiz();
      return;
    }
    if (currentSession.alphabetStep === "quiz") {
      renderAlphabetQuiz();
      return;
    }
    const formEntries = [
      ["独立", letter.forms.isolated],
      ["词首", letter.forms.initial],
      ["词中", letter.forms.medial],
      ["词尾", letter.forms.final],
    ];
    const heard = new Set(currentSession.heardKinds);
    const contrast = alphabetContrast(letter);
    const contrastLetters = contrast ? contrast.letterIds.map((id) => alphabetLetterById.get(id)).filter(Boolean) : [];
    const heardRequired = HAS_ALPHABET_AUDIO ? ["name", "fatha", "kasra", "damma", "example"].filter((kind) => heard.has(kind)).length : 5;
    sessionContent.innerHTML = `<div class="alphabet-lesson">
      ${alphabetStepRail(heardRequired ? 1 : 0)}
      <section class="alphabet-letter-hero">
        <div class="alphabet-main-glyph arabic" lang="ar">${letter.letter}</div>
        <h1>字母名：<span class="arabic" lang="ar">${letter.name}</span></h1>
        <p>${escapeHtml(letter.category)}</p>
      </section>
      ${HAS_ALPHABET_AUDIO ? `<section class="alphabet-sound-studio">
        <div class="alphabet-section-heading"><h2>逐音跟读</h2><span data-alphabet-audio-status aria-live="polite">${heardRequired ? `已听 ${heardRequired} / 5` : "点按每个发音，跟读 3 遍"}</span></div>
        <div class="alphabet-sound-grid">${ALPHABET_AUDIO_KINDS.map((unit) => {
          const listened = heard.has(unit.key);
          return `<button class="alphabet-sound-button ${listened ? "listened" : ""}" type="button" data-session-action="play-alphabet-unit" data-letter-id="${letter.id}" data-audio-kind="${unit.key}" aria-label="播放${unit.label} ${alphabetAudioText(letter, unit.key)}"><small>${unit.label}</small><b class="arabic" lang="ar">${alphabetAudioText(letter, unit.key)}</b><span>${icon(currentSession.activeAudioKind === unit.key ? "pause" : "volume")}</span><i>${listened ? icon("check") : "未听"}</i></button>`;
        }).join("")}</div>
        <div class="alphabet-playback-controls"><span>${icon("refresh")}跟读 3 遍</span><div role="group" aria-label="字母发音速度">${[0.75, 0.85, 1].map((speed) => `<button type="button" data-session-action="set-alphabet-audio-speed" data-speed="${speed}" class="${state.settings.audioRate === speed ? "active" : ""}" aria-pressed="${state.settings.audioRate === speed}">${speed}×</button>`).join("")}</div></div>
      </section>` : ""}
      <section class="alphabet-teaching-copy"><div class="alphabet-section-heading"><h2>发音动作</h2><span>${escapeHtml(letter.category)}</span></div><p>${escapeHtml(letter.articulation)}</p><div class="alphabet-mistake"><strong>避免这样读</strong><span>${escapeHtml(letter.mistake)}</span></div></section>
      ${contrast ? `<section class="alphabet-contrast"><div class="alphabet-section-heading"><h2>易混字形对比 · ${escapeHtml(contrast.title)}</h2><span>${HAS_ALPHABET_AUDIO ? "点按试听开口音" : "比较点位与骨架"}</span></div><p>${escapeHtml(contrast.cue)}</p><div>${contrastLetters.map((item) => HAS_ALPHABET_AUDIO ? `<button type="button" data-session-action="play-alphabet-unit" data-letter-id="${item.id}" data-audio-kind="fatha" aria-label="播放 ${item.vowels[0]}"><b class="arabic" lang="ar">${item.vowels[0]}</b>${icon("volume")}</button>` : `<span><b class="arabic" lang="ar">${item.letter}</b></span>`).join("")}</div></section>` : ""}
      <section class="alphabet-example"><div class="alphabet-section-heading"><h2>例词 · 古兰经高频形式</h2></div>${HAS_ALPHABET_AUDIO ? `<button type="button" data-session-action="play-alphabet-unit" data-letter-id="${letter.id}" data-audio-kind="example"><b class="arabic" lang="ar">${letter.example.word}</b><span>${escapeHtml(letter.example.meaning)}</span>${icon("volume")}</button>` : `<div><b class="arabic" lang="ar">${letter.example.word}</b><span>${escapeHtml(letter.example.meaning)}</span></div>`}</section>
      <section class="alphabet-forms"><div class="alphabet-section-heading"><h2>字形位置</h2><span>${letter.joining === "right" ? "只接右侧" : "双向连接"}</span></div><div class="alphabet-form-strip" aria-label="${letter.name}的四种位置字形">${formEntries.map(([label, glyph]) => `<span><small>${label}</small><b class="arabic" lang="ar">${glyph}</b></span>`).join("")}</div></section>
      <div class="alphabet-gate-status" data-alphabet-gate-status>${HAS_ALPHABET_AUDIO ? (heardRequired === 5 ? "五项发音已完成，可以进入听辨" : `还需完整跟读 ${5 - heardRequired} 项发音`) : "已完成字形与发音部位学习，可以进入辨形"}</div>
      <button class="primary-button wide" type="button" data-session-action="start-alphabet-listening-quiz" ${heardRequired === 5 ? "" : "disabled"}>${HAS_ALPHABET_AUDIO ? `进入听辨${heardRequired === 5 ? "" : " · 请先听完全部发音"}` : "进入辨形练习"}</button>
    </div>`;
  }

  function alphabetQuizOptions(letter) {
    const group = alphabetGroupById.get(letter.group);
    const candidates = group.letterIds.map((id) => alphabetLetterById.get(id)).filter(Boolean);
    const offset = letter.order % candidates.length;
    return [...candidates.slice(offset), ...candidates.slice(0, offset)];
  }

  function renderAlphabetListeningQuiz() {
    const letter = currentSession.items[currentSession.index];
    const answered = Boolean(currentSession.listeningQuizAnswer);
    const options = ALPHABET_AUDIO_KINDS.filter((item) => Number.isInteger(item.vowelIndex));
    sessionContent.innerHTML = `<div class="alphabet-quiz alphabet-listening-quiz">
      ${alphabetStepRail(2)}
      <div class="alphabet-quiz-heading"><span>听辨练习</span><h1>听发音，选择对应的短元音</h1><p>不要看字形猜答案；先完整播放示范音，再作答。</p></div>
      <button class="alphabet-quiz-audio ${currentSession.listeningQuizAudioPlayed ? "played" : ""}" type="button" data-session-action="play-alphabet-quiz-audio">${icon("volume")}<span><strong>${currentSession.listeningQuizAudioPlayed ? "再听一次" : "播放示范音"}</strong><small>清晰发音 · 播放 2 遍</small></span></button>
      <div class="alphabet-listening-options" role="radiogroup" aria-label="选择听到的短元音">${options.map((option) => {
        const selected = currentSession.listeningQuizAnswer === option.key;
        const correct = option.key === currentSession.listeningQuizKind;
        const className = selected ? (correct ? "correct" : "wrong") : "";
        return `<button class="alphabet-listening-option ${className}" type="button" role="radio" aria-checked="${selected}" data-session-action="answer-alphabet-listening" data-audio-kind="${option.key}" ${currentSession.listeningQuizAudioPlayed ? "" : "disabled"}><span class="arabic" lang="ar">${alphabetAudioText(letter, option.key)}</span><small>${option.label}</small></button>`;
      }).join("")}</div>
      <div class="alphabet-quiz-feedback ${currentSession.listeningQuizCorrect ? "correct" : answered ? "wrong" : ""}" aria-live="polite">${currentSession.listeningQuizCorrect ? `正确：你听到的是 ${alphabetAudioText(letter, currentSession.listeningQuizKind)}。` : answered ? "还不正确。请再听一次，注意短元音结尾。" : currentSession.listeningQuizAudioPlayed ? "请选择听到的音。" : "请先播放示范音。"}</div>
      <button class="primary-button wide" type="button" data-session-action="go-alphabet-shape-quiz" ${currentSession.listeningQuizCorrect ? "" : "disabled"}>继续辨形</button>
      <button class="back-button alphabet-quiz-back" type="button" data-session-action="back-alphabet-learn">${icon("back")}返回逐音跟读</button>
    </div>`;
  }

  function renderAlphabetQuiz() {
    const letter = currentSession.items[currentSession.index];
    const options = alphabetQuizOptions(letter);
    const answered = Boolean(currentSession.quizAnswer);
    sessionContent.innerHTML = `<div class="alphabet-quiz">
      ${alphabetStepRail(3)}
      <div class="alphabet-quiz-heading"><span>辨形小测</span><h1>找出 <b class="arabic" lang="ar">${letter.name}</b> 的词中形</h1><p>注意点位、骨架和连接线，不要只凭整体轮廓猜。</p></div>
      <div class="alphabet-quiz-options" role="radiogroup" aria-label="选择 ${letter.name} 的词中形">${options.map((option) => {
        const selected = currentSession.quizAnswer === option.id;
        const className = selected ? (option.id === letter.id ? "correct" : "wrong") : "";
        return `<button class="alphabet-quiz-option ${className}" type="button" role="radio" aria-checked="${selected}" data-session-action="answer-alphabet-quiz" data-letter-id="${option.id}" aria-label="选择字形 ${option.forms.medial}"><span class="arabic" lang="ar">${option.forms.medial}</span></button>`;
      }).join("")}</div>
      <div class="alphabet-quiz-feedback ${currentSession.quizCorrect ? "correct" : answered ? "wrong" : ""}" aria-live="polite">${currentSession.quizCorrect ? `正确：${letter.forms.medial} 是 ${letter.name} 的词中形。` : answered ? "这不是目标字母，请比较点位后再选一次。" : "请选择一个答案。"}</div>
      <button class="primary-button wide" type="button" data-session-action="next-alphabet-letter" ${currentSession.quizCorrect ? "" : "disabled"}>${currentSession.index + 1 === currentSession.items.length ? (currentSession.items.length === 1 ? "完成本次" : "完成本组") : "学习下一个字母"}</button>
      <button class="back-button alphabet-quiz-back" type="button" data-session-action="back-alphabet-listening">${icon("back")}${HAS_ALPHABET_AUDIO ? "返回听辨" : "返回字母学习"}</button>
    </div>`;
  }

  function waitForAlphabetAudioEnd(token) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        modelAudio.removeEventListener("ended", onEnded);
        modelAudio.removeEventListener("error", onError);
        modelAudio.removeEventListener("pause", onPause);
      };
      const onEnded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("alphabet-audio-error")); };
      const onPause = () => { if (token !== alphabetAudioPlayToken) { cleanup(); resolve(); } };
      modelAudio.addEventListener("ended", onEnded, { once: true });
      modelAudio.addEventListener("error", onError, { once: true });
      modelAudio.addEventListener("pause", onPause);
    });
  }

  function stopAlphabetAudio() {
    alphabetAudioPlayToken += 1;
    if (pronunciationPlayback.kind === "alphabet") modelAudio.pause();
    if (pronunciationPlayback.kind === "alphabet") pronunciationPlayback = { kind: "", audio: null };
  }

  async function playAlphabetTrack(letter, kind, repeats, completion) {
    const status = sessionContent.querySelector("[data-alphabet-audio-status]");
    stopWordAudio();
    stopAlphabetAudio();
    stopPronunciationPlayback();
    const token = ++alphabetAudioPlayToken;
    pronunciationPlayback = { kind: "alphabet", audio: modelAudio };
    currentSession.activeAudioKind = kind;
    sessionContent.querySelectorAll("[data-session-action='play-alphabet-unit']").forEach((button) => {
      button.classList.toggle("playing", button.dataset.letterId === letter.id && button.dataset.audioKind === kind);
    });
    try {
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        if (token !== alphabetAudioPlayToken) return;
        modelAudio.pause();
        if (modelAudio.getAttribute("src") !== letter.audio[kind]) modelAudio.src = letter.audio[kind];
        modelAudio.currentTime = 0;
        modelAudio.playbackRate = Number(state.settings.audioRate) || 0.85;
        if (status) status.textContent = `正在播放 ${alphabetAudioText(letter, kind)} · 第 ${repeat} / ${repeats} 遍`;
        await modelAudio.play();
        await waitForAlphabetAudioEnd(token);
        if (repeat < repeats) await new Promise((resolve) => setTimeout(resolve, 160));
      }
      if (token !== alphabetAudioPlayToken) return;
      currentSession.activeAudioKind = "";
      completion?.();
    } catch {
      currentSession.activeAudioKind = "";
      if (status) status.textContent = "发音播放失败 · 请重新安装完整 APP";
      toast("当前字母的离线发音无法播放，请重新安装完整 APP。");
    }
  }

  function playAlphabetUnit(letterId, kind) {
    const letter = alphabetLetterById.get(letterId);
    if (!letter?.audio?.[kind]) return;
    const currentLetter = currentSession.items[currentSession.index];
    const required = letter.id === currentLetter.id && ["name", "fatha", "kasra", "damma", "example"].includes(kind);
    playAlphabetTrack(letter, kind, required ? 3 : 1, () => {
      if (required && !currentSession.heardKinds.includes(kind)) {
        currentSession.heardKinds.push(kind);
        const previous = state.alphabetProgress[currentLetter.id] || {};
        state.alphabetProgress[currentLetter.id] = {
          ...previous,
          seen: true,
          listenedKinds: [...currentSession.heardKinds],
          updatedAt: new Date().toISOString(),
        };
        saveState(true);
      }
      renderAlphabetSession();
    });
  }

  function playAlphabetQuizAudio() {
    const letter = currentSession.items[currentSession.index];
    playAlphabetTrack(letter, currentSession.listeningQuizKind, 2, () => {
      currentSession.listeningQuizAudioPlayed = true;
      renderAlphabetListeningQuiz();
    });
  }

  function answerAlphabetListeningQuiz(kind) {
    if (!currentSession.listeningQuizAudioPlayed) return;
    const letter = currentSession.items[currentSession.index];
    const correct = kind === currentSession.listeningQuizKind;
    currentSession.listeningQuizAnswer = kind;
    currentSession.listeningQuizCorrect = correct;
    const previous = state.alphabetProgress[letter.id] || {};
    state.alphabetProgress[letter.id] = {
      ...previous,
      seen: true,
      listenedKinds: [...currentSession.heardKinds],
      soundAttempts: Number(previous.soundAttempts || 0) + 1,
      soundCorrect: Number(previous.soundCorrect || 0) + (correct ? 1 : 0),
      updatedAt: new Date().toISOString(),
    };
    saveState(true);
    renderAlphabetListeningQuiz();
  }

  function answerAlphabetQuiz(letterId) {
    const letter = currentSession.items[currentSession.index];
    const correct = letterId === letter.id;
    currentSession.quizAnswer = letterId;
    currentSession.quizCorrect = correct;
    const previous = state.alphabetProgress[letter.id] || {};
    state.alphabetProgress[letter.id] = {
      ...previous,
      seen: true,
      mastered: previous.mastered === true || (correct && (!HAS_ALPHABET_AUDIO || currentSession.listeningQuizCorrect)),
      attempts: Number(previous.attempts || 0) + 1,
      correct: Number(previous.correct || 0) + (correct ? 1 : 0),
      listenedKinds: [...currentSession.heardKinds],
      shapeAttempts: Number(previous.shapeAttempts || 0) + 1,
      shapeCorrect: Number(previous.shapeCorrect || 0) + (correct ? 1 : 0),
      updatedAt: new Date().toISOString(),
    };
    saveState(true);
    renderAlphabetQuiz();
  }

  function nextAlphabetLetter() {
    if (!currentSession.quizCorrect) return;
    currentSession.completed += 1;
    if (currentSession.index + 1 >= currentSession.items.length) {
      renderCompletion(currentSession.items.length === 1 ? "本次字母学习完成" : "本组字母完成", HAS_ALPHABET_AUDIO ? `已完成 ${currentSession.items.length} 个字母的逐音跟读、听辨与辨形练习。` : `已完成 ${currentSession.items.length} 个字母的发音部位学习与辨形练习。`);
      return;
    }
    currentSession.index += 1;
    resetAlphabetLetterSession();
    sessionLayer.scrollTop = 0;
    renderSession();
  }

  const WORD_AUDIO_LAYER_LABELS = {
    natural: "自然整词",
    slow: "慢速拆音",
    ending: "词尾强化",
    context: "古兰经语境",
  };

  function pronunciationFormsForWord(word) {
    return (wordPronunciationFormsByEntryId.get(word?.id) || []).map((form) => ({
      ...form,
      pronunciation: wordPronunciationById.get(form.pronunciationId),
    })).filter((form) => form.pronunciation);
  }

  function activePronunciationForm(word) {
    const forms = pronunciationFormsForWord(word);
    if (!forms.length) return null;
    const index = Math.max(0, Math.min(forms.length - 1, Number(currentSession?.pronunciationFormIndex) || 0));
    return forms[index];
  }

  function activeWordAudioLayer(word) {
    const pronunciation = activePronunciationForm(word)?.pronunciation;
    const requested = currentSession?.wordAudioLayer || "natural";
    if (!pronunciation) return "natural";
    if (WORD_AUDIO_LAYER_LABELS[requested] && pronunciation.layers?.[requested]?.available) return requested;
    return Object.keys(WORD_AUDIO_LAYER_LABELS).find((key) => pronunciation.layers?.[key]?.available) || "natural";
  }

  function isPronunciationLayerAvailable(pronunciation, layerKey) {
    return pronunciation ? Boolean(pronunciation.layers?.[layerKey]?.available) : layerKey === "natural";
  }

  function preferredAudioSource(primary, fallback) {
    const canPlayM4a = Boolean(modelAudio.canPlayType?.('audio/mp4; codecs="mp4a.40.2"'));
    if (canPlayM4a && primary) return { src: primary, fallbackSrc: fallback || "" };
    return { src: fallback || primary || "", fallbackSrc: primary && primary !== fallback ? primary : "" };
  }

  function wordAudioRate() {
    return Number(state.settings.audioRate) === 0.75 ? 0.75 : 1;
  }

  function pronunciationLayerTrack(word, pronunciation, layerKey, segmentIndex = -1) {
    if (!pronunciation) {
      const legacy = Array.isArray(word?.audioTracks) ? word.audioTracks[0] : null;
      return legacy ? {
        layerKey: "natural",
        label: "自然整词（原有音频）",
        text: legacy.spokenText || legacy.display || word.arabic,
        src: legacy.src,
        fallbackSrc: "",
        syllables: [],
        segmentTimings: [],
      } : null;
    }
    const layer = pronunciation.layers?.[layerKey];
    if (!layer || !layer.available) return null;
    if (layerKey === "context") {
      return {
        layerKey,
        label: layer.labelChinese || WORD_AUDIO_LAYER_LABELS.context,
        text: layer.phraseText,
        src: layer.src,
        fallbackSrc: "",
        syllables: [],
        segmentTimings: [],
      };
    }
    if (layerKey === "slow" && segmentIndex >= 0) {
      const segment = layer.segments?.[segmentIndex];
      if (!segment || !segment.available) return null;
      const source = preferredAudioSource(segment.m4a, segment.mp3);
      return {
        ...source,
        layerKey,
        label: `音节 ${segmentIndex + 1}`,
        text: segment.text,
        syllables: layer.syllables || [],
        segmentTimings: [],
        segmentIndex,
      };
    }
    if (layerKey === "ending" && segmentIndex >= 0) {
      const segment = layer.segments?.[segmentIndex];
      if (!segment || !segment.available) return null;
      const source = preferredAudioSource(segment.m4a, segment.mp3);
      return {
        ...source,
        layerKey,
        label: segment.labelChinese || `词尾步骤 ${segmentIndex + 1}`,
        text: segment.text,
        syllables: [],
        segmentTimings: [],
        segmentIndex,
      };
    }
    const source = preferredAudioSource(layer.m4a, layer.mp3);
    return {
      ...source,
      layerKey,
      label: WORD_AUDIO_LAYER_LABELS[layerKey],
      text: layer.text,
      syllables: layer.syllables || [],
      segmentTimings: layer.segmentTimings || [],
      segmentIndex: -1,
    };
  }

  function pronunciationEndingDrillTrack(pronunciation, drillIndex) {
    const drill = pronunciation?.layers?.ending?.letterDrills?.[drillIndex];
    if (!drill || !drill.available) return null;
    const source = preferredAudioSource(drill.m4a, drill.mp3);
    return {
      ...source,
      layerKey: "ending",
      label: "字母发音练习（非真实词尾）",
      text: drill.text,
      syllables: [],
      segmentTimings: [],
      segmentIndex: -1,
    };
  }

  function learnerPronunciationNote(value) {
    let note = String(value || "").trim();
    note = note
      .replace(/\s*GPT补入的连读格位词尾[^。！？]*[。！？]?/g, "")
      .replace(/按exactContext核正为[^；。]+[；。]?/g, "")
      .replace(/按所给来源(?:的主格词尾|词形)?核正(?:为)?/g, "")
      .replace(/无精确经文语境[；。]?/g, "")
      .replace(/录音仅使用可确定的停读形式/g, "按单独停读形式练习")
      .replace(/拒绝补格位、?تنوين或宾格支持ا，仅作中性停读/g, "按中性停读形式练习")
      .replace(/拒绝补格位或تنوين，仅作中性停读/g, "按中性停读形式练习")
      .replace(/保留输入重音符号/g, "保留词中重音符号")
      .replace(/[；。]\s*[；。]+/g, "；")
      .replace(/^[，；。\s]+|[，；\s]+$/g, "")
      .trim();
    if (note && !/[。！？]$/.test(note)) note += "。";
    return note || "按单独停读形式自然朗读，保留清楚的词尾辅音。";
  }

  function renderWordLayerTeaching(pronunciation, layerKey) {
    if (!pronunciation) {
      const word = currentSession?.items?.[currentSession.index];
      return `<div class="natural-word-panel">
        <span>单词范读</span>
        <strong class="arabic" lang="ar">${escapeHtml(word?.arabic || "")}</strong>
        <small>先听完整发音，再跟读并回忆词义。</small>
      </div>`;
    }
    const layer = pronunciation.layers?.[layerKey];
    if (layer && !layer.available) {
      return `<div class="layer-teaching-note">这项发音暂时不可播放，请先练习其他项目。</div>`;
    }
    if (layerKey === "natural") {
      return `<div class="natural-word-panel">
        <span>单独停读</span>
        <strong class="arabic" lang="ar">${escapeHtml(pronunciation.naturalWaqfText)}</strong>
        <small>${escapeHtml(learnerPronunciationNote(pronunciation.reviewNoteChinese))}</small>
      </div>`;
    }
    if (layerKey === "slow") {
      const syllables = pronunciation.layers.slow.syllables || [];
      return `<div class="slow-syllable-panel">
        <div class="slow-syllable-heading"><span>逐音听清</span><small>点击任一音节可单独播放</small></div>
        <div class="syllable-buttons" dir="rtl">${syllables.map((syllable, index) => `<button type="button" class="${currentSession.activeSyllableIndex === index ? "active" : ""}" data-session-action="play-word-syllable" data-syllable-index="${index}" lang="ar" ${pronunciation.layers.slow.segments?.[index]?.available ? "" : "disabled"}>${escapeHtml(syllable)}</button>`).join('<i aria-hidden="true">—</i>')}</div>
        <p class="layer-teaching-note">逐个点击音节，听清后再连读完整单词。</p>
      </div>`;
    }
    if (layerKey === "ending") {
      const ending = pronunciation.layers.ending;
      return `<div class="ending-teaching-grid">
        <div><span>真实停读词尾</span><strong class="arabic" lang="ar">${escapeHtml(pronunciation.naturalWaqfText)}</strong></div>
        <div><span>真实末音节</span><button type="button" class="ending-segment-button arabic" data-session-action="play-word-ending-segment" data-ending-segment-index="0" lang="ar" ${ending.segments?.[0]?.available ? "" : "disabled"}>${escapeHtml(ending.finalSyllableText)}</button></div>
        <div><span>末辅音</span><strong class="arabic" lang="ar">${escapeHtml(ending.finalConsonantText)}</strong><small>先听完整末音节，再留意最后一个辅音。</small></div>
        <div><span>经文连读</span><strong class="arabic" lang="ar">${escapeHtml(pronunciation.waslTargetText || "暂无示例")}</strong></div>
        <div class="ending-drills"><span>短元音练习</span><p dir="rtl">${ending.letterDrills.map((drill, index) => `<button type="button" class="ending-drill-button arabic" data-session-action="play-word-ending-drill" data-ending-drill-index="${index}" lang="ar" ${drill.available ? "" : "disabled"}>${escapeHtml(drill.text)}</button>`).join(" / ")}</p><small>练习同一字母搭配三种短元音的读法。</small></div>
      </div>`;
    }
    const context = pronunciation.layers.context;
    return `<div class="context-teaching-panel">
      <div class="context-reference"><span>${escapeHtml(context.labelChinese)}</span><b>${escapeHtml(context.verseKey)}</b></div>
      <div class="context-arabic arabic" lang="ar">${highlightArabic(context.verseText || context.phraseText, { arabic: context.targetText })}</div>
      ${context.warningChinese ? `<p class="context-warning">${escapeHtml(context.warningChinese)}</p>` : ""}
      <small>${escapeHtml(context.reciter)} · 完整经文诵读</small>
    </div>`;
  }

  function renderWordSession() {
    const word = currentSession.items[currentSession.index];
    const pronunciationForms = pronunciationFormsForWord(word);
    const activeForm = activePronunciationForm(word);
    const pronunciation = activeForm?.pronunciation || null;
    const layerKey = activeWordAudioLayer(word);
    const layerTrack = pronunciationLayerTrack(word, pronunciation, layerKey);
    const audioReady = Boolean(layerTrack?.src);
    const repeatCount = state.settings.wordAudioRepeats;
    const isDictation = currentSession.wordMode === "dictation";
    const dictationComplete = currentSession.dictationResult === "correct" || currentSession.revealed;
    const displayedArabic = pronunciation?.fullyVocalizedText || word.arabic;
    const audioLabel = pronunciation
      ? layerKey === "context"
        ? `${pronunciation.layers.context.labelChinese} · 完整经文诵读`
        : `${WORD_AUDIO_LAYER_LABELS[layerKey]}范读`
      : "单词范读";
    sessionTitle.textContent = isDictation ? "听写训练" : currentSession.mode === "review" ? "主动回忆" : "词汇学习";
    sessionFavorite.classList.toggle("favorite-mark", state.favorites.includes(word.id));
    sessionContent.innerHTML = `<div class="flashcard">
      <div class="flash-main"><div class="flash-main-inner">
        <div class="word-study-mode" role="group" aria-label="词汇学习方式">
          <button type="button" data-session-action="set-word-mode" data-mode="study" class="${isDictation ? "" : "active"}" aria-pressed="${!isDictation}">看词学习</button>
          ${audioReady ? `<button type="button" data-session-action="set-word-mode" data-mode="dictation" class="${isDictation ? "active" : ""}" aria-pressed="${isDictation}">听写输入</button>` : ""}
        </div>
        ${pronunciationForms.length > 1 ? `<div class="pronunciation-form-switcher" role="group" aria-label="选择本词条的发音词形"><span>本卡含 ${pronunciationForms.length} 个词形</span><div dir="rtl">${pronunciationForms.map((form, index) => `<button type="button" data-session-action="set-word-pronunciation-form" data-form-index="${index}" class="${index === currentSession.pronunciationFormIndex ? "active" : ""}" aria-pressed="${index === currentSession.pronunciationFormIndex}" lang="ar">${escapeHtml(form.displayText)}</button>`).join("")}</div></div>` : ""}
        ${isDictation
          ? `<div class="dictation-cue"><span>听写</span><strong>先听发音，不看答案</strong><small>元音符号可不输入，辅音字母必须写对</small></div>`
          : `<div class="flash-arabic arabic" lang="ar">${escapeHtml(displayedArabic)}</div>`}
        ${audioReady ? `<div class="word-audio-player four-layer-player">
          ${pronunciation ? `<div class="audio-layer-tabs" role="tablist" aria-label="四层发音">${Object.entries(WORD_AUDIO_LAYER_LABELS).map(([key, label]) => `<button type="button" role="tab" data-session-action="set-word-audio-layer" data-layer="${key}" class="${layerKey === key ? "active" : ""}" aria-selected="${layerKey === key}" ${isPronunciationLayerAvailable(pronunciation, key) ? "" : "disabled"}>${pronunciation.layers?.[key]?.labelChinese ? escapeHtml(pronunciation.layers[key].labelChinese) : label}</button>`).join("")}</div>` : ""}
          ${renderWordLayerTeaching(pronunciation, layerKey)}
          <div class="layer-play-actions">
            <button class="audio-circle${wordAudioPlaying ? " playing" : ""}" type="button" data-session-action="play-word-audio" aria-label="${wordAudioPlaying ? "停止当前发音" : `播放${audioLabel}`}" aria-pressed="${wordAudioPlaying}" ${audioReady ? "" : "disabled"}>${icon(wordAudioPlaying ? "pause" : "volume")}</button>
            <button type="button" class="layer-control-button" data-session-action="restart-word-audio" ${audioReady ? "" : "disabled"}>${icon("refresh")}<span>从头播放</span></button>
            <button type="button" class="layer-control-button" data-session-action="stop-word-audio" ${wordAudioPlaying ? "" : "disabled"}>${icon("pause")}<span>停止</span></button>
          </div>
          <div class="word-audio-label">${escapeHtml(audioReady ? audioLabel : "暂无可播放音频")}</div>
          <div class="word-audio-status" data-word-audio-status aria-live="polite">${audioReady ? (wordAudioPlaying ? "正在循环播放" : `点击播放 ${repeatCount} 遍`) : "当前发音暂时不可用"}</div>
          <div class="word-audio-controls">
            <label class="word-repeat-control"><span>循环</span><select data-session-setting="word-audio-repeats" aria-label="单词循环播放次数" ${wordAudioPlaying ? "disabled" : ""}>${Array.from({ length: 10 }, (_, index) => index + 1).map((count) => `<option value="${count}" ${repeatCount === count ? "selected" : ""}>${count} 遍</option>`).join("")}</select></label>
            <div class="word-speed-control" role="group" aria-label="单词播放速度"><span>速度</span>${[[0.75, "慢速"], [1, "正常"]].map(([speed, label]) => `<button type="button" data-session-action="set-word-audio-speed" data-speed="${speed}" class="${wordAudioRate() === speed ? "active" : ""}" aria-pressed="${wordAudioRate() === speed}">${label}</button>`).join("")}</div>
          </div>
        </div>` : ""}
        ${isDictation ? `<form class="dictation-form" data-dictation-form novalidate>
          <label for="dictationInput">听到什么，就输入什么</label>
          <input id="dictationInput" data-dictation-input type="text" dir="rtl" lang="ar" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100" value="${escapeHtml(currentSession.dictationInput)}" placeholder="اكتب الكلمة هنا" aria-describedby="dictationHelp dictationFeedback" ${dictationComplete ? "disabled" : ""}>
          <small id="dictationHelp">可反复播放并修改；核对前不会显示正确单词。</small>
          ${currentSession.dictationResult === "wrong" ? `<div id="dictationFeedback" class="dictation-feedback wrong" role="status">还不正确。再听一遍并修改，或查看答案。</div>` : ""}
          ${currentSession.dictationResult === "correct" ? `<div id="dictationFeedback" class="dictation-feedback correct" role="status">听写正确！现在把字形、词义和搭配连在一起记住。</div>` : ""}
          <div class="dictation-actions">
            ${dictationComplete ? "" : `<button class="primary-button" type="submit">核对听写</button>`}
            ${currentSession.dictationResult === "wrong" ? `<button class="secondary-button" type="button" data-session-action="reveal-dictation">显示正确答案</button>` : ""}
          </div>
        </form>` : `<p class="recall-prompt">先说出中文核心义和词性，再显示答案。</p>`}
      </div></div>
      ${currentSession.revealed ? `<div class="answer-panel">
        ${isDictation ? `<div class="dictation-result-badge ${currentSession.dictationResult === "correct" ? "correct" : "revealed"}">${currentSession.dictationResult === "correct" ? "听写正确" : "已查看答案"}</div><div class="dictation-answer arabic" lang="ar">${escapeHtml(displayedArabic)}</div>` : ""}
        <h2 class="answer-meaning">${escapeHtml(word.meaning)}</h2>
        <p class="answer-pos">${escapeHtml(word.pos)}${word.morphology ? ` · ${escapeHtml(word.morphology)}` : ""}</p>
        ${word.phrase ? `<div class="phrase-block"><span class="arabic" lang="ar">${escapeHtml(word.phrase)}</span><span>${escapeHtml(word.phraseHint || "读出搭配，再回到词义")}</span></div>` : ""}
        <div class="detail-lines">
          ${word.note ? `<p><b>易错边界：</b>${escapeHtml(word.note)}</p>` : ""}
          <p><b>课程位置：</b>第 ${word.unit} 课 · ${escapeHtml(lessonById.get(word.unit)?.title || "")}</p>
          <p><b>来源：</b>${escapeHtml(word.source)}</p>
        </div>
        <div class="rating-row">
          <button class="answer-button forgot" type="button" data-session-action="rate-word" data-rating="0">忘记<small>1 天后复习</small></button>
          <button class="answer-button fuzzy" type="button" data-session-action="rate-word" data-rating="1">模糊<small>3 天后复习</small></button>
          <button class="answer-button remember" type="button" data-session-action="rate-word" data-rating="2">记得<small>7–30 天后</small></button>
        </div>
      </div>` : isDictation ? "" : `<button class="primary-button reveal-button" type="button" data-session-action="reveal-word">显示答案</button>`}
    </div>`;
    queueMicrotask(() => primeWordAudio(word));
  }

  function normalizedDictationArabic(value) {
    return String(value || "").normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
      .replace(/ٱ/g, "ا")
      .replace(/[^\u0621-\u063A\u0641-\u064A]/g, "");
  }

  function resetDictationEntry() {
    currentSession.dictationInput = "";
    currentSession.dictationResult = null;
    currentSession.dictationAttempts = 0;
  }

  function setWordMode(mode) {
    if (!currentSession || currentSession.type !== "words" || !["study", "dictation"].includes(mode)) return;
    stopWordAudio();
    currentSession.wordMode = mode;
    currentSession.revealed = false;
    resetDictationEntry();
    renderSession();
    if (mode === "dictation") requestAnimationFrame(() => sessionContent.querySelector("[data-dictation-input]")?.focus());
  }

  function recordDictationAttempt(word, correct) {
    const previous = state.wordProgress[word.id] || { history: [], successStreak: 0 };
    state.wordProgress[word.id] = {
      ...previous,
      dictationAttempts: Number(previous.dictationAttempts || 0) + 1,
      dictationCorrect: Number(previous.dictationCorrect || 0) + (correct ? 1 : 0),
      lastDictationCorrect: correct,
      dictationHistory: [...(previous.dictationHistory || []), { day: state.currentDay, correct, at: new Date().toISOString() }].slice(-50),
    };
    saveState(true);
  }

  function checkDictation() {
    if (!currentSession || currentSession.type !== "words" || currentSession.wordMode !== "dictation" || currentSession.revealed) return;
    const word = currentSession.items[currentSession.index];
    const input = sessionContent.querySelector("[data-dictation-input]");
    const answer = String(input?.value || currentSession.dictationInput || "").trim();
    if (!normalizedDictationArabic(answer)) return toast("请先输入听到的阿拉伯语单词。");
    currentSession.dictationInput = answer;
    currentSession.dictationAttempts += 1;
    const correct = normalizedDictationArabic(answer) === normalizedDictationArabic(word.arabic);
    currentSession.dictationResult = correct ? "correct" : "wrong";
    recordDictationAttempt(word, correct);
    if (correct) currentSession.revealed = true;
    renderSession();
    if (!correct) requestAnimationFrame(() => {
      const nextInput = sessionContent.querySelector("[data-dictation-input]");
      nextInput?.focus();
      nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
    });
  }

  function revealDictationAnswer() {
    if (!currentSession || currentSession.type !== "words" || currentSession.wordMode !== "dictation") return;
    currentSession.dictationResult = currentSession.dictationResult === "correct" ? "correct" : "revealed";
    currentSession.revealed = true;
    renderSession();
  }

  function normalizedArabic(value) {
    return String(value || "").normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
      .replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[^\u0621-\u063A\u0641-\u064A]/g, "");
  }

  function highlightArabic(verse, target) {
    if (!target) return escapeHtml(verse);
    const key = normalizedArabic(target.arabic);
    return String(verse).split(/(\s+)/).map((token) => {
      const normalized = normalizedArabic(token);
      const matched = normalized === key || (key.length > 2 && ["و", "ف", "ب", "ك", "ل"].some((prefix) => normalized === `${prefix}${key}`));
      return matched ? `<mark>${escapeHtml(token)}</mark>` : escapeHtml(token);
    }).join("");
  }

  function verseOptions(verse, target) {
    if (!target) return [];
    const lesson = lessonById.get(verse.unit);
    const alternatives = lesson.words.filter((word) => word.id !== target.id && word.meaning !== target.meaning);
    const start = (currentSession.index * 3) % Math.max(1, alternatives.length);
    const selected = [target, ...Array.from({ length: Math.min(3, alternatives.length) }, (_, offset) => alternatives[(start + offset) % alternatives.length])];
    return [...new Map(selected.map((word) => [word.id, word])).values()].sort((a, b) => (a.id.charCodeAt(a.id.length - 1) + currentSession.index * 7) % 5 - (b.id.charCodeAt(b.id.length - 1) + currentSession.index * 7) % 5);
  }

  function renderVerseSession() {
    const verse = currentSession.items[currentSession.index];
    const target = verse.targetEntryId ? wordById.get(verse.targetEntryId) : null;
    const answered = currentSession.answered[verse.id];
    const options = verseOptions(verse, target);
    sessionTitle.textContent = "经文实战";
    sessionContent.innerHTML = `<div class="verse-card">
      <div class="verse-reference"><span>经文 ${escapeHtml(verse.reference)}</span><span>第 ${verse.unit} 课</span></div>
      <div class="verse-arabic arabic" lang="ar">${highlightArabic(verse.arabic, target)}</div>
      ${target ? `<p class="question-label">绿色标出的词，核心义是什么？</p>
        <div class="choice-list">${options.map((word) => {
          const selected = answered?.choice === word.id;
          const className = answered ? (word.id === target.id ? "correct" : selected ? "wrong" : "") : "";
          return `<button class="choice-button ${className}" type="button" data-session-action="answer-verse" data-choice="${word.id}" ${answered ? "disabled" : ""}>${escapeHtml(word.meaning)}</button>`;
        }).join("")}</div>` : `<p class="question-label">先找出一个本课熟悉词，再显示完整中文。</p>
        ${!answered ? `<button class="primary-button reveal-button" type="button" data-session-action="reveal-verse">显示中文译文</button>` : ""}`}
      ${answered ? `<div class="translation-panel"><p>${escapeHtml(verse.translation)}</p>${verse.footnote ? `<small>${escapeHtml(verse.footnote)}</small>` : ""}</div>
        <button class="primary-button session-next" type="button" data-session-action="next-verse">${currentSession.index + 1 === currentSession.items.length ? "完成经文实战" : "下一条经文"}</button>` : ""}
    </div>`;
  }

  const SCORE_RUBRICS = {
    "发音准确": "字母身份与发音部位",
    "音长节奏": "短长音、叠音与拍数",
    "有无加音": "静音与停读无额外元音",
    "整体自然": "连贯、稳定、不抢拍",
  };

  function formatAudioTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
  }

  function pronunciationAllScored() {
    return DIMENSIONS.every((dimension) => Number.isInteger(currentSession.scores[dimension]));
  }

  function pronunciationRequirements() {
    const missing = [];
    if (!currentSession.takeA || currentSession.durationA < MIN_RECORDING_DURATION_MS) missing.push("录制 A（至少 1 秒）");
    if (!currentSession.modelPlayed) missing.push("听标准音");
    if (!currentSession.replayed.A) missing.push("回听 A");
    if (!currentSession.selectedIssue) missing.push("选择改进重点");
    if (!currentSession.takeB || currentSession.durationB < MIN_RECORDING_DURATION_MS) missing.push("录制 B（至少 1 秒）");
    if (!currentSession.replayed.B) missing.push("回听 B");
    if (!Number.isInteger(currentSession.comparisonResult)) missing.push("判断 B 的改善");
    if (!pronunciationAllScored()) missing.push("完成四维自评");
    return missing;
  }

  function pronunciationStep() {
    if (mediaRecorder?.state === "recording") return `正在录制 ${currentSession.activeRecordingTake}`;
    if (!currentSession.takeA) return "第 1 步：不听标准音，先独立录制 A";
    if (!currentSession.modelPlayed) return "第 2 步：播放并仔细听标准音";
    if (!currentSession.replayed.A) return "第 3 步：回听 A，找出最大差异";
    if (!currentSession.selectedIssue) return "第 4 步：只选择一个本轮改进重点";
    if (!currentSession.takeB) return "第 5 步：带着改进重点录制 B";
    if (!currentSession.replayed.B) return "第 6 步：回听 B，并与 A 对照";
    if (!Number.isInteger(currentSession.comparisonResult)) return "第 7 步：判断 B 是否真的改善";
    if (!pronunciationAllScored()) return "第 8 步：按明确标准完成四维自评";
    return "本项练习已完成，可以保存";
  }

  function pronunciationLane(label, kind, available, duration, lockedText) {
    const playing = pronunciationPlayback.kind === kind && !pronunciationPlayback.audio?.paused;
    const take = kind === "takeA" ? "A" : kind === "takeB" ? "B" : "";
    const action = kind === "model" ? "play-model" : "play-take";
    const buttonLabel = kind === "model" ? `${playing ? "暂停" : "播放"}离线标准范读` : `${playing ? "暂停" : "播放"}录音 ${take}`;
    return `<div class="audio-lane" data-audio-kind="${kind}">
      <div class="lane-label"><strong>${label}</strong>${take ? `<small>${take === "A" ? "第一次录音" : "改进后"}</small>` : `<small>可离线播放</small>`}</div>
      <button class="round-play ${playing ? "playing" : ""}" type="button" data-session-action="${action}" ${take ? `data-take="${take}"` : ""} aria-label="${buttonLabel}" aria-pressed="${playing}" ${available ? "" : "disabled"}>${icon(playing ? "pause" : "play")}</button>
      <div class="playback"><span class="playback-track"><i></i></span><span class="playback-status">${available ? (kind === "model" ? "点击播放" : "可以回听") : escapeHtml(lockedText)}</span></div>
      <span class="lane-time">${available && duration ? formatAudioTime(duration / 1000) : "—"}</span>
      ${take && available ? `<button class="lane-rerecord" type="button" data-session-action="record-take" data-take="${take}" aria-label="重新录制 ${take}">重录</button>` : ""}
    </div>`;
  }

  function renderPronunciationSession() {
    const task = resolvedPronunciationTask(currentSession.items[currentSession.index]);
    const arabicTarget = pronunciationArabicTarget(task);
    const taskTitle = `任务 ${currentSession.index + 1} · ${pronunciationTag(task)}`;
    const canRecordB = currentSession.modelPlayed && currentSession.replayed.A && currentSession.selectedIssue;
    const nextTake = currentSession.takeA ? "B" : "A";
    const recording = mediaRecorder?.state === "recording";
    const canUseRecord = recording || nextTake === "A" || canRecordB;
    const missing = pronunciationRequirements();
    const steps = [
      ["A", Boolean(currentSession.takeA)], ["标准", currentSession.modelPlayed],
      ["重点", Boolean(currentSession.selectedIssue)], ["B", Boolean(currentSession.takeB)],
      ["自评", !missing.length],
    ];
    sessionTitle.textContent = `发音训练 · 第 ${currentSession.day.id} 天`;
    sessionContent.innerHTML = `<div class="pron-card">
      <div class="pron-task-title">${escapeHtml(taskTitle)}</div>
      <div class="pron-target arabic ${arabicTarget.length > 28 ? "long-target" : ""}" lang="ar">${escapeHtml(arabicTarget)}</div>
      <div class="pron-source">${escapeHtml(task.resolvedSource || task.source)} · ${escapeHtml(pronunciationTag(task))}</div>
      <section class="pron-step-card" aria-live="polite"><span>当前任务</span><strong>${escapeHtml(pronunciationStep())}</strong><div class="pron-step-rail">${steps.map(([label, done], index) => `<span class="${done ? "done" : ""}"><i>${done ? icon("check") : index + 1}</i>${label}</span>`).join("")}</div></section>
      <div class="audio-stack">
        ${pronunciationLane("录音 A", "takeA", Boolean(currentSession.takeA), currentSession.durationA, "先完成盲录")}
        ${pronunciationLane("标准范读", "model", Boolean(currentSession.takeA), 0, "录完 A 后解锁")}
        ${pronunciationLane("录音 B", "takeB", Boolean(currentSession.takeB), currentSession.durationB, "选定重点后录制")}
      </div>
      <div class="speed-control" role="group" aria-label="范读速度">${[0.75, 0.85, 1].map((speed) => `<button class="${Number(state.settings.audioRate) === speed ? "active" : ""}" type="button" data-session-action="set-speed" data-speed="${speed}" aria-pressed="${Number(state.settings.audioRate) === speed}">${speed}×</button>`).join("")}</div>
      <div class="record-zone"><button class="record-button ${recording ? "recording" : ""}" type="button" data-session-action="toggle-record" data-take="${nextTake}" aria-label="${recording ? `停止录音 ${currentSession.activeRecordingTake}` : `${currentSession.takeA ? (currentSession.takeB ? "重新录制" : "开始录制") : "开始录制"} ${nextTake}`}" ${canUseRecord ? "" : "disabled"}>${icon("mic")}</button><p>${recording ? `正在录制 ${currentSession.activeRecordingTake}，点击停止` : canUseRecord ? `${currentSession.takeB ? "重新" : ""}录制 ${nextTake}` : `先完成：${pronunciationRequirements().slice(0, 3).join("、")}`}</p></div>
      <section class="issue-picker"><h2>本轮只改进一个问题</h2><p>听完 A 和标准音后，选差异最大的一项。</p><div role="radiogroup" aria-label="本轮改进重点">${task.cues.map((cue) => `<button class="issue-option ${currentSession.selectedIssue === cue ? "active" : ""}" type="button" role="radio" aria-checked="${currentSession.selectedIssue === cue}" data-session-action="select-pron-issue" data-issue="${escapeHtml(cue)}" ${currentSession.replayed.A ? "" : "disabled"}>${escapeHtml(cue)}</button>`).join("")}</div></section>
      ${currentSession.takeB ? `<section class="comparison"><h2>A/B 对比结果</h2><p>先分别回听 A 和 B，再判断本轮是否有改善。</p><div role="radiogroup" aria-label="录音 B 相比 A 的改善程度">${[0, 1, 2].map((score) => `<button class="comparison-option ${currentSession.comparisonResult === score ? "active" : ""}" type="button" role="radio" aria-checked="${currentSession.comparisonResult === score}" data-session-action="compare-pron" data-score="${score}" ${currentSession.replayed.A && currentSession.replayed.B ? "" : "disabled"}>${["没有改善", "略有改善", "明显改善"][score]}</button>`).join("")}</div></section>` : ""}
      ${currentSession.records.length ? `<div class="ab-row"><span>以前保存</span>${currentSession.records.slice(0, 4).map((record) => `<button class="ab-button" type="button" data-session-action="play-history" data-record-id="${record.id}" aria-label="播放以前保存的录音 ${record.take || ""}">${record.take || "录音"} · ${new Date(record.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</button>`).join("")}</div>` : ""}
      <div class="self-check"><h2>四维自评</h2><p>0 = 需要改进，1 = 可接受，2 = 稳定。</p>${DIMENSIONS.map((dimension) => `<div class="score-row" role="radiogroup" aria-label="${dimension}评分"><span><b>${dimension}</b><small>${SCORE_RUBRICS[dimension]}</small></span>${[0, 1, 2].map((score) => `<button class="score-option ${currentSession.scores[dimension] === score ? "active" : ""}" type="button" role="radio" aria-checked="${currentSession.scores[dimension] === score}" aria-label="${dimension}：${["需要改进", "可接受", "稳定"][score]}" data-session-action="score-pron" data-dimension="${dimension}" data-score="${score}" ${currentSession.takeB && Number.isInteger(currentSession.comparisonResult) ? "" : "disabled"}>${["需要改进", "可接受", "稳定"][score]}</button>`).join("")}</div>`).join("")}</div>
      <div class="save-readiness ${missing.length ? "" : "ready"}" aria-live="polite">${missing.length ? `还需完成：${missing.join("、")}` : "A/B 录音与自评已完成"}</div>
      <button class="primary-button wide" type="button" data-session-action="save-pron" ${missing.length ? "disabled" : ""}>${currentSession.index + 1 === currentSession.items.length ? "保存并完成本日" : "保存并进入下一项"}</button>
    </div>`;
    updatePronunciationPlaybackUi();
  }

  function renderCompletion(title, message) {
    sessionFavorite.hidden = true;
    sessionTitle.textContent = "本次完成";
    sessionCount.textContent = "";
    sessionProgress.style.width = "100%";
    const returnLabel = currentSession?.type === "alphabet" ? "返回字母课程" : "返回今日学习";
    sessionContent.innerHTML = `<div class="completion"><div><div class="completion-mark">${icon("check")}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><button class="primary-button wide" type="button" data-session-action="close-session">${returnLabel}</button></div></div>`;
  }

  function completeSessionStep(title, message) {
    if (currentSession?.stepKey) dayRecord()[currentSession.stepKey] = true;
    saveState(true);
    renderCompletion(title, message);
  }

  function rateWord(rating) {
    stopWordAudio();
    const word = currentSession.items[currentSession.index];
    const previous = state.wordProgress[word.id] || { history: [], successStreak: 0 };
    const successStreak = rating === 2 ? Number(previous.successStreak || 0) + 1 : 0;
    const interval = rating === 0 ? 1 : rating === 1 ? 3 : REVIEW_INTERVALS[Math.min(4, successStreak + 1)] || 7;
    state.wordProgress[word.id] = {
      ...previous,
      seen: true,
      lastDay: state.currentDay,
      dueDay: Math.min(REVIEW_DAY_LIMIT, state.currentDay + interval),
      lastRating: rating,
      successStreak,
      history: [...(previous.history || []), { day: state.currentDay, rating, at: new Date().toISOString() }].slice(-20),
    };
    saveState(true);
    currentSession.completed += 1;
    if (currentSession.index + 1 >= currentSession.items.length) {
      completeSessionStep(currentSession.mode === "review" ? "复习完成" : "新词完成", `已完成 ${currentSession.items.length} 个词的主动回忆。`);
      return;
    }
    currentSession.index += 1;
    currentSession.revealed = false;
    currentSession.pronunciationFormIndex = 0;
    currentSession.wordAudioLayer = "natural";
    currentSession.activeSyllableIndex = -1;
    resetDictationEntry();
    renderSession();
  }

  function sameAudioSource(source) {
    if (!source) return false;
    const expected = new URL(source, document.baseURI).href;
    return (modelAudio.currentSrc || modelAudio.src) === expected;
  }

  function updateWordAudioUi(status = "") {
    if (!currentSession || currentSession.type !== "words") return;
    const button = sessionContent.querySelector('[data-session-action="play-word-audio"]');
    const stopButton = sessionContent.querySelector('[data-session-action="stop-word-audio"]');
    const statusNode = sessionContent.querySelector("[data-word-audio-status]");
    const repeatSelect = sessionContent.querySelector('[data-session-setting="word-audio-repeats"]');
    if (button) {
      button.classList.toggle("playing", wordAudioPlaying);
      button.setAttribute("aria-pressed", String(wordAudioPlaying));
      button.setAttribute("aria-label", wordAudioPlaying ? "停止当前发音" : "播放当前发音");
      button.innerHTML = icon(wordAudioPlaying ? "pause" : "volume");
    }
    if (stopButton) stopButton.disabled = !wordAudioPlaying;
    if (repeatSelect) repeatSelect.disabled = wordAudioPlaying;
    if (statusNode && status) statusNode.textContent = status;
  }

  function warmWordAudioSource(source) {
    if (!source) return;
    const absolute = new URL(source, document.baseURI).href;
    if (warmedWordAudio.has(absolute)) return;
    warmedWordAudio.add(absolute);
    fetch(source, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error("audio-warm-failed");
      return response.arrayBuffer();
    }).catch(() => warmedWordAudio.delete(absolute));
  }

  function warmPronunciationAudio(pronunciation) {
    if (!pronunciation) return;
    for (const key of ["natural", "slow", "ending"]) {
      const layer = pronunciation.layers?.[key];
      warmWordAudioSource(layer?.m4a);
      warmWordAudioSource(layer?.mp3);
      if (key === "slow" || key === "ending") {
        for (const segment of layer?.segments || []) {
          warmWordAudioSource(segment.m4a);
          warmWordAudioSource(segment.mp3);
        }
      }
    }
    warmWordAudioSource(pronunciation.layers?.context?.src);
  }

  function primeWordAudio(word) {
    if (!currentSession || currentSession.type !== "words" || currentSession.items[currentSession.index]?.id !== word.id) return;
    const pronunciation = activePronunciationForm(word)?.pronunciation || null;
    const track = pronunciationLayerTrack(word, pronunciation, activeWordAudioLayer(word));
    if (!track?.src) return;
    if (wordAudioPlaying) {
      const progress = wordAudioProgress;
      updateWordAudioUi(progress ? `正在播放 ${progress.label} · 第 ${progress.repeat}/${progress.repeats} 遍` : "正在循环播放");
      return;
    }
    const token = ++wordAudioPrimeToken;
    if (!sameAudioSource(track.src)) {
      modelAudio.pause();
      modelAudio.src = track.src;
      modelAudio.load();
    } else if (modelAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      try { modelAudio.currentTime = 0; } catch {}
    }
    modelAudio.playbackRate = wordAudioRate();
    const readyMessage = `音频已就绪 · 点击后播放 ${state.settings.wordAudioRepeats} 遍`;
    if (modelAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) updateWordAudioUi(readyMessage);
    else {
      updateWordAudioUi("正在准备音频…");
      const onReady = () => {
        if (token === wordAudioPrimeToken && !wordAudioPlaying && currentSession?.items?.[currentSession.index]?.id === word.id) updateWordAudioUi(readyMessage);
      };
      const onError = () => {
        if (token === wordAudioPrimeToken && !wordAudioPlaying && currentSession?.items?.[currentSession.index]?.id === word.id) updateWordAudioUi("音频准备失败 · 点击可重试");
      };
      modelAudio.addEventListener("canplay", onReady, { once: true });
      modelAudio.addEventListener("error", onError, { once: true });
    }
    warmPronunciationAudio(pronunciation);
    const nextWord = currentSession.items[currentSession.index + 1];
    const nextPronunciation = activePronunciationForm(nextWord)?.pronunciation || null;
    if (nextPronunciation) warmPronunciationAudio(nextPronunciation);
    else {
      const nextTrack = Array.isArray(nextWord?.audioTracks) ? nextWord.audioTracks[0] : null;
      if (nextTrack) warmWordAudioSource(nextTrack.src);
    }
  }

  function stopWordAudio(status = "已停止播放") {
    wordAudioPlayToken += 1;
    wordAudioPrimeToken += 1;
    pronunciationModelPlayToken += 1;
    wordAudioPlaying = false;
    wordAudioProgress = null;
    if (currentSession?.type === "words") currentSession.activeSyllableIndex = -1;
    modelAudio.pause();
    try { modelAudio.currentTime = 0; } catch {}
    updateWordSyllableUi(-1);
    updateWordAudioUi(status);
  }

  function updateWordSyllableUi(index) {
    if (currentSession?.type === "words") currentSession.activeSyllableIndex = index;
    sessionContent.querySelectorAll("[data-syllable-index]").forEach((button) => {
      const active = Number(button.dataset.syllableIndex) === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function updateSlowSyllableFromPlayback() {
    const progress = wordAudioProgress;
    if (!wordAudioPlaying || progress?.layerKey !== "slow") return;
    if (Number.isInteger(progress.segmentIndex) && progress.segmentIndex >= 0) {
      updateWordSyllableUi(progress.segmentIndex);
      return;
    }
    const syllables = progress.syllables || [];
    if (!syllables.length || !Number.isFinite(modelAudio.duration) || modelAudio.duration <= 0) return;
    const timings = progress.segmentTimings || [];
    let activeIndex = -1;
    if (timings.length === syllables.length) {
      const current = modelAudio.currentTime;
      const startOf = (timing) => Number(timing.startSeconds ?? timing.start);
      const endOf = (timing) => Number(timing.endSeconds ?? timing.end);
      const matched = timings.find((timing) => current >= startOf(timing) && current <= endOf(timing));
      activeIndex = matched ? Number(matched.index) : current < startOf(timings[0]) ? 0 : syllables.length - 1;
    } else {
      activeIndex = Math.min(syllables.length - 1, Math.floor((modelAudio.currentTime / modelAudio.duration) * syllables.length));
    }
    if (activeIndex !== currentSession.activeSyllableIndex) updateWordSyllableUi(activeIndex);
  }

  modelAudio.addEventListener("timeupdate", updateSlowSyllableFromPlayback);

  function waitForAudioEnd(token) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        modelAudio.removeEventListener("ended", onEnded);
        modelAudio.removeEventListener("error", onError);
        modelAudio.removeEventListener("pause", onPause);
      };
      const onEnded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("audio-error")); };
      const onPause = () => {
        if (token !== wordAudioPlayToken) { cleanup(); resolve(); }
      };
      modelAudio.addEventListener("ended", onEnded, { once: true });
      modelAudio.addEventListener("error", onError, { once: true });
      modelAudio.addEventListener("pause", onPause);
    });
  }

  function waitForWordAudioGap(token, milliseconds = 220) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(token === wordAudioPlayToken), milliseconds);
    });
  }

  async function playWordTrackOnce(track, token) {
    const sources = [...new Set([track.src, track.fallbackSrc].filter(Boolean))];
    let lastError = null;
    for (const source of sources) {
      if (token !== wordAudioPlayToken) return;
      try {
        if (!sameAudioSource(source)) {
          modelAudio.pause();
          modelAudio.src = source;
          modelAudio.load();
        } else {
          try { modelAudio.currentTime = 0; } catch {}
        }
        modelAudio.playbackRate = wordAudioRate();
        await modelAudio.play();
        await waitForAudioEnd(token);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("audio-source-unavailable");
  }

  async function playWordAudio(button, overrideTrack = null) {
    if (wordAudioPlaying) {
      stopWordAudio();
      return;
    }
    const word = currentSession?.items?.[currentSession.index];
    const pronunciation = activePronunciationForm(word)?.pronunciation || null;
    const layerKey = activeWordAudioLayer(word);
    const track = overrideTrack || pronunciationLayerTrack(word, pronunciation, layerKey);
    if (!track?.src) return toast("这项发音暂时不可播放，请稍后重试。");
    const repeatCount = state.settings.wordAudioRepeats;
    const token = ++wordAudioPlayToken;
    wordAudioPrimeToken += 1;
    wordAudioPlaying = true;
    let finalStatus = "";
    updateWordAudioUi(`准备播放 ${track.label} · 共 ${repeatCount} 遍`);
    try {
      for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
        if (token !== wordAudioPlayToken) return;
        wordAudioProgress = {
          repeat: repeatIndex,
          repeats: repeatCount,
          label: track.label,
          layerKey: track.layerKey,
          segmentIndex: Number.isInteger(track.segmentIndex) ? track.segmentIndex : -1,
          syllables: track.syllables || [],
          segmentTimings: track.segmentTimings || [],
        };
        if (track.layerKey === "slow" && track.segmentIndex >= 0) updateWordSyllableUi(track.segmentIndex);
        updateWordAudioUi(`正在播放 ${track.label} · 第 ${repeatIndex}/${repeatCount} 遍 · ${track.text}`);
        await playWordTrackOnce(track, token);
        if (repeatIndex < repeatCount) await waitForWordAudioGap(token);
      }
      finalStatus = `播放完成 · ${track.label}已循环 ${repeatCount} 遍`;
    } catch {
      finalStatus = "音频播放失败 · 请点击重试";
      toast("发音暂时无法播放，请稍后重试。");
    } finally {
      if (token === wordAudioPlayToken) {
        wordAudioPlaying = false;
        wordAudioProgress = null;
        updateWordSyllableUi(-1);
        updateWordAudioUi(finalStatus || `音频已就绪 · 点击后播放 ${repeatCount} 遍`);
      }
    }
  }

  function setWordPronunciationForm(index) {
    if (currentSession?.type !== "words") return;
    const word = currentSession.items[currentSession.index];
    const forms = pronunciationFormsForWord(word);
    if (!forms[index]) return;
    stopWordAudio("");
    currentSession.pronunciationFormIndex = index;
    currentSession.wordAudioLayer = "natural";
    currentSession.activeSyllableIndex = -1;
    renderSession();
  }

  function setWordAudioLayer(layerKey) {
    if (currentSession?.type !== "words" || !WORD_AUDIO_LAYER_LABELS[layerKey]) return;
    const word = currentSession.items[currentSession.index];
    const pronunciation = activePronunciationForm(word)?.pronunciation;
    if (!pronunciation && layerKey !== "natural") return;
    if (pronunciation && !pronunciation.layers?.[layerKey]?.available) return toast("这项发音暂时不可播放，请先练习其他项目。");
    stopWordAudio("");
    currentSession.wordAudioLayer = layerKey;
    currentSession.activeSyllableIndex = -1;
    renderSession();
  }

  async function restartWordAudio() {
    stopWordAudio("正在从头播放…");
    await playWordAudio(null);
  }

  async function playWordSyllable(index) {
    if (currentSession?.type !== "words") return;
    const word = currentSession.items[currentSession.index];
    const pronunciation = activePronunciationForm(word)?.pronunciation;
    const track = pronunciationLayerTrack(word, pronunciation, "slow", index);
    if (!track?.src) return toast("这个音节暂时不可播放。");
    stopWordAudio("");
    currentSession.wordAudioLayer = "slow";
    updateWordSyllableUi(index);
    await playWordAudio(null, track);
  }

  async function playWordEndingSegment(index) {
    if (currentSession?.type !== "words") return;
    const word = currentSession.items[currentSession.index];
    const pronunciation = activePronunciationForm(word)?.pronunciation;
    const track = pronunciationLayerTrack(word, pronunciation, "ending", index);
    if (!track?.src) return toast("这个词尾练习暂时不可播放。");
    stopWordAudio("");
    currentSession.wordAudioLayer = "ending";
    await playWordAudio(null, track);
  }

  async function playWordEndingDrill(index) {
    if (currentSession?.type !== "words") return;
    const word = currentSession.items[currentSession.index];
    const pronunciation = activePronunciationForm(word)?.pronunciation;
    const track = pronunciationEndingDrillTrack(pronunciation, index);
    if (!track?.src) return toast("这个字母发音练习暂时不可播放。");
    stopWordAudio("");
    currentSession.wordAudioLayer = "ending";
    await playWordAudio(null, track);
  }

  async function playModel() {
    const task = resolvedPronunciationTask(currentSession.items[currentSession.index]);
    if (!currentSession.takeA) return toast("请先完成盲录 A，再听标准音。");
    if (pronunciationPlayback.kind === "model" && !modelAudio.paused) {
      pronunciationModelPlayToken += 1;
      modelAudio.pause();
      return;
    }
    const clips = task.audioSequence?.length ? task.audioSequence : [task.audio];
    if (!clips.length) return toast("当前任务没有可用的离线标准范读。");
    try {
      stopWordAudio();
      const activeToken = ++pronunciationModelPlayToken;
      const playbackSession = currentSession;
      recordingAudio.pause();
      modelAudio.pause();
      for (const [clipIndex, clip] of clips.entries()) {
        if (activeToken !== pronunciationModelPlayToken) return;
        modelAudio.pause();
        modelAudio.src = clip;
        modelAudio.playbackRate = Number(state.settings.audioRate) || 0.85;
        pronunciationPlayback = { kind: "model", audio: modelAudio, clipIndex: clipIndex + 1, clipCount: clips.length };
        await modelAudio.play();
        renderSession();
        await waitForPronunciationModelEnd(activeToken);
      }
      if (activeToken === pronunciationModelPlayToken && currentSession === playbackSession) {
        playbackSession.modelPlayed = true;
        renderSession();
      }
    } catch {
      toast("内置范读文件无法播放，请重新解压完整 APP 后重试。");
    }
  }

  function waitForPronunciationModelEnd(token) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        modelAudio.removeEventListener("ended", onEnded);
        modelAudio.removeEventListener("error", onError);
        modelAudio.removeEventListener("pause", onPause);
      };
      const onEnded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("audio-error")); };
      const onPause = () => {
        if (token !== pronunciationModelPlayToken) { cleanup(); resolve(); }
      };
      modelAudio.addEventListener("ended", onEnded, { once: true });
      modelAudio.addEventListener("error", onError, { once: true });
      modelAudio.addEventListener("pause", onPause);
    });
  }

  function stopPronunciationPlayback() {
    pronunciationModelPlayToken += 1;
    pronunciationRecordingPlayToken += 1;
    modelAudio.pause();
    recordingAudio.pause();
    recordingAudio.onended = null;
    pronunciationPlayback = { kind: "", audio: null };
    updatePronunciationPlaybackUi();
  }

  function updatePronunciationPlaybackUi() {
    if (!currentSession || currentSession.type !== "pronunciation") return;
    sessionContent.querySelectorAll("[data-audio-kind]").forEach((lane) => {
      const kind = lane.dataset.audioKind;
      const active = pronunciationPlayback.kind === kind && pronunciationPlayback.audio;
      const audio = active ? pronunciationPlayback.audio : null;
      const playing = Boolean(audio && !audio.paused && !audio.ended);
      const button = lane.querySelector(".round-play");
      const fill = lane.querySelector(".playback-track i");
      const status = lane.querySelector(".playback-status");
      const time = lane.querySelector(".lane-time");
      if (button) {
        button.classList.toggle("playing", playing);
        button.setAttribute("aria-pressed", String(playing));
        button.innerHTML = icon(playing ? "pause" : "play");
      }
      if (fill) fill.style.width = audio?.duration ? `${Math.min(100, (audio.currentTime / audio.duration) * 100)}%` : "0%";
      if (status && active) {
        const clipStatus = pronunciationPlayback.clipCount > 1 ? ` ${pronunciationPlayback.clipIndex}/${pronunciationPlayback.clipCount}` : "";
        status.textContent = playing ? `正在播放${clipStatus}` : audio?.ended && pronunciationPlayback.clipIndex === pronunciationPlayback.clipCount ? "播放完成" : `已暂停${clipStatus}`;
      }
      if (time && active && Number.isFinite(audio.duration)) time.textContent = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    });
  }

  async function toggleRecording(requestedTake = "") {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    const take = requestedTake || (currentSession.takeA ? "B" : "A");
    if (take === "B" && !(currentSession.modelPlayed && currentSession.replayed.A && currentSession.selectedIssue)) {
      toast("录制 B 前，请先听标准音、回听 A，并选择一个改进重点。");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      toast("当前浏览器不支持录音，请使用新版 Edge 或 Chrome。");
      return;
    }
    try {
      stopPronunciationPlayback();
      const recordingSession = currentSession;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      const startedAt = Date.now();
      mediaStream = stream;
      mediaRecorder = recorder;
      recordingChunks = chunks;
      recordingStartedAt = startedAt;
      recordingSession.activeRecordingTake = take;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        clearInterval(recordingTimer);
        const duration = Date.now() - startedAt;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        if (mediaStream === stream) mediaStream = null;
        if (mediaRecorder === recorder) mediaRecorder = null;
        if (!currentSession || currentSession !== recordingSession) return;
        recordingSession.activeRecordingTake = "";
        if (duration < MIN_RECORDING_DURATION_MS || blob.size === 0) {
          renderSession();
          toast("录音至少需要 1 秒；本次过短录音未保存，请重新录制。");
          return;
        }
        recordingSession[`take${take}`] = blob;
        recordingSession[`duration${take}`] = duration;
        recordingSession.replayed[take] = false;
        if (take === "A") {
          recordingSession.modelPlayed = false;
          recordingSession.selectedIssue = "";
          recordingSession.takeB = null;
          recordingSession.durationB = 0;
          recordingSession.replayed.B = false;
          recordingSession.comparisonResult = null;
          recordingSession.scores = {};
        } else {
          recordingSession.comparisonResult = null;
          recordingSession.scores = {};
        }
        if (currentRecordingUrl) URL.revokeObjectURL(currentRecordingUrl);
        currentRecordingUrl = "";
        renderSession();
      };
      recorder.start();
      recordingTimer = setInterval(() => {
        const label = sessionContent.querySelector(".record-zone p");
        if (label) label.textContent = `正在录制 ${take} · ${Math.ceil((Date.now() - startedAt) / 1000)} 秒，点击停止`;
      }, 500);
      renderSession();
    } catch {
      toast("没有获得麦克风权限；请在浏览器地址栏允许麦克风后重试。");
    }
  }

  async function openAudioDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("recordings", { keyPath: "id" });
        store.createIndex("taskId", "taskId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveRecording(task, blob, duration, scores, metadata = {}) {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      const record = { id: `${task.id}-${metadata.take || "take"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, taskId: task.id, day: state.currentDay, createdAt: new Date().toISOString(), duration, scores, blob, ...metadata };
      tx.objectStore("recordings").put(record);
      tx.oncomplete = () => { db.close(); resolve(record); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function recordingsForTask(taskId) {
    try {
      const db = await openAudioDb();
      return await new Promise((resolve, reject) => {
        const request = db.transaction("recordings", "readonly").objectStore("recordings").index("taskId").getAll(taskId);
        request.onsuccess = () => { db.close(); resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); };
        request.onerror = () => { db.close(); reject(request.error); };
      });
    } catch {
      return [];
    }
  }

  async function loadPronunciationRecords() {
    if (!currentSession || currentSession.type !== "pronunciation") return;
    const task = currentSession.items[currentSession.index];
    if (currentSession.recordsLoadedFor === task.id) return;
    currentSession.recordsLoadedFor = task.id;
    currentSession.records = await recordingsForTask(task.id);
    if (currentSession?.type === "pronunciation" && currentSession.items[currentSession.index]?.id === task.id) renderSession();
  }

  async function playRecording(take = "B", recordId = null) {
    let source = recordId ? currentSession.records.find((record) => record.id === recordId)?.blob : currentSession[`take${take}`];
    if (!source) return toast(`请先完成录音 ${take}。`);
    const kind = recordId ? `history-${recordId}` : `take${take}`;
    if (pronunciationPlayback.kind === kind && !recordingAudio.paused) {
      pronunciationRecordingPlayToken += 1;
      recordingAudio.pause();
      recordingAudio.onended = null;
      updatePronunciationPlaybackUi();
      return;
    }
    pronunciationModelPlayToken += 1;
    modelAudio.pause();
    recordingAudio.pause();
    if (currentRecordingUrl) URL.revokeObjectURL(currentRecordingUrl);
    currentRecordingUrl = URL.createObjectURL(source);
    recordingAudio.src = currentRecordingUrl;
    pronunciationPlayback = { kind, audio: recordingAudio };
    const activeToken = ++pronunciationRecordingPlayToken;
    const playbackSession = currentSession;
    recordingAudio.onended = () => {
      if (activeToken !== pronunciationRecordingPlayToken || currentSession !== playbackSession) return;
      if (!recordId) playbackSession.replayed[take] = true;
      renderSession();
    };
    try {
      await recordingAudio.play();
      renderSession();
    } catch {
      if (activeToken === pronunciationRecordingPlayToken) recordingAudio.onended = null;
      toast("录音暂时无法播放，请重新录制。");
    }
  }

  async function savePronunciationTask() {
    const task = currentSession.items[currentSession.index];
    const missing = pronunciationRequirements();
    if (missing.length) return toast(`还需完成：${missing.join("、")}`);
    try {
      const pairId = `${task.id}-pair-${Date.now()}`;
      const metadata = { pairId, selectedIssue: currentSession.selectedIssue, comparisonResult: currentSession.comparisonResult };
      await saveRecording(task, currentSession.takeA, currentSession.durationA, { ...currentSession.scores }, { ...metadata, take: "A" });
      await saveRecording(task, currentSession.takeB, currentSession.durationB, { ...currentSession.scores }, { ...metadata, take: "B" });
      const previous = state.pronunciationProgress[task.id] || {};
      const average = DIMENSIONS.reduce((sum, dimension) => sum + currentSession.scores[dimension], 0) / DIMENSIONS.length;
      state.pronunciationProgress[task.id] = {
        ...previous,
        completed: true,
        day: state.currentDay,
        scores: { ...currentSession.scores },
        average,
        attempts: Number(previous.attempts || 0) + 1,
        selectedIssue: currentSession.selectedIssue,
        comparisonResult: currentSession.comparisonResult,
        comparisonResultLabel: ["没有改善", "略有改善", "明显改善"][currentSession.comparisonResult],
        history: [...(previous.history || []), { at: new Date().toISOString(), average, comparisonResult: currentSession.comparisonResult, selectedIssue: currentSession.selectedIssue }].slice(-20),
        updatedAt: new Date().toISOString(),
      };
      saveState(true);
    } catch {
      return toast("录音保存失败，请确认浏览器允许本地存储。");
    }
    currentSession.completed += 1;
    if (currentSession.index + 1 >= currentSession.items.length) {
      completeSessionStep("发音训练完成", `已保存第 ${currentSession.day.id} 天的 3 组 A/B 录音、改善判断与四维自评。`);
      return;
    }
    stopPronunciationPlayback();
    currentSession.index += 1;
    currentSession.scores = {};
    currentSession.takeA = null;
    currentSession.takeB = null;
    currentSession.durationA = 0;
    currentSession.durationB = 0;
    currentSession.activeRecordingTake = "";
    currentSession.modelPlayed = false;
    currentSession.selectedIssue = "";
    currentSession.replayed = { A: false, B: false };
    currentSession.comparisonResult = null;
    currentSession.records = [];
    currentSession.recordsLoadedFor = "";
    if (currentRecordingUrl) URL.revokeObjectURL(currentRecordingUrl);
    currentRecordingUrl = "";
    renderSession();
    loadPronunciationRecords();
  }

  function closeSession() {
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    clearInterval(recordingTimer);
    stopWordAudio();
    stopAlphabetAudio();
    stopPronunciationPlayback();
    if (currentRecordingUrl) URL.revokeObjectURL(currentRecordingUrl);
    currentRecordingUrl = "";
    currentSession = null;
    sessionLayer.hidden = true;
    appShell.inert = false;
    appShell.removeAttribute("aria-hidden");
    document.body.style.overflow = "";
    const returnView = sessionReturnView || "today";
    const opener = sessionOpener;
    setView(returnView);
    requestAnimationFrame(() => {
      const selector = opener?.action === "start-pron-day"
        ? `[data-action="start-pron-day"][data-pron-day="${opener.pronDay}"]`
        : `.nav-item[data-view="${returnView}"]`;
      document.querySelector(selector)?.focus({ preventScroll: true });
    });
  }

  function toggleFavorite() {
    if (!currentSession || currentSession.type !== "words") return;
    const id = currentSession.items[currentSession.index].id;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
    saveState();
    renderSession();
    toast(state.favorites.includes(id) ? "已加入收藏。" : "已取消收藏。");
  }

  function confirmDialog(title, message, callback) {
    $("dialogTitle").textContent = title;
    $("dialogMessage").textContent = message;
    confirmCallback = callback;
    $("confirmDialog").showModal();
  }

  function exportData() {
    const payload = { product: "古兰经阿拉伯语学习APP", version: 1, exportedAt: new Date().toISOString(), state };
    const filename = `古兰经阿语学习备份-${new Date().toISOString().slice(0, 10)}.json`;
    if (IS_NATIVE_ANDROID) {
      window.AndroidBridge.saveBackup(JSON.stringify(payload, null, 2), filename);
      toast("学习进度已保存到手机 Downloads/QuranLearning；录音仍保存在 APP 内。");
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("学习进度已导出；录音仍保存在本机浏览器中。");
  }

  async function importData(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload.product !== "古兰经阿拉伯语学习APP" || !payload.state) throw new Error("invalid");
      state = normalizeState(payload.state);
      saveState();
      toast("学习备份已导入。");
      renderView();
    } catch {
      toast("备份文件无效或已损坏。");
    }
  }

  async function resetData() {
    localStorage.removeItem(STORAGE_KEY);
    try { indexedDB.deleteDatabase(DB_NAME); } catch {}
    state = defaultState();
    saveState();
    renderView();
    toast("学习进度与本地录音已清空。");
  }

  async function installApp() {
    if (IS_NATIVE_ANDROID) return toast("当前已经是手机安装版 APP。");
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("installButton").hidden = true;
      return;
    }
    toast(location.protocol === "file:" ? "请使用手机安装包，或通过浏览器打开网页版。" : "请在浏览器菜单中选择“安装应用”或“添加到主屏幕”。");
  }

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.view === "course") { state.courseUnit = null; state.courseMode = "lessons"; state.alphabetGroup = null; }
    setView(button.dataset.view);
  }));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
  $("sessionBack").addEventListener("click", closeSession);
  sessionFavorite.addEventListener("click", toggleFavorite);
  $("installButton").addEventListener("click", installApp);
  $("importInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importData(file);
    event.target.value = "";
  });
  $("confirmDialog").addEventListener("close", () => {
    if ($("confirmDialog").returnValue === "confirm") confirmCallback?.();
    confirmCallback = null;
  });

  mainView.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "start-step") startStep(button.dataset.step);
    if (action === "next-day" && state.currentDay < DAY_COUNT) { state.currentDay += 1; saveState(); renderToday(); }
    if (action === "set-stage") { state.courseStage = Number(button.dataset.stage); saveState(); renderCourse(); }
    if (action === "open-alphabet") { state.view = "course"; state.courseMode = "alphabet"; state.courseUnit = null; state.alphabetGroup = null; saveState(); renderView(); }
    if (action === "close-alphabet") { state.courseMode = "lessons"; state.alphabetGroup = null; saveState(); renderCourse(); }
    if (action === "set-alphabet-tab") { state.alphabetTab = button.dataset.alphabetTab; state.alphabetGroup = null; saveState(); renderAlphabetCourse(); }
    if (action === "open-alphabet-group") {
      const group = alphabetGroupById.get(Number(button.dataset.alphabetGroup));
      if (group?.special) { state.alphabetGroup = group.id; saveState(); renderAlphabetSpecial(); }
      else if (group) openAlphabetSession(group.letterIds);
    }
    if (action === "open-alphabet-letter") openAlphabetSession([button.dataset.letterId]);
    if (action === "back-alphabet") { state.alphabetGroup = null; saveState(); renderAlphabetCourse(); }
    if (action === "complete-alphabet-special") { state.alphabetSpecialComplete = true; saveState(true); renderAlphabetSpecial(); toast("特殊字形复习已完成。"); }
    if (action === "open-unit") renderCourse(Number(button.dataset.unit));
    if (action === "back-course") { state.courseUnit = null; saveState(); renderCourse(); }
    if (action === "start-unit") openWordSession(lessonById.get(Number(button.dataset.unit)).words.map((word) => word.id), "learn");
    if (action === "show-unit-library") { state.libraryUnit = Number(button.dataset.unit); state.libraryFilter = "all"; setView("library"); }
    if (action === "clear-unit-filter") { state.libraryUnit = null; saveState(); renderLibrary(); }
    if (action === "set-library-filter") { state.libraryFilter = button.dataset.filter; saveState(); renderLibrary(); }
    if (action === "open-word") openWordSession([button.dataset.word], "learn");
    if (action === "start-pron-day") openPronunciationSession(Number(button.dataset.pronDay));
    if (action === "export-data") exportData();
    if (action === "import-data") $("importInput").click();
    if (action === "open-pdf") window.AndroidBridge?.openPdf?.();
    if (action === "reset-data") confirmDialog("清空全部学习数据？", "这会删除当前浏览器中的进度、成绩和录音，且无法撤销。", resetData);
    if (action === "install-app") installApp();
  });

  mainView.addEventListener("change", (event) => {
    const setting = event.target.dataset.setting;
    if (!setting) return;
    state.settings[setting] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value);
    saveState();
    renderProfile();
  });

  let searchTimer = null;
  mainView.addEventListener("input", (event) => {
    if (event.target.id !== "librarySearch") return;
    state.libraryQuery = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const position = state.libraryQuery.length;
      renderLibrary();
      const input = $("librarySearch");
      input?.focus();
      input?.setSelectionRange(position, position);
    }, 120);
  });

  sessionContent.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-session-action]");
    if (!button || !currentSession) return;
    const action = button.dataset.sessionAction;
    if (action === "set-word-mode") setWordMode(button.dataset.mode);
    if (action === "reveal-word") { currentSession.revealed = true; renderSession(); }
    if (action === "reveal-dictation") revealDictationAnswer();
    if (action === "rate-word") rateWord(Number(button.dataset.rating));
    if (action === "play-word-audio") playWordAudio(button);
    if (action === "restart-word-audio") restartWordAudio();
    if (action === "stop-word-audio") stopWordAudio();
    if (action === "set-word-pronunciation-form") setWordPronunciationForm(Number(button.dataset.formIndex));
    if (action === "set-word-audio-layer") setWordAudioLayer(button.dataset.layer);
    if (action === "play-word-syllable") playWordSyllable(Number(button.dataset.syllableIndex));
    if (action === "play-word-ending-segment") playWordEndingSegment(Number(button.dataset.endingSegmentIndex));
    if (action === "play-word-ending-drill") playWordEndingDrill(Number(button.dataset.endingDrillIndex));
    if (action === "answer-verse") {
      const verse = currentSession.items[currentSession.index];
      const correct = button.dataset.choice === verse.targetEntryId;
      currentSession.answered[verse.id] = { choice: button.dataset.choice, correct };
      state.verseProgress[verse.id] = { attempts: Number(state.verseProgress[verse.id]?.attempts || 0) + 1, correct, lastDay: state.currentDay };
      saveState(true);
      renderSession();
      toast(correct ? "回答正确。" : "已显示正确答案，请结合完整译文再读一遍。");
    }
    if (action === "reveal-verse") {
      const verse = currentSession.items[currentSession.index];
      currentSession.answered[verse.id] = { revealed: true };
      state.verseProgress[verse.id] = { attempts: Number(state.verseProgress[verse.id]?.attempts || 0) + 1, correct: null, lastDay: state.currentDay };
      saveState(true);
      renderSession();
    }
    if (action === "next-verse") {
      currentSession.completed += 1;
      if (currentSession.index + 1 >= currentSession.items.length) completeSessionStep("经文实战完成", `已完成 ${currentSession.items.length} 条经文语境训练。`);
      else { currentSession.index += 1; renderSession(); }
    }
    if (action === "play-model") playModel();
    if (action === "set-speed") { state.settings.audioRate = Number(button.dataset.speed); saveState(); renderSession(); }
    if (action === "set-word-audio-speed") {
      state.settings.audioRate = Number(button.dataset.speed);
      saveState();
      modelAudio.playbackRate = state.settings.audioRate;
      sessionContent.querySelectorAll('[data-session-action="set-word-audio-speed"]').forEach((speedButton) => {
        const active = Number(speedButton.dataset.speed) === state.settings.audioRate;
        speedButton.classList.toggle("active", active);
        speedButton.setAttribute("aria-pressed", String(active));
      });
    }
    if (action === "toggle-record") toggleRecording(button.dataset.take);
    if (action === "record-take") toggleRecording(button.dataset.take);
    if (action === "play-take") playRecording(button.dataset.take);
    if (action === "play-history") playRecording("", button.dataset.recordId);
    if (action === "select-pron-issue") { currentSession.selectedIssue = button.dataset.issue; currentSession.takeB = null; currentSession.durationB = 0; currentSession.replayed.B = false; currentSession.comparisonResult = null; currentSession.scores = {}; renderSession(); }
    if (action === "compare-pron") { currentSession.comparisonResult = Number(button.dataset.score); currentSession.scores = {}; renderSession(); }
    if (action === "score-pron") { currentSession.scores[button.dataset.dimension] = Number(button.dataset.score); renderSession(); }
    if (action === "save-pron") savePronunciationTask();
    if (action === "play-alphabet-unit") playAlphabetUnit(button.dataset.letterId, button.dataset.audioKind);
    if (action === "set-alphabet-audio-speed") {
      const speed = Number(button.dataset.speed);
      if ([0.75, 0.85, 1].includes(speed)) {
        state.settings.audioRate = speed;
        modelAudio.playbackRate = speed;
        saveState();
        sessionContent.querySelectorAll('[data-session-action="set-alphabet-audio-speed"]').forEach((item) => {
          item.classList.toggle("active", Number(item.dataset.speed) === speed);
          item.setAttribute("aria-pressed", String(Number(item.dataset.speed) === speed));
        });
      }
    }
    if (action === "start-alphabet-listening-quiz") { currentSession.alphabetStep = HAS_ALPHABET_AUDIO ? "listening" : "quiz"; currentSession.listeningQuizAudioPlayed = false; currentSession.listeningQuizAnswer = ""; currentSession.listeningQuizCorrect = !HAS_ALPHABET_AUDIO; currentSession.quizAnswer = ""; currentSession.quizCorrect = false; sessionLayer.scrollTop = 0; renderSession(); }
    if (action === "play-alphabet-quiz-audio") playAlphabetQuizAudio();
    if (action === "answer-alphabet-listening") answerAlphabetListeningQuiz(button.dataset.audioKind);
    if (action === "go-alphabet-shape-quiz") { currentSession.alphabetStep = "quiz"; currentSession.quizAnswer = ""; currentSession.quizCorrect = false; sessionLayer.scrollTop = 0; renderSession(); }
    if (action === "answer-alphabet-quiz") answerAlphabetQuiz(button.dataset.letterId);
    if (action === "next-alphabet-letter") nextAlphabetLetter();
    if (action === "back-alphabet-learn") { currentSession.alphabetStep = "learn"; currentSession.listeningQuizAnswer = ""; currentSession.listeningQuizCorrect = false; sessionLayer.scrollTop = 0; renderSession(); }
    if (action === "back-alphabet-listening") { currentSession.alphabetStep = HAS_ALPHABET_AUDIO ? "listening" : "learn"; currentSession.quizAnswer = ""; currentSession.quizCorrect = false; sessionLayer.scrollTop = 0; renderSession(); }
    if (action === "close-session") closeSession();
  });

  sessionContent.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-dictation-form]")) return;
    event.preventDefault();
    checkDictation();
  });

  sessionContent.addEventListener("input", (event) => {
    if (!event.target.matches("[data-dictation-input]") || currentSession?.type !== "words") return;
    currentSession.dictationInput = event.target.value;
  });

  sessionContent.addEventListener("change", (event) => {
    if (event.target.dataset.sessionSetting !== "word-audio-repeats") return;
    state.settings.wordAudioRepeats = boundedInteger(event.target.value, 1, 10, 3);
    saveState();
    updateWordAudioUi(`已设置循环 ${state.settings.wordAudioRepeats} 遍`);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("installButton").hidden = false;
  });

  window.quranHandleAndroidBack = () => {
    if ($("confirmDialog").open) { $("confirmDialog").close("cancel"); return true; }
    if (!sessionLayer.hidden) { closeSession(); return true; }
    if (state.view === "course" && state.courseUnit) { state.courseUnit = null; saveState(); renderCourse(); return true; }
    if (state.view === "course" && state.courseMode === "alphabet" && state.alphabetGroup) { state.alphabetGroup = null; saveState(); renderAlphabetCourse(); return true; }
    if (state.view === "course" && state.courseMode === "alphabet") { state.courseMode = "lessons"; saveState(); renderCourse(); return true; }
    if (state.view !== "today") { setView("today"); return true; }
    return false;
  };
  window.quranSetNativeInsets = (top, bottom) => {
    document.documentElement.style.setProperty("--safe-top", `${Math.max(0, Number(top) || 0)}px`);
    document.documentElement.style.setProperty("--safe-bottom", "0px");
  };

  [modelAudio, recordingAudio].forEach((audio) => {
    ["play", "pause", "timeupdate", "durationchange", "ended"].forEach((eventName) => {
      audio.addEventListener(eventName, updatePronunciationPlaybackUi);
    });
  });

  if (!IS_NATIVE_ANDROID && "serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  renderView();
})();
