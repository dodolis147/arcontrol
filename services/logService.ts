import { supabase } from './supabase';

export const logErrorToSupabase = async (error: Error | string, errorInfo?: string) => {
  try {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? '' : error.stack;

    await supabase.from('system_logs').insert([{
      message,
      stack,
      level: 'error',
      url: window.location.href,
      error_info: errorInfo // Optional error context
    }]);
  } catch (logError) {
    // Falls back to console ifSupabase logging fails as well
    console.error("Failed to log error to Supabase:", logError);
  }
};
