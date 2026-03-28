/* ── Config ──────────────────────────────────────────────── */
const API = "http://localhost:5000/api";
const chartInstances = {};          // canvas_id → Chart instance
let conversationHistory = [];       // [{role, content}, ...]
let isLoading = false;

/* ── Chart.js global defaults ────────────────────────────── */
Chart.defaults.color = "#6b7280";
Chart.defaults.borderColor = "#1e2230";
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 11;

const PALETTE = [
  "#f59e0b", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#a3e635", "#06b6d4"
];

/* ── DOM refs ────────────────────────────────────────────── */
const chatWindow    = document.getElementById("chatWindow");
const welcomeCard   = document.getElementById("welcomeCard");
const questionInput = document.getElementById("questionInput");
const sendBtn       = document.getElementById("sendBtn");
const tableList     = document.getElementById("tableList");
const suggestionList= document.getElementById("suggestionList");
const sampleChips   = document.getElementById("sampleChips");
const clearBtn      = document.getElementById("clearBtn");

/* ── Init ────────────────────────────────────────────────── */
async function init() {
  await loadStatus();
  await loadSuggestions();
}

async function loadStatus() {
  try {
    const res = await fetch(`${API}/status`);
    const data = await res.json();
    renderTableList(data.loaded_tables || []);
    document.getElementById("modelLabel").textContent = data.model || "llama3-70b";
  } catch {
    tableList.innerHTML = `<div style="font-size:0.72rem;color:#ef4444;padding:4px">Backend offline</div>`;
  }
}

function renderTableList(tables) {
  if (!tables.length) {
    tableList.innerHTML = `<div style="font-size:0.72rem;color:var(--text-muted);padding:4px">No tables loaded</div>`;
    return;
  }
  tableList.innerHTML = tables.map(t => `
    <div class="table-pill">
      <span class="tname">${t.table}</span>
      <span class="trows">${formatNum(t.rows)}</span>
    </div>
  `).join("");
}

async function loadSuggestions() {
  try {
    const res = await fetch(`${API}/suggestions`);
    const data = await res.json();
    const items = data.suggestions || [];

    // Sidebar list
    suggestionList.innerHTML = items.map(s => `
      <button class="suggestion-item" onclick="askQuestion(${JSON.stringify(s)})">${s}</button>
    `).join("");

    // Welcome chips (first 4)
    sampleChips.innerHTML = items.slice(0, 4).map(s => `
      <button class="chip" onclick="askQuestion(${JSON.stringify(s)})">${s}</button>
    `).join("");
  } catch {}
}

/* ── Send flow ───────────────────────────────────────────── */
function askQuestion(text) {
  questionInput.value = text;
  sendQuestion();
}

