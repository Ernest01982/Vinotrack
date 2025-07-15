import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ActiveVisitScreen } from './ActiveVisitScreen';
import { Button } from '../ui/Button';
import { User, MapPin, Phone, Mail, Clock, PlusCircle, LogOut, AlertTriangle, CheckCircle, ChevronRight, Star } from 'lucide-react';
import type { Client, Visit } from '../../types';

const RepDashboard: React.FC = () => {
  const { user, userProfile, signOut } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');

  // Fetch initial data on component mount
  useEffect(() => {
    if (user) {
      fetchClients(user.id);
      checkActiveVisit(user.id);
    }
  }, [user]);

  // Fetch clients assigned to the current rep
  const fetchClients = async (repId: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, visits(start_time)')
        .eq('assigned_rep_id', repId);

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
      console.error('Fetch clients error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check for an existing active visit
  const checkActiveVisit = async (repId: string) => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*, clients(*)')
        .eq('rep_id', repId)
        .is('end_time', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "No rows found"

      if (data) {
        setActiveVisit(data as any);
        setSelectedClient((data as any).clients);
      }
    } catch (err: any) {
      setError('Failed to check for active visits.');
      console.error('Check active visit error:', err);
    }
  };

  // Start a new visit
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
            .select()
            .single();

          if (error) throw error;

          setActiveVisit(data);
          setSelectedClient(client);
        } catch (err: any) {
          setError('Failed to start visit.');
          console.error('Start visit error:', err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLocationError(`Geolocation error: ${err.message}. Please enable location services.`);
        console.error('Geolocation error:', err);
      }
    );
  };

  // End the current visit
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
      if (user) fetchClients(user.id); // Refresh client list to update visit status
    } catch (err: any) {
      setError('Failed to end visit.');
      console.error('End visit error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client prioritization logic
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
          priority = 'high'; // New clients are high priority
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

  // Render active visit screen
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

  // Main dashboard view
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">VinoTracker</h1>
            <p className="text-sm text-gray-400">Welcome, {userProfile?.full_name || user?.email}</p>
          </div>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">{error}</div>}
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
  );
};

export default RepDashboard;
