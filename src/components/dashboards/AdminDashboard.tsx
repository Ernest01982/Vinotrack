import React, { useState, useEffect } from 'react';
import { Users, BarChart3, Wine, TrendingUp, Package, UserPlus, Mail, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { useUsers } from '../../hooks/useUsers';
import { useProducts } from '../../hooks/useProducts';

export const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Use custom hooks for data fetching
  const { users: reps, loading: repsLoading, error: repsError, refetch: refetchReps } = useUsers();
  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useProducts();
  
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Product management state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '' });
  const [productLoading, setProductLoading] = useState(false);
  
  // Bulk upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('Products');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[]; total: number; } | null>(null);
  
  // Reports state
  const [reportStats, setReportStats] = useState<{ totalClients: number; totalProducts: number; newProducts: number; visitsToday: number; visitsWeek: number; visitsMonth: number; onConsumptionVisits: number; offConsumptionVisits: number; repVisitStats: Array<{ rep_id: string; rep_name: string; total_visits: number; avg_duration_minutes: number; }>; } | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  
  // Form state for inviting new reps
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', fullName: '', role: 'Rep' as 'Rep' | 'Admin' });

  useEffect(() => {
    // Display errors from hooks
    if (repsError) setError(repsError);
    if (productsError) setError(productsError);
  }, [repsError, productsError]);

  const stats = [
    { name: 'Total Users', value: reps.length.toString(), icon: Users, change: '+12%' },
    { name: 'Wine Inventory', value: products.length.toString(), icon: Wine, change: '+8%' },
    { name: 'Monthly Sales', value: 'R47,532', icon: TrendingUp, change: '+23%' },
    { name: 'Active Reps', value: reps.filter(r => r.role === 'Rep').length.toString(), icon: Package, change: '+5%' },
  ];

  const handleInviteRep = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setError('');
    setSuccess('');

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteForm.email)) throw new Error('Please enter a valid email address');
      if (inviteForm.password.length < 6) throw new Error('Password must be at least 6 characters long');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: inviteForm.password,
      });
      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: inviteForm.email,
          full_name: inviteForm.fullName,
          role: inviteForm.role,
        });
        if (profileError) throw profileError;

        setSuccess(`${inviteForm.role} invited successfully!`);
        setInviteForm({ email: '', password: '', fullName: '', role: 'Rep' });
        refetchReps(); // Refetch users list
      }
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!productForm.name.trim()) throw new Error('Product name is required');
      if (!productForm.description.trim()) throw new Error('Product description is required');
      if (!productForm.price || parseFloat(productForm.price) <= 0) throw new Error('Product price must be greater than 0');

      const { error } = await supabase.from('products').insert({
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
      });
      if (error) throw error;

      setSuccess('Product added successfully!');
      setProductForm({ name: '', description: '', price: '' });
      setShowAddProductModal(false);
      refetchProducts(); // Refetch products list
    } catch (err: any) {
      console.error('Add product error:', err);
      setError(err.message || 'Failed to add product');
    } finally {
      setProductLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    if (!confirm(`Upload ${uploadType.toLowerCase()} from ${uploadFile.name}? This will add new records to your database.`)) return;

    setUploadLoading(true);
    setUploadResults(null);
    setError('');

    try {
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) throw new Error('The uploaded file appears to be empty or has no valid data');

      let successCount = 0;
      const errors: string[] = [];

      for (const [index, row] of jsonData.entries()) {
        try {
          if (uploadType === 'Products') {
            const product = row as any;
            if (!product.name || !product.description || product.price == null) throw new Error("Row is missing 'name', 'description', or 'price'.");
            const { error: insertError } = await supabase.from('products').insert({ name: String(product.name), description: String(product.description), price: parseFloat(product.price) });
            if (insertError) throw insertError;
          } else if (uploadType === 'Clients') {
            const client = row as any;
            if (!client.name || !client.email || !client.assigned_rep_id) throw new Error("Row is missing 'name', 'email', or 'assigned_rep_id'.");
            const { error: insertError } = await supabase.from('clients').insert({ name: String(client.name), email: String(client.email), phone: client.phone ? String(client.phone) : null, address: client.address ? String(client.address) : null, consumption_type: client.consumption_type === 'off-consumption' ? 'off-consumption' : 'on-consumption', call_frequency: client.call_frequency ? parseInt(client.call_frequency) : 1, assigned_rep_id: String(client.assigned_rep_id) });
            if (insertError) throw insertError;
          }
          successCount++;
        } catch (err: any) {
          errors.push(`Row ${index + 2}: ${err.message}`);
        }
      }

      setUploadResults({ success: successCount, errors, total: jsonData.length });
      if (uploadType === 'Products') refetchProducts();
      
      setUploadFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || 'Failed to process file');
    } finally {
      setUploadLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const [clientsRes, productsRes, visitsRes] = await Promise.all([
        supabase.from('clients').select('id, consumption_type'),
        supabase.from('products').select('id, created_at'),
        supabase.from('visits').select('id, start_time, end_time, rep_id, profiles!visits_rep_id_fkey(full_name)')
      ]);

      const totalClients = clientsRes.data?.length || 0;
      const totalProducts = productsRes.data?.length || 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newProducts = productsRes.data?.filter(p => new Date(p.created_at) > thirtyDaysAgo).length || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const visits = visitsRes.data || [];
      const visitsToday = visits.filter(v => new Date(v.start_time) >= today).length;
      const visitsWeek = visits.filter(v => new Date(v.start_time) >= weekAgo).length;
      const visitsMonth = visits.filter(v => new Date(v.start_time) >= monthAgo).length;
      const clients = clientsRes.data || [];
      const onConsumptionVisits = clients.filter(c => c.consumption_type === 'on-consumption').length;
      const offConsumptionVisits = clients.filter(c => c.consumption_type === 'off-consumption').length;
      const repVisitStats = visits.reduce((acc: any[], visit) => {
        const repId = visit.rep_id;
        const repName = (visit.profiles as any)?.full_name || 'Unknown';
        let repStat = acc.find(r => r.rep_id === repId);
        if (!repStat) {
          repStat = { rep_id: repId, rep_name: repName, total_visits: 0, avg_duration_minutes: 0, total_duration: 0 };
          acc.push(repStat);
        }
        repStat.total_visits++;
        if (visit.end_time) {
          const duration = new Date(visit.end_time).getTime() - new Date(visit.start_time).getTime();
          repStat.total_duration += duration;
          repStat.avg_duration_minutes = Math.round(repStat.total_duration / repStat.total_visits / 60000);
        }
        return acc;
      }, []);

      setReportStats({ totalClients, totalProducts, newProducts, visitsToday, visitsWeek, visitsMonth, onConsumptionVisits, offConsumptionVisits, repVisitStats });
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to fetch reports');
    } finally {
      setReportsLoading(false);
    }
  };

  // ... (rest of the rendering logic remains the same)

  return (
    <div className="min-h-screen bg-gray-900">
      {error && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded">{error}</div></div>)}
      {success && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-green-800 border border-green-600 text-green-200 px-4 py-3 rounded">{success}</div></div>)}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8"><nav className="flex space-x-8"><button onClick={() => setActiveTab('overview')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Overview</button><button onClick={() => setActiveTab('reps')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reps' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Users</button><button onClick={() => setActiveTab('inventory')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'inventory' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Inventory</button><button onClick={() => setActiveTab('bulk-upload')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'bulk-upload' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Bulk Upload</button><button onClick={() => setActiveTab('reports')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Reports</button></nav></div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'reps' && renderRepsTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'bulk-upload' && renderBulkUploadTab()}
        {activeTab === 'reports' && renderReportsTab()}
      </main>
    </div>
  );
};
