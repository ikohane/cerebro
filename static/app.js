// ─── State ───────────────────────────────────────────────────────────────────
const DURATION = 60; // seconds
const STORAGE_KEY = "cerebro_sessions";

let currentTask = null;
let timeLeft = 0;
let timerInterval = null;
let trials = [];        // { correct: bool, responseMs: number }
let trialStart = null;  // timestamp when current problem was shown
let currentAnswer = null;
let correct = 0;
let total = 0;

// Sequence recall
let sequenceLength = 4;   // starting length, grows on correct answers
let sequenceTarget = [];   // the digits to remember

// Stroop colours
const STROOP_COLORS = [
    { name: "Red",    hex: "#e74c3c" },
    { name: "Blue",   hex: "#2980b9" },
    { name: "Green",  hex: "#27ae60" },
    { name: "Yellow", hex: "#f1c40f" },
];

// ─── Screen management ──────────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

// ─── Start task ─────────────────────────────────────────────────────────────
function startTask(type) {
    currentTask = type;
    trials = [];
    correct = 0;
    total = 0;
    sequenceLength = 4; // reset for sequence recall
    showScreen("screen-countdown");
    runCountdown(3);
}

function runCountdown(n) {
    const el = document.getElementById("countdown-display");
    el.textContent = n;
    el.style.animation = "none";
    void el.offsetWidth; // reflow to restart animation
    el.style.animation = "pulse 0.6s ease-in-out";

    if (n > 1) {
        setTimeout(() => runCountdown(n - 1), 800);
    } else {
        setTimeout(() => beginTask(), 800);
    }
}

// ─── Begin task (after countdown) ───────────────────────────────────────────
function beginTask() {
    timeLeft = DURATION;
    showScreen("screen-task");
    updateScore();
    updateTimerBar();
    showProblem();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerBar();
        if (timeLeft <= 0) {
            endTask();
        }
    }, 1000);
}

function updateTimerBar() {
    const bar = document.getElementById("timer-bar");
    const text = document.getElementById("timer-text");
    const pct = (timeLeft / DURATION) * 100;
    bar.style.width = pct + "%";
    text.textContent = timeLeft + "s";

    bar.classList.remove("warning", "danger");
    if (timeLeft <= 10) bar.classList.add("danger");
    else if (timeLeft <= 20) bar.classList.add("warning");
}

function updateScore() {
    document.getElementById("task-score").textContent = correct + " / " + total;
}

// ─── Problem generation ─────────────────────────────────────────────────────
function showProblem() {
    trialStart = performance.now();
    const area = document.getElementById("task-area");

    if (currentTask === "addition") {
        const a = randInt(10, 99);
        const b = randInt(10, 99);
        currentAnswer = a + b;
        area.innerHTML = `
            <div class="problem-text">${a} + ${b}</div>
            <input type="number" class="answer-input" id="answer-input" inputmode="numeric" autocomplete="off">
            <div class="submit-hint">Press Enter to submit</div>
        `;
        const input = document.getElementById("answer-input");
        input.focus();
        input.addEventListener("keydown", handleAdditionKey);

    } else if (currentTask === "oddeven") {
        const n = randInt(1, 999);
        currentAnswer = n % 2 === 0 ? "even" : "odd";
        area.innerHTML = `
            <div class="problem-text">${n}</div>
            <div class="choice-buttons">
                <button class="choice-btn btn-odd" onclick="submitOddEven('odd')">Odd</button>
                <button class="choice-btn btn-even" onclick="submitOddEven('even')">Even</button>
            </div>
        `;

    } else if (currentTask === "stroop") {
        const wordIdx = randInt(0, STROOP_COLORS.length - 1);
        let colorIdx = randInt(0, STROOP_COLORS.length - 2);
        if (colorIdx >= wordIdx) colorIdx++; // ensure different
        currentAnswer = STROOP_COLORS[colorIdx].name;

        area.innerHTML = `
            <div class="stroop-word" style="color: ${STROOP_COLORS[colorIdx].hex}">
                ${STROOP_COLORS[wordIdx].name}
            </div>
            <div class="stroop-buttons">
                ${STROOP_COLORS.map(c => `
                    <button class="stroop-btn" style="background: ${c.hex}"
                        onclick="submitStroop('${c.name}')">
                        ${c.name}
                    </button>
                `).join("")}
            </div>
        `;

    } else if (currentTask === "sequence") {
        // Generate a sequence of digits
        sequenceTarget = [];
        for (let i = 0; i < sequenceLength; i++) {
            sequenceTarget.push(randInt(0, 9));
        }
        currentAnswer = sequenceTarget.join("");
        showSequenceFlash(area);
    }
}

