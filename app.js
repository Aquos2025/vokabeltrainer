/**
 * ¡VAMOS! Spanisch-Vokabeltrainer (¡Apúntate! 1)
 * ============================================
 * Didaktische Lern-Engine mit:
 * - 5-Stufen Leitner-Spaced-Repetition
 * - Gamification (XP, Level, Flammen-Streaks, Sounds, Confetti)
 * - Fehlertoleranter Eingabeprüfung (Levenshtein, Akzent-Assistent, Synonym- & Artikelerkennung)
 * - Text-To-Speech (Web Speech API es-ES)
 * - Web Audio API Synthesizer (Zero-Dependency Audio)
 * - Multiple-Choice Blitzmodus
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, startTime = 0, gainVal = 0.2) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + startTime);
      osc.stop(this.ctx.currentTime + startTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playSuccess() {
    // Happy major triad: C5 (523Hz), E5 (659Hz), G5 (784Hz)
    this.playTone(523.25, 'triangle', 0.12, 0.00, 0.25);
    this.playTone(659.25, 'triangle', 0.12, 0.08, 0.25);
    this.playTone(783.99, 'triangle', 0.25, 0.16, 0.3);
  }

  playWarning() {
    // Friendly attention chime: A4 (440Hz) -> C#5 (554Hz)
    this.playTone(440.00, 'sine', 0.15, 0.00, 0.2);
    this.playTone(554.37, 'sine', 0.20, 0.10, 0.2);
  }

  playError() {
    // Gentle low double boop: 220Hz -> 180Hz (soft, encouraging)
    this.playTone(220, 'sine', 0.12, 0.00, 0.2);
    this.playTone(180, 'sine', 0.20, 0.12, 0.2);
  }

  playStreak() {
    // Sparkly upward glissando
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.15, idx * 0.06, 0.2);
    });
  }

  playLevelUp() {
    // Triumphant Fanfare
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
    const times = [0, 0.12, 0.24, 0.36, 0.50, 0.68];
    const durs  = [0.1, 0.1, 0.1, 0.12, 0.15, 0.45];
    notes.forEach((freq, i) => {
      this.playTone(freq, 'triangle', durs[i], times[i], 0.3);
    });
  }

  playCoinSound() {
    // Classic sparkling coin sound: B5 (988Hz) -> E6 (1319Hz)
    this.playTone(987.77, 'sine', 0.08, 0.00, 0.25);
    this.playTone(1318.51, 'triangle', 0.35, 0.07, 0.3);
    this.playTone(2637.02, 'sine', 0.20, 0.12, 0.1);
  }
}

class TTSEngine {
  constructor() {
    this.enabled = true;
    this.autoTTS = false;
    this.spanishVoice = null;
    this.init();
  }

  init() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoice();
      };
      this.loadVoice();
    }
  }

  loadVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer Spanish (Spain) voice
    this.spanishVoice = voices.find(v => v.lang === 'es-ES') ||
                        voices.find(v => v.lang.startsWith('es')) ||
                        null;
  }

  speak(text) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any previous speech
      // Clean up bracketed or slash notes for natural speech
      const cleaned = text.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9; // Slightly slower and clearer for 5th grade beginner
      if (this.spanishVoice) {
        utterance.voice = this.spanishVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
    }
  }
}

// LEVEL TITLES FOR 12-YEAR OLD
const LEVEL_TITLES = [
  "Novato (Anfänger)",        // 1
  "Aprendiz (Lehrling)",       // 2
  "Explorador (Entdecker)",    // 3
  "Aventurero (Abenteurer)",   // 4
  "Guerrero (Krieger)",        // 5
  "Campeón (Champion)",        // 6
  "Héroe (Held)",              // 7
  "Maestro (Meister)",         // 8
  "Gran Maestro (Großmeister)",// 9
  "Leyenda (Legende! 🏆)"       // 10+
];

class VocabTrainerApp {
  constructor() {
    this.sound = new SoundEngine();
    this.tts = new TTSEngine();
    
    // Dataset
    this.allVocab = [];
    this.filteredVocab = [];
    
    // Session State
    this.sessionVocab = [];
    this.currentIndex = 0;
    this.currentDirection = 'ES_TO_DE'; // 'ES_TO_DE', 'DE_TO_ES'
    this.sessionMode = 'typing'; // 'typing' or 'blitz'
    this.cardState = 'AWAITING_ANSWER'; // 'AWAITING_ANSWER' or 'SHOWING_FEEDBACK'
    this.currentCorrectOptionIndex = -1;
    this.currentSessionType = 'standard'; // 'standard', 'daily', 'weekend', 'mistakes'
    this.sessionStartTime = null;
    this.simulateWeekend = false;
    
    // Canvas & Pile
    this.coinCanvas = null;
    this.coinCtx = null;
    
    // Session Stats
    this.sessionStats = {
      totalAnswered: 0,
      correctCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      xpEarned: 0,
      mistakes: []
    };

    // User State from LocalStorage
    this.userState = this.loadUserState();

    // DOM Elements
    this.dom = {};
  }

  loadUserState() {
    let state = {
      xp: 0,
      level: 1,
      streak: 0,
      bestStreak: 0,
      allTimeBestStreak: 0,
      leitnerBoxes: {}, // id -> 1..5
      soundEnabled: true,
      autoTTS: false,
      coins: {
        total: 0,
        history: [] // [{ date: '2026-09-23', timestamp: 1774378..., amount: 1, type: 'daily' }]
      },
      learningTime: {
        totalSeconds: 0,
        history: [] // [{ date: '2026-09-23', timestamp: 1774378..., seconds: 180 }]
      },
      vocabStats: {}, // id -> { seenCount: 1, correctCount: 1, lastPracticed: 1774378... }
      weekendChallengeClaimed: {}
    };

    const saved = localStorage.getItem('apuntate_user_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
        
        // Ensure nested structures are valid
        if (!state.coins || typeof state.coins !== 'object') {
          state.coins = { total: 0, history: [] };
        }
        if (!Array.isArray(state.coins.history)) state.coins.history = [];
        if (typeof state.coins.total !== 'number') state.coins.total = 0;

        if (!state.learningTime || typeof state.learningTime !== 'object') {
          state.learningTime = { totalSeconds: 0, history: [] };
        }
        if (!Array.isArray(state.learningTime.history)) state.learningTime.history = [];
        if (typeof state.learningTime.totalSeconds !== 'number') state.learningTime.totalSeconds = 0;

        if (!state.vocabStats || typeof state.vocabStats !== 'object') {
          state.vocabStats = {};
        }

        if (!state.allTimeBestStreak) {
          state.allTimeBestStreak = Math.max(state.bestStreak || 0, 0);
        } else {
          state.allTimeBestStreak = Math.max(state.allTimeBestStreak, state.bestStreak || 0);
        }

        if (!state.weekendChallengeClaimed || typeof state.weekendChallengeClaimed !== 'object') {
          state.weekendChallengeClaimed = {};
        }
      } catch (e) {
        console.error("Error loading user state:", e);
      }
    }
    return state;
  }

  saveUserState() {
    localStorage.setItem('apuntate_user_state', JSON.stringify(this.userState));
    this.updateHeaderStats();
  }

  getBox(vocabId) {
    return this.userState.leitnerBoxes[vocabId] || 1;
  }

  setBox(vocabId, boxNum) {
    const clamped = Math.max(1, Math.min(5, boxNum));
    this.userState.leitnerBoxes[vocabId] = clamped;
    this.saveUserState();
  }

  async init() {
    this.cacheDomElements();
    this.bindEvents();
    
    // Load Settings
    this.sound.enabled = this.userState.soundEnabled !== false;
    this.tts.autoTTS = this.userState.autoTTS === true;
    this.updateAudioIcons();

    // Setup Coin Canvas & Weekend UI
    this.initCoinPileCanvas();
    this.renderCoinPile();
    this.updateWeekendUIStatus();

    // Load Vocabulary
    await this.loadVocabData();

    // Populate Filters
    this.populateFilterDropdowns();
    this.updateLeitnerCounts();
    this.updateFilterCounts();
    this.updateHeaderStats();

    // Init Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  cacheDomElements() {
    this.dom.viewDashboard = document.getElementById('viewDashboard');
    this.dom.viewTraining = document.getElementById('viewTraining');
    this.dom.viewSummary = document.getElementById('viewSummary');

    // Header elements
    this.dom.headerCoinBtn = document.getElementById('headerCoinBtn');
    this.dom.headerCoinCount = document.getElementById('headerCoinCount');
    this.dom.headerStreakFlame = document.getElementById('headerStreakFlame');
    this.dom.headerStreakCount = document.getElementById('headerStreakCount');
    this.dom.headerLevelBadge = document.getElementById('headerLevelBadge');
    this.dom.headerLevelTitle = document.getElementById('headerLevelTitle');
    this.dom.headerXpBar = document.getElementById('headerXpBar');
    this.dom.headerXpText = document.getElementById('headerXpText');
    this.dom.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.dom.ttsAutoToggleBtn = document.getElementById('ttsAutoToggleBtn');

    // Dashboard elements
    this.dom.heroTotalVocabCount = document.getElementById('heroTotalVocabCount');
    this.dom.heroWeekendBtn = document.getElementById('heroWeekendBtn');
    this.dom.filterModulo = document.getElementById('filterModulo');
    this.dom.filterUnidad = document.getElementById('filterUnidad');
    this.dom.filterPageStart = document.getElementById('filterPageStart');
    this.dom.filterPageEnd = document.getElementById('filterPageEnd');
    this.dom.filterDirection = document.getElementById('filterDirection');
    this.dom.filterMatchesBadge = document.getElementById('filterMatchesBadge');
    this.dom.optShuffle = document.getElementById('optShuffle');
    this.dom.optLimit20 = document.getElementById('optLimit20');

    // Training elements
    this.dom.sessionCounterText = document.getElementById('sessionCounterText');
    this.dom.sessionStreakText = document.getElementById('sessionStreakText');
    this.dom.sessionStreakCount = document.getElementById('sessionStreakCount');
    this.dom.sessionProgressBar = document.getElementById('sessionProgressBar');
    this.dom.cardBoxBadge = document.getElementById('cardBoxBadge');
    this.dom.trainingCard = document.getElementById('trainingCard');
    this.dom.cardMetadata = document.getElementById('cardMetadata');
    this.dom.cardPromptLabel = document.getElementById('cardPromptLabel');
    this.dom.cardWord = document.getElementById('cardWord');
    this.dom.cardContextSentence = document.getElementById('cardContextSentence');
    this.dom.modeTypingContainer = document.getElementById('modeTypingContainer');
    this.dom.answerInput = document.getElementById('answerInput');
    this.dom.modeBlitzContainer = document.getElementById('modeBlitzContainer');
    this.dom.choiceBtns = [
      document.getElementById('choiceBtn0'),
      document.getElementById('choiceBtn1'),
      document.getElementById('choiceBtn2'),
      document.getElementById('choiceBtn3')
    ];
    this.dom.feedbackBanner = document.getElementById('feedbackBanner');
    this.dom.feedbackTitle = document.getElementById('feedbackTitle');
    this.dom.feedbackDetail = document.getElementById('feedbackDetail');
    this.dom.actionBtn = document.getElementById('actionBtn');
    this.dom.ttsPlayBtn = document.getElementById('ttsPlayBtn');

    // Summary elements
    this.dom.summaryIconContainer = document.getElementById('summaryIconContainer');
    this.dom.summaryIcon = document.getElementById('summaryIcon');
    this.dom.summaryTitle = document.getElementById('summaryTitle');
    this.dom.summarySubtitle = document.getElementById('summarySubtitle');
    this.dom.summaryBarCorrect = document.getElementById('summaryBarCorrect');
    this.dom.summaryBarMistakes = document.getElementById('summaryBarMistakes');
    this.dom.summaryGraphCorrectText = document.getElementById('summaryGraphCorrectText');
    this.dom.summaryGraphMistakesText = document.getElementById('summaryGraphMistakesText');
    this.dom.summaryFeedbackGrade = document.getElementById('summaryFeedbackGrade');
    this.dom.summaryAccuracy = document.getElementById('summaryAccuracy');
    this.dom.summaryCorrectCount = document.getElementById('summaryCorrectCount');
    this.dom.summaryBestStreak = document.getElementById('summaryBestStreak');
    this.dom.summaryXpEarned = document.getElementById('summaryXpEarned');
    this.dom.summaryMistakesContainer = document.getElementById('summaryMistakesContainer');
    this.dom.summaryMistakeCount = document.getElementById('summaryMistakeCount');
    this.dom.summaryMistakesList = document.getElementById('summaryMistakesList');
    this.dom.summaryRetryMistakesBtn = document.getElementById('summaryRetryMistakesBtn');

    // Persistent Coin Canvas & Drop Overlay
    this.dom.coinPileCanvas = document.getElementById('coinPileCanvas');
    this.dom.coinRewardOverlay = document.getElementById('coinRewardOverlay');
    this.dom.animatedFallingCoin = document.getElementById('animatedFallingCoin');
    this.dom.coinRewardText = document.getElementById('coinRewardText');

    // Profile & Stats Modal
    this.dom.profileModal = document.getElementById('profileModal');
    this.dom.profLevelBadge = document.getElementById('profLevelBadge');
    this.dom.profLevelTitle = document.getElementById('profLevelTitle');
    this.dom.profCoinsWeek = document.getElementById('profCoinsWeek');
    this.dom.profCoinsMonth = document.getElementById('profCoinsMonth');
    this.dom.profCoinsTotal = document.getElementById('profCoinsTotal');
    this.dom.profTimeWeek = document.getElementById('profTimeWeek');
    this.dom.profTimeMonth = document.getElementById('profTimeMonth');
    this.dom.profTimeTotal = document.getElementById('profTimeTotal');
    this.dom.profAllTimeStreak = document.getElementById('profAllTimeStreak');
    this.dom.profCirculatingCount = document.getElementById('profCirculatingCount');
    this.dom.profUntouchedCount = document.getElementById('profUntouchedCount');
    this.dom.profPoolRatioBadge = document.getElementById('profPoolRatioBadge');
    this.dom.profWeekendStatus = document.getElementById('profWeekendStatus');
    this.dom.profWeekendToggleBtn = document.getElementById('profWeekendToggleBtn');
  }

  bindEvents() {
    // Enter-Taste im Eingabefeld (Antwort absenden)
    this.dom.answerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Ganz wichtig: Stoppt Bubbling zum window-Listener!
        if (this.cardState === 'AWAITING_ANSWER') {
          this.checkTypingAnswer();
        }
      }
    });

    // Tastatursteuerung für Training (Blitzmodus 1-4 & Beliebige Taste zum Weiterblättern)
    window.addEventListener('keydown', (e) => {
      if (this.dom.viewTraining.classList.contains('hidden')) return;

      // Blitzmodus: Optionen 1-4
      if (this.sessionMode === 'blitz' && this.cardState === 'AWAITING_ANSWER') {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          this.selectChoice(idx);
        }
        return;
      }

      // Feedback-Zustand: Erst nach Tastendruck zur nächsten Vokabel wechseln
      if (this.cardState === 'SHOWING_FEEDBACK') {
        // Cooldown: Verhindert, dass derselbe Tastendruck (z.B. Enter) sofort weiterspringt
        if (Date.now() - (this.feedbackShownAt || 0) < 250) {
          return;
        }

        // Reine Modifikatortasten ignorieren
        if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
          return;
        }

        e.preventDefault();
        this.handleActionClick();
      }
    });
  }

  async loadVocabData() {
    try {
      const res = await fetch('vocabulario.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.allVocab = await res.json();
      this.dom.heroTotalVocabCount.textContent = `${this.allVocab.length} Vokabeln im Buch`;
    } catch (e) {
      console.error("Could not load vocabulario.json directly, fallback to empty array:", e);
      this.allVocab = [];
      this.dom.heroTotalVocabCount.textContent = `0 Vokabeln geladen`;
    }
  }

  populateFilterDropdowns() {
    // Extract unique Modulos
    const modulos = Array.from(new Set(this.allVocab.map(v => v.modulo).filter(Boolean)));
    this.dom.filterModulo.innerHTML = `<option value="ALL">Alle Módulos (${this.allVocab.length})</option>`;
    modulos.forEach(m => {
      const count = this.allVocab.filter(v => v.modulo === m).length;
      this.dom.filterModulo.innerHTML += `<option value="${m}">${m} (${count})</option>`;
    });

    this.onModuloChange();
  }

  onModuloChange() {
    const selectedModulo = this.dom.filterModulo.value;
    let relevantVocab = this.allVocab;
    if (selectedModulo !== 'ALL') {
      relevantVocab = this.allVocab.filter(v => v.modulo === selectedModulo);
    }

    const unidades = Array.from(new Set(relevantVocab.map(v => v.unidad).filter(Boolean)));
    this.dom.filterUnidad.innerHTML = `<option value="ALL">Alle Unidades / Abschnitte</option>`;
    unidades.forEach(u => {
      const count = relevantVocab.filter(v => v.unidad === u).length;
      this.dom.filterUnidad.innerHTML += `<option value="${u}">${u} (${count})</option>`;
    });

    this.updateFilterCounts();
  }

  updateFilterCounts() {
    const filtered = this.getFilteredVocab();
    this.dom.filterMatchesBadge.textContent = `${filtered.length} Vokabeln ausgewählt`;
    return filtered;
  }

  getFilteredVocab(forceBoxFilter = null) {
    const modulo = this.dom.filterModulo.value;
    const unidad = this.dom.filterUnidad.value;
    const pStart = parseInt(this.dom.filterPageStart.value) || 0;
    const pEnd = parseInt(this.dom.filterPageEnd.value) || 9999;

    return this.allVocab.filter(v => {
      if (modulo !== 'ALL' && v.modulo !== modulo) return false;
      if (unidad !== 'ALL' && v.unidad !== unidad) return false;
      if (v.seite && (v.seite < pStart || v.seite > pEnd)) return false;

      if (forceBoxFilter !== null) {
        const box = this.getBox(v.id);
        if (Array.isArray(forceBoxFilter)) {
          if (!forceBoxFilter.includes(box)) return false;
        } else {
          if (box !== forceBoxFilter) return false;
        }
      }
      return true;
    });
  }

  updateLeitnerCounts() {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.allVocab.forEach(v => {
      const b = this.getBox(v.id);
      counts[b] = (counts[b] || 0) + 1;
    });

    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`boxCount${i}`);
      if (el) el.textContent = counts[i];
    }
  }

  updateHeaderStats() {
    // Coins
    if (this.dom.headerCoinCount) {
      this.dom.headerCoinCount.textContent = this.userState.coins?.total || 0;
    }

    // XP & Level calculations
    // Each level requires (level * 100) XP
    let xp = this.userState.xp;
    let level = 1;
    while (xp >= level * 100) {
      xp -= level * 100;
      level++;
    }
    const neededForNext = level * 100;
    const pct = Math.min(100, Math.round((xp / neededForNext) * 100));

    this.userState.level = level;
    if (this.dom.headerLevelBadge) {
      this.dom.headerLevelBadge.textContent = `⭐ Level ${level}`;
    }
    const titleIdx = Math.min(level - 1, LEVEL_TITLES.length - 1);
    if (this.dom.headerLevelTitle) {
      this.dom.headerLevelTitle.textContent = LEVEL_TITLES[titleIdx];
    }
    if (this.dom.headerXpBar) {
      this.dom.headerXpBar.style.width = `${pct}%`;
    }
    if (this.dom.headerXpText) {
      this.dom.headerXpText.textContent = `${xp} / ${neededForNext} XP`;
    }

    // Streak
    if (this.dom.headerStreakCount) {
      this.dom.headerStreakCount.textContent = this.userState.streak;
    }
    if (this.dom.headerStreakFlame) {
      if (this.userState.streak >= 3) {
        this.dom.headerStreakFlame.classList.add('flame-active');
      } else {
        this.dom.headerStreakFlame.classList.remove('flame-active');
      }
    }
  }

  addXp(amount) {
    const oldLevel = this.userState.level;
    this.userState.xp += amount;
    this.sessionStats.xpEarned += amount;
    this.saveUserState();

    if (this.userState.level > oldLevel) {
      this.sound.playLevelUp();
      this.triggerConfetti();
    }
  }

  incrementStreak() {
    this.userState.streak++;
    this.sessionStats.currentStreak++;
    if (this.userState.streak > this.userState.bestStreak) {
      this.userState.bestStreak = this.userState.streak;
    }
    if (this.userState.streak > (this.userState.allTimeBestStreak || 0)) {
      this.userState.allTimeBestStreak = this.userState.streak;
    }
    if (this.sessionStats.currentStreak > this.sessionStats.bestStreak) {
      this.sessionStats.bestStreak = this.sessionStats.currentStreak;
    }
    if (this.userState.streak === 5 || this.userState.streak === 10 || this.userState.streak % 15 === 0) {
      this.sound.playStreak();
      this.triggerConfetti();
    }
    this.saveUserState();
  }

  resetStreak() {
    this.userState.streak = 0;
    this.sessionStats.currentStreak = 0;
    this.saveUserState();
  }

  resetFilters() {
    this.dom.filterModulo.value = 'ALL';
    this.onModuloChange();
    this.dom.filterUnidad.value = 'ALL';
    this.dom.filterPageStart.value = '';
    this.dom.filterPageEnd.value = '';
    this.dom.filterDirection.value = 'ES_TO_DE';
    this.updateFilterCounts();
  }

  filterByBox(boxNum) {
    const list = this.getFilteredVocab(boxNum);
    if (list.length === 0) {
      alert(`In Kasten ${boxNum} befinden sich aktuell keine passenden Vokabeln.`);
      return;
    }
    this.startSessionWithList(list, 'typing', 'standard');
  }

  startDifficultSession() {
    // Boxes 1 & 2
    const list = this.getFilteredVocab([1, 2]);
    if (list.length === 0) {
      alert("Großartig! Du hast aktuell keine schwierigen Vokabeln in Kasten 1 oder 2!");
      return;
    }
    this.startSessionWithList(list, 'typing', 'standard');
  }

  startBlitzSession() {
    const list = this.updateFilterCounts();
    if (list.length === 0) {
      alert("Bitte wähle mindestens eine Einheit mit Vokabeln aus.");
      return;
    }
    if (list.length < 4) {
      alert("Für den Blitzmodus werden mindestens 4 verschiedene Vokabeln für Antwortoptionen benötigt.");
      return;
    }
    this.startSessionWithList(list, 'blitz', 'standard');
  }

  startSession(mode = 'standard') {
    const list = this.updateFilterCounts();
    if (list.length === 0) {
      alert("Keine Vokabeln für diese Filterkriterien gefunden!");
      return;
    }
    this.startSessionWithList(list, mode === 'blitz' ? 'blitz' : 'typing', 'standard');
  }

  /**
   * TÄGLICHES ZIEL (20 Vokabeln) - Spaced Repetition Light
   * Schwerpunkt: ~10-12 aktuelle Lektionsvokabeln
   * Wiederholung: ~8-10 Vokabeln nur aus bereits geübten Vokabeln (seenCount > 0)
   * Gewichtung: Box 1 (40%), Box 2 (30%), Box 3 (15%), Box 4&5 (15%)
   */
  startDailyGoalSession() {
    if (!this.allVocab || this.allVocab.length === 0) {
      alert("Vokabeln werden noch geladen. Bitte einen kurzen Augenblick warten...");
      return;
    }
    const pool = this.generateDailyGoalPool();
    if (!pool || pool.length === 0) {
      alert("Keine Vokabeln verfügbar!");
      return;
    }
    this.startSessionWithList(pool, 'typing', 'daily');
  }

  generateDailyGoalPool() {
    // 1. Umlauf-Topf: Nur Vokabeln, die mindestens einmal berührt/geübt wurden
    const circulating = this.allVocab.filter(v => (this.userState.vocabStats?.[v.id]?.seenCount || 0) > 0);

    // 2. Bestimme aktuelle Lektion (aus Filter oder als aktiver Fortschritt)
    let targetLessonVocab = this.getFilteredVocab();
    if (this.dom.filterModulo.value === 'ALL' && this.dom.filterUnidad.value === 'ALL') {
      const lastPracticedVocabId = Object.entries(this.userState.vocabStats || {})
        .sort((a, b) => (b[1].lastPracticed || 0) - (a[1].lastPracticed || 0))[0]?.[0];
      const lastVocab = this.allVocab.find(v => v.id === lastPracticedVocabId);
      if (lastVocab && lastVocab.modulo) {
        targetLessonVocab = this.allVocab.filter(v => v.modulo === lastVocab.modulo);
      } else {
        const firstModulo = this.allVocab[0]?.modulo || 'ALL';
        targetLessonVocab = this.allVocab.filter(v => v.modulo === firstModulo);
      }
    }

    // ~11 Vokabeln aus Ziel-Lektion (bevorzugt noch unberührt oder niedrigere Kästen)
    const lessonUntouched = targetLessonVocab
      .filter(v => (this.userState.vocabStats?.[v.id]?.seenCount || 0) === 0)
      .sort(() => Math.random() - 0.5);
    const lessonTouched = targetLessonVocab
      .filter(v => (this.userState.vocabStats?.[v.id]?.seenCount || 0) > 0)
      .sort(() => Math.random() - 0.5);

    const lessonCandidates = [...lessonUntouched, ...lessonTouched];
    const selectedLesson = lessonCandidates.slice(0, 11);
    const selectedLessonIds = new Set(selectedLesson.map(v => v.id));

    // ~9 Vokabeln aus dem aktiven Wiederholungstopf (nur geübte, außerhalb der Ziel-Lektion)
    const repeatCandidates = circulating.filter(v => !selectedLessonIds.has(v.id));

    // Gewichtung nach Leitner-Kästen
    const b1 = repeatCandidates.filter(v => this.getBox(v.id) === 1).sort(() => Math.random() - 0.5);
    const b2 = repeatCandidates.filter(v => this.getBox(v.id) === 2).sort(() => Math.random() - 0.5);
    const b3 = repeatCandidates.filter(v => this.getBox(v.id) === 3).sort(() => Math.random() - 0.5);
    const b45 = repeatCandidates.filter(v => this.getBox(v.id) >= 4).sort(() => Math.random() - 0.5);

    const selectedRepeat = [
      ...b1.slice(0, 4),  // ~40%
      ...b2.slice(0, 3),  // ~30%
      ...b3.slice(0, 1),  // ~15%
      ...b45.slice(0, 1)  // ~15%
    ];

    let pool = [...selectedLesson, ...selectedRepeat];
    const poolIds = new Set(pool.map(v => v.id));

    // Falls Wiederholungstopf noch nicht genug Wörter hat: mit weiteren Wiederholungskandidaten auffüllen
    if (pool.length < 20) {
      const remainingRepeat = repeatCandidates.filter(v => !poolIds.has(v.id)).sort(() => Math.random() - 0.5);
      for (const v of remainingRepeat) {
        if (pool.length >= 20) break;
        pool.push(v);
        poolIds.add(v.id);
      }
    }

    // Falls immer noch unter 20: mit weiteren Wörtern der Ziel-Lektion auffüllen
    if (pool.length < 20) {
      const remainingLesson = targetLessonVocab.filter(v => !poolIds.has(v.id)).sort(() => Math.random() - 0.5);
      for (const v of remainingLesson) {
        if (pool.length >= 20) break;
        pool.push(v);
        poolIds.add(v.id);
      }
    }

    // Falls immer noch unter 20: aus allVocab auffüllen
    if (pool.length < 20) {
      const remainingAll = this.allVocab.filter(v => !poolIds.has(v.id)).sort(() => Math.random() - 0.5);
      for (const v of remainingAll) {
        if (pool.length >= 20) break;
        pool.push(v);
        poolIds.add(v.id);
      }
    }

    return pool.slice(0, 20).sort(() => Math.random() - 0.5);
  }

  /**
   * WOCHENEND-SPEZIAL (Bis zu 3 Münzen)
   */
  isWeekend() {
    if (this.simulateWeekend) return true;
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sonntag (0) oder Samstag (6)
  }

  updateWeekendUIStatus() {
    const isWknd = this.isWeekend();
    if (this.dom.profWeekendStatus) {
      this.dom.profWeekendStatus.textContent = isWknd 
        ? (this.simulateWeekend ? "Simuliert aktiv (Testmodus)" : "Aktiv (Wochenende!)")
        : "Inaktiv (Mo-Fr)";
      this.dom.profWeekendStatus.className = isWknd ? "font-bold text-emerald-600" : "font-bold text-slate-700";
    }
    if (this.dom.profWeekendToggleBtn) {
      this.dom.profWeekendToggleBtn.textContent = this.simulateWeekend 
        ? "Wochenend-Modus beenden" 
        : "Wochenend-Modus testen";
    }
    if (this.dom.heroWeekendBtn) {
      if (isWknd) {
        this.dom.heroWeekendBtn.classList.remove('opacity-75');
      } else {
        this.dom.heroWeekendBtn.classList.add('opacity-75');
      }
    }
  }

  toggleWeekendSimulation() {
    this.simulateWeekend = !this.simulateWeekend;
    this.updateWeekendUIStatus();
  }

  startWeekendSpecialSession() {
    if (!this.allVocab || this.allVocab.length === 0) {
      alert("Vokabeln werden noch geladen. Bitte einen kurzen Moment warten...");
      return;
    }

    if (!this.isWeekend()) {
      const confirmTest = confirm("Das Wochenend-Spezial ist regulär nur samstags und sonntags aktiv.\n\nMöchtest du es jetzt trotzdem im Testmodus starten?");
      if (!confirmTest) return;
      this.simulateWeekend = true;
      this.updateWeekendUIStatus();
    }

    // 25 Vokabeln aus bisher geübtem Umlauf-Topf + schwierige Kasten 1&2
    const circulating = this.allVocab.filter(v => (this.userState.vocabStats?.[v.id]?.seenCount || 0) > 0);
    let pool = [];

    if (circulating.length >= 25) {
      const difficult = circulating.filter(v => this.getBox(v.id) <= 2).sort(() => Math.random() - 0.5);
      const rest = circulating.filter(v => this.getBox(v.id) > 2).sort(() => Math.random() - 0.5);
      pool = [...difficult.slice(0, 15), ...rest.slice(0, 10)];
      if (pool.length < 25) {
        const poolIds = new Set(pool.map(v => v.id));
        const rem = circulating.filter(v => !poolIds.has(v.id)).sort(() => Math.random() - 0.5);
        pool.push(...rem.slice(0, 25 - pool.length));
      }
    } else {
      pool = [...circulating];
      const poolIds = new Set(pool.map(v => v.id));
      const remAll = this.allVocab.filter(v => !poolIds.has(v.id)).sort(() => Math.random() - 0.5);
      pool.push(...remAll.slice(0, 25 - pool.length));
    }

    pool = pool.slice(0, 25).sort(() => Math.random() - 0.5);
    this.startSessionWithList(pool, 'typing', 'weekend');
  }

  startSessionWithList(list, mode = 'typing', sessionType = 'standard') {
    this.sessionMode = mode;
    this.currentSessionType = sessionType;
    this.sessionStartTime = Date.now();
    let pool = [...list];

    if (sessionType === 'standard') {
      if (this.dom.optShuffle && this.dom.optShuffle.checked) {
        pool.sort(() => Math.random() - 0.5);
      }
      if (this.dom.optLimit20 && this.dom.optLimit20.checked && pool.length > 20) {
        pool = pool.slice(0, 20);
      }
    }

    this.sessionVocab = pool;
    this.currentIndex = 0;
    this.sessionStats = {
      totalAnswered: 0,
      correctCount: 0,
      currentStreak: this.userState.streak,
      bestStreak: this.userState.streak,
      xpEarned: 0,
      mistakes: []
    };

    this.dom.viewDashboard.classList.add('hidden');
    this.dom.viewSummary.classList.add('hidden');
    this.dom.viewTraining.classList.remove('hidden');

    this.renderCurrentCard();
  }

  renderCurrentCard() {
    if (this.currentIndex >= this.sessionVocab.length) {
      this.finishSession();
      return;
    }

    const item = this.sessionVocab[this.currentIndex];
    const box = this.getBox(item.id);
    this.cardState = 'AWAITING_ANSWER';

    // Update Progress
    const currentNum = this.currentIndex + 1;
    const totalNum = this.sessionVocab.length;
    this.dom.sessionCounterText.textContent = `Vokabel ${currentNum} von ${totalNum}`;
    const pct = Math.round(((currentNum - 1) / totalNum) * 100);
    this.dom.sessionProgressBar.style.width = `${pct}%`;
    this.dom.sessionStreakCount.textContent = this.userState.streak;

    // Box Badge
    this.dom.cardBoxBadge.className = `box-badge box-${box}`;
    this.dom.cardBoxBadge.textContent = `Kasten ${box}`;

    // Card Metadata
    const metaParts = [];
    if (item.modulo) metaParts.push(item.modulo);
    if (item.unidad) metaParts.push(item.unidad);
    if (item.seite) metaParts.push(`Seite ${item.seite}`);
    this.dom.cardMetadata.textContent = metaParts.join(' • ');

    // Direction Decision
    const dirSetting = this.dom.filterDirection.value;
    if (dirSetting === 'MIXED') {
      this.currentDirection = Math.random() > 0.5 ? 'ES_TO_DE' : 'DE_TO_ES';
    } else {
      this.currentDirection = dirSetting;
    }

    // Display Card Prompt and Word
    if (this.currentDirection === 'ES_TO_DE') {
      this.dom.cardPromptLabel.textContent = "🇪🇸 Übersetze ins Deutsche:";
      this.dom.cardWord.textContent = item.espanol;
    } else {
      this.dom.cardPromptLabel.textContent = "🇩🇪 Übersetze ins Spanische:";
      this.dom.cardWord.textContent = item.deutsch;
    }

    // Vorlesen-Knopf erst nach Eingabe/Auswertung einblenden
    if (this.dom.ttsPlayBtn) {
      this.dom.ttsPlayBtn.classList.add('hidden');
    }

    // Context / Beispielsatz
    if (item.beispiel && item.beispiel.trim()) {
      this.dom.cardContextSentence.textContent = `Beispiel: „${item.beispiel}“`;
    } else {
      this.dom.cardContextSentence.textContent = '';
    }

    // Reset feedback and styles
    this.dom.feedbackBanner.classList.add('hidden');
    this.dom.trainingCard.classList.remove('animate-shake', 'animate-pop');

    // Reset Action Button
    this.dom.actionBtn.innerHTML = `<span>PRÜFEN</span><kbd class="text-xs bg-black/20 px-2 py-0.5 rounded text-white font-sans hidden sm:inline">Enter ↵</kbd>`;
    this.dom.actionBtn.className = "btn-game btn-game-primary w-full py-3.5 rounded-2xl font-game font-bold text-lg shadow-md flex items-center justify-center gap-2";

    // Show appropriate mode view
    if (this.sessionMode === 'typing') {
      this.dom.modeTypingContainer.classList.remove('hidden');
      this.dom.modeBlitzContainer.classList.add('hidden');
      this.dom.answerInput.value = '';
      this.dom.answerInput.disabled = false;
      this.dom.answerInput.className = "w-full text-center font-game font-semibold text-xl sm:text-2xl px-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white shadow-inner transition-all";
      setTimeout(() => this.dom.answerInput.focus(), 50);
    } else {
      this.dom.modeTypingContainer.classList.add('hidden');
      this.dom.modeBlitzContainer.classList.remove('hidden');
      this.setupBlitzChoices(item);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  setupBlitzChoices(correctItem) {
    const isEsToDe = this.currentDirection === 'ES_TO_DE';
    const targetProp = isEsToDe ? 'deutsch' : 'espanol';
    const correctAnswer = correctItem[targetProp];

    // Pick 3 distractors from allVocab
    const distractors = this.allVocab
      .filter(v => v.id !== correctItem.id && v[targetProp] && v[targetProp] !== correctAnswer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(v => v[targetProp]);

    const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
    this.currentCorrectOptionIndex = options.indexOf(correctAnswer);

    this.dom.choiceBtns.forEach((btn, idx) => {
      btn.disabled = false;
      btn.className = "btn-game bg-white border-2 border-slate-200 hover:border-blue-400 p-3.5 rounded-2xl text-left font-game font-semibold text-slate-700 flex items-center gap-3 transition-all";
      btn.querySelector('.choice-text').textContent = options[idx] || '';
    });
  }

  selectChoice(index) {
    if (this.cardState !== 'AWAITING_ANSWER') return;
    const isCorrect = (index === this.currentCorrectOptionIndex);
    const item = this.sessionVocab[this.currentIndex];
    const isEsToDe = this.currentDirection === 'ES_TO_DE';
    const expected = isEsToDe ? item.deutsch : item.espanol;

    // Highlight buttons
    this.dom.choiceBtns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === this.currentCorrectOptionIndex) {
        btn.className = "btn-game bg-emerald-100 border-2 border-emerald-500 text-emerald-800 p-3.5 rounded-2xl text-left font-game font-semibold flex items-center gap-3";
      } else if (idx === index && !isCorrect) {
        btn.className = "btn-game bg-rose-100 border-2 border-rose-500 text-rose-800 p-3.5 rounded-2xl text-left font-game font-semibold flex items-center gap-3";
      }
    });

    const chosenText = this.dom.choiceBtns[index]?.querySelector('.choice-text')?.textContent || '';

    if (isCorrect) {
      this.handleSuccess(item, expected, "Blitzschnell und absolut richtig! 🎉", 10, chosenText);
    } else {
      this.handleFailure(item, expected, chosenText);
    }
  }

  handleActionClick() {
    if (this.cardState === 'AWAITING_ANSWER') {
      if (this.sessionMode === 'typing') {
        this.checkTypingAnswer();
      }
    } else {
      // Advance to next card
      this.currentIndex++;
      this.renderCurrentCard();
    }
  }

  checkTypingAnswer() {
    const inputVal = this.dom.answerInput.value.trim();
    if (!inputVal) {
      this.dom.answerInput.focus();
      return;
    }

    const item = this.sessionVocab[this.currentIndex];
    const isSpanishTarget = (this.currentDirection === 'DE_TO_ES');
    const expectedString = isSpanishTarget ? item.espanol : item.deutsch;

    const evalResult = this.evaluateAnswer(inputVal, expectedString, isSpanishTarget);

    if (evalResult.status === 'CORRECT') {
      this.handleSuccess(item, expectedString, "Hervorragend! Komplett richtig! ⭐", 10, inputVal);
    } else if (evalResult.status === 'ACCENT_WARNING') {
      this.handleAccentWarning(item, expectedString, evalResult.message, 8, inputVal);
    } else if (evalResult.status === 'TYPO_CORRECT') {
      this.handleTypoSuccess(item, expectedString, evalResult.message, 8, inputVal);
    } else {
      this.handleFailure(item, expectedString, inputVal);
    }
  }

  /**
   * INTELLIGENTE, FEHLERTOLERANTE EINGABEPRÜFUNG
   */
  evaluateAnswer(userInput, expectedString, isSpanishTarget) {
    const cleanUser = userInput.trim().toLowerCase();
    
    // 1. Generate all possible target synonyms from the expected string
    // e.g. "Okay, ... / Gut ..." -> ["okay", "gut"]
    // e.g. "das Geschäft, der Laden" -> ["das geschäft", "der laden"]
    // e.g. "el/la amigo/-a" -> ["el amigo", "la amiga", "amigo", "amiga"]
    const synonyms = this.extractSynonyms(expectedString);

    // Exact matches
    for (const syn of synonyms) {
      if (cleanUser === syn) {
        return { status: 'CORRECT' };
      }
    }

    // Article-stripped matches
    const userNoArticle = this.stripArticle(cleanUser, isSpanishTarget);
    for (const syn of synonyms) {
      const synNoArticle = this.stripArticle(syn, isSpanishTarget);
      if (userNoArticle === synNoArticle) {
        return { status: 'CORRECT' };
      }
    }

    // Accent-insensitive check (for Spanish)
    if (isSpanishTarget) {
      const userNoAccents = this.stripAccents(cleanUser);
      for (const syn of synonyms) {
        const synNoAccents = this.stripAccents(syn);
        if (userNoAccents === synNoAccents) {
          return {
            status: 'ACCENT_WARNING',
            message: `Achte auf die Akzente & Sonderzeichen: „${expectedString}“`
          };
        }
        // Also compare with article removed
        const synNoArtNoAcc = this.stripAccents(this.stripArticle(syn, true));
        const userNoArtNoAcc = this.stripAccents(userNoArticle);
        if (userNoArtNoAcc === synNoArtNoAcc) {
          return {
            status: 'ACCENT_WARNING',
            message: `Achte auf die Akzente: „${expectedString}“`
          };
        }
      }
    }

    // Levenshtein typo tolerance (distance == 1 on words >= 4 chars)
    for (const syn of synonyms) {
      const synClean = this.stripArticle(syn, isSpanishTarget);
      const userClean = userNoArticle;
      if (synClean.length >= 4 && userClean.length >= 4) {
        const dist = this.levenshtein(userClean, synClean);
        if (dist === 1) {
          return {
            status: 'TYPO_CORRECT',
            message: `Kleiner Tippfehler, aber gewertet! Richtig: „${expectedString}“`
          };
        }
      }
    }

    return { status: 'WRONG' };
  }

  extractSynonyms(raw) {
    // Remove grammatical annotations like "m.", "f.", "pl.", "sg.", "adj.", "adv."
    let text = raw.replace(/\b(m\.|f\.|pl\.|sg\.|adj\.|adv\.|sust\.|inf\.|fam\.)/g, '');
    
    // Split by comma, slash, semicolon, or "oder"
    const parts = text.split(/[,/;]|\boder\b/i);
    const results = [];

    parts.forEach(p => {
      let cleaned = p.trim().toLowerCase();
      // Remove trailing dots, question marks, exclamation marks
      cleaned = cleaned.replace(/[¡!¿?.]/g, '').trim();
      if (cleaned) {
        results.push(cleaned);
        // Also add variant without parenthesized text e.g. "(sehr) gut" -> "gut" and "sehr gut"
        if (cleaned.includes('(') && cleaned.includes(')')) {
          const withoutParens = cleaned.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
          const insideParens = cleaned.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
          if (withoutParens) results.push(withoutParens);
          if (insideParens) results.push(insideParens);
        }
      }
    });

    return Array.from(new Set(results));
  }

  stripArticle(str, isSpanish) {
    if (isSpanish) {
      return str.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
    } else {
      return str.replace(/^(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i, '').trim();
    }
  }

  stripAccents(str) {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, 'n')
      .replace(/[¡!¿?.]/g, '')
      .trim();
  }

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  recordVocabPractice(item, isCorrect) {
    if (!this.userState.vocabStats) this.userState.vocabStats = {};
    if (!this.userState.vocabStats[item.id]) {
      this.userState.vocabStats[item.id] = { seenCount: 0, correctCount: 0, lastPracticed: 0 };
    }
    const stat = this.userState.vocabStats[item.id];
    stat.seenCount = (stat.seenCount || 0) + 1;
    if (isCorrect) {
      stat.correctCount = (stat.correctCount || 0) + 1;
    }
    stat.lastPracticed = Date.now();
    this.saveUserState();
  }

  handleSuccess(item, expected, title, xp = 10, userInput = '') {
    this.cardState = 'SHOWING_FEEDBACK';
    this.feedbackShownAt = Date.now();
    this.sessionStats.totalAnswered++;
    this.sessionStats.correctCount++;
    this.incrementStreak();
    this.addXp(xp);
    this.recordVocabPractice(item, true);

    // Promote Leitner Box
    const currentBox = this.getBox(item.id);
    if (currentBox < 5) {
      this.setBox(item.id, currentBox + 1);
    }

    this.sound.playSuccess();
    this.dom.trainingCard.classList.add('animate-pop');

    // Vorlesen-Knopf oben einblenden & Vokabel automatisch einmal vorlesen
    if (this.dom.ttsPlayBtn) this.dom.ttsPlayBtn.classList.remove('hidden');
    if (this.tts) this.tts.speak(item.espanol);

    if (this.sessionMode === 'typing') {
      this.dom.answerInput.disabled = true;
      this.dom.answerInput.className = "w-full text-center font-game font-semibold text-xl sm:text-2xl px-4 py-3.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 rounded-2xl shadow-inner transition-all";
    }

    const detailHtml = `
      <div class="my-2 text-sm text-emerald-900 flex items-center justify-center gap-2 flex-wrap">
        <div>Lösung: <span class="font-bold bg-white/90 px-3 py-1 rounded-xl shadow-sm text-emerald-700 text-base inline-block">${expected}</span> <span class="ml-1 font-bold text-emerald-600">(+${xp} XP)</span></div>
        <button onclick="app.tts.speak('${this.escapeHtml(item.espanol).replace(/'/g, "\\'")}')" class="p-1.5 bg-white/90 hover:bg-white text-emerald-800 rounded-xl shadow-sm text-xs font-bold inline-flex items-center gap-1 border border-emerald-300" title="Nochmal anhören">
          <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
          <span>Nochmal</span>
        </button>
      </div>
      <div class="mt-3 pt-2 border-t border-emerald-200/60 text-xs text-emerald-800 font-medium flex items-center justify-center gap-1.5">
        <span>⌨️ Drücke eine <strong>beliebige Taste</strong> oder <strong>Enter</strong> für die nächste Vokabel</span>
      </div>
    `;

    this.showFeedback('success', title, detailHtml);
    this.prepareAdvanceButton();
  }

  handleAccentWarning(item, expected, message, xp = 8, userInput = '') {
    this.cardState = 'SHOWING_FEEDBACK';
    this.feedbackShownAt = Date.now();
    this.sessionStats.totalAnswered++;
    this.sessionStats.correctCount++;
    this.incrementStreak();
    this.addXp(xp);
    this.recordVocabPractice(item, true);

    // Promote Leitner Box
    const currentBox = this.getBox(item.id);
    if (currentBox < 5) {
      this.setBox(item.id, currentBox + 1);
    }

    this.sound.playWarning();

    // Vorlesen-Knopf oben einblenden & Vokabel automatisch einmal vorlesen
    if (this.dom.ttsPlayBtn) this.dom.ttsPlayBtn.classList.remove('hidden');
    if (this.tts) this.tts.speak(item.espanol);

    if (this.sessionMode === 'typing') {
      this.dom.answerInput.disabled = true;
      this.dom.answerInput.className = "w-full text-center font-game font-semibold text-xl sm:text-2xl px-4 py-3.5 bg-amber-50 border-2 border-amber-500 text-amber-800 rounded-2xl shadow-inner transition-all";
    }

    const escapedUser = this.escapeHtml(userInput);
    const detailHtml = `
      <div class="space-y-1.5 my-2 text-sm text-amber-950">
        <div>Deine Eingabe: <span class="font-bold bg-white/70 px-2.5 py-0.5 rounded text-amber-900">${escapedUser}</span></div>
        <div class="font-medium text-base flex items-center justify-center gap-2 flex-wrap">
          <span>Exakte Schreibweise mit Akzent: <span class="font-bold bg-white/90 px-3 py-1 rounded-xl shadow-sm text-emerald-700 inline-block">${expected}</span> <span class="ml-1 text-xs font-bold text-amber-700">(+${xp} XP)</span></span>
          <button onclick="app.tts.speak('${this.escapeHtml(item.espanol).replace(/'/g, "\\'")}')" class="p-1.5 bg-white/90 hover:bg-white text-amber-900 rounded-xl shadow-sm text-xs font-bold inline-flex items-center gap-1 border border-amber-300" title="Nochmal anhören">
            <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            <span>Anhören</span>
          </button>
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-amber-200/60 text-xs text-amber-900 font-medium flex items-center justify-center gap-1.5">
        <span>⌨️ Drücke eine <strong>beliebige Taste</strong> oder <strong>Enter</strong> für die nächste Vokabel</span>
      </div>
    `;

    this.showFeedback('warning', "⚠️ Fast perfekt! Achte auf die Akzente!", detailHtml);
    this.prepareAdvanceButton();
  }

  handleTypoSuccess(item, expected, message, xp = 8, userInput = '') {
    this.cardState = 'SHOWING_FEEDBACK';
    this.feedbackShownAt = Date.now();
    this.sessionStats.totalAnswered++;
    this.sessionStats.correctCount++;
    this.incrementStreak();
    this.addXp(xp);
    this.recordVocabPractice(item, true);

    // Promote Leitner Box
    const currentBox = this.getBox(item.id);
    if (currentBox < 5) {
      this.setBox(item.id, currentBox + 1);
    }

    this.sound.playWarning();

    // Vorlesen-Knopf oben einblenden & Vokabel automatisch einmal vorlesen
    if (this.dom.ttsPlayBtn) this.dom.ttsPlayBtn.classList.remove('hidden');
    if (this.tts) this.tts.speak(item.espanol);

    if (this.sessionMode === 'typing') {
      this.dom.answerInput.disabled = true;
      this.dom.answerInput.className = "w-full text-center font-game font-semibold text-xl sm:text-2xl px-4 py-3.5 bg-blue-50 border-2 border-blue-500 text-blue-800 rounded-2xl shadow-inner transition-all";
    }

    const escapedUser = this.escapeHtml(userInput);
    const detailHtml = `
      <div class="space-y-1.5 my-2 text-sm text-blue-950">
        <div>Deine Eingabe: <span class="font-bold bg-white/70 px-2.5 py-0.5 rounded text-blue-900">${escapedUser}</span></div>
        <div class="font-medium text-base flex items-center justify-center gap-2 flex-wrap">
          <span>Richtig geschrieben: <span class="font-bold bg-white/90 px-3 py-1 rounded-xl shadow-sm text-emerald-700 inline-block">${expected}</span> <span class="ml-1 text-xs font-bold text-blue-700">(+${xp} XP)</span></span>
          <button onclick="app.tts.speak('${this.escapeHtml(item.espanol).replace(/'/g, "\\'")}')" class="p-1.5 bg-white/90 hover:bg-white text-blue-900 rounded-xl shadow-sm text-xs font-bold inline-flex items-center gap-1 border border-blue-300" title="Nochmal anhören">
            <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            <span>Anhören</span>
          </button>
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-blue-200/60 text-xs text-blue-900 font-medium flex items-center justify-center gap-1.5">
        <span>⌨️ Drücke eine <strong>beliebige Taste</strong> oder <strong>Enter</strong> für die nächste Vokabel</span>
      </div>
    `;

    this.showFeedback('info', "💡 Tippfehler erkannt, aber gewertet!", detailHtml);
    this.prepareAdvanceButton();
  }

  handleFailure(item, expected, userInput = '') {
    this.cardState = 'SHOWING_FEEDBACK';
    this.feedbackShownAt = Date.now();
    this.sessionStats.totalAnswered++;
    this.resetStreak();
    this.recordVocabPractice(item, false);
    this.sessionStats.mistakes.push({
      item,
      userAnswer: userInput || "(Keine Antwort)",
      expected
    });

    // Demote Leitner Box to 1
    this.setBox(item.id, 1);

    this.sound.playError();
    this.dom.trainingCard.classList.add('animate-shake');

    // Vorlesen-Knopf oben einblenden & Vokabel automatisch einmal vorlesen
    if (this.dom.ttsPlayBtn) this.dom.ttsPlayBtn.classList.remove('hidden');
    if (this.tts) this.tts.speak(item.espanol);

    if (this.sessionMode === 'typing') {
      this.dom.answerInput.disabled = true;
      this.dom.answerInput.className = "w-full text-center font-game font-semibold text-xl sm:text-2xl px-4 py-3.5 bg-rose-50 border-2 border-rose-500 text-rose-700 rounded-2xl shadow-inner transition-all";
    }

    const escapedUser = this.escapeHtml(userInput || '(leer)');
    const detailHtml = `
      <div class="space-y-2 my-2 text-sm">
        <div class="text-rose-800 font-medium">Deine Eingabe: <span class="line-through font-bold bg-white/70 px-2.5 py-0.5 rounded text-rose-900">${escapedUser}</span></div>
        <div class="text-emerald-950 font-medium text-base flex items-center justify-center gap-2 flex-wrap">
          <span>Richtige Vokabel: <span class="font-bold bg-white/90 px-3 py-1 rounded-xl shadow-sm text-emerald-700 inline-block">${expected}</span></span>
          <button onclick="app.tts.speak('${this.escapeHtml(item.espanol).replace(/'/g, "\\'")}')" class="p-1.5 bg-white/90 hover:bg-white text-rose-900 rounded-xl shadow-sm text-xs font-bold inline-flex items-center gap-1 border border-rose-300" title="Aussprache anhören">
            <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            <span>Aussprache</span>
          </button>
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-rose-200/60 text-xs text-rose-800 font-medium flex items-center justify-center gap-1.5">
        <span>⌨️ Drücke eine <strong>beliebige Taste</strong> oder <strong>Enter</strong> für die nächste Vokabel</span>
      </div>
    `;

    this.showFeedback('danger', "❌ Leider nicht ganz richtig!", detailHtml);
    this.prepareAdvanceButton();
  }

  showFeedback(type, title, detail) {
    const fb = this.dom.feedbackBanner;
    fb.classList.remove('hidden', 'bg-emerald-100', 'text-emerald-800', 'border-emerald-300',
                          'bg-amber-100', 'text-amber-800', 'border-amber-300',
                          'bg-blue-100', 'text-blue-800', 'border-blue-300',
                          'bg-rose-100', 'text-rose-800', 'border-rose-300');
    fb.classList.add('border-2');

    if (type === 'success') {
      fb.classList.add('bg-emerald-100', 'text-emerald-800', 'border-emerald-300');
    } else if (type === 'warning') {
      fb.classList.add('bg-amber-100', 'text-amber-800', 'border-amber-300');
    } else if (type === 'info') {
      fb.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-300');
    } else {
      fb.classList.add('bg-rose-100', 'text-rose-800', 'border-rose-300');
    }

    this.dom.feedbackTitle.innerHTML = title;
    this.dom.feedbackDetail.innerHTML = detail;

    if (this.sessionMode === 'typing') {
      this.dom.answerInput.disabled = true;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  prepareAdvanceButton() {
    this.dom.actionBtn.innerHTML = `<span>WEITER</span><kbd class="text-xs bg-black/20 px-2 py-0.5 rounded text-white font-sans hidden sm:inline">Beliebige Taste ↵</kbd>`;
    this.dom.actionBtn.className = "btn-game btn-game-success w-full py-3.5 rounded-2xl font-game font-bold text-lg shadow-md flex items-center justify-center gap-2";
    if (this.dom.answerInput) {
      this.dom.answerInput.blur();
    }
  }

  insertChar(char) {
    if (this.sessionMode !== 'typing' || this.dom.answerInput.disabled) return;
    const input = this.dom.answerInput;
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.substring(0, start) + char + input.value.substring(end);
    input.focus();
    input.setSelectionRange(start + 1, start + 1);
  }

  speakCurrentWord() {
    if (this.currentIndex < this.sessionVocab.length) {
      const item = this.sessionVocab[this.currentIndex];
      this.tts.speak(item.espanol);
    }
  }

  finishSession() {
    this.dom.viewTraining.classList.add('hidden');
    this.dom.viewSummary.classList.remove('hidden');

    // 1. Record Learning Time
    const elapsedSeconds = this.sessionStartTime ? Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000)) : 0;
    if (elapsedSeconds > 0) {
      this.recordLearningTime(elapsedSeconds);
    }

    const total = this.sessionStats.totalAnswered;
    const correct = this.sessionStats.correctCount;
    const mistakesCount = this.sessionStats.mistakes.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const mistakesPct = total > 0 ? (100 - pct) : 0;

    // 2. Check and Award Coins
    let coinsEarnedThisRound = 0;
    if (this.currentSessionType === 'daily') {
      // 18, 19, or 20 correct answers in Daily Goal -> 1 Coin
      if (correct >= 18 && total >= 18) {
        coinsEarnedThisRound = 1;
        this.awardCoins(1, 'daily');
      }
    } else if (this.currentSessionType === 'weekend') {
      // Weekend Special (25 words)
      if (correct >= 23) {
        coinsEarnedThisRound = 3;
        this.awardCoins(3, 'weekend');
      } else if (correct >= 20) {
        coinsEarnedThisRound = 2;
        this.awardCoins(2, 'weekend');
      } else if (correct >= 17) {
        coinsEarnedThisRound = 1;
        this.awardCoins(1, 'weekend');
      }
    }

    // Stat-Zahlen
    this.dom.summaryAccuracy.textContent = `${pct}%`;
    this.dom.summaryCorrectCount.textContent = `${correct} / ${total}`;
    this.dom.summaryBestStreak.textContent = `🔥 ${this.sessionStats.bestStreak}`;
    this.dom.summaryXpEarned.textContent = `+${this.sessionStats.xpEarned} XP`;

    // Grafische Erfolgs-/Misserfolgs-Balken
    if (this.dom.summaryBarCorrect) {
      this.dom.summaryBarCorrect.style.width = `${pct}%`;
    }
    if (this.dom.summaryBarMistakes) {
      this.dom.summaryBarMistakes.style.width = `${mistakesPct}%`;
    }
    if (this.dom.summaryGraphCorrectText) {
      this.dom.summaryGraphCorrectText.textContent = `${correct} Richtig (${pct}%)`;
    }
    if (this.dom.summaryGraphMistakesText) {
      this.dom.summaryGraphMistakesText.textContent = `${mistakesCount} Falsch (${mistakesPct}%)`;
    }

    // Visuelle Auswertung / Stimmung / Trophäe
    if (pct >= 85) {
      if (this.dom.summaryIcon) this.dom.summaryIcon.textContent = coinsEarnedThisRound > 0 ? '🪙' : '🏆';
      if (this.dom.summaryIconContainer) {
        this.dom.summaryIconContainer.className = "w-20 h-20 mx-auto bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-3xl flex items-center justify-center text-4xl shadow-lg mb-4 animate-bounce";
      }
      if (this.dom.summaryTitle) {
        this.dom.summaryTitle.textContent = coinsEarnedThisRound > 0 
          ? `¡Excelente! +${coinsEarnedThisRound} Münze${coinsEarnedThisRound > 1 ? 'n' : ''} verdient! 🪙` 
          : '¡Excelente! Riesiger Erfolg! ⭐';
      }
      if (this.dom.summarySubtitle) {
        this.dom.summarySubtitle.textContent = coinsEarnedThisRound > 0
          ? `Hervorragende Leistung! Deine Münze${coinsEarnedThisRound > 1 ? 'n liegen' : ' liegt'} jetzt sicher auf deinem Münzhaufen!`
          : 'Fantastisch! Du hast fast alle Vokabeln dieser Einheit fehlerfrei beherrscht!';
      }
      if (this.dom.summaryFeedbackGrade) this.dom.summaryFeedbackGrade.textContent = 'Bewertung: Ausgezeichnet gemeistert! 🌟';
      this.triggerConfetti();
      this.sound.playLevelUp();
    } else if (pct >= 60) {
      if (this.dom.summaryIcon) this.dom.summaryIcon.textContent = coinsEarnedThisRound > 0 ? '🪙' : '🥈';
      if (this.dom.summaryIconContainer) {
        this.dom.summaryIconContainer.className = "w-20 h-20 mx-auto bg-gradient-to-tr from-blue-400 to-indigo-300 rounded-3xl flex items-center justify-center text-4xl shadow-lg mb-4";
      }
      if (this.dom.summaryTitle) {
        this.dom.summaryTitle.textContent = coinsEarnedThisRound > 0
          ? `¡Buen trabajo! +${coinsEarnedThisRound} Münze${coinsEarnedThisRound > 1 ? 'n' : ''} verdient! 🪙`
          : '¡Buen trabajo! Guter Fortschritt! 👍';
      }
      if (this.dom.summarySubtitle) {
        this.dom.summarySubtitle.textContent = 'Mehr als die Hälfte sitzt schon super! Wiederhole die Fehler, um 100% zu schaffen!';
      }
      if (this.dom.summaryFeedbackGrade) this.dom.summaryFeedbackGrade.textContent = 'Bewertung: Guter Lernerfolg! 💪';
      this.sound.playSuccess();
    } else {
      if (this.dom.summaryIcon) this.dom.summaryIcon.textContent = '🎯';
      if (this.dom.summaryIconContainer) {
        this.dom.summaryIconContainer.className = "w-20 h-20 mx-auto bg-gradient-to-tr from-rose-400 to-orange-300 rounded-3xl flex items-center justify-center text-4xl shadow-lg mb-4";
      }
      if (this.dom.summaryTitle) this.dom.summaryTitle.textContent = '¡Ánimo! Noch etwas üben! 💪';
      if (this.dom.summarySubtitle) {
        this.dom.summarySubtitle.textContent = this.currentSessionType === 'daily'
          ? 'Tipp: Erreiche mindestens 18 von 20 richtigen Antworten für eine Goldmünze!'
          : 'Aller Anfang ist schwer. Klicke unten auf "Fehler wiederholen", um sie dir einzuprägen!';
      }
      if (this.dom.summaryFeedbackGrade) this.dom.summaryFeedbackGrade.textContent = 'Bewertung: Nicht aufgeben – Übung macht den Meister! 🚀';
      this.sound.playWarning();
    }

    // Fehler-Liste zur Nachbereitung
    const mistakes = this.sessionStats.mistakes;
    if (mistakes.length > 0) {
      this.dom.summaryMistakesContainer.classList.remove('hidden');
      this.dom.summaryRetryMistakesBtn.classList.remove('hidden');
      this.dom.summaryMistakeCount.textContent = mistakes.length;

      this.dom.summaryMistakesList.innerHTML = mistakes.map(m => `
        <div class="bg-white p-2.5 rounded-xl border border-rose-200 flex items-center justify-between shadow-sm">
          <div>
            <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span>${this.escapeHtml(m.item.espanol)}</span>
              <span class="text-slate-400 text-xs">➜</span>
              <span class="text-emerald-700">${this.escapeHtml(m.expected)}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              Deine Eingabe: <span class="line-through text-rose-600 font-semibold">${this.escapeHtml(m.userAnswer)}</span> • ${m.item.modulo || ''} (S. ${m.item.seite || ''})
            </div>
          </div>
          <button onclick="app.tts.speak('${m.item.espanol.replace(/'/g, "\\'")}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors ml-2" title="Vorlesen">
            <i data-lucide="volume-2" class="w-4 h-4"></i>
          </button>
        </div>
      `).join('');
    } else {
      this.dom.summaryMistakesContainer.classList.add('hidden');
      this.dom.summaryRetryMistakesBtn.classList.add('hidden');
    }

    this.updateLeitnerCounts();
    if (window.lucide) window.lucide.createIcons();
  }

  recordLearningTime(seconds) {
    if (seconds <= 0) return;
    if (!this.userState.learningTime) {
      this.userState.learningTime = { totalSeconds: 0, history: [] };
    }
    this.userState.learningTime.totalSeconds = (this.userState.learningTime.totalSeconds || 0) + seconds;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    this.userState.learningTime.history.push({
      date: dateStr,
      timestamp: Date.now(),
      seconds: seconds
    });
    this.saveUserState();
  }

  awardCoins(amount, type = 'daily') {
    if (amount <= 0) return;
    if (!this.userState.coins) {
      this.userState.coins = { total: 0, history: [] };
    }
    this.userState.coins.total = (this.userState.coins.total || 0) + amount;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    this.userState.coins.history.push({
      date: dateStr,
      timestamp: Date.now(),
      amount: amount,
      type: type
    });
    this.saveUserState();
    this.triggerCoinDropAnimation(amount);
  }

  triggerCoinDropAnimation(amount = 1) {
    if (!this.dom.coinRewardOverlay) return;

    if (this.dom.coinRewardText) {
      this.dom.coinRewardText.textContent = amount === 1 
        ? "+1 MÜNZE VERDIENT!" 
        : `+${amount} MÜNZEN VERDIENT!`;
    }

    this.dom.coinRewardOverlay.classList.remove('hidden');
    this.sound.playCoinSound();

    if (amount > 1) {
      setTimeout(() => this.sound.playCoinSound(), 350);
      if (amount > 2) {
        setTimeout(() => this.sound.playCoinSound(), 700);
      }
    }

    this.triggerConfetti();

    setTimeout(() => {
      if (this.dom.coinRewardOverlay) {
        this.dom.coinRewardOverlay.classList.add('hidden');
      }
      this.renderCoinPile();
    }, 2800);
  }

  initCoinPileCanvas() {
    this.coinCanvas = this.dom.coinPileCanvas;
    if (!this.coinCanvas) return;
    this.coinCtx = this.coinCanvas.getContext('2d');

    window.addEventListener('resize', () => {
      this.renderCoinPile();
    });
  }

  renderCoinPile() {
    if (!this.coinCanvas || !this.coinCtx) return;

    const canvas = this.coinCanvas;
    const ctx = this.coinCtx;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || window.innerWidth;
    const height = 120; // fixed visual height

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const totalCoins = this.userState.coins?.total || 0;
    if (totalCoins <= 0) {
      // Draw subtle shadow placeholder
      ctx.fillStyle = 'rgba(203, 213, 225, 0.25)';
      ctx.beginPath();
      ctx.ellipse(width / 2, height - 12, 120, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Pseudorandom deterministic generator for consistent stacked layout
    const seededRandom = (seed) => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };

    const centerX = width / 2;
    const baseY = height - 14;
    const coinRadiusX = 22;
    const coinRadiusY = 9;
    const coinThickness = 5;

    // Ground shadow
    const pileSpread = Math.min(width * 0.4, 80 + Math.sqrt(totalCoins) * 35);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(centerX, baseY + 4, pileSpread + 25, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const displayCoinsCount = Math.min(totalCoins, 200);

    const coinsToDraw = [];
    for (let i = 0; i < displayCoinsCount; i++) {
      const r1 = seededRandom(i * 1.618 + 1);
      const r2 = seededRandom(i * 3.141 + 2);
      const r3 = seededRandom(i * 7.777 + 3);

      const layer = Math.floor(Math.sqrt(i * 1.8));
      const layerY = baseY - layer * (coinThickness + 1.5);
      
      const currentSpread = Math.max(30, pileSpread - layer * 14);
      const offsetX = (r1 - 0.5) * 2 * currentSpread;
      const offsetY = layerY + (r2 - 0.5) * 4;
      const angle = (r3 - 0.5) * 0.35;

      coinsToDraw.push({
        x: centerX + offsetX,
        y: offsetY,
        angle: angle,
        layer: layer,
        index: i
      });
    }

    // Sort by y (back to front)
    coinsToDraw.sort((a, b) => a.y - b.y);

    coinsToDraw.forEach(coin => {
      this.drawSingleCoin(ctx, coin.x, coin.y, coinRadiusX, coinRadiusY, coinThickness, coin.angle);
    });

    // Pile Label
    if (totalCoins > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
      ctx.font = 'bold 11px Fredoka, Inter, sans-serif';
      ctx.textAlign = 'center';
      const topY = Math.max(16, baseY - Math.floor(Math.sqrt(displayCoinsCount * 1.8)) * 6.5 - 16);
      ctx.fillText(`🪙 ${totalCoins} im Hort`, centerX, topY);
      ctx.restore();
    }
  }

  drawSingleCoin(ctx, x, y, rx, ry, thickness, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Coin Edge (3D depth cylinder)
    const edgeGrad = ctx.createLinearGradient(-rx, 0, rx, 0);
    edgeGrad.addColorStop(0, '#B45309');
    edgeGrad.addColorStop(0.3, '#F59E0B');
    edgeGrad.addColorStop(0.7, '#FBBF24');
    edgeGrad.addColorStop(1, '#92400E');

    ctx.fillStyle = edgeGrad;
    ctx.beginPath();
    ctx.ellipse(0, thickness, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(-rx, 0);
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Top Face (Gold gradient)
    const topGrad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.3, 2, 0, 0, rx);
    topGrad.addColorStop(0, '#FEF08A');
    topGrad.addColorStop(0.5, '#F59E0B');
    topGrad.addColorStop(1, '#D97706');

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner Ring Emboss
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-rx * 0.3, -ry * 0.3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  openProfileModal() {
    if (!this.dom.profileModal) return;

    const coinsTotal = this.userState.coins?.total || 0;
    const coinHistory = this.userState.coins?.history || [];
    const timeHistory = this.userState.learningTime?.history || [];
    const totalSeconds = this.userState.learningTime?.totalSeconds || 0;

    const weekStart = this.getStartOfWeek();
    const monthStart = this.getStartOfMonth();

    // Calculate coins
    const coinsWeek = coinHistory
      .filter(h => (h.timestamp || new Date(h.date).getTime()) >= weekStart)
      .reduce((sum, h) => sum + (h.amount || 0), 0);
    const coinsMonth = coinHistory
      .filter(h => (h.timestamp || new Date(h.date).getTime()) >= monthStart)
      .reduce((sum, h) => sum + (h.amount || 0), 0);

    // Calculate learning time
    const timeWeekSeconds = timeHistory
      .filter(h => (h.timestamp || new Date(h.date).getTime()) >= weekStart)
      .reduce((sum, h) => sum + (h.seconds || 0), 0);
    const timeMonthSeconds = timeHistory
      .filter(h => (h.timestamp || new Date(h.date).getTime()) >= monthStart)
      .reduce((sum, h) => sum + (h.seconds || 0), 0);

    // Circulating count vs Untouched count
    const circulatingCount = this.allVocab.filter(v => (this.userState.vocabStats?.[v.id]?.seenCount || 0) > 0).length;
    const untouchedCount = Math.max(0, this.allVocab.length - circulatingCount);

    // Populate Modal DOM
    if (this.dom.profLevelBadge) this.dom.profLevelBadge.textContent = `⭐ Level ${this.userState.level || 1}`;
    if (this.dom.profLevelTitle) {
      const titleIdx = Math.min((this.userState.level || 1) - 1, LEVEL_TITLES.length - 1);
      this.dom.profLevelTitle.textContent = `${LEVEL_TITLES[titleIdx]} • Spanisch Klasse 5`;
    }

    if (this.dom.profCoinsWeek) this.dom.profCoinsWeek.textContent = coinsWeek;
    if (this.dom.profCoinsMonth) this.dom.profCoinsMonth.textContent = coinsMonth;
    if (this.dom.profCoinsTotal) this.dom.profCoinsTotal.textContent = coinsTotal;

    if (this.dom.profTimeWeek) this.dom.profTimeWeek.textContent = this.formatDuration(timeWeekSeconds);
    if (this.dom.profTimeMonth) this.dom.profTimeMonth.textContent = this.formatDuration(timeMonthSeconds);
    if (this.dom.profTimeTotal) this.dom.profTimeTotal.textContent = this.formatDuration(totalSeconds);

    if (this.dom.profAllTimeStreak) {
      this.dom.profAllTimeStreak.textContent = this.userState.allTimeBestStreak || this.userState.bestStreak || 0;
    }

    if (this.dom.profCirculatingCount) this.dom.profCirculatingCount.textContent = `${circulatingCount} Vokabeln`;
    if (this.dom.profUntouchedCount) this.dom.profUntouchedCount.textContent = `${untouchedCount} Vokabeln`;
    if (this.dom.profPoolRatioBadge) {
      const pctCirc = this.allVocab.length > 0 ? Math.round((circulatingCount / this.allVocab.length) * 100) : 0;
      this.dom.profPoolRatioBadge.textContent = `${circulatingCount} im Umlauf (${pctCirc}%)`;
    }

    this.updateWeekendUIStatus();
    this.dom.profileModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeProfileModal() {
    if (this.dom.profileModal) {
      this.dom.profileModal.classList.add('hidden');
    }
  }

  getStartOfWeek(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  getStartOfMonth(d = new Date()) {
    const date = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    return date.getTime();
  }

  formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds < 60) {
      return totalSeconds > 0 ? "< 1 Min." : "0 Min.";
    }
    const mins = Math.floor(totalSeconds / 60);
    if (mins < 60) {
      return `${mins} Min.`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs} Std. ${remMins} Min.` : `${hrs} Std.`;
  }

  retryMistakes() {
    const list = this.sessionStats.mistakes.map(m => m.item);
    if (list.length > 0) {
      this.startSessionWithList(list, this.sessionMode, 'mistakes');
    }
  }

  restartSession() {
    if (this.currentSessionType === 'daily') {
      this.startDailyGoalSession();
    } else if (this.currentSessionType === 'weekend') {
      this.startWeekendSpecialSession();
    } else {
      this.startSession(this.sessionMode);
    }
  }

  abortSession() {
    if (confirm("Möchtest du diese Lerneinheit wirklich beenden?")) {
      this.showDashboard();
    }
  }

  showDashboard() {
    this.dom.viewTraining.classList.add('hidden');
    this.dom.viewSummary.classList.add('hidden');
    this.dom.viewDashboard.classList.remove('hidden');
    this.updateLeitnerCounts();
    this.updateFilterCounts();
    this.updateHeaderStats();
    if (window.lucide) window.lucide.createIcons();
  }

  triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.userState.soundEnabled = this.sound.enabled;
    this.saveUserState();
    this.updateAudioIcons();
  }

  toggleAutoTTS() {
    this.tts.autoTTS = !this.tts.autoTTS;
    this.userState.autoTTS = this.tts.autoTTS;
    this.saveUserState();
    this.updateAudioIcons();
  }

  updateAudioIcons() {
    const sBtn = this.dom.soundToggleBtn;
    if (sBtn) {
      sBtn.className = this.sound.enabled 
        ? "p-2 rounded-xl text-blue-600 bg-blue-50 transition-colors" 
        : "p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors";
    }
    const tBtn = this.dom.ttsAutoToggleBtn;
    if (tBtn) {
      tBtn.className = this.tts.autoTTS 
        ? "p-2 rounded-xl text-emerald-600 bg-emerald-50 transition-colors" 
        : "p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors";
    }
  }
}

// Global App Instance
const app = new VocabTrainerApp();
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
