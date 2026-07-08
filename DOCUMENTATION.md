# 🛡️ Sentinel — Comprehensive System Documentation

Welcome to the documentation for **Sentinel**, a production-grade, commercial-ready Software-as-a-Service (SaaS) Infrastructure and Uptime Monitoring platform. Sentinel empowers developers, DevOps engineers, and system administrators to observe, analyze, and automate alert dispatching for global network resources with sub-second precision.

---

## 📖 1. Non-Technical / Product Overview

### What is Sentinel?
Sentinel is an all-in-one system health monitoring platform. In today’s digital economy, website downtime and SSL certificate expirations directly translate to lost revenue, degraded SEO ranking, and damaged customer trust. Sentinel continuously surveys your endpoints and automatically alerts you the moment issues occur.

### Core Value Proposition
- **High Availability Assurance**: Know immediately if your service goes down or experiences slow response latency.
- **Proactive SSL Management**: Prevent costly downtime caused by expired SSL/TLS certificates.
- **AI-Powered Diagnostics**: Instead of reading raw logs, get an AI-generated natural language summary explaining *what* went wrong and *how* to fix it.
- **Low Overhead Operations**: Completely serverless backend architecture that scales instantly without server maintenance overhead.

### Targeted User Personas
1. **Developers**: Quickly add API checks, review response times, and chat with the AI assistant to troubleshoot errors.
2. **System Admins & DevOps**: Monitor SSL expiry dates, configure multi-protocol network probes, and review analytical trends.
3. **Product Owners / Stakeholders**: Receive beautiful, concise weekly email digests summarizing system uptime and incident resolution stats.

---

## 🚀 2. Comprehensive Feature Set

### 🖥️ A. Interactive Operations Center (Dashboard)
- **Aggregated Analytics Cards**:
  - **Total Targets**: Real-time count of registered network monitors.
  - **Active Uptime Ratio**: Overall uptime percentage of all targets compiled over the past 7 days.
  - **Average Latency**: Fleet-wide average response latency in milliseconds.
  - **Open Alerts**: Instant count of active incidents currently requiring attention.
- **Dynamic Charting**: Historical charts powered by **Recharts** displaying latency spikes, uptime curves, and request status distributions.
- **Optimistic UI Controls**: Instantly pause, resume, or delete monitors with modern micro-animations.

### 🌐 B. Multi-Monitor Target Engine
Sentinel supports 5 distinct probe options:
1. **HTTP**: Validates endpoint accessibility and monitors HTTP status codes.
2. **HTTPS**: Performs secured handshakes and captures endpoint response metrics.
3. **TCP Port**: Asserts connection availability on custom ports (e.g., databases, SSH, SMTP).
4. **SSL Certificate**: Automatically queries and parses SSL/TLS certificates, extracting expiry thresholds, issuers, and security state.
5. **JSON API**: Performs validation of raw API responses against expected JSON schemas or payload fields.

### 📢 C. Incident & Alert Management
- **Automatic Incident Creation**: Whenever a monitor check fails, Sentinel logs a new database Incident with a `DOWNTIME` label and marks the status as `OPEN`.
- **Downtime Calculations**: Calculates the precise duration of downtime from the initial failure to recovery.
- **Automatic Recovery**: Once the scheduler detects a successful probe response, the system updates the Incident status to `RESOLVED` and marks the resolution timestamp.

### ✉️ D. AI-Driven On-Demand & Weekly Reports
- **Resend Integration**: Sends transactional emails for alert notifications (downtime/recovery) and manual summary requests.
- **Gemini Health Analysis**: Uses the `gemini-2.5-flash` model to analyze historical database performance patterns (past 7 days) and write a human-like, professional executive summary outlining performance risks, anomalies, and remediation actions.

### 💬 E. Sentinel AI Assistant
- **Context-Aware Conversational Assistant**: Chat with an AI agent who has read-access to your monitor lists, active incidents, and recent latency profiles.
- **Interactive Troubleshooting**: Ask questions like *"Why is my portfolio website down?"* or *"Summarize the SSL status of my database"* and get direct answers.
- **Smart Chat Sessions**: Automatically generates clean 3-5 word titles based on the user's initial search query.

---

## 🛠️ 3. Technology Stack