// ─── Sequence Recall: flash digits one-by-one then prompt ───────────────────
function showSequenceFlash(area) {
    const flashMs = 600;  // time each digit is shown
    const gapMs = 150;    // gap between digits
    let i = 0;

    area.innerHTML = `
        <div class="sequence-length-label">${sequenceLength} digits</div>
        <div class="sequence-flash" id="seq-flash"></div>
        <div class="sequence-hint">Watch carefully…</div>
    `;
    const flashEl = document.getElementById("seq-flash");

    function showNext() {
        if (i >= sequenceTarget.length) {
            // Done flashing — show input
            trialStart = performance.now();  // start timing after flash
            area.innerHTML = `
                <div class="sequence-length-label">${sequenceLength} digits</div>
                <div class="sequence-prompt">Type the sequence</div>
                <input type="text" class="answer-input sequence-input" id="seq-input"
                       inputmode="numeric" autocomplete="off" maxlength="${sequenceLength}"
                       placeholder="${"·".repeat(sequenceLength)}">
                <div class="submit-hint">Press Enter to submit</div>
            `;
            const input = document.getElementById("seq-input");
            input.focus();
            input.addEventListener("keydown", handleSequenceKey);
            return;
        }

        flashEl.textContent = sequenceTarget[i];
        flashEl.style.opacity = "1";

        setTimeout(() => {
            flashEl.style.opacity = "0";
            i++;
            setTimeout(showNext, gapMs);
        }, flashMs);
    }

    showNext();
}

function handleSequenceKey(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        const val = document.getElementById("seq-input").value.trim();
        if (val.length === 0) return;
        const isCorrect = val === currentAnswer;
        // Adaptive length: grow on correct, shrink on wrong (min 3)
        if (isCorrect) {
            sequenceLength = Math.min(sequenceLength + 1, 12);
        } else {
            sequenceLength = Math.max(sequenceLength - 1, 3);
        }
        recordTrial(isCorrect);
    }
}

// ─── Input handlers ─────────────────────────────────────────────────────────
function handleAdditionKey(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        const val = parseInt(document.getElementById("answer-input").value, 10);
        if (isNaN(val)) return;
        recordTrial(val === currentAnswer);
    }
}

function submitOddEven(choice) {
    recordTrial(choice === currentAnswer);
}

function submitStroop(choice) {
    recordTrial(choice === currentAnswer);
}

// ─── Record trial and show next ─────────────────────────────────────────────
function recordTrial(isCorrect) {
    const responseMs = Math.round(performance.now() - trialStart);
    trials.push({ correct: isCorrect, responseMs });
    total++;
    if (isCorrect) correct++;
    updateScore();
    showFeedback(isCorrect);

    if (timeLeft > 0) {
        showProblem();
    }
}

function showFeedback(isCorrect) {
    const fb = document.getElementById("feedback");
    fb.textContent = isCorrect ? "✓" : "✗";
    fb.className = "feedback show " + (isCorrect ? "correct" : "wrong");
    setTimeout(() => { fb.className = "feedback"; }, 300);
}

// ─── End task ───────────────────────────────────────────────────────────────
function endTask() {
    clearInterval(timerInterval);
    timerInterval = null;
    showResults();
}

function showResults() {
    showScreen("screen-results");
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgMs = trials.length > 0
        ? Math.round(trials.reduce((s, t) => s + t.responseMs, 0) / trials.length)
        : 0;

    const taskLabels = { addition: "Addition", oddeven: "Odd / Even", stroop: "Stroop", sequence: "Sequence" };

    document.getElementById("results-card").innerHTML = `
        <div class="result-row">
            <span class="result-label">Task</span>
            <span class="result-value">${taskLabels[currentTask]}</span>
        </div>
        <div class="result-row">
            <span class="result-label">Score</span>
            <span class="result-value">${correct} / ${total}</span>
        </div>
        <div class="result-row">
            <span class="result-label">Accuracy</span>
            <span class="result-value">${accuracy}%</span>
        </div>
        <div class="result-row">
            <span class="result-label">Avg Response</span>
            <span class="result-value">${avgMs} ms</span>
        </div>
    `;
}

