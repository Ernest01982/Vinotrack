/**
 * Centralized TypeScript type definitions for the VinoTracker application.
 */

// User-related types
export type UserRole = 'Admin' | 'Rep';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at: string;
}

// Client-related types
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  consumption_type: 'on-consumption' | 'off-consumption';
  call_frequency: number;
  assigned_rep_id: string;
  created_at: string;
  last_visit_date?: string;
}

// Visit-related types
export interface Visit {
  id: string;
  client_id: string;
  rep_id: string;
  start_time: string;
  end_time?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  created_at: string;
}

// Product and Order types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  total: number;
  is_free_stock?: boolean; // New field for free stock
}