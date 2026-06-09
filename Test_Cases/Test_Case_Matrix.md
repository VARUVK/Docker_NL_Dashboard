# Test Case Matrix

| ID | Scenario | Expected Result |
|---|---|---|
| TC-01 | Start the app in dev mode | App loads on `http://localhost:3000` without server boot errors |
| TC-02 | Open dashboard in simulation mode | Summary cards, tables, and seeded containers render successfully |
| TC-03 | Ask a natural-language summary question | API returns an agent result with steps and commentary |
| TC-04 | Ask for logs of a known container | Log panel loads and shows lines for the selected container |
| TC-05 | Switch to Gemini with a valid key | Provider status reports Gemini availability |
| TC-06 | Switch to Ollama with a reachable URL | Provider status reports connected and lists models if available |
| TC-07 | Save a live Docker host URL | Backend stores the mode and host settings |
| TC-08 | Query live Docker state with reachable engine | Container, image, and info data load from the live engine |
| TC-09 | Start a stopped container | Control endpoint returns success and UI refreshes state |
| TC-10 | Stop a running container | Control endpoint returns success and UI refreshes state |
| TC-11 | Restart a running container | Control endpoint returns success and UI refreshes state |
| TC-12 | Provider unavailable or Docker unreachable | App shows a bounded error state rather than crashing |
| TC-13 | Run `npm run lint` | TypeScript check completes without errors |
| TC-14 | Run `npm run build` | Frontend and server build artifacts are produced successfully |
