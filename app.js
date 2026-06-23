/* ============================================================
   🍅 番茄钟 — Pomodoro Timer
   ============================================================ */

// ===== Constants =====
const STATE_STORAGE_KEY = 'pomodoro-state-v2';
const RING_CIRCUMFERENCE = 553; // 2 * π * 88 (matches SVG r=88)
const DEFAULT_COLORS = { bg: '#0c0c1a', card: '#161628', text: '#e8e8f0', focus: '#f97316', break: '#22c55e' };
const AVATARS = ['😀', '🌟', '🎯', '🔥', '💪', '🎨', '🚀', '🌈', '🦊', '🐼', '🐧', '🦄', '🌺', '🍀', '⭐', '💎'];

// ===== State =====
const state = {
  mode: 'pomodoro',

  /* Timer status: 'idle' | 'running' | 'paused' | 'timesUp' */
  status: 'idle',
  timeLeft: 25 * 60,
  completedPomodoros: 0,
  timerId: null,

  config: {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
  },

  task: '',
  users: [
    { id: 'u1', name: '小明', avatar: '😀', theme: 'default', customColors: { ...DEFAULT_COLORS } },
    { id: 'u2', name: '小美', avatar: '🌟', theme: 'default', customColors: { ...DEFAULT_COLORS } },
  ],
  currentUser: 'u1',
  history: [],

  historyOpen: false,
  theme: 'default',
  customColors: { ...DEFAULT_COLORS },
  settingsOpen: false,
  soundEnabled: true,
  notifEnabled: true,
  bgSound: { type: 'none', volume: 50 },
};

// ===== DOM Refs =====
const $ = (id) => document.getElementById(id);
const els = {
  timerDisplay: $('timerDisplay'),
  statusLabel: $('statusLabel'),
  mainBtn: $('mainBtn'),
  skipBtn: $('skipBtn'),
  resetBtn: $('resetBtn'),
  taskInput: $('taskInput'),
  pomoDots: $('pomoDots'),
  pomoStats: $('pomoStats'),
  modeTabs: document.querySelectorAll('.mode-tab'),
  settingsToggle: $('settingsToggle'),
  settingsToggleText: $('settingsToggleText'),
  settingsColumn: $('settingsColumn'),
  settingsCloseBtn: $('settingsCloseBtn'),
  pomodoroSetting: $('pomodoroSetting'),
  shortBreakSetting: $('shortBreakSetting'),
  longBreakSetting: $('longBreakSetting'),
  soundToggle: $('soundToggle'),
  notifToggle: $('notifToggle'),
  ringProgress: document.querySelector('.ring-progress'),
  helpBtn: $('helpBtn'),
  helpModal: $('helpModal'),
  helpCloseBtn: $('helpCloseBtn'),
  helpOkBtn: $('helpOkBtn'),
  themeOptions: $('themeOptions'),
  customColors: $('customColors'),
  colorBg: $('colorBg'),
  colorCard: $('colorCard'),
  colorText: $('colorText'),
  colorFocus: $('colorFocus'),
  colorBreak: $('colorBreak'),
  userBar: $('userBar'),
  userAvatar: $('userAvatar'),
  userName: $('userName'),
  userDropdown: $('userDropdown'),
  userDropdownList: $('userDropdownList'),
  userAddBtn: $('userAddBtn'),
  historyToggle: $('historyToggle'),
  historyBadge: $('historyBadge'),
  historyPanel: $('historyPanel'),
  historyList: $('historyList'),
  historyStats: $('historyStats'),
  historyEmpty: $('historyEmpty'),
  exportBtn: $('exportBtn'),
  importBtn: $('importBtn'),
  importFile: $('importFile'),
  bgSoundSelect: $('bgSoundSelect'),
  bgSoundVolume: $('bgSoundVolume'),
  bgSoundVolumeLabel: $('bgSoundVolumeLabel'),
};

