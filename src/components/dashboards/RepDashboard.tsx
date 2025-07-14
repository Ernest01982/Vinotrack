import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ActiveVisitScreen } from './ActiveVisitScreen';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { User, MapPin, Phone, Mail, Clock, PlusCircle, LogOut, AlertTriangle, CheckCircle, Star, X } from 'lucide-react';

// Type definitions
interface Client {
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

interface Visit {
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

const RepDashboard: React.FC = () => {
  const { user, userProfile, signOut } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locationError, setLocationError] = useState('');

  // State for the "Add Client" modal
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    consumption_type: 'on-consumption' as 'on-consumption' | 'off-consumption',
    call_frequency: 1,
  });
  const [addClientLoading, setAddClientLoading] = useState(false);

  // Fetch initial data on component mount
  useEffect(() => {
    if (user) {
      fetchClients(user.id);
      checkActiveVisit(user.id);
    }
  }, [user]);

  // Clear success/error messages after a delay
  useEffect(() => {
    if (success || error || locationError) {
        const timer = setTimeout(() => {
            setSuccess('');
            setError('');
            setLocationError('');
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [success, error, locationError]);


  const fetchClients = async (repId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, visits(start_time)')
        .eq('assigned_rep_id', repId)
        .order('name', { ascending: true });

      if (error) throw error;

      const clientsWithLastVisit = data.map(client => {
        const visits = (client.visits as any[]) || [];
        const last_visit_date = visits.length > 0
          ? visits.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0].start_time
          : undefined;
        return { ...client, last_visit_date };
      });

      setClients(clientsWithLastVisit);
    } catch (err: any) {
      setError('Failed to fetch clients.');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveVisit = async (repId: string) => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*, clients(*)')
        .eq('rep_id', repId)
        .is('end_time', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setActiveVisit(data as any);
        setSelectedClient((data as any).clients);
      }
    } catch (err: any) {
      console.error('Check active visit error:', err);
    }
  };

  const handleStartVisit = (client: Client) => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('visits')
            .insert({
              client_id: client.id,
              rep_id: user!.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            })
            .select('*, clients(*)')
            .single();

          if (error) throw error;

          setActiveVisit(data as any);
          setSelectedClient((data as any).clients);
        } catch (err: any) {
          setError('Failed to start visit.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLocationError('Geolocation error. Please enable location services.');
      }
    );
  };

  const handleEndVisit = async () => {
    if (!activeVisit) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('visits')
        .update({ end_time: new Date().toISOString() })
        .eq('id', activeVisit.id);

      if (error) throw error;

      setActiveVisit(null);
      setSelectedClient(null);
      if (user) fetchClients(user.id);
    } catch (err: any) {
      setError('Failed to end visit.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        setError("You must be logged in to add a client.");
        return;
    }
    setAddClientLoading(true);
    setError('');
    setSuccess('');

    try {
        if (!newClientForm.name.trim() || !newClientForm.email.trim()) {
            throw new Error("Client Name and Email are required.");
        }

        const { error } = await supabase.from('clients').insert({
            ...newClientForm,
            assigned_rep_id: user.id, // Assign client to the current rep
        });

        if (error) throw error;

        setSuccess(`Client "${newClientForm.name}" added successfully!`);
        setShowAddClientModal(false);
        setNewClientForm({
            name: '', email: '', phone: '', address: '',
            consumption_type: 'on-consumption', call_frequency: 1,
        });
        fetchClients(user.id); // Refresh the client list
    } catch (err: any) {
        if (err.message.includes('duplicate key')) {
            setError('A client with this email address already exists.');
        } else {
            setError(err.message || "Failed to add new client.");
        }
    } finally {
        setAddClientLoading(false);
    }
  };

  const prioritizedClients = useMemo(() => {
    const now = new Date();
    return clients
      .map(client => {
        const daysBetweenVisits = 30 / client.call_frequency;
        const lastVisit = client.last_visit_date ? new Date(client.last_visit_date) : null;
        let priority: 'high' | 'medium' | 'low' = 'low';
        let daysSinceLastVisit: number | null = null;

        if (lastVisit) {
          daysSinceLastVisit = (now.getTime() - lastVisit.getTime()) / (1000 * 3600 * 24);
          if (daysSinceLastVisit > daysBetweenVisits) {
            priority = 'high';
          } else if (daysSinceLastVisit > daysBetweenVisits * 0.75) {
            priority = 'medium';
          }
        } else {
          priority = 'high';
        }
        return { ...client, priority, daysSinceLastVisit };
      })
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return (b.daysSinceLastVisit || 999) - (a.daysSinceLastVisit || 999);
      });
  }, [clients]);

  if (activeVisit && selectedClient) {
    return (
      <ActiveVisitScreen
        visit={activeVisit}
        client={selectedClient}
        onEndVisit={handleEndVisit}
        onBack={() => {
          setActiveVisit(null);
          setSelectedClient(null);
        }}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">VinoTracker</h1>
              <p className="text-sm text-gray-400">Welcome, {userProfile?.full_name || user?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
                <Button onClick={() => setShowAddClientModal(true)} className="bg-purple-600 hover:bg-purple-700">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add New Client
                </Button>
                <Button onClick={signOut} variant="outline" size="sm">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {error && <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">{error}</div>}
            {success && <div className="bg-green-800 border border-green-600 text-green-200 px-4 py-3 rounded mb-6">{success}</div>}
            {locationError && <div className="bg-yellow-900 border border-yellow-700 text-yellow-100 px-4 py-3 rounded mb-6">{locationError}</div>}

            <h2 className="text-xl font-semibold mb-4">Your Clients ({clients.length})</h2>

            {loading ? (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-400">Loading clients...</p>
            </div>
            ) : (
            <div className="space-y-4">
                {prioritizedClients.map((client) => {
                const priorityStyles = {
                    high: { icon: <AlertTriangle className="h-5 w-5 text-red-400" />, text: 'High Priority', color: 'border-red-500' },
                    medium: { icon: <Star className="h-5 w-5 text-yellow-400" />, text: 'Medium Priority', color: 'border-yellow-500' },
                    low: { icon: <CheckCircle className="h-5 w-5 text-green-400" />, text: 'On Track', color: 'border-green-500' },
                };

                return (
                    <div key={client.id} className={`bg-gray-800 rounded-lg shadow-lg p-5 border-l-4 ${priorityStyles[client.priority].color} transition-all duration-300 hover:shadow-purple-500/20 hover:bg-gray-700`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex-1 mb-4 sm:mb-0">
                        <div className="flex items-center mb-2">
                            <h3 className="text-lg font-bold text-white mr-3">{client.name}</h3>
                            <span className="text-xs font-semibold px-2 py-1 bg-purple-600 rounded-full">{client.consumption_type}</span>
                        </div>
                        <div className="flex flex-wrap text-sm text-gray-400 gap-x-4 gap-y-1">
                            <span className="flex items-center"><Mail className="h-4 w-4 mr-2" />{client.email}</span>
                            {client.phone && <span className="flex items-center"><Phone className="h-4 w-4 mr-2" />{client.phone}</span>}
                            {client.address && <span className="flex items-center"><MapPin className="h-4 w-4 mr-2" />{client.address}</span>}
                        </div>
                        </div>
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end space-x-4">
                        <div className="text-right">
                            <div className="flex items-center justify-end text-sm font-medium">
                            {priorityStyles[client.priority].icon}
                            <span className="ml-1.5">{priorityStyles[client.priority].text}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                            {client.last_visit_date ? `Last visit: ${new Date(client.last_visit_date).toLocaleDateString()}` : 'No visits yet'}
                            </p>
                        </div>
                        <Button
                            onClick={() => handleStartVisit(client)}
                            disabled={!!activeVisit || loading}
                            className={`w-full sm:w-auto transition-all duration-200 hover:scale-105 ${
                            client.priority === 'high'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            } ${!!activeVisit || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <PlusCircle className="h-5 w-5 mr-2" />
                            Start Visit
                        </Button>
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
            )}
        </main>
      </div>

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 relative">
                <button onClick={() => setShowAddClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <X className="h-6 w-6" />
                </button>
                <h3 className="text-lg font-medium text-white mb-4">Add New Client</h3>
                <form onSubmit={handleAddNewClient} className="space-y-4">
                    <Input label="Client Name" type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} required />
                    <Input label="Email Address" type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} required />
                    <Input label="Phone Number" type="tel" value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} />
                    <Input label="Address" type="text" value={newClientForm.address} onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Consumption Type</label>
                            <select value={newClientForm.consumption_type} onChange={(e) => setNewClientForm({ ...newClientForm, consumption_type: e.target.value as any })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option value="on-consumption">On-Consumption</option>
                                <option value="off-consumption">Off-Consumption</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Call Frequency (per month)</label>
                            <select value={newClientForm.call_frequency} onChange={(e) => setNewClientForm({ ...newClientForm, call_frequency: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" onClick={() => setShowAddClientModal(false)} variant="secondary">Cancel</Button>
                        <Button type="submit" loading={addClientLoading} className="bg-purple-600 hover:bg-purple-700">Add Client</Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </>
  );
};

export default RepDashboard;