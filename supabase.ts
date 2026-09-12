import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awwmdvmabqxclhkzxxaq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dB5lEP_yfob7ifwX5Y0lHg_YWxMwbgG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});