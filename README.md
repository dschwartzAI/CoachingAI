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

## Memory System

CoachingAI stores chat history in Supabase and periodically condenses older
messages. Summaries are persisted in an OpenAI vector store so the assistant can
reference past conversations without loading the full thread.

### Additional Environment Variables

Add the following variables to enable the memory features:

- `OPENAI_API_KEY` – API key used when summarizing and embedding messages
- `OPENAI_VECTOR_STORE_ID` – ID of your OpenAI vector store
- `ALLOW_ANONYMOUS_CHATS` – set to `true` to allow chats without login (use
  `false` in production)

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