// ===== Helpers =====
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getCurrentUser() {
  return state.users.find((u) => u.id === state.currentUser) || state.users[0];
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeShort(m) {
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60}m`;
  return `${m}m`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getDuration() {
  return state.config[state.mode] * 60;
}

function getNextAvatar() {
  const used = new Set(state.users.map((u) => u.avatar));
  return AVATARS.find((a) => !used) || '😀';
}

/** Backfill a user object with defaults if missing old fields */
function backfillUser(u) {
  if (!u.theme) u.theme = 'default';
  if (!u.customColors) u.customColors = { ...DEFAULT_COLORS };
  delete u.customColors.textDim; // clean up old-format residue
}

// ===== Themes =====
const THEMES = {
  default: {
    name: '默认暗橙',
    vars: {
      '--bg': '#0c0c1a',
      '--bg-card': 'rgba(22, 22, 40, 0.85)',
      '--bg-card-border': 'rgba(255, 255, 255, 0.06)',
      '--text': '#e8e8f0',
      '--text-dim': '#9a9ab0',
      '--text-muted': '#5c5c78',
      '--shadow-card': '0 8px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      '--bg-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(249,115,22,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(59,130,246,0.03) 0%, transparent 50%)',
      '--accent-focus': '#f97316',
      '--accent-focus-hover': '#fb923c',
      '--accent-focus-dim': 'rgba(249,115,22,0.12)',
      '--accent-focus-glow': 'rgba(249,115,22,0.15)',
      '--accent-break': '#22c55e',
      '--accent-break-hover': '#4ade80',
      '--accent-break-dim': 'rgba(34,197,94,0.12)',
      '--accent-break-glow': 'rgba(34,197,94,0.15)',
    },
  },
  light: {
    name: '极简亮白',
    vars: {
      '--bg': '#f5f5f7',
      '--bg-card': 'rgba(255, 255, 255, 0.85)',
      '--bg-card-border': 'rgba(0, 0, 0, 0.06)',
      '--text': '#1d1d1f',
      '--text-dim': '#6e6e73',
      '--text-muted': '#a1a1a6',
      '--shadow-card': '0 8px 48px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
      '--bg-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(0,113,227,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(0,0,0,0.02) 0%, transparent 50%)',
      '--accent-focus': '#0071e3',
      '--accent-focus-hover': '#0077ed',
      '--accent-focus-dim': 'rgba(0,113,227,0.10)',
      '--accent-focus-glow': 'rgba(0,113,227,0.13)',
      '--accent-break': '#0d9488',
      '--accent-break-hover': '#14b8a6',
      '--accent-break-dim': 'rgba(13,148,136,0.10)',
      '--accent-break-glow': 'rgba(13,148,136,0.13)',
    },
  },
  purple: {
    name: '深邃暗紫',
    vars: {
      '--bg': '#0a0a12',
      '--bg-card': 'rgba(25, 20, 40, 0.88)',
      '--bg-card-border': 'rgba(255, 255, 255, 0.06)',
      '--text': '#e8e0f0',
      '--text-dim': '#a090c0',
      '--text-muted': '#605080',
      '--shadow-card': '0 8px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      '--bg-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(168,85,247,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(59,130,246,0.03) 0%, transparent 50%)',
      '--accent-focus': '#a855f7',
      '--accent-focus-hover': '#c084fc',
      '--accent-focus-dim': 'rgba(168,85,247,0.14)',
      '--accent-focus-glow': 'rgba(168,85,247,0.18)',
      '--accent-break': '#f472b6',
      '--accent-break-hover': '#f9a8d4',
      '--accent-break-dim': 'rgba(244,114,182,0.14)',
      '--accent-break-glow': 'rgba(244,114,182,0.18)',
    },
  },
  forest: {
    name: '森林绿意',
    vars: {
      '--bg': '#0a140a',
      '--bg-card': 'rgba(16, 30, 16, 0.88)',
      '--bg-card-border': 'rgba(255, 255, 255, 0.05)',
      '--text': '#e0f0e0',
      '--text-dim': '#90b090',
      '--text-muted': '#507050',
      '--shadow-card': '0 8px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      '--bg-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(34,197,94,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(59,130,246,0.02) 0%, transparent 50%)',
      '--accent-focus': '#22c55e',
      '--accent-focus-hover': '#4ade80',
      '--accent-focus-dim': 'rgba(34,197,94,0.14)',
      '--accent-focus-glow': 'rgba(34,197,94,0.18)',
      '--accent-break': '#f59e0b',
      '--accent-break-hover': '#fbbf24',
      '--accent-break-dim': 'rgba(245,158,11,0.14)',
      '--accent-break-glow': 'rgba(245,158,11,0.18)',
    },
  },
  neon: {
    name: '霓虹蓝粉',
    vars: {
      '--bg': '#0a0a1a',
      '--bg-card': 'rgba(16, 10, 30, 0.88)',
      '--bg-card-border': 'rgba(255, 255, 255, 0.06)',
      '--text': '#e0e8f0',
      '--text-dim': '#9098b0',
      '--text-muted': '#505870',
      '--shadow-card': '0 8px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      '--bg-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(6,182,212,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(244,63,94,0.05) 0%, transparent 50%)',
      '--accent-focus': '#06b6d4',
      '--accent-focus-hover': '#22d3ee',
      '--accent-focus-dim': 'rgba(6,182,212,0.14)',
      '--accent-focus-glow': 'rgba(6,182,212,0.18)',
      '--accent-break': '#f43f5e',
      '--accent-break-hover': '#fb7185',
      '--accent-break-dim': 'rgba(244,63,94,0.14)',
      '--accent-break-glow': 'rgba(244,63,94,0.18)',
    },
  },
};

// ===== Sound =====
function playSound() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    /* Audio unavailable — fail silently */
  }
}

// ===== Background Sound Engine =====
const MAX_BG_VOLUME = 0.12;

const bgAudio = {
  ctx: null,
  sourceNode: null,
  gainNode: null,
  modNodes: [],
  currentType: 'none',
  currentVolume: 50,
  isPlaying: false,
  noiseBuffer: null,

  _ctx() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  _noiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this._ctx();
    const sr = ctx.sampleRate;
    const len = sr * 4;
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  },

  _filter(type, freq, Q) {
    const ctx = this._ctx();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q || 0.5;
    return f;
  },

  _cleanup() {
    try { this.sourceNode?.stop(); } catch {}
    try { this.sourceNode?.disconnect(); } catch {}
    this.modNodes.forEach(n => {
      try { n.stop?.(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this.modNodes = [];
    this.sourceNode = null;
    this.gainNode = null;
  },

  start(type, volume) {
    this._cleanup();
    if (type === 'none') { this.isPlaying = false; this.currentType = 'none'; return; }

    const ctx = this._ctx();
    const buf = this._noiseBuffer();

    const master = ctx.createGain();
    master.gain.value = (volume / 100) * MAX_BG_VOLUME;
    master.connect(ctx.destination);
    this.gainNode = master;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.sourceNode = src;

    const chain = [src];

    switch (type) {
      case 'whitenoise':
        chain.push(this._filter('lowpass', 8000, 0.5));
        break;
      case 'rain': {
        chain.push(this._filter('lowpass', 3000, 0.8));
        const modGain = ctx.createGain();
        modGain.gain.value = 1;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1.5;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.08;
        lfo.connect(lfoG);
        lfoG.connect(modGain.gain);
        lfo.start();
        chain.push(modGain);
        this.modNodes = [lfo, lfoG];
        break;
      }
      case 'ocean': {
        chain.push(this._filter('lowpass', 400, 0.5));
        const modGain = ctx.createGain();
        modGain.gain.value = 0.6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.35;
        lfo.connect(lfoG);
        lfoG.connect(modGain.gain);
        lfo.start();
        chain.push(modGain);
        this.modNodes = [lfo, lfoG];
        break;
      }
      case 'forest': {
        chain.push(this._filter('lowpass', 3500, 0.5));
        chain.push(this._filter('highpass', 500, 0.6));
        break;
      }
    }

    let prev = chain[0];
    for (let i = 1; i < chain.length; i++) {
      prev.connect(chain[i]);
      prev = chain[i];
    }
    prev.connect(master);
    src.start();

    this.currentType = type;
    this.currentVolume = volume;
    this.isPlaying = true;
  },

  stop() {
    this._cleanup();
    this.isPlaying = false;
    this.currentType = 'none';
  },

  setVolume(vol) {
    this.currentVolume = vol;
    if (this.gainNode) {
      this.gainNode.gain.value = (vol / 100) * MAX_BG_VOLUME;
    }
  },

  setType(type) {
    if (type === 'none') {
      this.stop();
    } else if (this.isPlaying && type === this.currentType) {
      return;
    } else {
      this.start(type, this.currentVolume);
    }
  },
};

/** Ensure bgAudio is ready on first user interaction (auto-play policy) */
let _bgAudioReady = false;
function ensureBgAudio() {
  if (_bgAudioReady) return;
  _bgAudioReady = true;
  if (state.bgSound.type !== 'none') {
    bgAudio.start(state.bgSound.type, state.bgSound.volume);
  }
}

// ===== Notification =====
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if (!state.notifEnabled) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '' });
  }
}

// ===== Persistence =====
function loadState() {
  try {
    const saved = localStorage.getItem(STATE_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);

    /* Scalar settings */
    if (parsed.config) Object.assign(state.config, parsed.config);
    if (typeof parsed.soundEnabled === 'boolean') state.soundEnabled = parsed.soundEnabled;
    if (typeof parsed.notifEnabled === 'boolean') state.notifEnabled = parsed.notifEnabled;
    if (parsed.bgSound) Object.assign(state.bgSound, parsed.bgSound);
    if (parsed.task) state.task = parsed.task;
    if (typeof parsed.completedPomodoros === 'number') state.completedPomodoros = parsed.completedPomodoros;
    if (Array.isArray(parsed.history)) state.history = parsed.history;

    /* Users */
    if (parsed.users && parsed.users.length > 0) {
      state.users = parsed.users;
      state.users.forEach(backfillUser);
      state.currentUser = parsed.currentUser && state.users.find((u) => u.id === parsed.currentUser)
        ? parsed.currentUser
        : state.users[0].id;
      const cu = getCurrentUser();
      state.theme = cu.theme || 'default';
      state.customColors = { ...(cu.customColors || DEFAULT_COLORS) };
      delete state.customColors.textDim;
    }

    /* Legacy format fallback (pre-multi-user) */
    if (parsed.theme && (THEMES[parsed.theme] || parsed.theme === 'custom')) {
      state.theme = parsed.theme;
    }
    if (parsed.customColors && !parsed.users) {
      Object.assign(state.customColors, parsed.customColors);
      delete state.customColors.textDim;
    }
  } catch {
    /* Corrupt state — start fresh */
  }
}

function saveState() {
  /* Sync current user's theme/colors */
  const user = state.users.find((u) => u.id === state.currentUser);
  if (user) {
    user.theme = state.theme;
    user.customColors = { ...state.customColors };
    delete user.customColors.textDim;
  }
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({
      config: state.config,
      task: state.task,
      completedPomodoros: state.completedPomodoros,
      soundEnabled: state.soundEnabled,
      notifEnabled: state.notifEnabled,
      bgSound: state.bgSound,
      theme: state.theme,
      customColors: state.customColors,
      users: state.users,
      currentUser: state.currentUser,
      history: state.history,
    }));
  } catch {
    /* Storage full or unavailable */
  }
}

// ===== Export / Import =====
function exportData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    config: state.config,
    users: state.users,
    currentUser: state.currentUser,
    history: state.history,
    theme: state.theme,
    customColors: state.customColors,
    soundEnabled: state.soundEnabled,
    notifEnabled: state.notifEnabled,
    bgSound: state.bgSound,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `番茄钟备份_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.version || !data.users || !data.history) {
        alert('文件格式不对，请选择正确的番茄钟备份文件。');
        return;
      }
      if (!confirm(`确认导入？当前数据将被覆盖。\n\n文件中包含 ${data.users.length} 位用户、${data.history.length} 条记录。`)) return;

      state.users = data.users;
      state.users.forEach(backfillUser);
      state.history = data.history;
      state.currentUser = data.currentUser || state.users[0]?.id || state.currentUser;

      const cu = state.users.find((u) => u.id === state.currentUser) || state.users[0];
      state.theme = cu.theme || 'default';
      state.customColors = { ...(cu.customColors || DEFAULT_COLORS) };
      delete state.customColors.textDim;

      if (data.config) Object.assign(state.config, data.config);
      if (data.theme && THEMES[data.theme]) state.theme = data.theme;
      if (data.customColors) {
        Object.assign(state.customColors, data.customColors);
        delete state.customColors.textDim;
      }
      if (typeof data.soundEnabled === 'boolean') state.soundEnabled = data.soundEnabled;
      if (typeof data.notifEnabled === 'boolean') state.notifEnabled = data.notifEnabled;
      if (data.bgSound) Object.assign(state.bgSound, data.bgSound);

      state.completedPomodoros = getHistoryForUser(state.currentUser).filter((e) => e.mode === 'pomodoro').length;
      applyTheme(state.theme);
      syncCustomPickers();
      refreshUI();
      updateUserUI();
      updateHistoryUI();
      saveState();
      alert('导入成功！');
    } catch {
      alert('文件解析失败，请重试。');
    }
  };
  reader.readAsText(file);
}

