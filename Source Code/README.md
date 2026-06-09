# Source Code

This directory contains the updated Docker NL Health Dashboard application.

## Stack

- React 19 + Vite
- Express + TypeScript
- Docker integration through `dockerode`
- Gemini and Ollama provider support

## Local development

```bash
npm install
npm run dev
```

The app serves on `http://localhost:3000`.

## Useful scripts

- `npm run dev` — start the development server
- `npm run lint` — run the TypeScript type check
- `npm run build` — build the frontend and bundled server output
- `npm start` — start the production server from `dist/server.js`

## Environment

Copy `.env.example` to `.env.local` or `.env` and configure the values you need:

- `GEMINI_API_KEY`
- `OLLAMA_URL`
- `OLLAMA_MODEL`

Use simulation mode if a live Docker Engine is not available.

