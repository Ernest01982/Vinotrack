import React, { useState, useEffect, useCallback } from 'react';
import { Users, BarChart3, Wine, TrendingUp, Package, UserPlus, Mail, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { useUsers } from '../../hooks/useUsers';
import { useProducts } from '../../hooks/useProducts';
import type { UserProfile } from '../../types';

export const AdminDashboard: React.FC = () => {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    // Data hooks
    const { users: reps, loading: repsLoading, error: repsError, refetch: refetchReps } = useUsers();
    const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useProducts();

    // UI State
    const [inviteLoading, setInviteLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    
    // Form State
    const [productForm, setProductForm] = useState({ name: '', description: '', price: '' });
    const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'Rep' as 'Rep' | 'Admin' });

    // Bulk Upload State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState('Products');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadResults, setUploadResults] = useState<{ success: number; errors: string[]; total: number; } | null>(null);

    // Reports State
    const [reportStats, setReportStats] = useState<any | null>(null);
    const [reportsLoading, setReportsLoading] = useState(true);

    // Fetch reports on initial load and when the tab is active
    const fetchReports = useCallback(async () => {
        setReportsLoading(true);
        setError('');
        try {
            const { data, error } = await supabase.rpc('get_dashboard_analytics');
            if (error) throw error;
            setReportStats(data);
        } catch (err: any) {
            console.error('Error fetching reports:', err);
            setError('Failed to fetch reports. Ensure the database function is set up.');
        } finally {
            setReportsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'overview' || activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab, fetchReports]);


    useEffect(() => {
        if (repsError) setError(repsError);
        if (productsError) setError(productsError);
    }, [repsError, productsError]);

    const handleInviteRep = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setError('');
        setSuccess('');

        try {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(inviteForm.email)) throw new Error('Please enter a valid email address.');
            if (!inviteForm.fullName.trim()) throw new Error('Full name is required.');

            const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
                inviteForm.email,
                { data: { full_name: inviteForm.fullName, role: inviteForm.role } }
            );

            if (inviteError) throw inviteError;
            
            if (data.user && data.user.id) {
                 const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({ role: inviteForm.role, full_name: inviteForm.fullName })
                    .eq('id', data.user.id);
                
                if (profileUpdateError) {
                   console.error("Profile update failed:", profileUpdateError);
                   setError(`Invite sent to ${inviteForm.email}, but failed to update profile role. Please set it manually.`);
                } else {
                   setSuccess(`Invite sent successfully to ${inviteForm.email}!`);
                }
            }
            
            setInviteForm({ email: '', fullName: '', role: 'Rep' });
            refetchReps();
        } catch (err: any) {
            console.error('Invite error:', err);
            setError(err.message || 'Failed to send invite.');
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
            refetchProducts();
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
    
    // JSX Rendering functions for each tab
    const renderOverview = () => {
        const stats = [
            { name: 'Total Users', value: reps.length.toString(), icon: Users },
            { name: 'Total Products', value: products.length.toString(), icon: Wine },
            { name: 'Visits Today', value: reportStats?.visitsToday?.toString() ?? '...', icon: Calendar },
            { name: 'Active Reps', value: reps.filter(r => r.role === 'Rep').length.toString(), icon: Package },
        ];
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(stat => (
                    <div key={stat.name} className="bg-gray-800 rounded-lg p-6 flex items-center space-x-4">
                        <div className="bg-purple-600 bg-opacity-20 p-3 rounded-lg">
                            <stat.icon className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">{stat.name}</p>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>
            );
        };
    
    const renderRepsTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Manage Users</h3>
                {repsLoading ? <p>Loading users...</p> : (
                    <ul className="space-y-4">
                        {reps.map(rep => (
                            <li key={rep.id} className="flex justify-between items-center bg-gray-700 p-4 rounded-lg">
                                <div>
                                    <p className="font-medium text-white">{rep.full_name}</p>
                                    <p className="text-sm text-gray-400">{rep.email} - <span className="font-semibold">{rep.role}</span></p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Invite New User</h3>
                <form onSubmit={handleInviteRep} className="space-y-4">
                    <Input label="Full Name" value={inviteForm.fullName} onChange={e => setInviteForm({...inviteForm, fullName: e.target.value})} placeholder="e.g., Jane Doe" required />
                    <Input label="Email" type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} placeholder="e.g., rep@example.com" required />
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Role</label>
                        <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value as 'Rep' | 'Admin'})} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                            <option value="Rep">Rep</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                    <Button type="submit" loading={inviteLoading} className="w-full">
                        <Mail className="h-4 w-4 mr-2" /> Send Invite
                    </Button>
                </form>
            </div>
        </div>
    );
        
    const renderInventoryTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-white">Product Inventory</h3>
                <Button onClick={() => setShowAddProductModal(true)}>Add Product</Button>
            </div>
            {productsLoading ? <p>Loading products...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-gray-800 rounded-lg p-4">
                            <h4 className="font-bold text-white">{product.name}</h4>
                            <p className="text-gray-400 text-sm">{product.description}</p>
                            <p className="text-lg font-semibold text-purple-400 mt-2">R{product.price.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            )}
            {showAddProductModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-xl font-semibold text-white mb-4">Add New Product</h3>
                        <form onSubmit={handleAddProduct} className="space-y-4">
                            <Input label="Product Name" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                            <Input label="Description" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} required />
                            <Input label="Price" type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} required />
                            <div className="flex justify-end space-x-4">
                                <Button type="button" variant="secondary" onClick={() => setShowAddProductModal(false)}>Cancel</Button>
                                <Button type="submit" loading={productLoading}>Save Product</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
    
    const renderBulkUploadTab = () => (
        <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Bulk Upload</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300">Upload Type</label>
                    <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                        <option>Products</option>
                        <option>Clients</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Upload File (CSV or XLSX)</label>
                    <Input type="file" accept=".csv, .xlsx" onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                <Button onClick={handleFileUpload} loading={uploadLoading} disabled={!uploadFile}>
                    <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
            </div>
            {uploadResults && (
                <div className="mt-6">
                    <h4 className="font-semibold text-white">Upload Results</h4>
                    <p className="text-gray-300">Total Rows: {uploadResults.total}</p>
                    <p className="text-green-400">Successfully Uploaded: {uploadResults.success}</p>
                    {uploadResults.errors.length > 0 && (
                        <div>
                            <p className="text-red-400">Errors: {uploadResults.errors.length}</p>
                            <ul className="list-disc list-inside text-red-400 text-sm">
                                {uploadResults.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                                {uploadResults.errors.length > 10 && <li>...and {uploadResults.errors.length - 10} more.</li>}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
        
    const renderReportsTab = () => {
        if (reportsLoading) return <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div><p className="mt-4 text-gray-400">Loading reports...</p></div>;
        if (!reportStats) return <div className="text-center py-12"><AlertCircle className="mx-auto h-12 w-12 text-red-400" /><p className="mt-4 text-gray-400">Could not load report data.</p><Button onClick={fetchReports} className="mt-4">Try Again</Button></div>;

        return (
            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">High-Level Stats</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Total Clients</p><p className="text-3xl font-bold">{reportStats.totalClients}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Total Products</p><p className="text-3xl font-bold">{reportStats.totalProducts}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">On-Consumption</p><p className="text-3xl font-bold">{reportStats.onConsumptionVisits}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Off-Consumption</p><p className="text-3xl font-bold">{reportStats.offConsumptionVisits}</p></div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Visit Activity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Visits Today</p><p className="text-3xl font-bold">{reportStats.visitsToday}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Visits This Week</p><p className="text-3xl font-bold">{reportStats.visitsWeek}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg text-center"><p className="text-gray-400">Visits This Month</p><p className="text-3xl font-bold">{reportStats.visitsMonth}</p></div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Rep Performance</h3>
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rep Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Visits</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg. Duration (Mins)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {reportStats.repVisitStats.map((rep: any) => (
                                    <tr key={rep.rep_id} className="hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{rep.rep_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.total_visits}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{rep.avg_duration_minutes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };
    
    return (
        <div className="min-h-screen bg-gray-900">
            {error && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded">{error}</div></div>)}
            {success && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"><div className="bg-green-800 border border-green-600 text-green-200 px-4 py-3 rounded">{success}</div></div>)}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white">Admin Dashboard</h2>
                    <p className="text-gray-400">Welcome, {userProfile?.full_name}</p>
                </div>
                <div className="border-b border-gray-700 mb-8">
                    <nav className="flex space-x-8">
                        <button onClick={() => setActiveTab('overview')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Overview</button>
                        <button onClick={() => setActiveTab('reps')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reps' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Users</button>
                        <button onClick={() => setActiveTab('inventory')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'inventory' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Inventory</button>
                        <button onClick={() => setActiveTab('bulk-upload')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'bulk-upload' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Bulk Upload</button>
                        <button onClick={() => setActiveTab('reports')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}>Reports</button>
                    </nav>
                </div>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'reps' && renderRepsTab()}
                {activeTab === 'inventory' && renderInventoryTab()}
                {activeTab === 'bulk-upload' && renderBulkUploadTab()}
                {activeTab === 'reports' && renderReportsTab()}
            </main>
        </div>
    );
};