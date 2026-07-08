import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// We create a singleton client for the browser to use Realtime channels
export const supabase = createClient(supabaseUrl, supabaseKey);
