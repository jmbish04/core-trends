# The Monolith Repository Intelligence Engine

A production-ready, AI-powered repository intelligence system built on **Cloudflare Workers**, **Agents SDK**, and modern edge infrastructure. This application automatically discovers, tracks, and evaluates GitHub repositories using autonomous AI agents with dual-layer persistence.

## 🏗️ Architecture Overview

### Core Stack (2026-Native)

- **Compute & Routing**: Cloudflare Workers + Hono framework
- **Frontend**: Astro (SSR/Server Mode) + React Islands + Shadcn UI
- **AI Layer**: Cloudflare Agents SDK (`@cloudflare/ai-chat`) + Workers AI
- **Data Persistence**:
  - **Hot State**: Durable Object SQLite (sub-millisecond agent state)
  - **Cold State**: D1 Database via Drizzle ORM (dashboard queries)
- **Assets**: Unified Workers Static Assets (single Worker isolate)

### Key Features

✅ **Dual-Layer Persistence Architecture**
- Agent conversations stored in Durable Object SQLite for instant access
- Non-blocking synchronization to D1 using `ctx.waitUntil()` for analytics

✅ **Autonomous AI Agents**
- Repository evaluation agents using `AIChatAgent` class
- Persistent state and conversation history per repository
- WebSocket support for real-time interactions

✅ **GitHub Integration**
- Webhook listener for real-time star events
- Automated daily trending repository ingestion
- GitHub Actions workflow for scheduled data collection

✅ **Modern Edge Architecture**
- Single Worker deployment combining frontend + backend + agents
- Global distribution via Cloudflare's network
- Zero cold starts with hibernating Durable Objects

## 📁 Project Structure

```
core-trends/
├── src/
│   ├── _worker.ts                    # Main Worker entry point
│   ├── frontend/                     # Astro frontend (SSR)
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── backend/
│       ├── agents/
│       │   └── RepositoryIntelligenceAgent.ts  # AI evaluation agent
│       ├── api/
│       │   ├── index.ts              # Hono API router
│       │   └── routes/
│       │       ├── webhooks.ts       # GitHub webhook handler
│       │       ├── repositories.ts   # Repository CRUD + evaluation triggers
│       │       ├── dashboard.ts      # Analytics endpoints
│       │       └── ...
│       └── db/
│           └── schema.ts             # Drizzle ORM schema
├── wrangler.jsonc                    # Cloudflare Workers configuration
├── astro.config.ts                   # Astro SSR configuration
└── .github/workflows/
    └── repository-intelligence-pipeline.yml  # Daily ingestion workflow
```

## 🗄️ Database Schema

### D1 Tables (Relational Layer)

**repositories** - Tracked GitHub repositories
- `githubId`, `name`, `owner`, `fullName`, `description`
- `url`, `language`, `stars`
- `trendPeriod`, `isNewTrending`, `isStarredByUser`
- `discoveredMethod` (pipeline_trending | agent_search | webhook_signal)

**evaluations** - AI-generated repository assessments
- `repositoryId`, `score` (1-10), `rationale`
- `compatibilityFlags`, `isAbandonedProject`
- `surveyResponse` (user feedback)

**goals** - User-defined discovery criteria
- `userId`, `title`, `description`
- `targetKeywords`, `targetLanguages`

**projects** - Generated from repositories
- `userId`, `name`, `description`
- `generatedRepoUrl`, `contextData`, `status`

**systemLogs** - Monitoring and telemetry
- `level`, `subsystem`, `message`, `metadata`

### Durable Object Storage (Agent State)

Each `RepositoryIntelligenceAgent` instance maintains:
- Conversation history (messages table)
- Agent state (totalEvaluations, sessionStartTime)
- Per-repository context and memory

## 🚀 API Endpoints

### Repository Management
- `GET /api/repositories` - List all tracked repositories
- `GET /api/repositories/:id` - Get repository with evaluations
- `POST /api/repositories` - Add new repository
- `POST /api/repositories/:id/evaluate` - Trigger AI evaluation
- `POST /api/repositories/:id/survey` - Submit user feedback

### Webhooks
- `POST /api/webhooks/github` - GitHub star event handler

### Dashboard
- `GET /api/dashboard/summary` - Repository intelligence overview
- `GET /api/dashboard/metrics` - Time-series metrics
- `GET /api/dashboard/charts/:category` - Chart data

### Agents (WebSocket)
- `/agents/repository-intelligence-agent/:repo-id` - Agent WebSocket endpoint

### Documentation
- `GET /openapi.json` - OpenAPI specification
- `GET /swagger` - Swagger UI
- `GET /scalar` - Scalar API documentation
- `GET /health` - Health check endpoint

## 🔧 Configuration

### wrangler.jsonc

```jsonc
{
  "name": "monolith-repo-engine",
  "main": "dist/_worker.js/index.js",
  "compatibility_date": "2026-05-24",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets configuration
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "run_worker_first": true
  },

  // AI binding
  "ai": {
    "binding": "AI"
  },

  // Durable Objects for agents
  "durable_objects": {
    "bindings": [
      {
        "name": "REPO_INTEL_AGENT",
        "class_name": "RepositoryIntelligenceAgent"
      }
    ]
  },

  // SQLite storage migration
  "migrations": [
    {
      "tag": "v1_repo_intel_agent",
      "new_sqlite_classes": ["RepositoryIntelligenceAgent"]
    }
  ],

  // D1 database binding
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "monolith_repo_intel",
      "migrations_dir": "drizzle"
    }
  ]
}
```

