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
  
  // Product management state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: ''
  });
  const [productLoading, setProductLoading] = useState(false);
  
  // Bulk upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('Products');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    errors: string[];
    total: number;
  } | null>(null);
  
  // Reports state
  const [reportStats, setReportStats] = useState<{
    totalClients: number;
    totalProducts: number;
    newProducts: number;
    visitsToday: number;
    visitsWeek: number;
    visitsMonth: number;
    onConsumptionVisits: number;
    offConsumptionVisits: number;
    repVisitStats: Array<{
      rep_id: string;
      rep_name: string;
      total_visits: number;
      avg_duration_minutes: number;
    }>;
  } | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  
  // Form state for inviting new reps
  const [inviteForm, setInviteForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'Rep' as 'Rep' | 'Admin'
  });

  const stats = [
    { name: 'Total Users', value: reps.length.toString(), icon: Users, change: '+12%' },
    { name: 'Wine Inventory', value: products.length.toString(), icon: Wine, change: '+8%' },
    { name: 'Monthly Sales', value: 'R47,532', icon: TrendingUp, change: '+23%' },
    { name: 'Active Reps', value: reps.filter(r => r.role === 'Rep').length.toString(), icon: Package, change: '+5%' },
  ];

  useEffect(() => {
    fetchReps();
    fetchProducts();
  }, []);

  const fetchReps = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReps(data || []);
    } catch (err) {
      console.error('Error fetching reps:', err);
      setError('Failed to fetch users');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products');
    }
  };

  const handleInviteRep = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteForm.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password strength
      if (inviteForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: inviteForm.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: inviteForm.email,
            full_name: inviteForm.fullName,
            role: inviteForm.role,
          });

        if (profileError) throw profileError;

        setSuccess(`${inviteForm.role} invited successfully!`);
        setInviteForm({ email: '', password: '', fullName: '', role: 'Rep' });
        fetchReps();
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
      // Validate inputs
      if (!productForm.name.trim()) {
        throw new Error('Product name is required');
      }
      if (!productForm.description.trim()) {
        throw new Error('Product description is required');
      }
      if (!productForm.price || parseFloat(productForm.price) <= 0) {
        throw new Error('Product price must be greater than 0');
      }

      const { error } = await supabase
        .from('products')
        .insert({
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
        });

      if (error) throw error;

      setSuccess('Product added successfully!');
      setProductForm({ name: '', description: '', price: '' });
      setShowAddProductModal(false);
      fetchProducts();
    } catch (err: any) {
      console.error('Add product error:', err);
      setError(err.message || 'Failed to add product');
    } finally {
      setProductLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    if (!confirm(`Upload ${uploadType.toLowerCase()} from ${uploadFile.name}? This will add new records to your database.`)) {
      return;
    }

    setUploadLoading(true);
    setUploadResults(null);
    setError('');

    try {
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The uploaded file appears to be empty or has no valid data');
      }

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

      if (uploadType === 'Products') {
        fetchProducts();
      } else {
      
      // Clear the file input
      setUploadFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
        // You may want to fetch clients here
      }
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
          repStat = {
            rep_id: repId,
            rep_name: repName,
            total_visits: 0,
            avg_duration_minutes: 0,
            total_duration: 0
          };
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

      setReportStats({
        totalClients,
        totalProducts,
        newProducts,
        visitsToday,
        visitsWeek,
        visitsMonth,
        onConsumptionVisits,
        offConsumptionVisits,
        repVisitStats
      });
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to fetch reports');
    } finally {
      setReportsLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <item.icon className="h-6 w-6 text-purple-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">{item.name}</dt>
                    <dd>
                      <div className="text-lg font-medium text-white">{item.value}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-700 px-5 py-3">
              <div className="text-sm">
                <span className="text-green-400 font-medium">{item.change}</span>
                <span className="text-gray-400"> from last month</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-white">Quick Actions</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button onClick={() => setActiveTab('reps')} className="bg-purple-600 hover:bg-purple-700 text-white"><UserPlus className="h-4 w-4 mr-2" />Manage Users</Button>
            <Button onClick={() => setActiveTab('reports')} className="bg-blue-600 hover:bg-blue-700 text-white"><BarChart3 className="h-4 w-4 mr-2" />View Full Report</Button>
            <Button onClick={() => setActiveTab('reps')} className="bg-green-600 hover:bg-green-700 text-white"><Mail className="h-4 w-4 mr-2" />Add New Rep</Button>
            <Button onClick={() => setActiveTab('inventory')} className="bg-orange-600 hover:bg-orange-700 text-white"><Package className="h-4 w-4 mr-2" />Manage Inventory</Button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-white">Recent Activity</h3>
          <div className="mt-5 space-y-4">
            <div className="flex items-center space-x-3"><div className="flex-shrink-0"><CheckCircle className="h-5 w-5 text-green-400" /></div><div className="flex-1 min-w-0"><p className="text-sm text-gray-300">New rep John Smith was added</p><p className="text-xs text-gray-500">2 hours ago</p></div></div>
            <div className="flex items-center space-x-3"><div className="flex-shrink-0"><Package className="h-5 w-5 text-blue-400" /></div><div className="flex-1 min-w-0"><p className="text-sm text-gray-300">5 new products added</p><p className="text-xs text-gray-500">4 hours ago</p></div></div>
            <div className="flex items-center space-x-3"><div className="flex-shrink-0"><BarChart3 className="h-5 w-5 text-purple-400" /></div><div className="flex-1 min-w-0"><p className="text-sm text-gray-300">Weekly sales report generated</p><p className="text-xs text-gray-500">1 day ago</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRepsTab = () => (
    <div className="space-y-6">
      {/* Invite New Rep Form */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700"><div className="px-4 py-5 sm:p-6"><h3 className="text-lg leading-6 font-medium text-white mb-4">Invite New User</h3><form onSubmit={handleInviteRep} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required /><Input label="Full Name" type="text" value={inviteForm.fullName} onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })} required /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="Password" type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} required /><div><label className="block text-sm font-medium text-gray-300 mb-1">Role</label><select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'Rep' | 'Admin' })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"><option value="Rep">Rep</option><option value="Admin">Admin</option></select></div></div><Button type="submit" disabled={inviteLoading} className="bg-purple-600 hover:bg-purple-700 text-white">{inviteLoading ? 'Inviting...' : 'Invite User'}</Button></form></div></div>
      {/* Users List */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700"><div className="px-4 py-5 sm:p-6"><h3 className="text-lg leading-6 font-medium text-white mb-4">All Users</h3><div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg"><table className="min-w-full divide-y divide-gray-600"><thead className="bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th></tr></thead><tbody className="bg-gray-800 divide-y divide-gray-600">{reps.map((rep) => (<tr key={rep.id}><td className="px-6 py-4 whitespace-nowrap text-sm text-white">{rep.full_name || 'N/A'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.email}</td><td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${rep.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{rep.role}</span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.created_at ? new Date(rep.created_at).toLocaleDateString() : 'N/A'}</td></tr>))}</tbody></table></div></div></div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Product Inventory</h2><Button onClick={() => setShowAddProductModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white"><Package className="h-4 w-4 mr-2" />Add Product</Button></div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => (<div key={product.id} className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6"><h3 className="text-lg font-medium text-white mb-2">{product.name}</h3><p className="text-gray-300 text-sm mb-4">{product.description}</p><div className="flex justify-between items-center"><span className="text-2xl font-bold text-purple-400">R{product.price.toFixed(2)}</span><span className="text-xs text-gray-500">{new Date(product.created_at).toLocaleDateString()}</span></div></div>))}</div>
      {showAddProductModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-gray-800 rounded-lg p-6 w-full max-w-md"><h3 className="text-lg font-medium text-white mb-4">Add New Product</h3><form onSubmit={handleAddProduct} className="space-y-4"><Input label="Product Name" type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /><div><label className="block text-sm font-medium text-gray-300 mb-1">Description</label><textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500" rows={3} required /></div><Input label="Price (R)" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /><div className="flex space-x-3"><Button type="submit" disabled={productLoading} className="bg-purple-600 hover:bg-purple-700 text-white flex-1">{productLoading ? 'Adding...' : 'Add Product'}</Button><Button type="button" onClick={() => setShowAddProductModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white flex-1">Cancel</Button></div></form></div></div>)}
    </div>
  );
  
  const renderBulkUploadTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700"><div className="px-4 py-5 sm:p-6"><h3 className="text-lg leading-6 font-medium text-white mb-4">Bulk Upload Products & Clients</h3><div className="space-y-4"><div><label className="block text-sm font-medium text-gray-300 mb-1">Upload Type</label><select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"><option value="Products">Products</option><option value="Clients">Clients</option></select></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Excel File</label><p className="text-sm text-gray-400 mb-2">{uploadType === 'Products' ? "Excel should have columns: name, description, price" : "Excel should have columns: name, email, phone, address, consumption_type, call_frequency, assigned_rep_id"}</p><input type="file" accept=".xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500" /></div><Button onClick={handleFileUpload} disabled={!uploadFile || uploadLoading} className="bg-purple-600 hover:bg-purple-700 text-white"><Upload className="h-4 w-4 mr-2" />{uploadLoading ? 'Uploading...' : `Upload ${uploadType}`}</Button></div>{uploadResults && (<div className="mt-6 p-4 bg-gray-700 rounded-lg"><h4 className="text-white font-medium mb-2">Upload Results</h4><div className="space-y-2"><p className="text-green-400"><CheckCircle className="h-4 w-4 inline mr-1" />Successfully processed: {uploadResults.success}/{uploadResults.total}</p>{uploadResults.errors.length > 0 && (<div><p className="text-red-400 mb-1"><AlertCircle className="h-4 w-4 inline mr-1" />Errors:</p><ul className="text-sm text-gray-300 space-y-1">{uploadResults.errors.slice(0, 5).map((error, index) => (<li key={index}>• {error}</li>))}{uploadResults.errors.length > 5 && (<li>• ... and {uploadResults.errors.length - 5} more errors</li>)}</ul></div>)}</div></div>)}</div></div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Analytics & Reports</h2><Button onClick={fetchReports} disabled={reportsLoading} className="bg-purple-600 hover:bg-purple-700 text-white"><BarChart3 className="h-4 w-4 mr-2" />{reportsLoading ? 'Loading...' : 'Refresh Data'}</Button></div>
      {reportStats && (<><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"><div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700 p-5"><div className="flex items-center"><Users className="h-8 w-8 text-blue-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Total Clients</p><p className="text-2xl font-semibold text-white">{reportStats.totalClients}</p></div></div></div><div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700 p-5"><div className="flex items-center"><Package className="h-8 w-8 text-green-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Total Products</p><p className="text-2xl font-semibold text-white">{reportStats.totalProducts}</p></div></div></div><div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700 p-5"><div className="flex items-center"><TrendingUp className="h-8 w-8 text-purple-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">New Products (30d)</p><p className="text-2xl font-semibold text-white">{reportStats.newProducts}</p></div></div></div><div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700 p-5"><div className="flex items-center"><Calendar className="h-8 w-8 text-orange-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Visits Today</p><p className="text-2xl font-semibold text-white">{reportStats.visitsToday}</p></div></div></div></div><div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6"><h3 className="text-lg font-medium text-white mb-4">Visit Statistics</h3><div className="space-y-4"><div className="flex justify-between"><span className="text-gray-300">This Week</span><span className="text-white font-semibold">{reportStats.visitsWeek}</span></div><div className="flex justify-between"><span className="text-gray-300">This Month</span><span className="text-white font-semibold">{reportStats.visitsMonth}</span></div><div className="flex justify-between"><span className="text-gray-300">On-Consumption Clients</span><span className="text-white font-semibold">{reportStats.onConsumptionVisits}</span></div><div className="flex justify-between"><span className="text-gray-300">Off-Consumption Clients</span><span className="text-white font-semibold">{reportStats.offConsumptionVisits}</span></div></div></div><div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6"><h3 className="text-lg font-medium text-white mb-4">Rep Performance</h3><div className="space-y-3">{reportStats.repVisitStats.slice(0, 5).map((rep) => (<div key={rep.rep_id} className="flex justify-between items-center"><div><p className="text-white font-medium">{rep.rep_name}</p><p className="text-sm text-gray-400">{rep.total_visits} visits</p></div><div className="text-right"><p className="text-purple-400 font-semibold">{rep.avg_duration_minutes}m</p><p className="text-xs text-gray-500">avg duration</p></div></div>))}</div></div></div></>)}
    </div>
  );

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
