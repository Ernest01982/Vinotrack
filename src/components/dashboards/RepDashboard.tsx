import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ActiveVisitScreen } from './ActiveVisitScreen';
import { Button } from '../ui/Button';
import { User, MapPin, Phone, Mail, Clock, PlusCircle, LogOut, AlertTriangle, CheckCircle, Star, BarChart3, Calendar, TrendingUp } from 'lucide-react';

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

interface RepStats {
  totalClients: number;
  visitsToday: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
  highPriorityClients: number;
}

const RepDashboard: React.FC = () => {
  const { user, userProfile, signOut } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [stats, setStats] = useState<RepStats>({
    totalClients: 0,
    visitsToday: 0,
    visitsThisWeek: 0,
    visitsThisMonth: 0,
    highPriorityClients: 0
  });

  // Fetch initial data on component mount
  useEffect(() => {
    if (user) {
      fetchClients(user.id);
      checkActiveVisit(user.id);
      fetchRepStats(user.id);
    }
  }, [user]);

  // Fetch clients assigned to the current rep
  const fetchClients = async (repId: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          visits!visits_client_id_fkey(start_time, end_time)
        `)
        .eq('assigned_rep_id', repId)
        .order('name');

      if (error) throw error;

      const clientsWithLastVisit = data.map(client => {
        const visits = (client.visits as any[]) || [];
        const completedVisits = visits.filter(v => v.end_time);
        const last_visit_date = completedVisits.length > 0
          ? completedVisits.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0].start_time
          : undefined;
        return { ...client, last_visit_date };
      });

      setClients(clientsWithLastVisit);
    } catch (err: any) {
      console.error('Fetch clients error:', err);
      if (err.message?.includes('permission denied') || err.message?.includes('RLS')) {
        setError('You do not have permission to view clients. Please contact your administrator.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(`Failed to load clients: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check for an existing active visit
  const checkActiveVisit = async (repId: string) => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          clients(*)
        `)
        .eq('rep_id', repId)
        .is('end_time', null)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "No rows found"

      if (data) {
        setActiveVisit(data as any);
        setSelectedClient((data as any).clients);
      }
    } catch (err: any) {
      console.error('Check active visit error:', err);
      // Don't show error for this as it's not critical
    }
  };

  // Fetch rep statistics
  const fetchRepStats = async (repId: string) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [clientsRes, visitsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, call_frequency')
          .eq('assigned_rep_id', repId),
        supabase
          .from('visits')
          .select('start_time, end_time')
          .eq('rep_id', repId)
          .not('end_time', 'is', null)
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (visitsRes.error) throw visitsRes.error;

      const visits = visitsRes.data || [];
      const visitsToday = visits.filter(v => new Date(v.start_time) >= today).length;
      const visitsThisWeek = visits.filter(v => new Date(v.start_time) >= weekAgo).length;
      const visitsThisMonth = visits.filter(v => new Date(v.start_time) >= monthAgo).length;

      setStats({
        totalClients: clientsRes.data?.length || 0,
        visitsToday,
        visitsThisWeek,
        visitsThisMonth,
        highPriorityClients: 0 // Will be calculated in prioritizedClients
      });
    } catch (err: any) {
      console.error('Fetch stats error:', err);
      // Don't show error for stats as it's not critical
    }
  };

  // Start a new visit
  const handleStartVisit = (client: Client) => {
    setLocationError('');
    setError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please use a modern browser with location services.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    };

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
              start_time: new Date().toISOString()
            })
            .select(`
              *,
              clients(*)
            `)
            .single();

          if (error) throw error;

          setActiveVisit(data);
          setSelectedClient((data as any).clients);
          
          // Log activity
          await supabase.from('activity_log').insert({
            type: 'VISIT_STARTED',
            message: `Started visit with ${client.name}`
          }).catch(() => {}); // Don't fail if activity log fails

        } catch (err: any) {
          console.error('Start visit error:', err);
          if (err.message?.includes('permission denied') || err.message?.includes('RLS')) {
            setError('You do not have permission to start visits. Please contact your administrator.');
          } else if (err.message?.includes('foreign key')) {
            setError('Invalid client or user data. Please refresh the page and try again.');
          } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
            setError('Network error. Please check your internet connection and try again.');
          } else {
            setError(`Failed to start visit: ${err.message || 'Unknown error'}`);
          }
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        let errorMessage = 'Location access failed. ';
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage += 'Please enable location permissions in your browser settings and try again.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable. Please check your GPS settings.';
            break;
          case err.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'Please enable location services and try again.';
            break;
        }
        
        setLocationError(errorMessage);
      },
      options
    );
  };

  // End the current visit
  const handleEndVisit = async () => {
    if (!activeVisit) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('visits')
        .update({ end_time: new Date().toISOString() })
        .eq('id', activeVisit.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_log').insert({
        type: 'VISIT_ENDED',
        message: `Ended visit with ${selectedClient?.name || 'client'}`
      }).catch(() => {}); // Don't fail if activity log fails

      setActiveVisit(null);
      setSelectedClient(null);
      
      // Refresh data
      if (user) {
        await Promise.all([
          fetchClients(user.id),
          fetchRepStats(user.id)
        ]);
      }
      
    } catch (err: any) {
      console.error('End visit error:', err);
      if (err.message?.includes('permission denied') || err.message?.includes('RLS')) {
        setError('You do not have permission to end visits. Please contact your administrator.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(`Failed to end visit: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Client prioritization logic
  const prioritizedClients = useMemo(() => {
    const now = new Date();
    const prioritized = clients
      .map(client => {
        const daysBetweenVisits = 30 / client.call_frequency;
        const lastVisit = client.last_visit_date ? new Date(client.last_visit_date) : null;
        let priority: 'high' | 'medium' | 'low' = 'low';
        let daysSinceLastVisit: number | null = null;

        if (lastVisit) {
          daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 3600 * 24));
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

    // Update high priority count in stats
    const highPriorityCount = prioritized.filter(c => c.priority === 'high').length;
    setStats(prev => ({ ...prev, highPriorityClients: highPriorityCount }));

    return prioritized;
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
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">VinoTracker</h1>
            <p className="text-sm text-gray-400">Welcome, {userProfile?.full_name || user?.email}</p>
          </div>
          <Button onClick={signOut} variant="outline" size="sm" className="hover:bg-gray-700">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Messages */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
        {locationError && (
          <div className="bg-yellow-900 border border-yellow-700 text-yellow-100 px-4 py-3 rounded mb-6 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            {locationError}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-gray-800 overflow-hidden shadow-lg rounded-lg border border-gray-700">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0 bg-blue-600/20 p-3 rounded-lg">
                <User className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-400 truncate">Total Clients</dt>
                <dd className="text-2xl font-bold text-white">{stats.totalClients}</dd>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 overflow-hidden shadow-lg rounded-lg border border-gray-700">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0 bg-green-600/20 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-400 truncate">Visits Today</dt>
                <dd className="text-2xl font-bold text-white">{stats.visitsToday}</dd>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 overflow-hidden shadow-lg rounded-lg border border-gray-700">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0 bg-purple-600/20 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-400 truncate">This Week</dt>
                <dd className="text-2xl font-bold text-white">{stats.visitsThisWeek}</dd>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 overflow-hidden shadow-lg rounded-lg border border-gray-700">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0 bg-red-600/20 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-400 truncate">High Priority</dt>
                <dd className="text-2xl font-bold text-white">{stats.highPriorityClients}</dd>
              </div>
            </div>
          </div>
        </div>

        {/* Active Visit Banner */}
        {activeVisit && (
          <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>Active visit in progress with {selectedClient?.name}</span>
            </div>
            <Button
              onClick={handleEndVisit}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              End Visit
            </Button>
          </div>
        )}

        {/* Clients Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            Your Clients ({clients.length})
          </h2>
          {activeVisit && (
            <div className="text-sm text-gray-400">
              Visit in progress - complete current visit to start another
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No clients assigned</p>
            <p className="text-gray-500 text-sm mt-2">Contact your administrator to get clients assigned to you</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prioritizedClients.map((client) => {
              const priorityStyles = {
                high: { 
                  icon: <AlertTriangle className="h-5 w-5 text-red-400" />, 
                  text: 'High Priority', 
                  color: 'border-red-500',
                  bgColor: 'bg-red-900/20'
                },
                medium: { 
                  icon: <Star className="h-5 w-5 text-yellow-400" />, 
                  text: 'Medium Priority', 
                  color: 'border-yellow-500',
                  bgColor: 'bg-yellow-900/20'
                },
                low: { 
                  icon: <CheckCircle className="h-5 w-5 text-green-400" />, 
                  text: 'On Track', 
                  color: 'border-green-500',
                  bgColor: 'bg-green-900/20'
                },
              };

              const style = priorityStyles[client.priority];

              return (
                <div 
                  key={client.id} 
                  className={`bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 ${style.color} transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:bg-gray-750`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <h3 className="text-lg font-bold text-white mr-3">{client.name}</h3>
                        <span className="text-xs font-semibold px-3 py-1 bg-purple-600 rounded-full text-white">
                          {client.consumption_type === 'on-consumption' ? 'On-Consumption' : 'Off-Consumption'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-purple-400 flex-shrink-0" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.address && (
                          <div className="flex items-center md:col-span-2">
                            <MapPin className="h-4 w-4 mr-2 text-purple-400 flex-shrink-0" />
                            <span className="truncate">{client.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto">
                      <div className={`${style.bgColor} rounded-lg p-3 text-center lg:text-right`}>
                        <div className="flex items-center justify-center lg:justify-end text-sm font-medium mb-1">
                          {style.icon}
                          <span className="ml-1.5">{style.text}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {client.last_visit_date 
                            ? `Last visit: ${new Date(client.last_visit_date).toLocaleDateString()}` 
                            : 'No visits yet'
                          }
                        </p>
                        {client.daysSinceLastVisit !== null && (
                          <p className="text-xs text-gray-500 mt-1">
                            {client.daysSinceLastVisit} days ago
                          </p>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => handleStartVisit(client)}
                        disabled={!!activeVisit || loading}
                        className={`w-full lg:w-auto transition-all duration-200 hover:scale-105 ${
                          client.priority === 'high'
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25'
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