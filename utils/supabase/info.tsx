
export const supabaseUrl = "https://qxdgubrnxasnzbsydasf.supabase.co/rest/v1/";
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZGd1YnJueGFzbnpic3lkYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODU4NDUsImV4cCI6MjA5MzU2MTg0NX0.as0rrFGUrm4pqLl4FHJpzBqwTKiCXFiB_pvfLuGzbeI";
export const projectId = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";

export const hasSupabaseConfig = Boolean(supabaseUrl && publicAnonKey);

export function getSupabaseConfigError() {
  if (hasSupabaseConfig) return null;
  return "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.";
}
