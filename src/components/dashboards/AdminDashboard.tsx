import React, { useState, useEffect } from 'react';
import { Users, BarChart3, Settings, Wine, TrendingUp, Package, UserPlus, Mail, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase, UserProfile } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  created_at: string;
}

export const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [reps, setReps] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '' });
  const [productLoading, setProductLoading] = useState(false);
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('Products');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[]; total: number; } | null>(null);
  
  const [reportStats, setReportStats] = useState</*...*/>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', fullName: '', role: 'Rep' as 'Rep' | 'Admin' });

  // ... (stats array and useEffect remain the same)

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    setUploadLoading(true);
    setUploadResults(null);
    setError('');

    try {
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      const errors: string[] = [];

      for (const [index, row] of jsonData.entries()) {
        try {
          if (uploadType === 'Products') {
            const product = row as any;
            if (!product.name || !product.description || product.price == null) {
              throw new Error("Row is missing 'name', 'description', or 'price'.");
            }
            const { error: insertError } = await supabase
              .from('products')
              .insert({
                name: String(product.name),
                description: String(product.description),
                price: parseFloat(product.price),
              });
            if (insertError) throw insertError;
            successCount++;
          } else if (uploadType === 'Clients') {
            const client = row as any;
            if (!client.name || !client.email || !client.assigned_rep_id) {
              throw new Error("Row is missing 'name', 'email', or 'assigned_rep_id'.");
            }
            const { error: insertError } = await supabase
              .from('clients')
              .insert({
                name: String(client.name),
                email: String(client.email),
                phone: client.phone ? String(client.phone) : null,
                address: client.address ? String(client.address) : null,
                consumption_type: client.consumption_type === 'off-consumption' ? 'off-consumption' : 'on-consumption',
                call_frequency: client.call_frequency ? parseInt(client.call_frequency) : 1,
                assigned_rep_id: String(client.assigned_rep_id),
              });
            if (insertError) throw insertError;
            successCount++;
          }
        } catch (err: any) {
          errors.push(`Row ${index + 2}: ${err.message}`);
        }
      }

      setUploadResults({
        success: successCount,
        errors,
        total: jsonData.length,
      });

      if (uploadType === 'Products') fetchProducts();
      // You might want to fetch clients here if you implement that functionality
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      setUploadLoading(false);
    }
  };

  // ... (The rest of the AdminDashboard component remains the same)
};