async function sendQuestion() {
  const question = questionInput.value.trim();
  if (!question || isLoading) return;

  isLoading = true;
  sendBtn.disabled = true;
  questionInput.value = "";
  autoResize();

  hideWelcome();
  appendUserMessage(question);
  const thinkingEl = appendThinking();

  conversationHistory.push({ role: "user", content: question });

  try {
    const res = await fetch(`${API}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: conversationHistory })
    });
    const data = await res.json();
    thinkingEl.remove();

    if (data.error) {
      appendError(data.error, data.sql);
      conversationHistory.push({ role: "assistant", content: `Error: ${data.error}` });
    } else if (data.type === "answer") {
      appendTextAnswer(data.answer);
      conversationHistory.push({ role: "assistant", content: data.answer });
    } else {
      appendChartMessage(data);
      conversationHistory.push({
        role: "assistant",
        content: `Result: ${data.title}. Insight: ${data.insight}`
      });
    }
  } catch (err) {
    thinkingEl.remove();
    appendError("Could not reach the backend. Is Flask running on port 5000?");
  }

  isLoading = false;
  sendBtn.disabled = false;
  scrollBottom();
}

/* ── Message renderers ───────────────────────────────────── */
function appendUserMessage(text) {
  const el = createElement(`
    <div class="message user">
      <div class="msg-header">
        <div class="avatar">U</div>
        <span>You</span>
      </div>
      <div class="bubble">${escHtml(text)}</div>
    </div>
  `);
  chatWindow.appendChild(el);
  scrollBottom();
}

function appendThinking() {
  const el = createElement(`
    <div class="message ai thinking-msg">
      <div class="msg-header">
        <div class="avatar">Q</div>
        <span>QueryMind</span>
      </div>
      <div class="thinking">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        Generating query…
      </div>
    </div>
  `);
  chatWindow.appendChild(el);
  scrollBottom();
  return el;
}

function appendTextAnswer(text) {
  const el = createElement(`
    <div class="message ai">
      <div class="msg-header">
        <div class="avatar">Q</div>
        <span>QueryMind</span>
      </div>
      <div class="bubble">${escHtml(text)}</div>
    </div>
  `);
  chatWindow.appendChild(el);
}

function appendError(msg, sql) {
  const sqlPart = sql ? `<div class="sql-block open" style="margin-top:8px">${escHtml(sql)}</div>` : "";
  const el = createElement(`
    <div class="message ai">
      <div class="msg-header">
        <div class="avatar">Q</div>
        <span>QueryMind</span>
      </div>
      <div class="error-bubble">⚠ ${escHtml(msg)}${sqlPart}</div>
    </div>
  `);
  chatWindow.appendChild(el);
}

function appendChartMessage(data) {
  const canvasId = "chart_" + Date.now();
  const showChart = data.chart_type !== "table" && data.columns && data.rows?.length;

  const sqlId = "sql_" + Date.now();
  const insightHtml = data.insight
    ? `<div class="insight-bar"><span class="insight-icon">💡</span>${escHtml(data.insight)}</div>`
    : "";

  const bodyHtml = showChart
    ? `<div class="chart-canvas-wrap"><canvas id="${canvasId}"></canvas></div>${insightHtml}`
    : buildTableHtml(data.columns, data.rows) + insightHtml;

  const el = createElement(`
    <div class="message ai">
      <div class="msg-header">
        <div class="avatar">Q</div>
        <span>QueryMind</span>
      </div>
      <div class="bubble chart-card">
        <div class="chart-card-header">
          <div class="chart-title">${escHtml(data.title || "Result")}</div>
          <div class="chart-meta">
            <span class="chart-type-badge">${data.chart_type}</span>
            ${data.sql ? `<button class="toggle-sql-btn" onclick="toggleSql('${sqlId}')">SQL</button>` : ""}
          </div>
        </div>
        ${bodyHtml}
        ${data.sql ? `<div class="sql-block" id="${sqlId}">${escHtml(data.sql)}</div>` : ""}
      </div>
    </div>
  `);
  chatWindow.appendChild(el);

  if (showChart) {
    renderChart(canvasId, data);
  }
}

/* ── Chart rendering ─────────────────────────────────────── */
function renderChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const { columns, rows, chart_type, x_axis, y_axis } = data;

  // Find column indices
  const xIdx = x_axis ? columns.indexOf(x_axis) : 0;
  const yIdx = y_axis ? columns.indexOf(y_axis) : 1;
  const safeXIdx = xIdx === -1 ? 0 : xIdx;
  const safeYIdx = yIdx === -1 ? 1 : yIdx;

  const labels = rows.map(r => String(r[safeXIdx] ?? ""));
  const values = rows.map(r => parseFloat(r[safeYIdx]) || 0);

  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: chart_type === "pie", labels: { color: "#6b7280", font: { size: 11 } } },
      tooltip: {
        backgroundColor: "#111318",
        borderColor: "#1e2230",
        borderWidth: 1,
        titleColor: "#f59e0b",
        bodyColor: "#e8eaf0",
        padding: 10,
      }
    },
    scales: chart_type === "pie" ? {} : {
      x: {
        ticks: { color: "#6b7280", maxRotation: 45 },
        grid: { color: "#1e2230" }
      },
      y: {
        ticks: { color: "#6b7280" },
        grid: { color: "#1e2230" }
      }
    }
  };

  let cfg;
  if (chart_type === "pie") {
    cfg = {
      type: "pie",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: PALETTE, borderColor: "#0c0d0f", borderWidth: 2 }]
      },
      options: { ...commonOptions, plugins: { ...commonOptions.plugins, legend: { display: true, position: "right", labels: { color: "#6b7280" } } } }
    };
  } else if (chart_type === "line") {
    cfg = {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: y_axis || columns[safeYIdx],
          data: values,
          borderColor: PALETTE[0],
          backgroundColor: "rgba(245,158,11,0.08)",
          pointBackgroundColor: PALETTE[0],
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }]
      },
      options: commonOptions
    };
  } else {
    // bar
    cfg = {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: y_axis || columns[safeYIdx],
          data: values,
          backgroundColor: values.map((_, i) => PALETTE[i % PALETTE.length] + "cc"),
          borderColor: values.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: commonOptions
    };
  }

  chartInstances[canvasId] = new Chart(canvas, cfg);
}

/* ── Table rendering ─────────────────────────────────────── */
function buildTableHtml(columns, rows) {
  if (!columns || !rows) return "";
  const header = columns.map(c => `<th>${escHtml(c)}</th>`).join("");
  const body = rows.map(row =>
    `<tr>${row.map(v => `<td>${escHtml(String(v ?? ""))}</td>`).join("")}</tr>`
  ).join("");
  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

/* ── Helpers ─────────────────────────────────────────────── */
function toggleSql(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("open");
}

function hideWelcome() {
  if (welcomeCard && !welcomeCard.classList.contains("hidden")) {
    welcomeCard.classList.add("hidden");
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createElement(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstChild;
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function scrollBottom() {
  requestAnimationFrame(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

function autoResize() {
  questionInput.style.height = "auto";
  questionInput.style.height = Math.min(questionInput.scrollHeight, 140) + "px";
}

/* ── Events ──────────────────────────────────────────────── */
sendBtn.addEventListener("click", sendQuestion);

questionInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendQuestion();
  }
});

questionInput.addEventListener("input", autoResize);

clearBtn.addEventListener("click", () => {
  conversationHistory = [];
  chatWindow.innerHTML = "";
  chatWindow.appendChild(welcomeCard);
  welcomeCard.classList.remove("hidden");
  // Destroy all chart instances
  Object.values(chartInstances).forEach(c => c.destroy());
  Object.keys(chartInstances).forEach(k => delete chartInstances[k]);
});

/* ── Bootstrap ───────────────────────────────────────────── */
init();
