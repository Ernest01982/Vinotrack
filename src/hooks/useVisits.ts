import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Visit } from '../types';

/**
 * Custom hook to fetch the visit history for a specific client.
 * @param clientId The ID of the client whose visit history is to be fetched.
 * @param currentVisitId Optional ID of the current visit to exclude from the history.
 * @returns An object containing the visit history, loading state, error state, and a refetch function.
 */
export const useVisits = (clientId: string, currentVisitId?: string) => {
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisitHistory = useCallback(async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('visits')
        .select('*')
        .eq('client_id', clientId)
        .order('start_time', { ascending: false });

      // If a current visit ID is provided, exclude it from the history
      if (currentVisitId) {
        query = query.neq('id', currentVisitId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setVisitHistory(data || []);
    } catch (err: any) {
      console.error('Error fetching visit history:', err);
      setError('Failed to fetch visit history. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, currentVisitId]);

  useEffect(() => {
    fetchVisitHistory();
  }, [fetchVisitHistory]);

  return { visitHistory, loading, error, refetch: fetchVisitHistory };
};