function handleImportFile(e) {
  importFromFile(e.target.files[0]);
  e.target.value = '';
}

// ===== Ring Progress =====
function updateRing() {
  if (!els.ringProgress) return;
  const total = getDuration();
  const progress = total > 0 ? state.timeLeft / total : 1;
  els.ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
}

// ===== Theme =====
/* ---- Color helpers ---- */
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbStr(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return alpha == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v) => Math.min(255, Math.round(v + (255 - v) * amount));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

/* ---- Apply preset theme ---- */
function applyPresetTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  state.theme = themeId;
}

/* ---- Apply custom theme from user colors ---- */
function applyCustomTheme() {
  const c = state.customColors;
  const { r, g, b } = hexToRgb(c.text);
  const textDim = `rgb(${Math.round(r * 0.8 + 255 * 0.2)},${Math.round(g * 0.8 + 255 * 0.2)},${Math.round(b * 0.8 + 255 * 0.2)})`;
  const textMuted = `rgb(${Math.round(r * 0.55 + 255 * 0.45)},${Math.round(g * 0.55 + 255 * 0.45)},${Math.round(b * 0.55 + 255 * 0.45)})`;

  const vars = {
    '--bg': c.bg,
    '--bg-card': rgbStr(c.card, 0.85),
    '--bg-card-border': rgbStr(c.card, 0.08),
    '--text': c.text,
    '--text-dim': textDim,
    '--text-muted': textMuted,
    '--shadow-card': `0 8px 48px ${rgbStr(c.bg, 0.5)}, 0 2px 8px ${rgbStr(c.bg, 0.3)}`,
    '--bg-gradient': `radial-gradient(ellipse at 20% 50%, ${rgbStr(c.focus, 0.05)} 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, ${rgbStr(c.break, 0.04)} 0%, transparent 50%)`,
    '--accent-focus': c.focus,
    '--accent-focus-hover': lighten(c.focus, 0.18),
    '--accent-focus-dim': rgbStr(c.focus, 0.12),
    '--accent-focus-glow': rgbStr(c.focus, 0.16),
    '--accent-break': c.break,
    '--accent-break-hover': lighten(c.break, 0.18),
    '--accent-break-dim': rgbStr(c.break, 0.12),
    '--accent-break-glow': rgbStr(c.break, 0.16),
  };

  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  state.theme = 'custom';
}

/* ---- Main entry: pick preset or custom ---- */
function applyTheme(themeId) {
  if (themeId === 'custom') {
    applyCustomTheme();
  } else {
    applyPresetTheme(themeId);
  }
  updateThemeUI();
  updateDisplay();
  syncCustomPickers();
  saveState();
}

/* ---- Sync color picker inputs with state ---- */
function syncCustomPickers() {
  const c = state.customColors;
  if (els.colorBg) els.colorBg.value = c.bg;
  if (els.colorCard) els.colorCard.value = c.card;
  if (els.colorText) els.colorText.value = c.text;
  if (els.colorFocus) els.colorFocus.value = c.focus;
  if (els.colorBreak) els.colorBreak.value = c.break;
  if (els.customColors) els.customColors.hidden = state.theme !== 'custom';
}

function updateThemeUI() {
  if (!els.themeOptions) return;
  els.themeOptions.querySelectorAll('.theme-swatch').forEach((sw) => {
    sw.classList.toggle('active', sw.dataset.theme === state.theme);
  });
}

// ===== User Management =====
function switchUser(userId) {
  if (userId === state.currentUser || !state.users.find((u) => u.id === userId)) return;

  const oldUser = state.users.find((u) => u.id === state.currentUser);
  if (oldUser) {
    oldUser.theme = state.theme;
    oldUser.customColors = { ...state.customColors };
  }

  state.currentUser = userId;
  const newUser = getCurrentUser();
  state.theme = newUser.theme || 'default';
  state.customColors = { ...(newUser.customColors || DEFAULT_COLORS) };
  delete state.customColors.textDim;
  state.completedPomodoros = getHistoryForUser(userId).filter((e) => e.mode === 'pomodoro').length;

  applyTheme(state.theme);
  updateUserUI();
  closeUserDropdown();
  saveState();
  refreshUI();
}

function addUser(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const newUser = {
    id: genId(),
    name: trimmed,
    avatar: getNextAvatar(),
    theme: 'default',
    customColors: { ...DEFAULT_COLORS },
  };
  state.users.push(newUser);
  state.currentUser = newUser.id;
  state.completedPomodoros = 0;

  updateUserUI();
  renderUserDropdown();
  closeUserDropdown();
  refreshUI();
  saveState();
  return newUser;
}

function renameUser(userId) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  const name = prompt('重命名用户：', user.name);
  if (name && name.trim() && name.trim() !== user.name) {
    user.name = name.trim();
    renderUserDropdown();
    updateUserUI();
    saveState();
  }
}

function deleteUser(userId) {
  if (state.users.length <= 1) return;
  if (userId === state.currentUser) {
    const next = state.users.find((u) => u.id !== userId);
    if (next) state.currentUser = next.id;
  }
  state.users = state.users.filter((u) => u.id !== userId);
  state.completedPomodoros = getHistoryForUser(state.currentUser).filter((e) => e.mode === 'pomodoro').length;

  updateUserUI();
  renderUserDropdown();
  refreshUI();
  saveState();
}

function renderUserDropdown() {
  if (!els.userDropdownList) return;
  els.userDropdownList.innerHTML = state.users
    .map((u) => {
      const active = u.id === state.currentUser;
      return `<button class="user-dropdown-item${active ? ' active' : ''}" data-user-id="${u.id}">
        <span class="item-avatar">${u.avatar}</span>
        <span class="item-name">${u.name}</span>
        <span class="item-check">${active ? '✓' : ''}</span>
        <span class="item-rename" data-rename-id="${u.id}" title="重命名">✎</span>
        ${state.users.length > 1 ? `<span class="item-del" data-del-id="${u.id}" title="删除">✕</span>` : ''}
      </button>`;
    })
    .join('');
}

function openUserDropdown() {
  renderUserDropdown();
  els.userDropdown.hidden = false;
  els.userBar.querySelector('.user-chevron')?.classList.add('open');
}

function closeUserDropdown() {
  els.userDropdown.hidden = true;
  els.userBar.querySelector('.user-chevron')?.classList.remove('open');
}

function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  if (els.userDropdown.hidden) openUserDropdown();
  else closeUserDropdown();
}

function updateUserUI() {
  const user = getCurrentUser();
  if (els.userAvatar) els.userAvatar.textContent = user.avatar;
  if (els.userName) els.userName.textContent = user.name;
  updateHistoryUI();
}

// ===== History =====
function recordSession(task, duration, mode) {
  const user = getCurrentUser();
  state.history.push({
    id: genId(),
    userId: user.id,
    userAvatar: user.avatar,
    timestamp: Date.now(),
    date: todayStr(),
    task: task || '',
    duration,
    mode,
  });
  /* Keep max 500 entries to avoid storage bloat */
  if (state.history.length > 500) {
    state.history = state.history.slice(-500);
  }
  updateHistoryUI();
  saveState();
}

function getHistoryForUser(userId) {
  return state.history.filter((e) => e.userId === userId);
}

function getUserStats(userId) {
  const entries = getHistoryForUser(userId);
  const today = todayStr();
  const todayEntries = entries.filter((e) => e.date === today && e.mode === 'pomodoro');
  const totalEntries = entries.filter((e) => e.mode === 'pomodoro');
  const todayMinutes = todayEntries.reduce((sum, e) => sum + e.duration, 0);
  const totalMinutes = totalEntries.reduce((sum, e) => sum + e.duration, 0);
  return {
    today: todayEntries.length,
    todayMinutes,
    total: totalEntries.length,
    totalMinutes,
  };
}

function formatHistoryDate(e) {
  const dateStr = e.date || todayStr();
  const today = todayStr();
  if (dateStr === today) return '今天';
  if (dateStr === getYesterdayStr()) return '昨天';
  return dateStr;
}

function updateHistoryUI() {
  const user = getCurrentUser();
  const entries = getHistoryForUser(user.id);
  const stats = getUserStats(user.id);

  /* Badge */
  if (els.historyBadge) els.historyBadge.textContent = stats.today;

  /* Stats row */
  if (els.historyStats) {
    const totalEntries = entries.filter((e) => e.mode === 'pomodoro').length;
    els.historyStats.innerHTML = `
      <div class="history-stat-item">
        <span class="history-stat-value">${stats.today}</span>
        <span class="history-stat-label">今日🍅</span>
      </div>
      <div class="history-stat-item">
        <span class="history-stat-value">${formatTimeShort(stats.todayMinutes)}</span>
        <span class="history-stat-label">今日专注</span>
      </div>
      <div class="history-stat-item">
        <span class="history-stat-value">${totalEntries}</span>
        <span class="history-stat-label">总计🍅</span>
      </div>
      <button class="history-clear-btn" id="historyClearBtn" title="清空当前用户的所有记录">🗑️</button>
    `;
    const clearBtn = els.historyStats.querySelector('#historyClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('确定清空当前用户的所有记录？此操作不可撤销。')) return;
        const uid = state.currentUser;
        state.history = state.history.filter((e) => e.userId !== uid);
        state.completedPomodoros = 0;
        updatePomodoroInfo();
        updateHistoryUI();
        saveState();
      });
    }
  }

  /* History list (show latest 20) */
  if (els.historyList) {
    const latest = entries.slice(-20).reverse();
    if (latest.length === 0) {
      els.historyList.innerHTML = '';
      if (els.historyEmpty) els.historyEmpty.hidden = false;
    } else {
      if (els.historyEmpty) els.historyEmpty.hidden = true;
      els.historyList.innerHTML = latest
        .map((e) => {
          const modeLabel = e.mode === 'pomodoro' ? '专注' : e.mode === 'shortBreak' ? '短休' : '长休';
          const time = new Date(e.timestamp);
          const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
          return `<div class="history-entry" data-history-id="${e.id}">
            <span class="history-entry-avatar">${e.userAvatar}</span>
            <div class="history-entry-body">
              <div class="history-entry-task">${e.task || ''}</div>
              <div class="history-entry-meta">
                <span class="history-entry-mode">${modeLabel}</span>
                <span class="history-entry-duration">${e.duration}分钟</span>
                <span class="history-entry-date">${formatHistoryDate(e)}</span>
                <span class="history-entry-time">${timeStr}</span>
              </div>
            </div>
            <button class="history-entry-del" title="删除此记录">✕</button>
          </div>`;
        })
        .join('');
    }
  }
}

function toggleHistory() {
  state.historyOpen = !state.historyOpen;
  els.historyPanel.hidden = !state.historyOpen;
  els.historyToggle.querySelector('.history-chevron')?.classList.toggle('open', state.historyOpen);
  if (state.historyOpen) updateHistoryUI();
}

function deleteHistoryEntry(id) {
  if (!confirm('确定删除这条记录？')) return;
  state.history = state.history.filter((e) => e.id !== id);
  state.completedPomodoros = getHistoryForUser(state.currentUser).filter((e) => e.mode === 'pomodoro').length;
  updatePomodoroInfo();
  updateHistoryUI();
  saveState();
}

// ===== Display Updates =====
function updateAccentColors() {
  const isFocus = state.mode === 'pomodoro';
  const modeKey = isFocus ? 'focus' : 'break';

  let accent, accentHover, accentDim, accentGlow;

  if (state.theme === 'custom') {
    const cs = getComputedStyle(document.documentElement);
    accent = cs.getPropertyValue(`--accent-${modeKey}`).trim();
    accentHover = cs.getPropertyValue(`--accent-${modeKey}-hover`).trim();
    accentDim = cs.getPropertyValue(`--accent-${modeKey}-dim`).trim();
    accentGlow = cs.getPropertyValue(`--accent-${modeKey}-glow`).trim();
  } else {
    const theme = THEMES[state.theme];
    accent = theme.vars[`--accent-${modeKey}`];
    accentHover = theme.vars[`--accent-${modeKey}-hover`];
    accentDim = theme.vars[`--accent-${modeKey}-dim`];
    accentGlow = theme.vars[`--accent-${modeKey}-glow`];
  }

  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-dim', accentDim);
  root.style.setProperty('--accent-glow', accentGlow);
}

function updateDisplay() {
  els.timerDisplay.textContent = formatTime(state.timeLeft);
  updateRing();

  /* Document title */
  const prefix = state.status === 'running' ? '▶ ' : state.status === 'paused' ? '⏸ ' : '';
  document.title = `${prefix}${formatTime(state.timeLeft)} — 番茄钟`;

  /* Status label */
  const modeLabels = { pomodoro: '🎯 专注中', shortBreak: '☕ 短休息', longBreak: '🌿 长休息' };
  switch (state.status) {
    case 'idle': els.statusLabel.textContent = '准备开始'; break;
    case 'running': els.statusLabel.textContent = modeLabels[state.mode]; break;
    case 'paused': els.statusLabel.textContent = '⏸ 已暂停'; break;
    case 'timesUp': els.statusLabel.textContent = '⏰ 时间到！'; break;
  }

  updateAccentColors();
}

function updatePomodoroInfo() {
  const cyclePos = state.completedPomodoros % 4;
  let dots = '';
  for (let i = 0; i < 4; i++) {
    dots += `<span class="${i < cyclePos ? 'pomo-dot filled' : 'pomo-dot empty'}">●</span>`;
  }
  els.pomoDots.innerHTML = dots;
  els.pomoStats.textContent = `${state.completedPomodoros} 个`;
}

function updateTaskInput() {
  if (els.taskInput.value !== state.task) {
    els.taskInput.value = state.task;
  }
}

function updateMainButton() {
  switch (state.status) {
    case 'idle':
    case 'paused':
      els.mainBtn.textContent = '▶ 开始';
      break;
    case 'running':
      els.mainBtn.textContent = '⏸ 暂停';
      break;
    case 'timesUp':
      els.mainBtn.textContent = '▶ 继续';
      break;
  }
}

function updateModeTabs() {
  els.modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === state.mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
}

