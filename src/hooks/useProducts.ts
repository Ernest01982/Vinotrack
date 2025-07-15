import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

/**
 * Custom hook to fetch a list of all products.
 * @returns An object containing the list of products, loading state, error state, and a function to refetch the data.
 */
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
};
