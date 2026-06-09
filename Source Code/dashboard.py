"""
dashboard.py
============
Dashboard Rendering Module
All Streamlit UI rendering functions: metric cards, data tables,
log viewers, health indicators, and summary generators.

Author: Docker NL Health Dashboard
"""

import streamlit as st
import pandas as pd
from typing import Optional
from docker_engine import (
    get_all_containers,
    get_container_logs,
    get_docker_stats,
    get_crashed_containers,
    is_docker_running,
)

# ─── Status Styling Maps ──────────────────────────────────────────────────────
STATUS_EMOJI = {
    "running":    "🟢",
    "exited":     "🔴",
    "restarting": "🟡",
    "paused":     "⏸️",
    "created":    "🔵",
    "dead":       "💀",
    "unhealthy":  "⚠️",
    "crashed":    "💥",
    "N/A":        "⚪",
}

STATUS_COLOR = {
    "running":    "#00d26a",
    "exited":     "#ff4757",
    "restarting": "#ffa502",
    "paused":     "#747d8c",
    "created":    "#1e90ff",
    "dead":       "#ff6b81",
    "unhealthy":  "#ff6348",
    "healthy":    "#00d26a",
}


# ─── Metric Cards ─────────────────────────────────────────────────────────────

def render_stats_cards(stats: dict):
    """Render the top-row metric cards showing container counts."""
    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.metric(
            label="🐳 Total Containers",
            value=stats["total"],
            delta=None,
        )
    with col2:
        st.metric(
            label="🟢 Running",
            value=stats["running"],
        )
    with col3:
        st.metric(
            label="🔴 Stopped",
            value=stats["stopped"],
        )
    with col4:
        st.metric(
            label="🟡 Restarting",
            value=stats["restarting"],
        )
    with col5:
        st.metric(
            label="⚠️ Unhealthy",
            value=stats["unhealthy"],
        )


# ─── Container Table ──────────────────────────────────────────────────────────

def render_container_table(containers: list[dict], title: str = "Containers"):
    """
    Render a styled DataFrame table of containers.

    Args:
        containers: List of container dicts from docker_engine.
        title: Section heading.
    """
    if not containers:
        st.info("📭 No containers found matching your query.")
        return

    st.subheader(f"📋 {title} ({len(containers)} found)")

    # Build DataFrame
    df = pd.DataFrame(containers)

    # Add emoji status column
    df["Status"] = df["status"].apply(
        lambda s: f"{STATUS_EMOJI.get(s, '⚪')} {s.capitalize()}"
    )
    df["Health"] = df["health"].apply(
        lambda h: f"{STATUS_EMOJI.get(h, '⚪')} {h}"
    )

    # Select and rename display columns
    display_cols = {
        "id": "ID",
        "name": "Name",
        "image": "Image",
        "Status": "Status",
        "Health": "Health",
        "uptime": "Uptime",
        "ports": "Ports",
        "restart_count": "Restarts",
    }

    existing = [c for c in display_cols if c in df.columns]
    df_display = df[existing].rename(columns=display_cols)

    # Highlight rows based on status
    def highlight_row(row):
        status = row.get("Status", "")
        if "running" in status.lower():
            return ["background-color: rgba(0, 210, 106, 0.08)"] * len(row)
        elif "exited" in status.lower() or "dead" in status.lower():
            return ["background-color: rgba(255, 71, 87, 0.08)"] * len(row)
        elif "restarting" in status.lower():
            return ["background-color: rgba(255, 165, 2, 0.08)"] * len(row)
        return [""] * len(row)

    styled = df_display.style.apply(highlight_row, axis=1)
    st.dataframe(styled, use_container_width=True, hide_index=True)


# ─── Log Viewer ───────────────────────────────────────────────────────────────

def render_logs(container_name: str, tail: int = 50):
    """
    Render container logs in a styled code block.

    Args:
        container_name: Name or ID of the container.
        tail: Number of log lines to show.
    """
    st.subheader(f"📄 Logs: `{container_name}` (last {tail} lines)")

    with st.spinner(f"Fetching logs for {container_name}..."):
        logs = get_container_logs(container_name, tail=tail)

    if logs.startswith("❌"):
        st.error(logs)
    elif logs.startswith("📭"):
        st.info(logs)
    else:
        st.code(logs, language="bash")

        # Download button for logs
        st.download_button(
            label="⬇️ Download Logs",
            data=logs,
            file_name=f"{container_name}_logs.txt",
            mime="text/plain",
        )


# ─── Health Overview ──────────────────────────────────────────────────────────

def render_health_overview():
    """Render the full health overview with stats and all containers."""
    stats = get_docker_stats()

    # Stats cards
    render_stats_cards(stats)
    st.divider()

    # Status distribution bar
    if stats["total"] > 0:
        st.subheader("📊 Container Status Distribution")

        chart_data = pd.DataFrame({
            "Status": ["Running", "Stopped", "Restarting", "Paused", "Dead"],
            "Count": [
                stats["running"],
                stats["stopped"],
                stats["restarting"],
                stats["paused"],
                stats["dead"],
            ]
        })
        chart_data = chart_data[chart_data["Count"] > 0]
        if not chart_data.empty:
            st.bar_chart(chart_data.set_index("Status"))

    st.divider()

    # All containers table
    all_containers = get_all_containers()
    render_container_table(all_containers, "All Containers")


