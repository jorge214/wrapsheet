import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL = "https://joymgpqtbkobjmznqyzi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveW1ncHF0YmtvYmptem5xeXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjc3NTYsImV4cCI6MjA5NTgwMzc1Nn0.wkClDRRUXINktGHApzuXaE_iHKRAxFfHQDeYgKvKev8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
