import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mygkmiofmbhnxzrvrqml.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15Z2ttaW9mbWJobnh6cnZycW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDI2MTgsImV4cCI6MjA4Mzg3ODYxOH0.agnb8OBTwlI3iOgWdkDRnsKg-WHD1C58ys_8nK4zsxo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Render backend API base URL
export const API_BASE_URL = 'https://api.projectnow.app'

// Scopes cần thiết để gọi Gemini API qua Google Cloud
export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')
