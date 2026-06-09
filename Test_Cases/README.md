# Test Approach

This folder documents how the updated Docker NL Health Dashboard should be validated.

The current application is a full-stack TypeScript project and does **not** use the old Python test suite anymore. Validation for this version focuses on:

1. dependency installation
2. static TypeScript checks
3. production build generation
4. manual scenario coverage for the main dashboard flows

## Recommended commands

Run these from `Source Code/`:

```bash
npm install
npm run lint
npm run build
```

## Manual validation areas

- dashboard load in simulation mode
- natural-language query execution
- Gemini/Ollama configuration flow
- Docker live-mode configuration flow
- container start / stop / restart controls
- log panel and detail panels
- health and summary cards

See `Test_Case_Matrix.md` for the full checklist.
