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

