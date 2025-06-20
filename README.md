# CoachingAI

CoachingAI is a Next.js application that integrates with Supabase and n8n. The project uses Netlify for deployment.

## Environment Variables

Create a `.env.local` file in the project root and define the following variables:

- `NEXT_PUBLIC_SUPABASE_URL` – URL of your Supabase instance
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anonymous API key from Supabase
- `NEXT_PUBLIC_SKIP_AUTH` – set to `true` to bypass authentication when developing
- `N8N_WEBHOOK_URL` – serverless functions send data to this n8n webhook
- `NEXT_PUBLIC_N8N_WEBHOOK_URL` – client side webhook for the hybrid offer tool
- `NEXT_PUBLIC_N8N_WORKSHOP_WEBHOOK_URL` – webhook used by the workshop generator

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/abc123
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8n.example.com/webhook/hybrid
NEXT_PUBLIC_N8N_WORKSHOP_WEBHOOK_URL=https://n8n.example.com/webhook/workshop
NEXT_PUBLIC_SKIP_AUTH=true
```

## Running Locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Deployment

The repository includes a `netlify.toml` configuration for Netlify.

1. Push the project to your Git provider.
2. Create a new site on Netlify and link it to the repository.
3. Add the environment variables listed above in the Netlify dashboard.
4. Netlify will execute `npm run build` and publish the `.next` directory.

## Tests

A few scripts help verify your setup:

- `node check-env.js` – prints the current Supabase environment variables.
- `node test-supabase.js` – attempts a simple database write using your Supabase credentials.
- With the dev server running you can test the n8n integration:
  ```bash
  curl -X POST http://localhost:3000/api/test-n8n
  ```


## User Profiles and Settings

The application stores additional details about each account. These fields are:

- **Business Name**
- **Business Type**
- **Target Audience**
- **Business Description**
- **Goals**
- **Challenges**

You will be prompted to provide this information on your first login. The same form can be revisited at any time from the **Settings** page to update your profile.

## Supabase Development Workflow

### Quick Start
```bash
# Sync with cloud and start local development
npm run db:sync
npm run dev
```

### Daily Workflow
```bash
# Morning: Get latest schema from cloud
npm run db:pull

# Development: Make changes locally
npm run db:migration "your_change_description"
# Edit the migration file in supabase/migrations/

# Test your changes
npm run db:reset

# Evening: Push changes to cloud
npm run db:push
```

### Common Commands
```bash
npm run db:status     # Check what's running
npm run db:start      # Start local Supabase
npm run db:stop       # Stop local Supabase
npm run db:reset      # Reset local DB with migrations
npm run db:types      # Generate TypeScript types
```

### Troubleshooting
- **Constraint violations**: Run `npm run db:pull` to sync latest schema
- **Migration conflicts**: Reset with `npm run db:reset`
- **Type errors**: Update types with `npm run db:types`

## Memory System

CoachingAI stores chat history in Supabase and periodically condenses older
messages. Summaries are persisted in an OpenAI vector store so the assistant can
reference past conversations without loading the full thread.

### Additional Environment Variables

Add the following variables to enable the memory features:

- `OPENAI_API_KEY` – API key used when summarizing and embedding messages
- `OPENAI_VECTOR_STORE_ID` – ID of your OpenAI vector store
- `OPENAI_MODEL` – OpenAI model to use for chat completions (default: `gpt-4o-mini`)
- `ALLOW_ANONYMOUS_CHATS` – set to `true` to allow chats without login (use
  `false` in production)

## AI Features

### Proactive Tool Suggestions

The main "DarkJK" coaching chat now includes intelligent tool suggestion capabilities. When you ask questions or describe tasks, the AI analyzes your request and can proactively suggest using specialized tools when relevant:

- **Hybrid Offer Creator** - Suggested when discussing offers, pricing, or packaging services
- **Workshop Generator** - Suggested when talking about workshops, training, or educational content
- **HighLevel Landing Page Generator** - Suggested when discussing landing pages or sales funnels

The AI provides contextual suggestions without interrupting your flow, mentioning tools only when they would genuinely help with your current task.

### Stateful Conversational Engine

The Workshop Generator and Hybrid Offer Creator use an advanced conversational system that:

- **Maintains Context** - Remembers all your answers within a session
- **Asks Clarifying Questions** - Can request more details when needed
- **Builds Progressively** - Each answer builds upon previous responses
- **Handles Natural Language** - Understands conversational responses, not just structured data

This creates a more natural, interview-style experience where the AI guides you through creating comprehensive documents step by step.

## Available Tools

### Workshop Generator
Creates comprehensive workshop plans by guiding you through:
- Participant outcomes and learning objectives
- Target audience definition
- Problem identification and solutions
- Workshop duration and format
- Topics, activities, and exercises
- Resources and materials

See [WORKSHOP_GENERATOR.md](WORKSHOP_GENERATOR.md) for detailed usage instructions.

### Hybrid Offer Creator
Builds detailed service offers by collecting:
- High-level offer description
- Target audience and their pain points
- Your unique solution approach
- Pricing structure and packages
- Client results and testimonials

See [HYBRID_OFFER_CREATOR.md](HYBRID_OFFER_CREATOR.md) for detailed usage instructions.

### HighLevel Landing Page Generator
Generates ready-to-use landing pages for the HighLevel platform. See [HIGHLEVEL_LANDING_PAGE_GENERATOR.md](HIGHLEVEL_LANDING_PAGE_GENERATOR.md) for detailed usage instructions.

## Database Migrations and Functions

All Supabase migrations live under `supabase/migrations`. Apply them with:

```bash
npx supabase db push
```

After running migrations, deploy the scheduled function that compresses old
memories:

```bash
npx supabase functions deploy compressMemories
```

Once deployed you can schedule it directly through the Supabase dashboard or via
the CLI:

```bash
npx supabase functions schedule compressMemories "0 * * * *"
```

## Privacy and Cost Considerations

Conversation data is stored remotely. Disable `ALLOW_ANONYMOUS_CHATS` and
`NEXT_PUBLIC_SKIP_AUTH` to restrict access in production. Storing long histories
and running the `compressMemories` job will consume Supabase storage and OpenAI
credits, so adjust the schedule according to your budget.

## Troubleshooting

### 504 Gateway Timeout Errors on Vercel

If you're experiencing 504 errors with JamesBot or tools like the Ideal Client Extractor:

1. **Vercel Function Timeout Limits:**
   - Hobby Plan: 10 seconds max
   - Pro Plan: 60 seconds max (configured in `vercel.json`)
   - Enterprise: Up to 900 seconds

2. **Current Configuration:**
   - API routes are configured for 60-second timeout (Pro plan required)
   - AI API calls have 45-second timeout with 5-second buffer
   - Token limits reduced to prevent long generation times

3. **Current Configuration (Hobby Plan + Fluid Compute):**
   - Configured for 60-second timeout limits (Fluid Compute enabled)
   - AI API calls limited to 50 seconds with 5-second buffer
   - Token limits restored to 4000 for comprehensive responses
   - Full AI feature access available with Fluid Compute
   - No need to upgrade to Pro for basic timeout needs

4. **Additional Optimizations:**
   - The Ideal Client Extractor token limit was reduced from 8000 to 4000
   - Retry attempts reduced from 2 to 1 to avoid timeout cascades
   - Better error messages for timeout scenarios

5. **If errors persist:**
   - Check Vercel Function logs for specific timeout details
   - Consider using edge functions for faster response times
   - Break complex queries into smaller parts
