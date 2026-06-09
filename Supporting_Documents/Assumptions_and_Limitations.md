# Assumptions and Limitations

A consolidated, evaluator-facing reference. The README carries the summary; this document explains the reasoning behind each point.

## Assumptions

| # | Assumption | Why |
|---|---|---|
| 1 | Docker daemon is reachable locally via `docker.from_env()` | The tool is built for the operator's own machine / Docker Desktop, matching the hackathon brief's local-troubleshooting scenario. |
| 2 | "Crashed" = `exited` state with `FinishedAt` inside the look-back window | Docker has no single "crashed" status; recent exit is the closest faithful signal. Exit code is shown so the user can judge whether it was an error. |
| 3 | "Stopped" → `exited`; "active" → `running` | These are the natural-language-to-Docker mappings encoded in both parser paths to avoid ambiguity. |
| 4 | The AI parser is optional | Requiring an API key would make the tool unusable offline; the keyword parser guarantees baseline function. |
| 5 | Docker timestamps are UTC | The SDK returns RFC3339 UTC timestamps; uptime and crash windows are computed accordingly. |
| 6 | The app is read-only | Non-technical users are the audience; observation-only removes the risk of accidental container disruption. |

## Limitations

| # | Limitation | Impact | Mitigation / future work |
|---|---|---|---|
| 1 | Local daemon only | No remote hosts, Swarm, or Kubernetes | Docker contexts / multi-host support is a planned enhancement |
| 2 | Read-only | Cannot restart a crash-looping container from the UI | Guarded lifecycle actions are a planned enhancement |
| 3 | Keyword fallback is bounded | Free-form phrasing may fall through to `unknown` without an API key | Supply an Anthropic API key for full natural-language coverage |
| 4 | Crash detection needs retained containers | Containers run with `--rm` leave no record | Out of scope; documented behaviour |
| 5 | Bounded log tail (default 50) | Not a log-aggregation platform | Tail count is adjustable per query |
| 6 | No persistence | No historical health trends | Time-series storage is a planned enhancement |

## Known graceful-degradation behaviours

- **Docker offline** → a remediation panel is shown and the app halts cleanly rather than throwing.
- **Malformed AI response** → fence-stripping + try/except, then automatic fallback to the keyword parser.
- **Container without a healthcheck** → health reported as `N/A` instead of erroring.
- **Unrecognised query** → `unknown` action, a warning, and a safe default of showing all containers.
