import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  Clock,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPinIcon,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ActiveVisitScreen } from './ActiveVisitScreen';
import { Button } from '../ui/Button';

// ... (interfaces remain the same)

const RepDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    consumption_type: 'on-consumption' as 'on-consumption' | 'off-consumption',
    call_frequency: 1
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stats = [
    { name: 'Total Clients', value: clients.length.toString(), change: '+12%', icon: Users },
    { name: 'Visits This Month', value: visits.length.toString(), change: '+8%', icon: MapPin },
    { name: 'Orders This Month', value: orders.length.toString(), change: '+23%', icon: Calendar },
   { name: 'Revenue This Month', value: `R ${orders.reduce((sum, order) => sum + Number(order.total_amount), 0).toLocaleString()}`, change: '+15%', icon: TrendingUp },
  ];

  const fetchData = useCallback(async () => {
    if (!userProfile?.id) {
      setClients([]);
      setVisits([]);
      setOrders([]);
      setProducts([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('assigned_rep_id', userProfile.id);

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*, clients(*)')
        .eq('rep_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('rep_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;
      setProducts(productsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  const checkForActiveVisit = useCallback(async () => {
    if (!userProfile?.id) {
      setActiveVisit(null);
      setActiveClient(null);
      return;
    }
    
    try {
      const { data: activeVisits, error } = await supabase
        .from('visits')
        .select('*, clients(*)')
        .eq('rep_id', userProfile.id)
        .is('end_time', null);

      if (error) throw error;

      if (activeVisits && activeVisits.length > 0) {
        const visit = activeVisits[0];
        setActiveVisit(visit);
        setActiveClient(visit.clients as Client);
      } else {
        setActiveVisit(null);
        setActiveClient(null);
      }
    } catch (error) {
      console.error('Error checking for active visit:', error);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    fetchData();
    checkForActiveVisit();
  }, [fetchData, checkForActiveVisit]);
  
  // ... (The rest of the RepDashboard.tsx file remains the same)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('rep_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;
      setProducts(productsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startVisit = async (client: Client) => {
    if (!userProfile?.id) {
      alert('Cannot start visit in testing mode - user profile not available');
      return;
    }
    
    try {
      let latitude, longitude;
      
      // Try to get current location
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.warn('Could not get location:', geoError);
        }
      }

      const { data: visit, error } = await supabase
        .from('visits')
        .insert({
          client_id: client.id,
          rep_id: userProfile.id,
          latitude,
          longitude,
          start_time: new Date().toISOString()
        })
        .select('*, clients(*)')
        .single();

      if (error) throw error;

      setActiveVisit(visit);
      setActiveClient(client);
    } catch (error) {
      console.error('Error starting visit:', error);
    }
  };

  const endVisit = async () => {
    if (!activeVisit) return;

    try {
      const { error } = await supabase
        .from('visits')
        .update({ end_time: new Date().toISOString() })
        .eq('id', activeVisit.id);

      if (error) throw error;

      setActiveVisit(null);
      setActiveClient(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error ending visit:', error);
    }
  };

  const getClientPriority = (client: Client) => {
    const lastVisit = visits.find(v => v.client_id === client.id && v.end_time);
    if (!lastVisit) return 'high';
    
    const daysSinceLastVisit = Math.floor(
      (Date.now() - new Date(lastVisit.end_time!).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const expectedDays = Math.floor(30 / client.call_frequency);
    
    if (daysSinceLastVisit > expectedDays + 7) return 'high';
    if (daysSinceLastVisit > expectedDays) return 'medium';
    return 'low';
  };

  const getNextScheduledClient = () => {
    const clientsWithPriority = clients.map(client => ({
      ...client,
      priority: getClientPriority(client)
    }));
    
    const highPriorityClients = clientsWithPriority.filter(c => c.priority === 'high');
    if (highPriorityClients.length > 0) {
      return highPriorityClients[0];
    }
    
    const mediumPriorityClients = clientsWithPriority.filter(c => c.priority === 'medium');
    if (mediumPriorityClients.length > 0) {
      return mediumPriorityClients[0];
    }
    
    return clientsWithPriority[0];
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (priorityFilter === 'all') return matchesSearch;
    
    const priority = getClientPriority(client);
    return matchesSearch && priority === priorityFilter;
  });

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!newClientForm.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!newClientForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(newClientForm.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Check for duplicate email
    if (clients.some(client => client.email.toLowerCase() === newClientForm.email.toLowerCase())) {
      errors.email = 'A client with this email already exists';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (!userProfile?.id) {
      alert('Cannot add client in testing mode - user profile not available');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: newClientForm.name.trim(),
          email: newClientForm.email.toLowerCase().trim(),
          phone: newClientForm.phone.trim() || null,
          address: newClientForm.address.trim() || null,
          consumption_type: newClientForm.consumption_type,
          call_frequency: newClientForm.call_frequency,
          assigned_rep_id: userProfile.id
        })
        .select()
        .single();

      if (error) throw error;

      // Reset form and close modal
      setNewClientForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        consumption_type: 'on-consumption',
        call_frequency: 1
      });
      setFormErrors({});
      setShowAddClientModal(false);
      
      // Refresh clients list
      fetchData();
      
    } catch (error) {
      console.error('Error adding client:', error);
      setFormErrors({ submit: 'Failed to add client. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If there's an active visit, show the active visit screen
  if (activeVisit && activeClient) {
    return (
      <ActiveVisitScreen
        visit={activeVisit}
        client={activeClient}
        onEndVisit={endVisit}
        onBack={() => {
          setActiveVisit(null);
          setActiveClient(null);
        }}
      />
    );
  }

  const renderOverview = () => (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.name}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-green-400">{stat.change}</p>
                </div>
                <div className="bg-purple-600 bg-opacity-20 p-3 rounded-lg">
                  <Icon className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Priority Clients and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Priority Clients */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Priority Clients</h3>
          <div className="space-y-3">
            {clients
              .filter(client => getClientPriority(client) === 'high')
              .slice(0, 5)
              .map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{client.name}</p>
                    <p className="text-sm text-gray-400">{client.email}</p>
                  </div>
                  <Button
                    onClick={() => startVisit(client)}
                    disabled={!!activeVisit}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm"
                  >
                    Visit
                  </Button>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {visits.slice(0, 5).map((visit) => (
              <div key={visit.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                <div className="bg-blue-600 bg-opacity-20 p-2 rounded-lg">
                  <MapPin className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{visit.clients?.name}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(visit.start_time).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {visit.end_time ? 'Completed' : 'In Progress'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => {
              const nextClient = getNextScheduledClient();
              if (nextClient) startVisit(nextClient);
            }}
            disabled={!!activeVisit || clients.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105"
          >
            <Clock className="h-5 w-5" />
            <span>Next Scheduled Visit</span>
          </Button>
          
          <Button
            onClick={() => setShowAddClientModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            <span>Add New Client</span>
          </Button>
          
          <Button
            onClick={fetchData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105"
          >
            <TrendingUp className="h-5 w-5" />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>
    </>
  );

  const renderClients = () => (
    <>
      {/* Search and Filter Bar */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="pl-10 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            
            <Button
              onClick={() => setShowAddClientModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              <span>Add Client</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const priority = getClientPriority(client);
          const priorityColors = {
            high: 'border-red-500 bg-red-500 bg-opacity-10',
            medium: 'border-yellow-500 bg-yellow-500 bg-opacity-10',
            low: 'border-green-500 bg-green-500 bg-opacity-10'
          };
          
          return (
            <div key={client.id} className={`bg-gray-800 rounded-lg p-6 border-2 ${priorityColors[priority]}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{client.name}</h3>
                  <p className="text-sm text-gray-400 capitalize">{priority} Priority</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  client.consumption_type === 'on-consumption' 
                    ? 'bg-blue-600 bg-opacity-20 text-blue-400' 
                    : 'bg-purple-600 bg-opacity-20 text-purple-400'
                }`}>
                  {client.consumption_type === 'on-consumption' ? 'On-Consumption' : 'Off-Consumption'}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <Mail className="h-4 w-4" />
                  <span>{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <MapPinIcon className="h-4 w-4" />
                    <span>{client.address}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <Calendar className="h-4 w-4" />
                  <span>{client.call_frequency}x per month</span>
                </div>
              </div>
              
              <Button
                onClick={() => startVisit(client)}
                disabled={!!activeVisit}
                className={`w-full py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 ${
                  priority === 'high' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                } ${!!activeVisit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Start Visit
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderVisits = () => (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Visit History</h3>
      </div>
      <div className="divide-y divide-gray-700">
        {visits.map((visit) => (
          <div key={visit.id} className="p-6 hover:bg-gray-750 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-600 bg-opacity-20 p-3 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{visit.clients?.name}</h4>
                  <p className="text-sm text-gray-400">{visit.clients?.email}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(visit.start_time).toLocaleString()}
                    {visit.end_time && ` - ${new Date(visit.end_time).toLocaleString()}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  visit.end_time 
                    ? 'bg-green-600 bg-opacity-20 text-green-400' 
                    : 'bg-yellow-600 bg-opacity-20 text-yellow-400'
                }`}>
                  {visit.end_time ? 'Completed' : 'In Progress'}
                </span>
                {visit.notes && (
                  <p className="text-sm text-gray-400 mt-2 max-w-xs">{visit.notes}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Order History</h3>
      </div>
      <div className="divide-y divide-gray-700">
        {orders.map((order) => (
          <div key={order.id} className="p-6 hover:bg-gray-750 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white">Order #{order.id.slice(0, 8)}</h4>
                <p className="text-sm text-gray-400">
                  {new Date(order.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-400">
                  {order.items.length} items
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-white">
                  ${Number(order.total_amount).toFixed(2)}
                </p>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-600 bg-opacity-20 text-green-400">
                  Completed
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Rep Dashboard</h1>
            <p className="text-gray-400">Welcome back, {userProfile?.full_name || userProfile?.email}</p>
          </div>
          {activeVisit && (
            <div className="bg-red-600 bg-opacity-20 border border-red-600 rounded-lg px-4 py-2">
              <p className="text-red-400 font-medium">Active Visit in Progress</p>
              <p className="text-red-300 text-sm">{activeClient?.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'clients', label: 'Clients' },
            { id: 'visits', label: 'Visits' },
            { id: 'orders', label: 'Orders' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'clients' && renderClients()}
        {activeTab === 'visits' && renderVisits()}
        {activeTab === 'orders' && renderOrders()}
      </div>

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Client</h3>
              <button
                onClick={() => {
                  setShowAddClientModal(false);
                  setFormErrors({});
                  setNewClientForm({
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                    consumption_type: 'on-consumption',
                    call_frequency: 1
                  });
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Client name"
                />
                {formErrors.name && (
                  <p className="text-red-400 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="client@example.com"
                />
                {formErrors.email && (
                  <p className="text-red-400 text-sm mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Business Type
                </label>
                <select
                  value={newClientForm.consumption_type}
                  onChange={(e) => setNewClientForm({ 
                    ...newClientForm, 
                    consumption_type: e.target.value as 'on-consumption' | 'off-consumption'
                  })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="on-consumption">On-Consumption (Restaurant/Bar)</option>
                  <option value="off-consumption">Off-Consumption (Retail/Store)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Visit Frequency (per month)
                </label>
                <select
                  value={newClientForm.call_frequency}
                  onChange={(e) => setNewClientForm({ 
                    ...newClientForm, 
                    call_frequency: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={1}>1 time per month</option>
                  <option value={2}>2 times per month</option>
                  <option value={3}>3 times per month</option>
                  <option value={4}>4 times per month</option>
                </select>
              </div>

              {formErrors.submit && (
                <p className="text-red-400 text-sm">{formErrors.submit}</p>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddClientModal(false);
                    setFormErrors({});
                    setNewClientForm({
                      name: '',
                      email: '',
                      phone: '',
                      address: '',
                      consumption_type: 'on-consumption',
                      call_frequency: 1
                    });
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Client'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepDashboard;