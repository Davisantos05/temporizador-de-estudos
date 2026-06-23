(() => {
  const STORAGE_KEY = "coracaoDoEstudoDataV1";
  const TIMER_KEY = "coracaoDoEstudoActiveTimerV2";

  const defaultData = {
    profile: { name: "Estudante", dailyGoal: 240, dark: false },
    subjects: ["Matemática", "Português", "História"],
    sessions: []
  };

  const state = {
    data: loadData(),
    timer: {
      totalSeconds: 45 * 60,
      remainingSeconds: 45 * 60,
      interval: null,
      running: false,
      activeSession: null
    }
  };

  const els = {};
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindNavigation();
    bindTimer();
    bindModals();
    bindTheme();
    restoreActiveTimer();
    renderAll();

    document.addEventListener("visibilitychange", syncTimerFromClock);
    window.addEventListener("focus", syncTimerFromClock);
    window.addEventListener("pageshow", syncTimerFromClock);
    window.addEventListener("beforeunload", persistActiveTimer);

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  function cacheElements() {
    Object.assign(els, {
      pages: qa(".page"), pageTitle: q("#pageTitle"), pageSubtitle: q("#pageSubtitle"), pageEyebrow: q("#pageEyebrow"),
      headerName: q("#headerName"), profileName: q("#profileName"), avatarLetter: q("#avatarLetter"),
      sidebarStreak: q("#sidebarStreak"), todayTimeHero: q("#todayTimeHero"), goalRemaining: q("#goalRemaining"),
      heartPercent: q("#heartPercent"), mainHeart: q("#mainHeart"), todayTime: q("#todayTime"),
      dailyGoalLabel: q("#dailyGoalLabel"), progressRing: q("#progressRing"), progressRingText: q("#progressRingText"),
      dailyProgressBar: q("#dailyProgressBar"), subjectList: q("#subjectList"), streakDays: q("#streakDays"),
      weekDays: q("#weekDays"), streakMessage: q("#streakMessage"), focusSubject: q("#focusSubject"),
      durationSelect: q("#durationSelect"), timerDisplay: q("#timerDisplay"), timerCaption: q("#timerCaption"),
      timerHeart: q("#timerHeart"), timerRing: q("#timerRing"), focusStatus: q("#focusStatus"),
      startPauseTimer: q("#startPauseTimer"), resetTimer: q("#resetTimer"), finishTimer: q("#finishTimer"),
      totalStudyTime: q("#totalStudyTime"), averageStudyTime: q("#averageStudyTime"), statsStreak: q("#statsStreak"),
      sessionCount: q("#sessionCount"), weeklyChart: q("#weeklyChart"), heartCollection: q("#heartCollection"),
      collectionText: q("#collectionText"), nextHeartText: q("#nextHeartText"), historyList: q("#historyList"),
      achievementGrid: q("#achievementGrid"), settingsModal: q("#settingsModal"), subjectModal: q("#subjectModal"),
      settingsForm: q("#settingsForm"), subjectForm: q("#subjectForm"), nameInput: q("#nameInput"), goalInput: q("#goalInput"),
      subjectInput: q("#subjectInput"), themeButton: q("#themeButton"), toast: q("#toast")
    });
  }

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed) return structuredClone(defaultData);
      return {
        profile: { ...defaultData.profile, ...(parsed.profile || {}) },
        subjects: Array.isArray(parsed.subjects) && parsed.subjects.length ? parsed.subjects : [...defaultData.subjects],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch {
      return structuredClone(defaultData);
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function bindNavigation() {
    qa("[data-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
    qa("[data-page-jump]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.pageJump)));
    qa("[data-go-focus]").forEach(button => button.addEventListener("click", () => navigate("foco")));
  }

  const pageMeta = {
    inicio: ["SEU ESPAÇO DE FOCO", null, "Cada minuto de estudo fortalece o seu futuro."],
    foco: ["MODO FOCO", "Hora de concentrar", "Escolha uma matéria e comece sua sessão."],
    estatisticas: ["SEU DESEMPENHO", "Estatísticas", "Entenda sua rotina e acompanhe sua evolução."],
    conquistas: ["GAMIFICAÇÃO SAUDÁVEL", "Conquistas", "Celebre cada etapa da sua jornada de estudos."]
  };

  function navigate(page) {
    els.pages.forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
    qa("[data-page]").forEach(item => item.classList.toggle("active", item.dataset.page === page));
    const [eyebrow, title, subtitle] = pageMeta[page] || pageMeta.inicio;
    els.pageEyebrow.textContent = eyebrow;
    if (page === "inicio") {
      els.pageTitle.innerHTML = `Olá, <span id="headerName">${escapeHtml(firstName(state.data.profile.name).toLowerCase())}</span>! 💗`;
      els.headerName = q("#headerName");
    } else {
      els.pageTitle.textContent = title;
    }
    els.pageSubtitle.textContent = subtitle;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindTimer() {
    els.durationSelect.addEventListener("change", () => {
      if (state.timer.running) return;
      const minutes = Number(els.durationSelect.value);
      state.timer.totalSeconds = minutes * 60;
      state.timer.remainingSeconds = minutes * 60;
      updateTimerUI();
    });

    els.startPauseTimer.addEventListener("click", () => state.timer.running ? pauseTimer() : startTimer());
    els.resetTimer.addEventListener("click", resetTimer);
    els.finishTimer.addEventListener("click", () => finishSession(false));
  }

  function startTimer() {
    if (state.timer.remainingSeconds <= 0) resetTimer();

    const now = Date.now();
    state.timer.running = true;
    state.timer.activeSession = {
      subject: els.focusSubject.value || state.data.subjects[0],
      totalSeconds: state.timer.totalSeconds,
      startedAt: now,
      expectedEndAt: now + state.timer.remainingSeconds * 1000
    };

    persistActiveTimer();
    scheduleTimerTick();
    updateTimerUI();
    showToast("Cronômetro iniciado. Pode sair da tela que ele continua contando.");
  }

  function pauseTimer() {
    syncTimerFromClock();
    state.timer.running = false;
    clearInterval(state.timer.interval);
    state.timer.interval = null;

    if (state.timer.activeSession) {
      state.timer.activeSession.expectedEndAt = Date.now() + state.timer.remainingSeconds * 1000;
    }

    persistActiveTimer();
    updateTimerUI();
  }

  function resetTimer() {
    state.timer.running = false;
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.activeSession = null;
    localStorage.removeItem(TIMER_KEY);

    const minutes = Number(els.durationSelect.value);
    state.timer.totalSeconds = minutes * 60;
    state.timer.remainingSeconds = minutes * 60;
    updateTimerUI();
  }

  function scheduleTimerTick() {
    clearInterval(state.timer.interval);
    state.timer.interval = setInterval(syncTimerFromClock, 1000);
  }

  function syncTimerFromClock() {
    if (!state.timer.running || !state.timer.activeSession) {
      updateTimerUI();
      return;
    }

    const remainingMs = state.timer.activeSession.expectedEndAt - Date.now();
    state.timer.remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    if (state.timer.remainingSeconds <= 0) {
      state.timer.remainingSeconds = 0;
      updateTimerUI();
      finishSession(true);
      return;
    }

    updateTimerUI();
  }

  function persistActiveTimer() {
    if (!state.timer.activeSession) {
      localStorage.removeItem(TIMER_KEY);
      return;
    }
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      ...state.timer.activeSession,
      running: state.timer.running,
      remainingSeconds: state.timer.remainingSeconds,
      savedAt: Date.now()
    }));
  }

  function restoreActiveTimer() {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMER_KEY));
      if (!saved || !saved.totalSeconds || !saved.expectedEndAt) return;

      state.timer.totalSeconds = Number(saved.totalSeconds);
      state.timer.remainingSeconds = Number(saved.remainingSeconds || saved.totalSeconds);
      state.timer.activeSession = {
        subject: saved.subject || state.data.subjects[0],
        totalSeconds: Number(saved.totalSeconds),
        startedAt: Number(saved.startedAt || Date.now()),
        expectedEndAt: Number(saved.expectedEndAt)
      };
      state.timer.running = Boolean(saved.running);

      const durationMinutes = Math.round(state.timer.totalSeconds / 60);
      if ([25, 45, 60, 90].includes(durationMinutes)) els.durationSelect.value = String(durationMinutes);

      if (saved.subject && state.data.subjects.includes(saved.subject)) els.focusSubject.value = saved.subject;

      if (state.timer.running) {
        state.timer.remainingSeconds = Math.max(0, Math.ceil((state.timer.activeSession.expectedEndAt - Date.now()) / 1000));
        if (state.timer.remainingSeconds <= 0) {
          finishSession(true);
        } else {
          scheduleTimerTick();
        }
      }
    } catch {
      localStorage.removeItem(TIMER_KEY);
    }
  }

  function finishSession(completed) {
    const wasRunning = state.timer.running;
    if (wasRunning && state.timer.activeSession) {
      state.timer.remainingSeconds = Math.max(0, Math.ceil((state.timer.activeSession.expectedEndAt - Date.now()) / 1000));
    }

    const active = state.timer.activeSession;
    const subject = active?.subject || els.focusSubject.value || state.data.subjects[0];
    const totalSeconds = active?.totalSeconds || state.timer.totalSeconds;
    const elapsedSeconds = Math.max(0, totalSeconds - state.timer.remainingSeconds);
    const elapsedMinutes = completed ? Math.round(totalSeconds / 60) : Math.max(1, Math.round(elapsedSeconds / 60));

    if (elapsedSeconds < 30 && !completed) {
      showToast("Estude pelo menos 30 segundos antes de finalizar.");
      return;
    }

    state.timer.running = false;
    clearInterval(state.timer.interval);
    state.timer.interval = null;
    state.timer.activeSession = null;
    localStorage.removeItem(TIMER_KEY);

    state.data.sessions.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      subject,
      minutes: elapsedMinutes,
      date: new Date().toISOString()
    });

    saveData();
    renderAll();
    showToast(completed ? "Sessão concluída mesmo fora da página! 💗" : `Sessão de ${elapsedMinutes} min salva.`);
    resetTimer();
    navigate("estatisticas");
  }

  function updateTimerUI() {
    const minutes = Math.floor(state.timer.remainingSeconds / 60);
    const seconds = state.timer.remainingSeconds % 60;
    els.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    const elapsed = state.timer.totalSeconds - state.timer.remainingSeconds;
    const degrees = state.timer.totalSeconds ? (elapsed / state.timer.totalSeconds) * 360 : 0;
    els.timerRing.style.setProperty("--timer-progress", `${degrees}deg`);

    els.timerHeart.classList.toggle("beating", state.timer.running);
    els.focusStatus.classList.toggle("running", state.timer.running);
    els.focusStatus.innerHTML = state.timer.running ? "<span></span> Rodando em 2ª tela" : "<span></span> Preparando";
    els.startPauseTimer.innerHTML = state.timer.running ? "Ⅱ Pausar" : "▶ Iniciar";
    els.timerCaption.textContent = state.timer.running ? "Pode trocar de tela, o relógio continua" : "Pronto para começar";
    els.durationSelect.disabled = state.timer.running;
    els.focusSubject.disabled = state.timer.running;
  }

  function bindModals() {
    q("#openSettings").addEventListener("click", openSettings);
    q("#addSubjectButton").addEventListener("click", () => { els.subjectModal.hidden = false; setTimeout(() => els.subjectInput.focus(), 30); });
    qa("[data-close-modal]").forEach(button => button.addEventListener("click", () => els.settingsModal.hidden = true));
    qa("[data-close-subject-modal]").forEach(button => button.addEventListener("click", () => els.subjectModal.hidden = true));
    [els.settingsModal, els.subjectModal].forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) modal.hidden = true; }));

    els.settingsForm.addEventListener("submit", event => {
      event.preventDefault();
      state.data.profile.name = els.nameInput.value.trim() || "Estudante";
      state.data.profile.dailyGoal = Number(els.goalInput.value);
      saveData();
      els.settingsModal.hidden = true;
      renderAll();
      navigate("inicio");
      showToast("Perfil atualizado.");
    });

    els.subjectForm.addEventListener("submit", event => {
      event.preventDefault();
      const subject = els.subjectInput.value.trim();
      if (!subject) return;
      if (state.data.subjects.some(item => item.toLowerCase() === subject.toLowerCase())) return showToast("Essa matéria já existe.");
      state.data.subjects.push(subject);
      saveData();
      els.subjectInput.value = "";
      els.subjectModal.hidden = true;
      renderSubjects();
      renderFocusSubjects();
      showToast("Matéria adicionada.");
    });

    q("#clearHistory").addEventListener("click", () => {
      if (!state.data.sessions.length) return;
      if (confirm("Deseja apagar todo o histórico de sessões?")) {
        state.data.sessions = [];
        saveData();
        renderAll();
        showToast("Histórico apagado.");
      }
    });
  }

  function openSettings() {
    els.nameInput.value = state.data.profile.name;
    els.goalInput.value = String(state.data.profile.dailyGoal);
    els.settingsModal.hidden = false;
    setTimeout(() => els.nameInput.focus(), 30);
  }

  function bindTheme() {
    document.body.classList.toggle("dark", state.data.profile.dark);
    updateThemeButton();
    els.themeButton.addEventListener("click", () => {
      state.data.profile.dark = !state.data.profile.dark;
      document.body.classList.toggle("dark", state.data.profile.dark);
      updateThemeButton();
      saveData();
    });
  }

  function updateThemeButton() { els.themeButton.textContent = state.data.profile.dark ? "☀" : "☾"; }

  function renderAll() {
    renderProfile(); renderFocusSubjects(); renderDashboard(); renderSubjects(); renderStats(); renderAchievements(); updateTimerUI();
  }

  function renderProfile() {
    const name = state.data.profile.name || "Estudante";
    els.profileName.textContent = name;
    els.avatarLetter.textContent = firstName(name).charAt(0).toUpperCase();
    if (els.headerName) els.headerName.textContent = firstName(name).toLowerCase();
  }

  function renderDashboard() {
    const todayMinutes = minutesOnDate(new Date());
    const goal = state.data.profile.dailyGoal;
    const percent = Math.min(100, Math.round((todayMinutes / goal) * 100));
    const remaining = Math.max(0, goal - todayMinutes);
    const streak = calculateStreak();

    els.todayTimeHero.textContent = formatMinutes(todayMinutes);
    els.goalRemaining.textContent = remaining ? formatMinutes(remaining) : "Concluída";
    els.heartPercent.textContent = `${percent}%`;
    els.todayTime.textContent = formatMinutes(todayMinutes);
    els.dailyGoalLabel.textContent = formatMinutes(goal);
    els.progressRingText.textContent = `${percent}%`;
    els.progressRing.style.background = `conic-gradient(var(--primary) ${percent * 3.6}deg, var(--surface-soft) 0deg)`;
    els.dailyProgressBar.style.width = `${percent}%`;
    els.mainHeart.style.transform = `scale(${0.88 + Math.min(percent, 100) / 850})`;
    els.streakDays.textContent = streak;
    els.sidebarStreak.textContent = `${streak} ${streak === 1 ? "dia" : "dias"}`;
    els.streakMessage.textContent = streak ? `Você está há ${streak} ${streak === 1 ? "dia" : "dias"} cuidando da sua rotina.` : "Comece hoje a sua sequência!";
    renderWeekDays();
  }

  function renderSubjects() {
    const totals = subjectTotals();
    const max = Math.max(1, ...state.data.subjects.map(subject => totals[subject] || 0));
    const symbols = ["Σ", "A", "⌛", "⚗", "✦", "⌘"];
    els.subjectList.innerHTML = state.data.subjects.map((subject, index) => {
      const total = totals[subject] || 0;
      const pct = Math.max(6, Math.round((total / max) * 100));
      return `<div class="subject-item"><div class="subject-item-top"><span class="subject-badge">${symbols[index % symbols.length]}</span><span class="status-dot">${state.data.sessions.filter(s => s.subject === subject).length} sessões</span></div><strong>${escapeHtml(subject)}</strong><small>${formatMinutes(total)} estudados</small><div class="subject-mini-bar"><span style="width:${pct}%"></span></div></div>`;
    }).join("");
  }

  function renderFocusSubjects() {
    const current = els.focusSubject.value;
    els.focusSubject.innerHTML = state.data.subjects.map(subject => `<option value="${escapeAttribute(subject)}">${escapeHtml(subject)}</option>`).join("");
    if (state.data.subjects.includes(current)) els.focusSubject.value = current;
    if (state.timer.activeSession?.subject && state.data.subjects.includes(state.timer.activeSession.subject)) els.focusSubject.value = state.timer.activeSession.subject;
  }

  function renderWeekDays() {
    const days = lastSevenDays();
    const todayKey = dateKey(new Date());
    const studiedDates = new Set(state.data.sessions.map(s => dateKey(new Date(s.date))));
    const labels = ["D", "S", "T", "Q", "Q", "S", "S"];
    els.weekDays.innerHTML = days.map(date => {
      const key = dateKey(date);
      const completed = studiedDates.has(key);
      return `<div class="day-bubble ${completed ? "completed" : ""} ${key === todayKey ? "today" : ""}"><span>${completed ? "✓" : date.getDate()}</span><small>${labels[date.getDay()]}</small></div>`;
    }).join("");
  }

  function renderStats() {
    const total = state.data.sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
    const weekData = lastSevenDays().map(date => ({ date, minutes: minutesOnDate(date) }));
    const average = Math.round(weekData.reduce((sum, item) => sum + item.minutes, 0) / 7);
    const streak = calculateStreak();

    els.totalStudyTime.textContent = formatMinutes(total);
    els.averageStudyTime.textContent = formatMinutes(average);
    els.statsStreak.textContent = `${streak} ${streak === 1 ? "dia" : "dias"}`;
    els.sessionCount.textContent = state.data.sessions.length;

    const maxMinutes = Math.max(60, ...weekData.map(item => item.minutes));
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    els.weeklyChart.innerHTML = weekData.map(item => {
      const height = Math.max(3, (item.minutes / maxMinutes) * 88);
      return `<div class="bar-column"><span class="bar-value">${item.minutes ? formatMinutes(item.minutes) : "0"}</span><div class="bar" style="height:${height}%"></div><span class="bar-day">${dayNames[item.date.getDay()]}</span></div>`;
    }).join("");

    const shown = Math.min(20, state.data.sessions.length);
    els.heartCollection.innerHTML = Array.from({ length: 20 }, (_, index) => `<span class="collection-heart ${index < shown ? "" : "empty"}">♥</span>`).join("");
    els.collectionText.textContent = `${state.data.sessions.length} ${state.data.sessions.length === 1 ? "sessão concluída" : "sessões concluídas"}`;
    els.nextHeartText.textContent = `Próximo marco: ${Math.ceil((state.data.sessions.length + 1) / 5) * 5}`;
    renderHistory();
  }

  function renderHistory() {
    if (!state.data.sessions.length) {
      els.historyList.innerHTML = `<div class="empty-state">Nenhuma sessão registrada ainda. Comece pelo modo foco.</div>`;
      return;
    }
    els.historyList.innerHTML = state.data.sessions.slice(0, 8).map(session => {
      const date = new Date(session.date);
      return `<div class="history-item"><span class="history-icon">♥</span><div><strong>${escapeHtml(session.subject)}</strong><small>Sessão concluída</small></div><span class="history-time">${formatMinutes(session.minutes)}</span><span class="history-date">${formatDate(date)}</span></div>`;
    }).join("");
  }

  function renderAchievements() {
    const totalMinutes = state.data.sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
    const sessions = state.data.sessions.length;
    const streak = calculateStreak();
    const achievements = [
      { icon: "💗", title: "Primeiro passo", description: "Conclua sua primeira sessão de estudos.", unlocked: sessions >= 1, progress: `${Math.min(sessions, 1)}/1 sessão` },
      { icon: "🔥", title: "Chama acesa", description: "Mantenha uma sequência de 3 dias.", unlocked: streak >= 3, progress: `${Math.min(streak, 3)}/3 dias` },
      { icon: "🏆", title: "Dez horas", description: "Acumule 10 horas de estudo.", unlocked: totalMinutes >= 600, progress: `${formatMinutes(Math.min(totalMinutes, 600))}/10h` },
      { icon: "⭐", title: "Foco mestre", description: "Conclua 25 sessões de foco.", unlocked: sessions >= 25, progress: `${Math.min(sessions, 25)}/25 sessões` },
      { icon: "📚", title: "Explorador", description: "Estude pelo menos 3 matérias diferentes.", unlocked: studiedSubjectCount() >= 3, progress: `${Math.min(studiedSubjectCount(), 3)}/3 matérias` },
      { icon: "⏱", title: "Maratona", description: "Complete uma sessão de 90 minutos.", unlocked: state.data.sessions.some(s => s.minutes >= 90), progress: state.data.sessions.some(s => s.minutes >= 90) ? "Concluída" : "90 min em uma sessão" },
      { icon: "💎", title: "Constância", description: "Mantenha uma sequência de 7 dias.", unlocked: streak >= 7, progress: `${Math.min(streak, 7)}/7 dias` },
      { icon: "👑", title: "Coração de ouro", description: "Acumule 50 horas de estudo.", unlocked: totalMinutes >= 3000, progress: `${formatMinutes(Math.min(totalMinutes, 3000))}/50h` }
    ];
    els.achievementGrid.innerHTML = achievements.map(item => `<article class="achievement-card ${item.unlocked ? "" : "locked"}"><div class="achievement-badge">${item.unlocked ? item.icon : "🔒"}</div><h3>${item.title}</h3><p>${item.description}</p><small>${item.unlocked ? "Desbloqueada" : item.progress}</small></article>`).join("");
  }

  function calculateStreak() {
    const studied = new Set(state.data.sessions.map(session => dateKey(new Date(session.date))));
    if (!studied.size) return 0;
    let cursor = startOfDay(new Date());
    if (!studied.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (studied.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }

  function minutesOnDate(date) {
    const key = dateKey(date);
    return state.data.sessions.filter(session => dateKey(new Date(session.date)) === key).reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  }

  function subjectTotals() {
    return state.data.sessions.reduce((totals, session) => {
      totals[session.subject] = (totals[session.subject] || 0) + Number(session.minutes || 0);
      return totals;
    }, {});
  }

  function studiedSubjectCount() { return new Set(state.data.sessions.map(s => s.subject)).size; }

  function lastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = startOfDay(new Date());
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
  }

  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

  function formatMinutes(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    if (!hours) return `${mins}min`;
    if (!mins) return `${hours}h`;
    return `${hours}h ${String(mins).padStart(2, "0")}min`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function firstName(name) { return String(name || "Estudante").trim().split(/\s+/)[0] || "Estudante"; }
  function showToast(message) { els.toast.textContent = message; els.toast.classList.add("show"); clearTimeout(showToast.timeout); showToast.timeout = setTimeout(() => els.toast.classList.remove("show"), 3200); }
  function escapeHtml(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
  function escapeAttribute(value) { return escapeHtml(value); }
})();