function updateSettingsColumn() {
  els.pomodoroSetting.value = state.config.pomodoro;
  els.shortBreakSetting.value = state.config.shortBreak;
  els.longBreakSetting.value = state.config.longBreak;
  els.soundToggle.checked = state.soundEnabled;
  els.notifToggle.checked = state.notifEnabled;
  if (els.bgSoundSelect) els.bgSoundSelect.value = state.bgSound.type;
  if (els.bgSoundVolume) els.bgSoundVolume.value = state.bgSound.volume;
  if (els.bgSoundVolumeLabel) els.bgSoundVolumeLabel.textContent = `${state.bgSound.volume}%`;
  els.settingsColumn.hidden = !state.settingsOpen;
  syncCustomPickers();
}

function refreshUI() {
  updateDisplay();
  updateMainButton();
  updateModeTabs();
  updatePomodoroInfo();
  updateTaskInput();
  updateSettingsColumn();
}

// ===== Timer =====
function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  state.status = 'running';
  updateMainButton();
  updateDisplay();

  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    updateDisplay();

    if (state.timeLeft <= 0) {
      stopTimer();
      onTimerComplete();
    }
  }, 1000);
}

function advanceToNextMode() {
  if (state.mode === 'pomodoro') {
    state.mode = state.completedPomodoros % 4 === 0 ? 'longBreak' : 'shortBreak';
  } else {
    state.mode = 'pomodoro';
  }
  state.timeLeft = getDuration();
  state.status = 'idle';
}

function onTimerComplete() {
  playSound();

  if (state.mode === 'pomodoro') {
    state.completedPomodoros += 1;
    recordSession(state.task, state.config.pomodoro, 'pomodoro');
    saveState();
    updatePomodoroInfo();
    sendNotification('🍅 专注完成！', '很棒！休息一下吧 ☕');
  } else {
    sendNotification('⏰ 休息结束', '该开始新的专注了 🎯');
  }

  /* Pulse animation */
  document.querySelector('.timer-ring-container').classList.add('times-up');
  setTimeout(() => {
    document.querySelector('.timer-ring-container').classList.remove('times-up');
  }, 2400);

  requestNotificationPermission();
  advanceToNextMode();
  refreshUI();
}

// ===== Actions =====
function startPause() {
  if (state.status === 'running') {
    stopTimer();
    state.status = 'paused';
    updateMainButton();
    updateDisplay();
  } else {
    startTimer();
    requestNotificationPermission();
  }
}

function resetTimer() {
  stopTimer();
  state.timeLeft = getDuration();
  state.status = 'idle';
  refreshUI();
}

function skipPhase() {
  if (state.status === 'idle' || state.status === 'timesUp') return;
  stopTimer();
  onTimerComplete();
}

function switchMode(mode) {
  if (mode === state.mode && state.status === 'idle') return;
  state.mode = mode;
  stopTimer();
  state.timeLeft = getDuration();
  state.status = 'idle';
  refreshUI();
}

function setTask(value) {
  state.task = value;
  saveState();
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  updateSettingsColumn();
}

function applySettings() {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, parseInt(v, 10) || min));
  state.config.pomodoro = clamp(els.pomodoroSetting.value, 1, 120);
  state.config.shortBreak = clamp(els.shortBreakSetting.value, 1, 60);
  state.config.longBreak = clamp(els.longBreakSetting.value, 1, 120);
  saveState();

  if (state.status === 'idle' || state.status === 'timesUp') {
    state.timeLeft = getDuration();
    updateDisplay();
  }
  updateSettingsColumn();
}

function toggleSound() {
  state.soundEnabled = els.soundToggle.checked;
  saveState();
}

function toggleNotification() {
  state.notifEnabled = els.notifToggle.checked;
  if (state.notifEnabled) requestNotificationPermission();
  saveState();
}

