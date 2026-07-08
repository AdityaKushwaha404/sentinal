# 🛡️ Sentinel — Real-Time Infrastructure Monitoring Engine

Sentinel is a production-grade, commercial-ready SaaS infrastructure monitoring platform. Built using **Next.js**, **Prisma ORM**, **Tailwind CSS**, and **React Query**, it allows engineering teams to observe, analyze, and alerts on network components globally with sub-second precision.

---

## 🚀 Key Features

*   **Multi-Monitor Support**: Check target endpoints using **HTTP**, **HTTPS**, **TCP Port**, **SSL Certificates**, **JSON APIs**, and simulated **PING** fallbacks.
*   **Operations Center**: An interactive real-time dashboard displaying average response latency, operational uptime ratios, active alerts, and status lists.
*   **Instant UI Interactions**: Responsive toggle actions and alert deletions with optimistic updates.
*   **Fully Mobile Responsive**: Adapts seamlessly to all mobile screens with a micro-animated hamburger drawer menu.
*   **Alert History & Incidents**: Automatically creates, monitors, and closes downtime incidents.

---

## 🛠️ Tech Stack & Architecture

```mermaid
graph TD
  A[Client UI - Next.js/React] -->|React Query Polling| B[Serverless Route Handlers]
  B -->|Prisma Client| C[Neon PostgreSQL Database]
  D[Cron Trigger - Cron/Monitor] -->|SchedulerService| B
  B -->|Prober Engine| E[Target Server / API / TCP Port]
```

*   **Framework**: Next.js 16 (Dynamic Serverless Rendering)
*   **Database**: PostgreSQL hosted on Neon DB, managed via Prisma ORM.
*   **State Management**: React Query (configured with 10s automatic polling and optimistic UI cache invalidations).
*   **Security & Authentication**: Clerk Auth integration.

---

## 🔧 Setup & Local Development

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/AdityaKushwaha404/sentinal.git
cd sentinel
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Database Connections
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

### 3. Run Database Migrations
Generate the client and push the schema changes to your database:
```bash
npx prisma generate
npx prisma db push
```

### 4. Boot Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application dashboard.

---

## ☁️ Vercel Deployment Guide

To deploy Sentinel onto Vercel, follow these steps:

### Step 1: Connect GitHub
1. Push all your updates to your GitHub repository:
   ```bash
   git add .
   git commit -m "prep: configure project for Vercel deployment and build scripts"
   git push origin main
   ```
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your `sentinal` repository.

### Step 2: Configure Vercel Settings
*   **Framework Preset**: Select `Next.js`.
*   **Build & Development Settings**: Keep defaults. The `postinstall` script (`prisma generate`) will run automatically to compile the Prisma client types.
*   **Environment Variables**: Paste all variables from your `.env.local`:
    *   `DATABASE_URL`
    *   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
    *   `CLERK_SECRET_KEY`
    *   `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
    *   `NEXT_PUBLIC_CLERK_SIGN_UP_URL`

### Step 3: Trigger Deploy
Click **Deploy**. Once complete, Vercel will provide you with a production-ready preview URL.

### Step 4: Configure Cron Jobs (Optional)
To trigger automated uptime checks every minute on Vercel:
1. Create a `vercel.json` file in the root:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/monitor",
         "schedule": "* * * * *"
       }
     ]
   }
   ```
2. Redeploy the project on Vercel to activate the cron triggers.
