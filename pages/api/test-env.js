export default function handler(req, res) {
  res.status(200).json({ 
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set ✓' : 'Missing ✗',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set ✓' : 'Missing ✗',
    skipAuth: process.env.NEXT_PUBLIC_SKIP_AUTH
  });
} 