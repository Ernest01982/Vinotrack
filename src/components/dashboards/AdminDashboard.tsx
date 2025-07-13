import React, { useState, useEffect, useMemo } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Users, BarChart3, Wine, TrendingUp, Package, UserPlus, Mail, Upload, CheckCircle, AlertCircle, Calendar, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';

// Type definitions
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  created_at: string;
}

interface ActivityLog {
    id: string;
    type: 'USER_ADDED' | 'PRODUCT_ADDED' | 'REPORT_GENERATED';
    message: string;
    created_at: string;
}

interface ReportStats {
    totalClients: number;
    totalProducts: number;
    newProducts: number;
    visitsToday: number;
    visitsWeek: number;
    visitsMonth: number;
    onConsumptionClients: number;
    offConsumptionClients: number;
    repVisitStats: Array<{
      rep_id: string;
      rep_name: string;
      total_visits: number;
      avg_duration_minutes: number;
    }>;
}

export const AdminDashboard: React.FC = () => {
    const { userProfile, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [reps, setReps] = useState<UserProfile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // State for modals
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [showBulkUploadConfirmModal, setShowBulkUploadConfirmModal] = useState(false);

    // Form states
    const [productForm, setProductForm] = useState({ name: '', description: '', price: '' });
    const [inviteForm, setInviteForm] = useState({ email: '', password: '', fullName: '', role: 'Rep' as 'Rep' | 'Admin' });
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState('Products');
    
    // Loading states
    const [inviteLoading, setInviteLoading] = useState(false);
    const [productLoading, setProductLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [reportsLoading, setReportsLoading] = useState(false);
    
    // Data states
    const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[]; total: number } | null>(null);
    const [reportStats, setReportStats] = useState<ReportStats | null>(null);

    // Fetch initial data
    useEffect(() => {
        fetchReps();
        fetchProducts();
        fetchActivityLogs();
    }, []);

    // Fetch reports data when the reports tab is active
    useEffect(() => {
        if (activeTab === 'reports' && !reportStats) {
            fetchReports();
        }
    }, [activeTab, reportStats]);

    // Dynamic stats based on fetched data
    const stats = useMemo(() => [
        { name: 'Total Users', value: reps.length.toString(), icon: Users },
        { name: 'Wine Inventory', value: products.length.toString(), icon: Wine },
        { name: 'Total Admins', value: reps.filter(r => r.role === 'Admin').length.toString(), icon: UserPlus },
        { name: 'Active Reps', value: reps.filter(r => r.role === 'Rep').length.toString(), icon: Package },
    ], [reps, products]);

    // Clear success/error messages after a delay
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 5000);
            return () => clearTimeout(timer);
        }
        if (error) {
            const timer = setTimeout(() => setError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    const fetchReps = async () => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setReps(data || []);
        } catch (err) {
            setError('Failed to fetch users');
        }
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            setError('Failed to fetch products');
        }
    };
    
    const fetchActivityLogs = async () => {
        try {
            const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            setActivityLogs(data || []);
        } catch (err) {
            // It's okay if this fails, not critical
            console.error('Could not fetch activity logs', err);
        }
    };

    const handleInviteRep = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setError('');
        setSuccess('');

        try {
            if (inviteForm.password.length < 6) throw new Error('Password must be at least 6 characters long');
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: inviteForm.email,
                password: inviteForm.password,
                options: {
                    data: {
                        full_name: inviteForm.fullName,
                        role: inviteForm.role
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                 // The handle_new_user trigger in Supabase should create the profile.
                setSuccess(`${inviteForm.role} invited successfully!`);
                setInviteForm({ email: '', password: '', fullName: '', role: 'Rep' });
                fetchReps();
                // Log activity
                await supabase.from('activity_log').insert({ type: 'USER_ADDED', message: `Invited ${inviteForm.role}: ${inviteForm.email}` });
                fetchActivityLogs();
            }
        } catch (err: any) {
            // Enhanced error handling with specific messages
            let errorMessage = 'Failed to invite user';
            
            if (err.message) {
                if (err.message.includes('User already registered')) {
                    errorMessage = `A user with email ${inviteForm.email} already exists. Please use a different email address.`;
                } else if (err.message.includes('Invalid email')) {
                    errorMessage = 'Please enter a valid email address.';
                } else if (err.message.includes('Password should be at least')) {
                    errorMessage = 'Password must be at least 6 characters long and contain a mix of letters and numbers.';
                } else if (err.message.includes('Email rate limit exceeded')) {
                    errorMessage = 'Too many signup attempts. Please wait a few minutes before trying again.';
                } else if (err.message.includes('Signup is disabled')) {
                    errorMessage = 'User registration is currently disabled. Please contact your system administrator.';
                } else if (err.message.includes('network') || err.message.includes('fetch')) {
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                } else if (err.message.includes('Database error') || err.message.includes('relation')) {
                    errorMessage = 'Database configuration error. Please contact technical support.';
                } else {
                    errorMessage = `Error: ${err.message}`;
                }
            }
            
            setError(errorMessage);
            console.error('Invite user error:', err);
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
            // Enhanced validation with specific messages
            if (!productForm.name.trim()) {
                throw new Error('Product name is required and cannot be empty.');
            }
            if (!productForm.description.trim()) {
                throw new Error('Product description is required and cannot be empty.');
            }
            if (!productForm.price || parseFloat(productForm.price) <= 0) {
                throw new Error('Product price must be a positive number greater than 0.');
            }
            if (parseFloat(productForm.price) > 999999.99) {
                throw new Error('Product price cannot exceed R999,999.99.');
            }
            
            const { error } = await supabase.from('products').insert({
                name: productForm.name,
                description: productForm.description,
                price: parseFloat(productForm.price),
            });
            if (error) throw error;

            setSuccess('Product added successfully!');
            setProductForm({ name: '', description: '', price: '' });
            setShowAddProductModal(false);
            fetchProducts();
            // Log activity
            await supabase.from('activity_log').insert({ type: 'PRODUCT_ADDED', message: `Added product: ${productForm.name}` });
            fetchActivityLogs();
        } catch (err: any) {
            // Enhanced error handling for product creation
            let errorMessage = 'Failed to add product';
            
            if (err.message) {
                if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
                    errorMessage = `A product named "${productForm.name}" already exists. Please choose a different name.`;
                } else if (err.message.includes('invalid input syntax')) {
                    errorMessage = 'Invalid price format. Please enter a valid number (e.g., 25.99).';
                } else if (err.message.includes('value too long')) {
                    errorMessage = 'Product name or description is too long. Please shorten your text.';
                } else if (err.message.includes('permission denied') || err.message.includes('RLS')) {
                    errorMessage = 'You do not have permission to add products. Please contact your administrator.';
                } else if (err.message.includes('network') || err.message.includes('fetch')) {
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                } else if (err.message.includes('Product name is required') || 
                          err.message.includes('Product description is required') || 
                          err.message.includes('Product price must be')) {
                    errorMessage = err.message; // Use our custom validation messages
                } else {
                    errorMessage = `Error adding product: ${err.message}`;
                }
            }
            
            setError(errorMessage);
            console.error('Add product error:', err);
        } finally {
            setProductLoading(false);
        }
    };
    
    const triggerBulkUpload = async () => {
        setShowBulkUploadConfirmModal(false);
        if (!uploadFile) return;

        setUploadLoading(true);
        setUploadResults(null);
        setError('');

        try {
            const data = await uploadFile.arrayBuffer();
            const workbook = XLSX.read(data);
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('The uploaded file appears to be empty or corrupted. Please check your file and try again.');
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error('The uploaded file contains no data rows. Please ensure your file has data below the header row.');
            }
            
            if (jsonData.length > 1000) {
                throw new Error(`File contains ${jsonData.length} rows. Please limit uploads to 1000 rows or fewer for optimal performance.`);
            }

            let successCount = 0;
            const errors: string[] = [];

            for (const [index, row] of jsonData.entries()) {
                try {
                    if (uploadType === 'Products') {
                        const product = row as any;
                        if (!product.name || !product.description || product.price == null) {
                            throw new Error("Missing required fields: 'name', 'description', or 'price'");
                        }
                        if (typeof product.price !== 'number' && isNaN(parseFloat(product.price))) {
                            throw new Error("Price must be a valid number");
                        }
                        const { error: insertError } = await supabase.from('products').insert({ name: String(product.name), description: String(product.description), price: parseFloat(product.price) });
                        if (insertError) throw insertError;
                    } else if (uploadType === 'Clients') {
                        const client = row as any;
                        if (!client.name || !client.email || !client.assigned_rep_id) {
                            throw new Error("Missing required fields: 'name', 'email', or 'assigned_rep_id'");
                        }
                        if (!client.email.includes('@')) {
                            throw new Error("Invalid email format");
                        }
                        const { error: insertError } = await supabase.from('clients').insert({
                            name: String(client.name),
                            email: String(client.email),
                            phone: client.phone ? String(client.phone) : null,
                            address: client.address ? String(client.address) : null,
                            consumption_type: client.consumption_type === 'off-consumption' ? 'off-consumption' : 'on-consumption',
                            call_frequency: client.call_frequency ? parseInt(client.call_frequency) : 1,
                            assigned_rep_id: String(client.assigned_rep_id),
                        });
                        if (insertError) throw insertError;
                    }
                    successCount++;
                } catch (err: any) {
                    let rowError = `Row ${index + 2}: `;
                    if (err.message.includes('duplicate key')) {
                        rowError += uploadType === 'Products' ? 
                            `Product name already exists` : 
                            `Email address already exists`;
                    } else if (err.message.includes('foreign key')) {
                        rowError += `Invalid assigned_rep_id - representative not found`;
                    } else {
                        rowError += err.message;
                    }
                    errors.push(rowError);
                }
            }

            setUploadResults({ success: successCount, errors, total: jsonData.length });
            if (uploadType === 'Products') fetchProducts();
            // You might want to fetch clients here if you implement a client list view
            
        } catch (err: any) {
            // Enhanced error handling for bulk upload
            let errorMessage = 'Failed to process file';
            
            if (err.message) {
                if (err.message.includes('not a valid zip file') || err.message.includes('corrupted')) {
                    errorMessage = 'The uploaded file is corrupted or not a valid Excel file. Please try saving and re-uploading your file.';
                } else if (err.message.includes('permission denied')) {
                    errorMessage = 'You do not have permission to upload data. Please contact your administrator.';
                } else if (err.message.includes('network') || err.message.includes('fetch')) {
                    errorMessage = 'Network error during upload. Please check your connection and try again.';
                } else if (err.message.includes('file contains') || 
                          err.message.includes('uploaded file') || 
                          err.message.includes('limit uploads')) {
                    errorMessage = err.message; // Use our custom validation messages
                } else {
                    errorMessage = `Upload error: ${err.message}`;
                }
            }
            
            setError(errorMessage);
            console.error('Bulk upload error:', err);
        } finally {
            setUploadLoading(false);
            setUploadFile(null);
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        }
    };

    const fetchReports = async () => {
        setReportsLoading(true);
        setError('');
        
        try {
            const [clientsRes, productsRes, visitsRes] = await Promise.all([
                supabase.from('clients').select('id, consumption_type', { count: 'exact' }),
                supabase.from('products').select('id, created_at', { count: 'exact' }),
                supabase.from('visits').select('id, start_time, end_time, rep_id, profiles!visits_rep_id_fkey(full_name)')
            ]);

            // Check for errors in any of the queries
            if (clientsRes.error) throw new Error(`Failed to fetch client data: ${clientsRes.error.message}`);
            if (productsRes.error) throw new Error(`Failed to fetch product data: ${productsRes.error.message}`);
            if (visitsRes.error) throw new Error(`Failed to fetch visit data: ${visitsRes.error.message}`);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const visits = visitsRes.data || [];
            
            const repVisitStats = visits.reduce((acc: any, visit) => {
                const repId = visit.rep_id;
                if (!acc[repId]) {
                    acc[repId] = { rep_id: repId, rep_name: (visit.profiles as any)?.full_name || 'Unknown', total_visits: 0, total_duration: 0 };
                }
                acc[repId].total_visits++;
                if (visit.end_time) {
                    acc[repId].total_duration += new Date(visit.end_time).getTime() - new Date(visit.start_time).getTime();
                }
                return acc;
            }, {});

            setReportStats({
                totalClients: clientsRes.count || 0,
                totalProducts: productsRes.count || 0,
                newProducts: productsRes.data?.filter(p => new Date(p.created_at) > thirtyDaysAgo).length || 0,
                visitsToday: visits.filter(v => new Date(v.start_time) >= today).length,
                visitsWeek: visits.filter(v => new Date(v.start_time) >= weekAgo).length,
                visitsMonth: visits.filter(v => new Date(v.start_time) >= thirtyDaysAgo).length,
                onConsumptionClients: clientsRes.data?.filter(c => c.consumption_type === 'on-consumption').length || 0,
                offConsumptionClients: clientsRes.data?.filter(c => c.consumption_type === 'off-consumption').length || 0,
                repVisitStats: Object.values(repVisitStats).map((stat: any) => ({
                    ...stat,
                    avg_duration_minutes: stat.total_visits > 0 ? Math.round(stat.total_duration / stat.total_visits / 60000) : 0
                }))
            });
        } catch (err) {
            // Enhanced error handling for reports
            let errorMessage = 'Failed to generate reports';
            
            if (err.message) {
                if (err.message.includes('permission denied') || err.message.includes('RLS')) {
                    errorMessage = 'You do not have permission to view reports. Please contact your administrator.';
                } else if (err.message.includes('network') || err.message.includes('fetch')) {
                    errorMessage = 'Network error while loading reports. Please check your connection and try again.';
                } else if (err.message.includes('Failed to fetch')) {
                    errorMessage = err.message; // Use our specific fetch error messages
                } else {
                    errorMessage = `Reports error: ${err.message}`;
                }
            }
            
            setError(errorMessage);
            console.error('Fetch reports error:', err);
        } finally {
            setReportsLoading(false);
        }
    };
    
    // Render Functions for each tab
    const renderOverview = () => (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((item) => (
                    <div key={item.name} className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                        <div className="p-5 flex items-center">
                            <div className="flex-shrink-0 bg-purple-600/20 p-3 rounded-lg"><item.icon className="h-6 w-6 text-purple-400" /></div>
                            <div className="ml-5 w-0 flex-1">
                                <dt className="text-sm font-medium text-gray-400 truncate">{item.name}</dt>
                                <dd className="text-2xl font-bold text-white">{item.value}</dd>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gray-800 shadow rounded-lg border border-gray-700 p-6">
                     <h3 className="text-lg leading-6 font-medium text-white mb-4">Quick Actions</h3>
                     <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Button onClick={() => setActiveTab('reps')} className="bg-purple-600 hover:bg-purple-700"><UserPlus className="h-5 w-5 mr-2" />Manage Users</Button>
                        <Button onClick={() => setActiveTab('inventory')} className="bg-blue-600 hover:bg-blue-700"><Package className="h-5 w-5 mr-2" />Manage Inventory</Button>
                        <Button onClick={() => setActiveTab('bulk-upload')} className="bg-green-600 hover:bg-green-700"><Upload className="h-5 w-5 mr-2" />Bulk Upload Data</Button>
                        <Button onClick={() => setActiveTab('reports')} className="bg-orange-600 hover:bg-orange-700"><BarChart3 className="h-5 w-5 mr-2" />View Reports</Button>
                    </div>
                </div>
                <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6">
                    <h3 className="text-lg leading-6 font-medium text-white mb-4">Recent Activity</h3>
                    <div className="mt-5 space-y-4">
                        {activityLogs.length > 0 ? activityLogs.map(log => (
                            <div key={log.id} className="flex items-center space-x-3">
                                <div className="flex-shrink-0"><CheckCircle className="h-5 w-5 text-green-400" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-300">{log.message}</p>
                                    <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-gray-500">No recent activity.</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderRepsTab = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-medium text-white mb-4">Invite New User</h3>
                <form onSubmit={handleInviteRep} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
                        <Input label="Full Name" type="text" value={inviteForm.fullName} onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Password (min. 6 characters)" type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} required />
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                            <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'Rep' | 'Admin' })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option value="Rep">Rep</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    <Button type="submit" loading={inviteLoading} className="bg-purple-600 hover:bg-purple-700">Invite User</Button>
                </form>
            </div>
            <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-white mb-4">All Users</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-600">
                            <thead className="bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th></tr></thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-600">{reps.map((rep) => (<tr key={rep.id}><td className="px-6 py-4 whitespace-nowrap text-sm text-white">{rep.full_name || 'N/A'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.email}</td><td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${rep.role === 'Admin' ? 'bg-purple-200 text-purple-800' : 'bg-green-200 text-green-800'}`}>{rep.role}</span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.created_at ? new Date(rep.created_at).toLocaleDateString() : 'N/A'}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInventoryTab = () => (
        <div className="space-y-6">
             <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Product Inventory</h2><Button onClick={() => setShowAddProductModal(true)} className="bg-purple-600 hover:bg-purple-700"><Package className="h-4 w-4 mr-2" />Add Product</Button></div>
             <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => (<div key={product.id} className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6"><h3 className="text-lg font-medium text-white mb-2">{product.name}</h3><p className="text-gray-300 text-sm mb-4">{product.description}</p><div className="flex justify-between items-center"><span className="text-2xl font-bold text-purple-400">R{product.price.toFixed(2)}</span><span className="text-xs text-gray-500">{new Date(product.created_at).toLocaleDateString()}</span></div></div>))}</div>
        </div>
    );

    const renderBulkUploadTab = () => (
        <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6 space-y-6">
            <h3 className="text-lg font-medium text-white">Bulk Upload Data</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Upload Type</label>
                    <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"><option value="Products">Products</option><option value="Clients">Clients</option></select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Excel File (.xlsx)</label>
                    <p className="text-sm text-gray-400 mb-2">{uploadType === 'Products' ? "Columns: name, description, price" : "Columns: name, email, phone, address, consumption_type, call_frequency, assigned_rep_id"}</p>
                    <input type="file" accept=".xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
                </div>
                <Button onClick={() => setShowBulkUploadConfirmModal(true)} disabled={!uploadFile || uploadLoading} className="bg-purple-600 hover:bg-purple-700"><Upload className="h-4 w-4 mr-2" />{uploadLoading ? 'Uploading...' : `Upload ${uploadType}`}</Button>
            </div>
            {uploadResults && (<div className="mt-6 p-4 bg-gray-700 rounded-lg"><h4 className="text-white font-medium mb-2">Upload Results</h4><div className="space-y-2"><p className="text-green-400 flex items-center"><CheckCircle className="h-4 w-4 mr-2" />Successfully processed: {uploadResults.success}/{uploadResults.total}</p>{uploadResults.errors.length > 0 && (<div><p className="text-red-400 mb-1 flex items-center"><AlertCircle className="h-4 w-4 mr-2" />Errors:</p><ul className="text-sm text-gray-300 space-y-1 max-h-32 overflow-y-auto pl-5">{uploadResults.errors.slice(0, 10).map((error, index) => (<li key={index} className="list-disc">{error}</li>))}{uploadResults.errors.length > 10 && (<li>... and {uploadResults.errors.length - 10} more errors</li>)}</ul></div>)}</div></div>)}
        </div>
    );

    const renderReportsTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Analytics & Reports</h2><Button onClick={fetchReports} loading={reportsLoading} className="bg-purple-600 hover:bg-purple-700"><BarChart3 className="h-4 w-4 mr-2" />{reportsLoading ? 'Refreshing...' : 'Refresh Data'}</Button></div>
            {reportsLoading && !reportStats ? <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div><p className="mt-4 text-gray-400">Generating reports...</p></div> : null}
            {reportStats && (<>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex items-center"><Users className="h-8 w-8 text-blue-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Total Clients</p><p className="text-2xl font-semibold text-white">{reportStats.totalClients}</p></div></div>
                    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex items-center"><Package className="h-8 w-8 text-green-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Total Products</p><p className="text-2xl font-semibold text-white">{reportStats.totalProducts}</p></div></div>
                    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex items-center"><TrendingUp className="h-8 w-8 text-purple-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">New Products (30d)</p><p className="text-2xl font-semibold text-white">{reportStats.newProducts}</p></div></div>
                    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex items-center"><Calendar className="h-8 w-8 text-orange-400" /><div className="ml-4"><p className="text-sm font-medium text-gray-400">Visits Today</p><p className="text-2xl font-semibold text-white">{reportStats.visitsToday}</p></div></div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700"><h3 className="text-lg font-medium text-white mb-4">Visit Statistics</h3><div className="space-y-4"><div className="flex justify-between"><span className="text-gray-300">This Week</span><span className="text-white font-semibold">{reportStats.visitsWeek}</span></div><div className="flex justify-between"><span className="text-gray-300">This Month</span><span className="text-white font-semibold">{reportStats.visitsMonth}</span></div><div className="flex justify-between"><span className="text-gray-300">On-Consumption Clients</span><span className="text-white font-semibold">{reportStats.onConsumptionClients}</span></div><div className="flex justify-between"><span className="text-gray-300">Off-Consumption Clients</span><span className="text-white font-semibold">{reportStats.offConsumptionClients}</span></div></div></div>
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700"><h3 className="text-lg font-medium text-white mb-4">Rep Performance</h3><div className="space-y-3">{reportStats.repVisitStats.length > 0 ? reportStats.repVisitStats.slice(0, 5).map((rep) => (<div key={rep.rep_id} className="flex justify-between items-center"><div><p className="text-white font-medium">{rep.rep_name}</p><p className="text-sm text-gray-400">{rep.total_visits} visits</p></div><div className="text-right"><p className="text-purple-400 font-semibold">{rep.avg_duration_minutes}m</p><p className="text-xs text-gray-500">avg duration</p></div></div>)) : <p className="text-sm text-gray-500">No visit data available.</p>}</div></div>
                </div>
            </>)}
    </div>
    );

    // Main component render
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <header className="bg-gray-800 shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                        <p className="text-sm text-gray-400">Welcome, {userProfile?.full_name || 'Admin'}</p>
                    </div>
                    <Button onClick={signOut} variant="outline" size="sm"><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
                </div>
            </header>

            {/* Global Messages */}
            {error && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded animate-pulse">{error}</div></div>)}
            {success && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-green-800 border border-green-600 text-green-200 px-4 py-3 rounded animate-pulse">{success}</div></div>)}
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 border-b border-gray-700"><nav className="flex space-x-8"><button onClick={() => setActiveTab('overview')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Overview</button><button onClick={() => setActiveTab('reps')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reps' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Users</button><button onClick={() => setActiveTab('inventory')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'inventory' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Inventory</button><button onClick={() => setActiveTab('bulk-upload')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'bulk-upload' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Bulk Upload</button><button onClick={() => setActiveTab('reports')} className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Reports</button></nav></div>
                
                {/* Render active tab content */}
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'reps' && renderRepsTab()}
                {activeTab === 'inventory' && renderInventoryTab()}
                {activeTab === 'bulk-upload' && renderBulkUploadTab()}
                {activeTab === 'reports' && renderReportsTab()}
            </main>

            {/* Add Product Modal */}
            {showAddProductModal && (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"><div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700"><h3 className="text-lg font-medium text-white mb-4">Add New Product</h3><form onSubmit={handleAddProduct} className="space-y-4"><Input label="Product Name" type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /><div><label className="block text-sm font-medium text-gray-300 mb-1">Description</label><textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500" rows={3} required /></div><Input label="Price (R)" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /><div className="flex space-x-3 pt-4"><Button type="button" onClick={() => setShowAddProductModal(false)} variant="secondary" className="flex-1">Cancel</Button><Button type="submit" loading={productLoading} className="bg-purple-600 hover:bg-purple-700 flex-1">Add Product</Button></div></form></div></div>)}
            
            {/* Bulk Upload Confirmation Modal */}
            {showBulkUploadConfirmModal && (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"><div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700"><h3 className="text-lg font-medium text-white mb-2">Confirm Upload</h3><p className="text-sm text-gray-400 mb-4">Are you sure you want to upload {uploadFile?.name}? This will add new records to your database and cannot be undone.</p><div className="flex space-x-3 pt-4"><Button type="button" onClick={() => setShowBulkUploadConfirmModal(false)} variant="secondary" className="flex-1">Cancel</Button><Button onClick={triggerBulkUpload} className="bg-red-600 hover:bg-red-700 flex-1">Yes, Upload</Button></div></div></div>)}
        </div>
    );
};