// ===== Help Modal =====
function openHelp() {
  els.helpModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeHelp() {
  els.helpModal.hidden = true;
  document.body.style.overflow = '';
}

// ===== Keyboard Shortcuts =====
function handleKeydown(e) {
  if (e.target.tagName === 'INPUT') return;

  if (!els.helpModal.hidden && e.code === 'Escape') {
    closeHelp();
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      startPause();
      break;
    case 'KeyR':
      if (!e.ctrlKey && !e.metaKey) resetTimer();
      break;
    case 'KeyS':
      skipPhase();
      break;
    case 'Escape':
      if (state.settingsOpen) {
        state.settingsOpen = false;
        updateSettingsColumn();
      }
      break;
  }
}

// ===== Event Binding =====
function bindEvents() {
  /* Main controls */
  els.mainBtn.addEventListener('click', startPause);
  els.resetBtn.addEventListener('click', resetTimer);
  els.skipBtn.addEventListener('click', skipPhase);

  els.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  /* Task input — debounce save */
  let taskTimeout;
  els.taskInput.addEventListener('input', () => {
    clearTimeout(taskTimeout);
    taskTimeout = setTimeout(() => setTask(els.taskInput.value), 400);
  });

  /* Settings toggle */
  els.settingsToggle.addEventListener('click', toggleSettings);
  if (els.settingsCloseBtn) {
    els.settingsCloseBtn.addEventListener('click', () => {
      state.settingsOpen = false;
      updateSettingsColumn();
    });
  }

  /* Duration inputs */
  [els.pomodoroSetting, els.shortBreakSetting, els.longBreakSetting].forEach((input) => {
    input.addEventListener('change', applySettings);
    input.addEventListener('blur', applySettings);
  });

  /* Toggles */
  els.soundToggle.addEventListener('change', toggleSound);
  els.notifToggle.addEventListener('change', toggleNotification);

  /* Background sound */
  if (els.bgSoundSelect) {
    els.bgSoundSelect.addEventListener('change', () => {
      state.bgSound.type = els.bgSoundSelect.value;
      bgAudio.setType(state.bgSound.type);
      saveState();
    });
  }
  if (els.bgSoundVolume) {
    els.bgSoundVolume.addEventListener('input', () => {
      const vol = parseInt(els.bgSoundVolume.value, 10);
      state.bgSound.volume = vol;
      if (els.bgSoundVolumeLabel) els.bgSoundVolumeLabel.textContent = `${vol}%`;
      bgAudio.setVolume(vol);
    });
    els.bgSoundVolume.addEventListener('change', () => {
      const vol = parseInt(els.bgSoundVolume.value, 10);
      state.bgSound.volume = vol;
      if (els.bgSoundVolumeLabel) els.bgSoundVolumeLabel.textContent = `${vol}%`;
      bgAudio.setVolume(vol);
      saveState();
    });
  }

  /* First interaction → resume bgAudio if needed (browser autoplay policy) */
  document.addEventListener('click', ensureBgAudio, { once: true });
  document.addEventListener('keydown', ensureBgAudio, { once: true });

  /* Stop bgAudio on page unload */
  window.addEventListener('beforeunload', () => bgAudio.stop());

  /* Help modal */
  els.helpBtn.addEventListener('click', openHelp);
  els.helpCloseBtn.addEventListener('click', closeHelp);
  els.helpOkBtn.addEventListener('click', closeHelp);
  els.helpModal.addEventListener('click', (e) => {
    if (e.target === els.helpModal) closeHelp();
  });

  /* Theme swatches */
  if (els.themeOptions) {
    els.themeOptions.addEventListener('click', (e) => {
      const swatch = e.target.closest('.theme-swatch');
      if (!swatch || swatch.dataset.theme === state.theme) return;
      applyTheme(swatch.dataset.theme);
    });
  }

  /* Custom color pickers */
  const COLOR_MAP = { colorBg: 'bg', colorCard: 'card', colorText: 'text', colorFocus: 'focus', colorBreak: 'break' };
  Object.keys(COLOR_MAP).forEach((id) => {
    const el = els[id];
    const key = COLOR_MAP[id];
    if (!el) return;
    el.addEventListener('input', () => {
      state.customColors[key] = el.value;
      applyCustomTheme();
      updateDisplay();
    });
    el.addEventListener('change', () => {
      state.customColors[key] = el.value;
      applyCustomTheme();
      updateThemeUI();
      updateDisplay();
      saveState();
    });
  });

  /* User bar */
  els.userBar.addEventListener('click', toggleUserDropdown);

  /* Close dropdown on outside click */
  document.addEventListener('click', (e) => {
    if (!els.userDropdown.hidden && !els.userBar.contains(e.target) && !els.userDropdown.contains(e.target)) {
      closeUserDropdown();
    }
  });

  /* User dropdown events (delegated) */
  if (els.userDropdownList) {
    els.userDropdownList.addEventListener('click', (e) => {
      const item = e.target.closest('.user-dropdown-item');
      if (!item) return;

      const delBtn = e.target.closest('.item-del');
      if (delBtn) {
        const delId = delBtn.dataset.delId;
        if (delId && confirm(`确认删除用户「${state.users.find((u) => u.id === delId)?.name}」？`)) {
          deleteUser(delId);
        }
        return;
      }

      const renameBtn = e.target.closest('.item-rename');
      if (renameBtn) {
        const renameId = renameBtn.dataset.renameId;
        if (renameId) renameUser(renameId);
        return;
      }

      const userId = item.dataset.userId;
      if (userId) switchUser(userId);
    });
  }

  /* Add user */
  els.userAddBtn.addEventListener('click', () => {
    const name = prompt('输入新用户名称：');
    if (name && name.trim()) addUser(name.trim());
  });

  /* History */
  els.historyToggle.addEventListener('click', toggleHistory);

  /* History delete (delegated) */
  els.historyList.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.history-entry-del');
    if (!delBtn) return;
    const entry = delBtn.closest('.history-entry');
    if (entry) deleteHistoryEntry(entry.dataset.historyId);
  });

  /* Export / Import */
  els.exportBtn.addEventListener('click', exportData);
  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', handleImportFile);

  /* Keyboard */
  document.addEventListener('keydown', handleKeydown);
}

// ===== Init =====
function init() {
  loadState();
  applyTheme(state.theme);
  syncCustomPickers();

  updateSettingsColumn();
  state.completedPomodoros = getHistoryForUser(state.currentUser).filter((e) => e.mode === 'pomodoro').length;
  updateUserUI();
  updateHistoryUI();

  state.timeLeft = getDuration();
  if (state.task) els.taskInput.value = state.task;

  refreshUI();
  bindEvents();
  requestNotificationPermission();
}

document.addEventListener('DOMContentLoaded', init);