Sentinel leverages a modern, robust, and lightning-fast developer toolchain:

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16 (App Router)** | Powers server-side rendering (SSR), dynamic client pages, and serverless API route handlers. |
| **Runtime** | **React 19 & React DOM** | Interactive frontend state engine with React Hooks and context patterns. |
| **Styling** | **Tailwind CSS v4** | Utility-first responsive CSS styling with dark mode tokens and custom animations. |
| **State Management** | **TanStack React Query v5** | Caches API data, manages automatic 10-second polling frequencies, and supports clean UI invalidations. |
| **Database** | **PostgreSQL (Neon DB)** | Fully serverless cloud database with instant scaling and connection pooling. |
| **ORM** | **Prisma ORM v7** | Type-safe schema definitions, automated migrations, and high-performance database client. |
| **Authentication** | **Clerk SDK** | User accounts, signup/login flows, session cookies, and API auth protection. |
| **Email Delivery** | **Resend SDK** | Delivery platform for incident alerts, weekly reports, and on-demand summaries. |
| **AI Processing** | **Google GenAI SDK** | Powers the Gemini 2.5 Flash model for assistant chats and analytical summary compilation. |

---

## 💾 4. Database Schema Structure

Managed via Prisma, the database schema contains the following models:

```mermaid
erDiagram
    User ||--o| UserSettings : "has"
    User ||--o{ Monitor : "owns"
    Monitor ||--o{ MonitorCheck : "generates"
    Monitor ||--o{ Incident : "triggers"
    Monitor ||--o| SSLCertificate : "registers"
    User ||--o{ AssistantSession : "starts"
    AssistantSession ||--o{ AssistantMessage : "contains"

    User {
        String id PK
        String email
        DateTime createdAt
    }
    UserSettings {
        String id PK
        String userId FK
        String timezone
        Boolean emailNotifications
        String theme
    }
    Monitor {
        String id PK
        String userId FK
        String name
        String url
        String type
        String status
        Int monitorInterval
        Boolean isActive
    }
    MonitorCheck {
        String id PK
        String monitorId FK
        Boolean isAvailable
        Int responseTime
        Int statusCode
        DateTime checkedAt
    }
    Incident {
        String id PK
        String monitorId FK
        String title
        String status
        DateTime startedAt
        DateTime resolvedAt
    }
    SSLCertificate {
        String id PK
        String monitorId FK
        DateTime expiryDate
        String issuer
        String status
    }
    AssistantSession {
        String id PK
        String userId FK
        String title
        DateTime updatedAt
    }
    AssistantMessage {
        String id PK
        String sessionId FK
        String role
        String content
        DateTime createdAt
    }
```

---

## 🔌 5. Key System API Endpoints

All endpoints are fully authenticated and secure.

### 🛡️ User & Settings APIs
- `GET /api/user/me`: Retrieves current Clerk user profile information synced with the Prisma database.
- `POST /api/user/settings`: Updates global settings such as Timezone, Theme, or Email notification preferences.
- `POST /api/user/send-summary`: Triggers the on-demand database scan and dispatches the Gemini-infused summary email.

### 🖥️ Monitor Management APIs
- `GET /api/monitors`: Lists all monitors owned by the authenticated user.
- `POST /api/monitors`: Registers a new web or network target.
- `PATCH /api/monitors/[id]`: Modifies properties (e.g. name, URL) or toggles the active state.
- `DELETE /api/monitors/[id]`: Removes a monitor along with its history logs.

### 🤖 AI Assistant APIs
- `GET /api/assistant/sessions`: Lists all previous chat sessions.
- `POST /api/assistant/sessions`: Creates a new conversational chat session.
- `POST /api/assistant/chat`: Streams/sends prompts to the Gemini assistant and returns context-aware replies.

### ⏰ Scheduler & Automation APIs
- `GET/POST /api/cron/monitor`: Secure automated endpoint triggered by Vercel Cron. Performs network handshakes, logs check results, updates statuses, and dispatches Resend alert emails if state changes.

---

## ⚙️ 6. Production Setup & Vercel Variables

To launch Sentinel in production, set up the following environment variables in your Vercel Project settings:

```env
# 1. Database Configuration
DATABASE_URL="postgresql://neondb_owner:...@ep-shiny-wind-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://neondb_owner:...@ep-shiny-wind.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 2. Authentication Configuration (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# 3. Third Party Email Delivery (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM_ADDRESS="alerts@sentinel.yourdomain.com"

# 4. Artificial Intelligence (Google GenAI)
GEMINI_API_KEY="AQ..."
ENABLE_AI="true"
ENABLE_WEEKLY_REPORT="true"
ENABLE_AI_ASSISTANT="true"

# 5. Cron Security & App URLs
CRON_SECRET="generate-a-secure-random-token-here"
NEXT_PUBLIC_APP_URL="https://sentinel.yourdomain.com/"
```
