# NPS Analytics Dashboard

A comprehensive NPS (Net Promoter Score) analytics dashboard with AI-powered sentiment analysis.

## Features

- 📊 **Comprehensive Analytics**: Complete NPS scoring, trends, and insights
- 🤖 **AI-Powered Analysis**: Sentiment analysis using Ollama local LLM
- 🏦 **Banking-Specific**: Tailored for financial services with multilingual support
- 📱 **Responsive Design**: Beautiful UI built with React and Tailwind CSS
- 💾 **Local Data Storage**: SQLite database for data persistence
- 🔧 **Modern Stack**: TypeScript, React, Node.js, and Vite

## Project Structure

```
DataVisualizer/
├── packages/
│   ├── client/          # React frontend dashboard
│   ├── server/          # Express.js backend API
│   └── shared/          # Shared types and utilities
├── data/                # SQLite database files
├── misc/                # Documentation, backups, and old files
├── package.json         # Workspace configuration
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development (both client and server):**
   ```bash
   npm run dev
   ```

3. **Or start individually:**
   ```bash
   # Beautiful dashboard only
   npm run dev:client
   
   # Server only  
   npm run dev:server
   
   # Old workspace version (basic)
   npm run dev:workspace
   ```

## Production

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Preview production build:**
   ```bash
   npm run preview
   ```

3. **Start production server:**
   ```bash
   npm start
   ```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/nps-responses` - Get all NPS responses
- `GET /api/nps-stats` - Get NPS statistics
- `POST /api/nps-responses` - Create new NPS response

## Environment Setup

The application uses Ollama for local AI processing. Make sure you have:
- Node.js 18+
- Ollama installed with qwen2.5:3b model

## Development

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript + SQLite
- **AI**: Ollama with qwen2.5:3b model for sentiment analysis
- **Build Tool**: Vite for fast development and building

## Database

The application uses SQLite for data persistence. The database file is located at `data/nps_data.db`.
