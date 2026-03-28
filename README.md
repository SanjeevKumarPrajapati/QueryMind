# QueryMind — Conversational BI Agent
> Ask plain English questions about your Instacart dataset. Get charts, tables, and insights powered by Groq + DuckDB.

---

## Project Structure

```
bi_agent/
├── backend/
│   ├── app.py              ← Flask API + Groq + DuckDB
│   └── requirements.txt
└── data/                   ← Put your CSV files here
    ├── orders.csv
    ├── order_products__prior.csv
    ├── order_products__train.csv
    ├── products.csv
    ├── aisles.csv
    └── departments.csv
├── frontend/
    ├── index.html
    └── static/
        ├── css/style.css
        └── js/app.js
 
```

---

## Quick Start

### 1. Get a Groq API Key
Sign up at https://console.groq.com → Create API Key (free tier available)

### 2. Download the Dataset (optional)
Dataset: https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis  
Place all 6 CSV files in the `data/` folder.


### 3. Install & Run Backend

```bash
cd backend
pip install -r requirements.txt

# Set your Groq API key
export GROQ_API_KEY="gsk_your_key_here"

# Optional: point to your data folder (default: ../data)
export DATA_DIR="../data"

python app.py
```

Backend runs at: http://localhost:5000

### 4. Open Frontend

Just open `frontend/index.html` in your browser:

```bash
# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html

# Or use a simple HTTP server
cd frontend && python -m http.server 8080
# Then visit http://localhost:8080
```

---

## Example Questions

| Question | What it does |
|---|---|
| "Which department has the most reordered products?" | 3-table join + aggregation |
| "Show me order volume by day of week" | Bar chart with time distribution |
| "Top 10 most popular products" | Ranked product query |
| "What percentage of orders contain reordered items?" | Computed metric |
| "Which aisle has the highest average cart position?" | Multi-table join |

---

## Architecture

```
Browser (HTML/CSS/JS)
    │  Plain English question
    ▼
Flask API (/api/query)
    │  Build schema context
    ▼
Groq LLM (llama-3.1-8b-instant)
    │  Returns JSON: { sql, chart_type, x_axis, y_axis, title, insight }
    ▼
DuckDB (in-memory)
    │  Execute SQL on CSV tables
    ▼
Response → Chart.js renders bar/line/pie or HTML table
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Loaded tables + row counts |
| POST | `/api/query` | Ask a question |
| GET | `/api/suggestions` | Get example questions |

### POST /api/query

**Request:**
```json
{
  "question": "Which department has the most orders?",
  "history": []
}
```

**Response:**
```json
{
  "type": "chart",
  "sql": "SELECT d.department, COUNT(*) ...",
  "chart_type": "bar",
  "x_axis": "department",
  "y_axis": "order_count",
  "title": "Orders by Department",
  "insight": "Produce dominates with 22% of all orders.",
  "columns": ["department", "order_count"],
  "rows": [["produce", 45000], ...]
}
```

---

## Stretch Features Implemented

- ✅ Multi-table joins (3+ tables)
- ✅ Automatic chart type selection (bar/line/pie/table)
- ✅ Conversational memory (last 3 turns sent to LLM)
- ✅ Error recovery (retry with corrected SQL)
- ✅ Scale handling (DuckDB handles 32M-row tables)
- ✅ SQL inspection (toggle SQL view per message)
- ✅ Business insights per query

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Groq (llama3-70b-8192) |
| Query Engine | DuckDB |
| Backend | Python + Flask |
| Frontend | Vanilla HTML/CSS/JS |
| Charts | Chart.js v4 |