// ─── Save / Discard ─────────────────────────────────────────────────────────
function saveAndReturn() {
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgMs = trials.length > 0
        ? Math.round(trials.reduce((s, t) => s + t.responseMs, 0) / trials.length)
        : 0;

    const session = {
        date: new Date().toISOString(),
        task: currentTask,
        correct,
        total,
        accuracy,
        avgMs,
    };

    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    sessions.unshift(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

    goHome();
}

function discardAndReturn() {
    goHome();
}

function goHome() {
    currentTask = null;
    showScreen("screen-home");
    renderBestScores();
renderHistory();
}

// ─── Best Scores ────────────────────────────────────────────────────────────
function renderBestScores() {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const section = document.getElementById("best-scores-section");
    const grid = document.getElementById("best-scores-grid");
    const taskTypes = ["addition", "oddeven", "stroop", "sequence"];
    const taskLabels = { addition: "Addition", oddeven: "Odd / Even", stroop: "Stroop", sequence: "Sequence" };
    const taskIcons = { addition: "➕", oddeven: "🔢", stroop: "🎨", sequence: "🧠" };

    const bests = {};
    for (const type of taskTypes) {
        const typeSessions = sessions.filter(s => s.task === type && s.total > 0);
        if (typeSessions.length === 0) continue;
        // Best = highest accuracy, then lowest avgMs as tiebreaker
        typeSessions.sort((a, b) => b.accuracy - a.accuracy || a.avgMs - b.avgMs);
        bests[type] = typeSessions[0];
    }

    if (Object.keys(bests).length === 0) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";
    grid.innerHTML = taskTypes.filter(t => bests[t]).map(t => {
        const s = bests[t];
        const d = new Date(s.date);
        const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return `<div class="best-card best-card-${t}">
            <div class="best-card-icon">${taskIcons[t]}</div>
            <div class="best-card-info">
                <div class="best-card-title">${taskLabels[t]}</div>
                <div class="best-card-date">${dateStr} at ${timeStr}</div>
            </div>
            <div class="best-card-stats">
                <div class="best-card-accuracy">${s.accuracy}%</div>
                <div class="best-card-time">${s.correct}/${s.total} · ${s.avgMs}ms</div>
            </div>
        </div>`;
    }).join("");
}

// ─── History ────────────────────────────────────────────────────────────────
function renderHistory() {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const wrap = document.getElementById("history-table-wrap");
    const clearBtn = document.getElementById("btn-clear-history");

    if (sessions.length === 0) {
        wrap.innerHTML = '<p class="empty-state">No sessions yet. Pick a task above to start!</p>';
        clearBtn.style.display = "none";
        return;
    }

    clearBtn.style.display = "inline-block";

    const taskLabels = { addition: "Addition", oddeven: "Odd / Even", stroop: "Stroop", sequence: "Sequence" };

    const rows = sessions.map(s => {
        const d = new Date(s.date);
        const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return `<tr>
            <td>${dateStr}<br><span style="color:#aaa;font-size:0.72rem">${timeStr}</span></td>
            <td><span class="badge badge-${s.task}">${taskLabels[s.task] || s.task}</span></td>
            <td>${s.correct}/${s.total}</td>
            <td>${s.accuracy}%</td>
            <td>${s.avgMs}ms</td>
        </tr>`;
    }).join("");

    wrap.innerHTML = `
        <table class="history">
            <thead><tr>
                <th>Date</th>
                <th>Task</th>
                <th>Score</th>
                <th>Acc</th>
                <th>Avg</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function clearHistory() {
    if (!confirm("Clear all session history?")) return;
    localStorage.removeItem(STORAGE_KEY);
    renderBestScores();
renderHistory();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Init ───────────────────────────────────────────────────────────────────
renderBestScores();
renderHistory();
