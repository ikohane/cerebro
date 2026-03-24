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

    const taskLabels = { addition: "Addition", oddeven: "Odd / Even", stroop: "Stroop" };

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
    renderHistory();
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

    const taskLabels = { addition: "Addition", oddeven: "Odd / Even", stroop: "Stroop" };

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
    renderHistory();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Init ───────────────────────────────────────────────────────────────────
renderHistory();