# ─── AI Summary Generator ────────────────────────────────────────────────────

def generate_summary(containers: list[dict], action: dict) -> str:
    """
    Generate a plain-English summary of the query results.

    Args:
        containers: List of container dicts.
        action: The parsed action dict.

    Returns:
        A human-readable summary string.
    """
    act = action.get("action", "")
    count = len(containers)

    if act == "health_overview":
        stats = get_docker_stats()
        parts = []
        if stats["running"]:
            parts.append(f"**{stats['running']} running**")
        if stats["stopped"]:
            parts.append(f"**{stats['stopped']} stopped**")
        if stats["restarting"]:
            parts.append(f"**{stats['restarting']} restarting**")
        if stats["unhealthy"]:
            parts.append(f"**{stats['unhealthy']} unhealthy** ⚠️")
        summary = f"Docker has **{stats['total']} containers** total: " + ", ".join(parts) + "."
        return summary

    if act == "show_logs":
        return f"📄 Showing logs for container **{action.get('container', '?')}**."

    if act == "crashed_containers":
        hours = action.get("hours", 1)
        if count == 0:
            return f"✅ No containers crashed in the last **{hours} hour(s)**."
        return f"💥 **{count} container(s)** crashed in the last **{hours} hour(s)**."

    if act == "count_containers":
        status = action.get("status", "all")
        return f"📊 There are **{count} {status}** container(s)."

    if act == "search_containers":
        q = action.get("query", "")
        if count == 0:
            return f"🔍 No containers found matching **'{q}'**."
        return f"🔍 Found **{count} container(s)** matching **'{q}'**."

    if act == "list_containers":
        status = action.get("status", "all")
        if count == 0:
            return f"📭 No **{status}** containers found."
        emoji = STATUS_EMOJI.get(status.lower(), "📦")
        return f"{emoji} Found **{count} {status}** container(s)."

    if count == 0:
        return "📭 No results found for your query."
    return f"📦 Found **{count}** container(s)."


# ─── Docker Not Running Warning ───────────────────────────────────────────────

def render_docker_offline_warning():
    """Display a prominent warning when Docker daemon is not accessible."""
    st.error("""
### 🐳 Docker Engine Not Running

**Could not connect to the Docker daemon.**

Please check:
1. **Docker Desktop** is open and running
2. **Docker service** is started (`sudo systemctl start docker`)
3. Your user has permission to access Docker

```bash
# Test Docker connection:
docker ps
```

Once Docker is running, refresh this page.
    """)


# ─── Sidebar ─────────────────────────────────────────────────────────────────

def render_sidebar(api_key_placeholder: list):
    """
    Render the sidebar with quick action buttons and settings.

    Args:
        api_key_placeholder: Mutable list to store API key (Streamlit workaround).
    """
    with st.sidebar:
        st.markdown("## ⚙️ Settings")

        # API Key input
        api_key = st.text_input(
            "🔑 Anthropic API Key",
            type="password",
            placeholder="sk-ant-...",
            help="Optional — enables AI-powered natural language parsing. "
                 "Without it, keyword-based parsing is used.",
        )
        if api_key:
            api_key_placeholder[0] = api_key

        st.divider()

        # Docker Status Indicator
        st.markdown("## 🐳 Docker Status")
        if is_docker_running():
            st.success("✅ Docker is running")
        else:
            st.error("❌ Docker offline")

        st.divider()

        # Quick Action Buttons
        st.markdown("## ⚡ Quick Actions")
        quick_actions = {
            "🟢 Running Containers": "Show all running containers",
            "🔴 Stopped Containers": "Show stopped containers",
            "🟡 Restarting Containers": "Show containers that are restarting",
            "💥 Recent Crashes": "Which containers crashed in the last hour",
            "📊 Health Overview": "Show docker health overview",
            "🐳 All Containers": "List all containers",
        }

        for label, query in quick_actions.items():
            if st.button(label, use_container_width=True):
                st.session_state["nl_query"] = query
                st.rerun()

        st.divider()

        # Auto-refresh toggle
        st.markdown("## 🔄 Auto Refresh")
        auto_refresh = st.toggle("Enable Auto-Refresh", value=False)
        if auto_refresh:
            refresh_interval = st.slider(
                "Refresh every (seconds)", min_value=10, max_value=120, value=30
            )
            st.info(f"⏱️ Refreshing every {refresh_interval}s")
            # Use streamlit-autorefresh if installed, otherwise show info
            try:
                from streamlit_autorefresh import st_autorefresh
                st_autorefresh(interval=refresh_interval * 1000, key="autorefresh")
            except ImportError:
                st.caption("Install `streamlit-autorefresh` for live refresh.")

        st.divider()
        st.caption("Docker NL Health Dashboard v1.0")
        st.caption("Built with 🐳 Docker SDK + 🤖 Claude AI")