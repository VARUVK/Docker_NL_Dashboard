"""
app.py
======
Docker NL Health Dashboard — Main Application
Entry point for the Streamlit web application.

Run with:
    streamlit run app.py

Features:
- Natural language Docker query interface
- AI-powered query parsing (Claude API or keyword fallback)
- Real-time Docker container monitoring
- Health statistics and visualizations
- Container log viewer
- PDF export
- Auto-refresh support

Author: Docker NL Health Dashboard
"""

import streamlit as st
import json
import time
import os
from datetime import datetime

# ─── Page Config (MUST be first Streamlit call) ───────────────────────────────
st.set_page_config(
    page_title="Docker NL Dashboard",
    page_icon="🐳",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Local Module Imports ─────────────────────────────────────────────────────
from ai_parser import parse_query, describe_action
from docker_engine import (
    get_all_containers,
    get_docker_stats,
    get_crashed_containers,
    is_docker_running,
)
from dashboard import (
    render_stats_cards,
    render_container_table,
    render_logs,
    render_health_overview,
    generate_summary,
    render_docker_offline_warning,
    render_sidebar,
)

# ─── Custom CSS — Docker-themed Dark Dashboard ────────────────────────────────
st.markdown("""
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Sora:wght@300;400;600;700&display=swap');

/* ── Root Variables ── */
:root {
    --docker-blue:   #0db7ed;
    --docker-dark:   #0a1628;
    --docker-navy:   #0e2040;
    --docker-accent: #00d4ff;
    --success:       #00d26a;
    --warning:       #ffa502;
    --danger:        #ff4757;
    --card-bg:       rgba(13, 32, 64, 0.85);
    --border:        rgba(13, 183, 237, 0.2);
    --text-primary:  #e8f4fd;
    --text-muted:    #7aa8c7;
}

/* ── Global App Background ── */
.stApp {
    background: linear-gradient(135deg, #050d1a 0%, #0a1628 40%, #0d1f3c 100%);
    font-family: 'Sora', sans-serif;
    color: var(--text-primary);
}

/* ── Animated whale-wave top border ── */
.stApp::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg,
        transparent, #0db7ed, #00d4ff, #0db7ed, transparent);
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
    z-index: 9999;
}
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #06111f 0%, #0a1a2e 100%) !important;
    border-right: 1px solid var(--border);
}
[data-testid="stSidebar"] .stMarkdown h2 {
    color: var(--docker-blue) !important;
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
}

/* ── Sidebar Buttons ── */
[data-testid="stSidebar"] .stButton > button {
    background: rgba(13, 183, 237, 0.08) !important;
    border: 1px solid var(--border) !important;
    color: var(--text-primary) !important;
    border-radius: 8px !important;
    font-family: 'Sora', sans-serif !important;
    font-size: 0.82rem !important;
    transition: all 0.2s ease !important;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background: rgba(13, 183, 237, 0.2) !important;
    border-color: var(--docker-blue) !important;
    transform: translateX(4px);
}

/* ── Main Metric Cards ── */
[data-testid="stMetric"] {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    backdrop-filter: blur(10px);
    transition: transform 0.2s ease, border-color 0.2s ease;
}
[data-testid="stMetric"]:hover {
    transform: translateY(-2px);
    border-color: var(--docker-blue);
}
[data-testid="stMetricLabel"] {
    color: var(--text-muted) !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
}
[data-testid="stMetricValue"] {
    color: var(--docker-accent) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 2rem !important;
    font-weight: 600 !important;
}

/* ── Query Input Box ── */
.stTextInput > div > div > input {
    background: rgba(13, 183, 237, 0.06) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: 12px !important;
    color: var(--text-primary) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 1rem !important;
    padding: 0.75rem 1rem !important;
    transition: border-color 0.2s ease !important;
}
.stTextInput > div > div > input:focus {
    border-color: var(--docker-blue) !important;
    box-shadow: 0 0 0 3px rgba(13, 183, 237, 0.15) !important;
}
.stTextInput > div > div > input::placeholder {
    color: var(--text-muted) !important;
}

/* ── Primary Action Button ── */
.stButton > button[kind="primary"],
div[data-testid="stFormSubmitButton"] > button {
    background: linear-gradient(135deg, #0db7ed, #0077b6) !important;
    border: none !important;
    border-radius: 10px !important;
    color: #fff !important;
    font-family: 'Sora', sans-serif !important;
    font-weight: 600 !important;
    letter-spacing: 0.03em !important;
    padding: 0.6rem 2rem !important;
    transition: all 0.2s ease !important;
}
.stButton > button[kind="primary"]:hover,
div[data-testid="stFormSubmitButton"] > button:hover {
    background: linear-gradient(135deg, #00d4ff, #0db7ed) !important;
    box-shadow: 0 4px 20px rgba(13, 183, 237, 0.35) !important;
    transform: translateY(-1px) !important;
}

/* ── DataFrames / Tables ── */
[data-testid="stDataFrame"] {
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    overflow: hidden;
}
.dataframe thead th {
    background: rgba(13, 183, 237, 0.15) !important;
    color: var(--docker-blue) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.78rem !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
}

/* ── Code / Log Block ── */
.stCode, [data-testid="stCode"] {
    background: #020810 !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.8rem !important;
}

/* ── Info / Success / Warning / Error Boxes ── */
.stAlert {
    border-radius: 10px !important;
    border-left-width: 4px !important;
}

/* ── Tabs ── */
.stTabs [data-baseweb="tab-list"] {
    background: rgba(13, 32, 64, 0.5) !important;
    border-radius: 10px !important;
    padding: 4px !important;
}
.stTabs [data-baseweb="tab"] {
    color: var(--text-muted) !important;
    font-family: 'Sora', sans-serif !important;
    border-radius: 8px !important;
}
.stTabs [aria-selected="true"] {
    background: rgba(13, 183, 237, 0.15) !important;
    color: var(--docker-blue) !important;
}

/* ── Expander ── */
[data-testid="stExpander"] {
    background: var(--card-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
}

/* ── Dividers ── */
hr {
    border-color: var(--border) !important;
    margin: 1.5rem 0 !important;
}

/* ── Subheaders ── */
h2, h3 {
    color: var(--text-primary) !important;
}

/* ── Summary Box ── */
.summary-box {
    background: linear-gradient(135deg,
        rgba(13, 183, 237, 0.1), rgba(0, 119, 182, 0.08));
    border: 1px solid rgba(13, 183, 237, 0.3);
    border-radius: 12px;
    padding: 1rem 1.4rem;
    margin: 1rem 0;
    font-size: 1rem;
    line-height: 1.6;
}

/* ── Parsed JSON expander ── */
.json-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 6px;
    padding: 2px 8px;
    color: var(--docker-accent);
}

/* ── Header hero area ── */
.hero-header {
    text-align: center;
    padding: 2rem 0 1rem;
}
.hero-header h1 {
    font-family: 'Sora', sans-serif;
    font-size: 2.4rem;
    font-weight: 700;
    background: linear-gradient(135deg, #0db7ed, #00d4ff, #ffffff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.25rem;
}
.hero-header p {
    color: var(--text-muted);
    font-size: 1rem;
    margin: 0;
}

/* ── Spinner color ── */
.stSpinner > div {
    border-top-color: var(--docker-blue) !important;
}

/* ── Toast / status badge ── */
.status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}
</style>
""", unsafe_allow_html=True)


# ─── Session State Defaults ───────────────────────────────────────────────────
if "nl_query" not in st.session_state:
    st.session_state["nl_query"] = ""
if "query_history" not in st.session_state:
    st.session_state["query_history"] = []

# Mutable list used as a pointer to pass API key into render_sidebar
api_key_holder = [""]


# ─── Sidebar ─────────────────────────────────────────────────────────────────
render_sidebar(api_key_holder)


# ─── Hero Header ─────────────────────────────────────────────────────────────
st.markdown("""
<div class="hero-header">
    <h1>🐳 Docker NL Health Dashboard</h1>
    <p>Ask Docker questions in plain English — no commands required</p>
</div>
""", unsafe_allow_html=True)

st.divider()


# ─── Docker Connectivity Check ────────────────────────────────────────────────
if not is_docker_running():
    render_docker_offline_warning()
    st.stop()


# ─── Top-level Stats (always visible) ────────────────────────────────────────
stats = get_docker_stats()
render_stats_cards(stats)
st.divider()


# ─── Natural Language Query Box ───────────────────────────────────────────────
st.markdown("### 💬 Ask a Docker Question")

col_input, col_btn = st.columns([5, 1])

with col_input:
    user_query = st.text_input(
        label="query",
        label_visibility="collapsed",
        value=st.session_state.get("nl_query", ""),
        placeholder="e.g. Show all running containers  |  Show logs of nginx  |  Which containers crashed?",
        key="query_input",
    )

with col_btn:
    submit = st.button("🔍 Ask", type="primary", use_container_width=True)


# ─── Example Queries Expander ─────────────────────────────────────────────────
with st.expander("💡 Example queries you can try"):
    examples = [
        "Show all running containers",
        "Show containers that are restarting",
        "Which containers crashed in the last hour?",
        "Show stopped containers",
        "How many containers are active?",
        "Show logs of nginx container",
        "Show unhealthy containers",
        "List all containers",
        "How many total containers do I have?",
        "Find containers named web",
    ]
    cols = st.columns(2)
    for i, ex in enumerate(examples):
        with cols[i % 2]:
            if st.button(f"→ {ex}", key=f"ex_{i}", use_container_width=True):
                st.session_state["nl_query"] = ex
                st.rerun()


# ─── Process Query ────────────────────────────────────────────────────────────
active_query = user_query.strip() or st.session_state.get("nl_query", "").strip()

if submit and active_query:
    st.session_state["nl_query"] = active_query

if active_query:
    st.divider()

    # Save to history
    if active_query not in st.session_state["query_history"]:
        st.session_state["query_history"].insert(0, active_query)
        st.session_state["query_history"] = st.session_state["query_history"][:10]

    # ── Parse the query ───────────────────────────────────────────────────────
    with st.spinner("🤖 Parsing your query..."):
        api_key = api_key_holder[0] or os.getenv("ANTHROPIC_API_KEY", "")
        parsed = parse_query(active_query, api_key=api_key if api_key else None)
        action_description = describe_action(parsed)

    # ── Show parsed intent ────────────────────────────────────────────────────
    col_desc, col_json = st.columns([3, 2])
    with col_desc:
        st.markdown(f"**🎯 Detected intent:** {action_description}")
    with col_json:
        with st.expander("🔬 View parsed JSON"):
            st.json(parsed)

    st.markdown("---")

    # ── Execute action ────────────────────────────────────────────────────────
    action = parsed.get("action", "unknown")
    containers = []
    start_time = time.time()

    with st.spinner("🐳 Querying Docker Engine..."):
        if action == "health_overview":
            render_health_overview()
            elapsed = time.time() - start_time
            st.caption(f"⏱️ Completed in {elapsed:.2f}s")
            st.stop()

        elif action == "list_containers":
            status = parsed.get("status", "all")
            if status == "unhealthy":
                all_c = get_all_containers()
                containers = [c for c in all_c if c["health"] == "unhealthy"]
            else:
                containers = get_all_containers(
                    status_filter=None if status == "all" else status
                )

        elif action == "crashed_containers":
            hours = parsed.get("hours", 1)
            containers = get_crashed_containers(hours=hours)

        elif action == "count_containers":
            status = parsed.get("status", "all")
            if status == "all":
                containers = get_all_containers()
            else:
                containers = get_all_containers(
                    status_filter=None if status == "all" else status
                )

        elif action == "show_logs":
            container_name = parsed.get("container", "")
            tail = parsed.get("tail", 50)
            if not container_name:
                st.error("❌ Could not determine container name. Try: 'Show logs of **nginx**'")
            else:
                render_logs(container_name, tail=tail)
            elapsed = time.time() - start_time
            st.caption(f"⏱️ Completed in {elapsed:.2f}s")
            st.stop()

        elif action == "search_containers":
            query_term = parsed.get("query", "").lower()
            all_c = get_all_containers()
            containers = [
                c for c in all_c
                if query_term in c["name"].lower() or query_term in c["image"].lower()
            ]

        else:
            # Unknown action — show all containers as fallback
            st.warning(
                "⚠️ Query not fully understood. Showing all containers. "
                "Try rephrasing or use the Quick Actions in the sidebar."
            )
            containers = get_all_containers()

    # ── AI Summary ────────────────────────────────────────────────────────────
    summary = generate_summary(containers, parsed)
    st.markdown(f'<div class="summary-box">🤖 <b>AI Summary:</b> {summary}</div>',
                unsafe_allow_html=True)

    # ── Results Table ─────────────────────────────────────────────────────────
    status_label = parsed.get("status", "").capitalize() or "Query"
    render_container_table(containers, f"{status_label} Containers")

    elapsed = time.time() - start_time
    st.caption(f"⏱️ Completed in {elapsed:.2f}s · {datetime.now().strftime('%H:%M:%S')}")

    # ── Export as CSV ─────────────────────────────────────────────────────────
    if containers:
        import pandas as pd
        df_export = pd.DataFrame(containers)
        csv_data = df_export.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Export Results as CSV",
            data=csv_data,
            file_name=f"docker_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
        )

else:
    # ── Default View: Health Overview ─────────────────────────────────────────
    st.markdown("### 🩺 Docker Health Overview")
    st.caption("Type a question above or click a Quick Action in the sidebar to get started.")
    render_health_overview()


# ─── Query History (sidebar bottom) ──────────────────────────────────────────
if st.session_state["query_history"]:
    with st.sidebar:
        st.divider()
        st.markdown("## 🕐 Recent Queries")
        for q in st.session_state["query_history"][:5]:
            if st.button(f"↩ {q[:35]}{'…' if len(q) > 35 else ''}", key=f"hist_{q}",
                         use_container_width=True):
                st.session_state["nl_query"] = q
                st.rerun()