## 🛠️ Development Setup

### Prerequisites
- Node.js v20+
- pnpm (or npm)
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Clone repository
git clone https://github.com/jmbish04/core-trends.git
cd core-trends

# Install dependencies
npm install

# Configure Cloudflare credentials
npx wrangler login

# Create D1 database
npx wrangler d1 create monolith_repo_intel

# Update wrangler.jsonc with database_id

# Generate and apply migrations
npm run db:generate
npm run migrate:local

# Start development server
npm run dev
```

### Local Development

```bash
# Start Astro dev server (frontend)
npm run dev

# Preview with Wrangler (full stack)
npm run preview

# Build for production
npm run build
```

## 📦 Deployment

### Automated Deployment

GitHub Actions automatically deploys on push to main:
- Generates database migrations
- Applies migrations to remote D1
- Builds Astro frontend
- Deploys to Cloudflare Workers

### Manual Deployment

```bash
# Build and deploy
npm run deploy
```

## 🤖 Agent Architecture

### RepositoryIntelligenceAgent

Extends `AIChatAgent` from `@cloudflare/ai-chat`:

**Features:**
- Persistent conversation history in Durable Object SQLite
- Automatic state synchronization via WebSocket
- Non-blocking D1 mirroring with `ctx.waitUntil()`
- RPC methods for programmatic evaluation

**Usage:**

```typescript
import { getAgentByName } from 'agents';

// Get agent instance for specific repository
const agent = await getAgentByName<RepositoryIntelligenceAgent>(
  env.REPO_INTEL_AGENT,
  `repo-${githubId}`
);

// Trigger evaluation via RPC
await agent.evaluateRepository({
  name: 'repository-name',
  owner: 'owner',
  language: 'TypeScript',
  stars: 1000,
  url: 'https://github.com/...'
});
```

**WebSocket Connection:**

```typescript
import { useAgentChat } from '@cloudflare/ai-chat/react';

const { messages, sendMessage } = useAgentChat({
  agent: 'repository-intelligence-agent',
  name: 'repo-123456'
});
```

## 🔄 Data Flow

### Trending Repository Pipeline

1. **GitHub Actions Workflow** (Daily at midnight UTC)
   - Fetches trending repositories via GitHub API
   - Posts to `/api/repositories` endpoint
   - Triggers database migrations
   - Deploys updated Worker

2. **Webhook Processing** (Real-time)
   - Receives GitHub star events
   - Updates repository records in D1
   - Logs to systemLogs table

3. **Agent Evaluation** (On-demand)
   - User triggers via API: `POST /api/repositories/:id/evaluate`
   - Creates/retrieves Durable Object agent instance
   - Agent generates evaluation using Workers AI
   - Results stored in agent's SQLite (hot)
   - Mirrored to D1 asynchronously (cold)

4. **Dashboard Queries** (Read-optimized)
   - Frontend queries `/api/dashboard/summary`
   - Aggregates data from D1 tables
   - Returns statistics, top repos, language distribution

## 🎨 Frontend Integration

Built with Astro (SSR mode) + React islands for optimal performance:

```typescript
// src/frontend/pages/dashboard.astro
---
const response = await fetch('/api/dashboard/summary');
const data = await response.json();
---

<DashboardLayout>
  <RepositoryStats stats={data.statistics} />
  <TopRepositories repos={data.topRepositories} client:load />
  <LanguageChart data={data.languageDistribution} client:idle />
</DashboardLayout>
```

## 🔐 Security & Best Practices

- **No Vercel AI SDK**: Uses native `@cloudflare/ai-chat` to avoid dependency conflicts
- **Type-safe migrations**: Drizzle ORM with `$defaultFn()` for timestamps
- **Non-blocking persistence**: `ctx.waitUntil()` for D1 synchronization
- **GitHub token security**: Uses `GH_TOKEN` (not `GITHUB_TOKEN`) per Cloudflare guidelines
- **Agent isolation**: Each repository gets dedicated Durable Object instance

## 📊 Monitoring & Observability

- **System Logs**: All operations logged to D1 `system_logs` table
- **Agent Telemetry**: Evaluation metrics tracked in agent state
- **Cloudflare Dashboard**: Request analytics, error rates, performance metrics
- **Health Endpoint**: `/api/health` for uptime monitoring

## 🚧 Roadmap

- [ ] Multi-provider AI fallbacks via AI Gateway
- [ ] Advanced repository scoring algorithms
- [ ] User authentication and personalized goals
- [ ] Real-time WebSocket dashboard updates
- [ ] Export evaluation reports to PDF/Markdown
- [ ] Integration with more Git platforms (GitLab, Bitbucket)

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is a demonstration project showcasing modern Cloudflare Workers architecture with Agents SDK. Contributions welcome!

---

**Built with ❤️ using Cloudflare's 2026-native edge infrastructure**
