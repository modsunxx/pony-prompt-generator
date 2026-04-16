import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

// สร้างตัวเชื่อมต่อ (Client) โดยใช้คีย์จากไฟล์ .env
export const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
