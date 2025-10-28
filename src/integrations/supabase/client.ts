import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vvtslbyqzqxdlmtavpgp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dHNsYnlxenF4ZGxtdGF2cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MDYwODksImV4cCI6MjA1MDk4MjA4OX0.WdnkfCULCyOjwdZQsA1dL9U1xm0VQAuMRj1SYPpMa7s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
