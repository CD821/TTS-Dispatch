# TTS Dispatch

A multi-user dispatch dashboard for installs and services. This repository is prepared for:

- **GitHub** — source control and collaboration
- **Vercel** — Next.js hosting and deployments
- **Clerk** — sign-in, user accounts, and team access
- **Neon** — shared Postgres storage for added and edited jobs

The original 6,042 workbook records are included in `app/data/jobs.json`. New jobs and edits are stored in Neon and automatically override the matching imported record for every signed-in member.

## Deploy from GitHub

1. Create a new empty GitHub repository.
2. Upload everything in this project folder to the repository root and commit it.
3. In Vercel, choose **Add New → Project** and import the GitHub repository.
4. Before the first production deployment, add both integrations from the Vercel Marketplace:
   - **Clerk** for authentication
   - **Neon** for Postgres
5. Confirm these environment variables exist for Production, Preview, and Development:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
6. Deploy or redeploy the project.
7. Open the deployment and create the first Clerk account. Afterward, configure Clerk invitations or sign-up restrictions for your approved team members.

The application creates the Neon `jobs` table and indexes automatically on the first authenticated API request. The same schema is also available at `db/schema.sql` for review or manual use in the Neon SQL Editor.

## Local development

Use Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with Clerk development keys and a Neon connection string. Never commit `.env.local`.

To initialize Neon explicitly instead of waiting for the first API request:

```bash
npm run db:setup
```

## Useful commands

```bash
npm run dev       # local development
npm run build     # production build check
npm run lint      # code quality check
npm run db:setup  # create the Neon table and indexes
```

## Access and data behavior

- Clerk protects the dashboard and every `/api` route.
- The API verifies the current Clerk user again before reading or changing data.
- Neon stores the Clerk user ID that created or last updated each shared record.
- Excel exports use the current date range, search, work type, full-house/partial, and installer filters.
- Custom date ranges stay selected while working and reset only on reload or when **This week** is clicked.
- Installer, project manager, builder, and subdivision fields share reusable dropdown choices, including an **Add new** option.
- No Clerk or Neon secrets are included in this repository.
