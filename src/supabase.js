import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qijapjafswogmjxxsbhw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpamFwamFmc3dvZ21qeHhzYmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODUwNjcsImV4cCI6MjA4ODI2MTA2N30.lEc9Xw3YcIIxQvN2tfSf15u4e7B-iShK9vp4iW36qRc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
