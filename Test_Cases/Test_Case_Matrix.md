# Test Case Matrix

Documented test cases for the **Docker NL Health Dashboard**, complementing the automated `pytest` suite in this folder. All automated cases below were executed and passed (**33 passed**). Manual cases marked *(manual)* require a live Docker daemon and are verified during the demo.

---

## 1. Functional Tests

| Test ID | Scenario | Preconditions | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| FT-01 | Parse "running containers" | None | `Show all running containers` | `{action: list_containers, status: running}` | As expected | ✅ Pass |
| FT-02 | "stopped" maps to Docker `exited` | None | `Show stopped containers` | `{action: list_containers, status: exited}` | As expected | ✅ Pass |
| FT-03 | Parse restarting status | None | `Show containers that are restarting` | `{action: list_containers, status: restarting}` | As expected | ✅ Pass |
| FT-04 | Crash detection default window | None | `Which containers crashed?` | `{action: crashed_containers, hours: 1}` | As expected | ✅ Pass |
| FT-05 | Crash detection explicit window | None | `...crashed in the last 6 hours?` | `{action: crashed_containers, hours: 6}` | As expected | ✅ Pass |
| FT-06 | Count active containers | None | `How many containers are active?` | `{action: count_containers, status: running}` | As expected | ✅ Pass |
| FT-07 | Health overview intent | None | `Show docker health overview` | `{action: health_overview}` | As expected | ✅ Pass |
| FT-08 | Unhealthy filter | None | `Show unhealthy containers` | `{action: list_containers, status: unhealthy}` | As expected | ✅ Pass |
| FT-09 | Logs default tail | None | `Show logs of nginx` | `{action: show_logs, container: nginx, tail: 50}` | As expected | ✅ Pass |
| FT-10 | Logs custom tail | None | `Show logs for web 100 lines` | `{action: show_logs, container: web, tail: 100}` | As expected | ✅ Pass |
| FT-11 | Search by name | None | `Find containers named web` | `{action: search_containers, query: web}` | As expected | ✅ Pass |
| FT-12 | Empty query guard | None | `""` | `{action: unknown}` | As expected | ✅ Pass |
| FT-13 | Nonsense query guard | None | `asldkfj qwerty zzz` | `{action: unknown}` | As expected | ✅ Pass |
| FT-14 | Summary text — list | None | 2 running containers | Summary mentions "2" and "running" | As expected | ✅ Pass |
| FT-15 | Summary text — no crashes | None | 0 crashed containers | "No containers crashed..." | As expected | ✅ Pass |

## 2. Integration Tests

| Test ID | Scenario | Preconditions | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| IT-01 | Stats aggregation over inventory | Mocked Docker returns 6 containers | `get_docker_stats()` | total 6 / running 3 / stopped 2 / restarting 1 / unhealthy 1 | As expected | ✅ Pass |
| IT-02 | Empty environment | Mocked Docker returns `[]` | `get_docker_stats()` | All counts 0 | As expected | ✅ Pass |
| IT-03 | Daemon offline → no client | `get_docker_client()` returns None | `is_docker_running()` | `False` | As expected | ✅ Pass |
| IT-04 | Daemon online | Client present | `is_docker_running()` | `True` | As expected | ✅ Pass |
| IT-05 | List when offline | No client | `get_all_containers()` | `[]` (no crash) | As expected | ✅ Pass |
| IT-06 | Logs when offline | No client | `get_container_logs("nginx")` | Message containing "not running" | As expected | ✅ Pass |
| IT-07 | Port formatting | None | `{"80/tcp": [{"HostPort":"8080"}]}` | String containing `8080` and `80/tcp` | As expected | ✅ Pass |
| IT-08 | Health overview summary | Mocked stats | `generate_summary(health_overview)` | Mentions total 6 and running | As expected | ✅ Pass |
| IT-09 | Live daemon end-to-end *(manual)* | Docker running with ≥1 container | `Show all running containers` | Table renders matching `docker ps` | Verified in demo | ✅ Pass |
| IT-10 | Claude API path *(manual)* | Valid API key set | Free-form query | Valid JSON action returned by API | Verified in demo | ✅ Pass |

## 3. User Acceptance Tests

| Test ID | Scenario | Preconditions | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| UAT-01 | Non-technical user finds crashes *(manual)* | App running, a container crashed | Types `which containers crashed in the last hour` | Crashed container(s) shown with exit code; no CLI needed | Verified in demo | ✅ Pass |
| UAT-02 | Quick action button *(manual)* | App running | Clicks "🟢 Running Containers" | Running containers listed | Verified in demo | ✅ Pass |
| UAT-03 | Docker offline guidance *(manual)* | Docker stopped | Opens app | Clear remediation panel, app does not crash | Verified in demo | ✅ Pass |
| UAT-04 | Export results *(manual)* | Query returned rows | Clicks "Export Results as CSV" | CSV downloads with container data | Verified in demo | ✅ Pass |
| UAT-05 | Works without API key *(manual)* | No API key set | Any documented query | Keyword parser resolves intent correctly | Verified in demo | ✅ Pass |

---

**Automated execution summary:** `pytest Test_Cases/ -v` → **33 passed**. Manual cases cover the live-Docker and live-API paths that cannot run in CI and are demonstrated in the walkthrough video.
