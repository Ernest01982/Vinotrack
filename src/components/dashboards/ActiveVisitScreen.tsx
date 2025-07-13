import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Clock, Save, FileText, History, ShoppingCart, Plus, Minus, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ... (The rest of the component remains the same)

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  assigned_rep_id: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  created_at: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  total: number;
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

interface ActiveVisitScreenProps {
  visit: Visit;
  client: Client;
  onEndVisit: () => void;
  onBack: () => void;
}

export const ActiveVisitScreen: React.FC<ActiveVisitScreenProps> = ({
  visit,
  client,
  onEndVisit,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState(visit.notes || '');
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Order tab state
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Auto-save notes every 3 seconds when typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes !== (visit.notes || '')) {
        handleSaveNotes();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [notes]);

  // Fetch visit history when component mounts or tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchVisitHistory();
    } else if (activeTab === 'order') {
      fetchProducts();
    }
  }, [activeTab, client.id]);

  const fetchVisitHistory = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', client.id)
        .neq('id', visit.id) // Exclude current visit
        .order('start_time', { ascending: false });

      if (error) throw error;
      setVisitHistory(data || []);
    } catch (err: any) {
      setError('Failed to fetch visit history');
      console.error('Error fetching visit history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all products for order tab
  const fetchProducts = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      setError('Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update quantity for a product
  const updateQuantity = (product: Product, quantity: number) => {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      setOrderItems(prev => prev.filter(item => item.product_id !== product.id));
    } else {
      const total = product.price * quantity;
      const orderItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        total
      };

      setOrderItems(prev => {
        const existingIndex = prev.findIndex(item => item.product_id === product.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = orderItem;
          return updated;
        } else {
          return [...prev, orderItem];
        }
      });
    }
  };

  // Get quantity for a specific product
  const getQuantity = (productId: string): number => {
    const item = orderItems.find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  };

  // Calculate order total
  const getOrderTotal = (): number => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Generate PDF
  const generatePDF = (orderData: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 128); // Purple color
    doc.text('VINO TRACKER', 20, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Order Confirmation', 20, 35);
    
    // Order details
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderData.id}`, 20, 50);
    doc.text(`Date: ${new Date(orderData.created_at).toLocaleDateString()}`, 20, 60);
    doc.text(`Time: ${new Date(orderData.created_at).toLocaleTimeString()}`, 20, 70);
    
    // Client information
    doc.setFontSize(14);
    doc.text('Client Information:', 20, 90);
    doc.setFontSize(12);
    doc.text(`Name: ${client.name}`, 20, 105);
    doc.text(`Email: ${client.email}`, 20, 115);
    if (client.phone) doc.text(`Phone: ${client.phone}`, 20, 125);
    if (client.address) doc.text(`Address: ${client.address}`, 20, 135);
    
    // Representative information
    doc.setFontSize(14);
    doc.text('Sales Representative:', 120, 90);
    doc.setFontSize(12);
    doc.text(`Rep ID: ${visit.rep_id}`, 120, 105);
    
    // Order items table
    const tableData = orderItems.map(item => [
      item.product_name,
      item.quantity.toString(),
      `R${item.price.toFixed(2)}`,
      `R${item.total.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['Product', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      startY: 150,
      theme: 'grid',
      headStyles: { fillColor: [128, 0, 128] }, // Purple header
      styles: { fontSize: 10 }
    });
    
    // Order total
    const finalY = (doc as any).lastAutoTable?.finalY || 170;
    doc.setFontSize(14);
    doc.text(`Order Total: R${getOrderTotal().toFixed(2)}`, 20, finalY + 10);
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for your business!', 20, finalY + 20);
    doc.text('Generated by Vino Tracker', 20, finalY + 30);
    
    // Download the PDF
    doc.save(`Order_${orderData.id}_${client.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Place order and generate PDF
  const handlePlaceOrder = async () => {
    if (orderItems.length === 0) {
      setError('Please add items to your order before placing it');
      return;
    }

    setPdfLoading(true);
    setError('');

    try {
      // Create order record
      const orderData = {
        client_id: client.id,
        rep_id: visit.rep_id,
        visit_id: visit.id,
        total_amount: getOrderTotal(),
        items: orderItems,
        created_at: new Date().toISOString()
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Generate and download PDF
      generatePDF(order);

      // Clear order items after successful placement
      setOrderItems([]);
      
      // Show success message
      alert('Order placed successfully! PDF has been downloaded.');
      
    } catch (err: any) {
      setError('Failed to place order');
      console.error('Error placing order:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaveLoading(true);
    setError('');
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('visits')
        .update({ notes })
        .eq('id', visit.id);

      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      setError('Failed to save notes');
      console.error('Error saving notes:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEndVisit = async () => {
    setEndLoading(true);
    setError('');

    try {
      // Save any unsaved notes first
      if (notes !== (visit.notes || '')) {
        await handleSaveNotes();
      }

      // End the visit
      const { error } = await supabase
        .from('visits')
        .update({ 
          end_time: new Date().toISOString(),
          notes 
        })
        .eq('id', visit.id);

      if (error) throw error;
      
      onEndVisit();
    } catch (err: any) {
      setError('Failed to end visit');
      console.error('Error ending visit:', err);
    } finally {
      setEndLoading(false);
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minutes`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const renderNotesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Visit Notes</h3>
        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <span className="text-green-400 text-sm flex items-center">
              <Save className="h-4 w-4 mr-1" />
              Saved
            </span>
          )}
          <Button
            onClick={handleSaveNotes}
            loading={saveLoading}
            size="sm"
            variant="outline"
            className="transition-all duration-200 hover:scale-105"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Notes
          </Button>
        </div>
      </div>
      
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter your visit notes here... (auto-saves every 3 seconds)"
        className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
      />
      
      <div className="text-xs text-gray-400">
        Notes are automatically saved every 3 seconds while typing
      </div>
    </div>
  );

  const renderOrderTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Place Order</h3>
        {orderItems.length > 0 && (
          <div className="text-right">
            <p className="text-sm text-gray-400">Order Total</p>
            <p className="text-xl font-bold text-green-400">R{getOrderTotal().toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Order Summary */}
      {orderItems.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
          <h4 className="text-white font-medium mb-3">Order Summary ({orderItems.length} items)</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {orderItems.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center text-sm">
                <span className="text-gray-300">{item.product_name}</span>
                <span className="text-white">
                  {item.quantity} × R{item.price.toFixed(2)} = R{item.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-600 mt-3 pt-3 flex justify-between items-center">
            <Button
              onClick={handlePlaceOrder}
              loading={pdfLoading}
              className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105"
              disabled={orderItems.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Place Order & Generate PDF
            </Button>
            <span className="text-lg font-bold text-green-400">
              Total: R{getOrderTotal().toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Available Products</h4>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => {
              const quantity = getQuantity(product.id);
              return (
                <div key={product.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="text-white font-medium text-lg mb-1">{product.name}</h5>
                      <p className="text-gray-300 text-sm mb-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400 font-bold text-lg">R{product.price.toFixed(2)}</span>
                        {quantity > 0 && (
                          <span className="text-purple-400 text-sm">
                            (R{(product.price * quantity).toFixed(2)} total)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => updateQuantity(product, quantity - 1)}
                          size="sm"
                          variant="outline"
                          disabled={quantity <= 0}
                          className="transition-all duration-200 hover:scale-110"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="text-white font-medium min-w-[2rem] text-center">
                          {quantity}
                        </span>
                        
                        <Button
                          onClick={() => updateQuantity(product, quantity + 1)}
                          size="sm"
                          variant="outline"
                          className="transition-all duration-200 hover:scale-110"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Visit History</h3>
        <Button
          onClick={fetchVisitHistory}
          loading={loading}
          size="sm"
          variant="outline"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading visit history...</p>
        </div>
      ) : visitHistory.length === 0 ? (
        <div className="text-center py-8">
          <History className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No previous visits found</p>
          <p className="text-sm text-gray-500 mt-2">This is the first visit with {client.name}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitHistory.map((historyVisit) => (
            <div key={historyVisit.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-600 bg-opacity-20 p-2 rounded-lg">
                    <Calendar className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {new Date(historyVisit.start_time).toLocaleDateString()}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(historyVisit.start_time).toLocaleTimeString()}
                      </span>
                      {historyVisit.end_time && (
                        <span>
                          Duration: {formatDuration(historyVisit.start_time, historyVisit.end_time)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!historyVisit.end_time && (
                  <span className="bg-yellow-600 bg-opacity-20 text-yellow-400 px-2 py-1 rounded text-xs">
                    Incomplete
                  </span>
                )}
              </div>
              
              {historyVisit.notes ? (
                <div className="bg-gray-800 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <FileText className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-300">Notes</span>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{historyVisit.notes}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">No notes recorded for this visit</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button
                onClick={onBack}
                variant="outline"
                size="sm"
                className="transition-all duration-200 hover:scale-105"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Active Visit</h1>
                <p className="text-sm text-gray-400">
                  Started at {new Date(visit.start_time).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <Button
              onClick={handleEndVisit}
              loading={endLoading}
              className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105"
            >
              End Visit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Client Information */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-600 bg-opacity-20 p-2 rounded-lg">
              <User className="h-5 w-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Client Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">{client.name}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-gray-300">
                  <Mail className="h-4 w-4 mr-3 text-purple-400" />
                  <span>{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center text-gray-300">
                    <Phone className="h-4 w-4 mr-3 text-purple-400" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center text-gray-300">
                    <MapPin className="h-4 w-4 mr-3 text-purple-400" />
                    <span>{client.address}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Visit Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Start Time:</span>
                  <span className="text-white">{new Date(visit.start_time).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">{formatDuration(visit.start_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400">In Progress</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          {/* Tab Navigation */}
          <div className="border-b border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 hover:scale-105 ${
                  activeTab === 'notes'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Notes
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 hover:scale-105 ${
                  activeTab === 'history'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <History className="h-4 w-4 inline mr-2" />
                Visit History
              </button>
              <button
                onClick={() => setActiveTab('order')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 hover:scale-105 ${
                  activeTab === 'order'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="h-4 w-4 inline mr-2" />
                Order
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'notes' && renderNotesTab()}
            {activeTab === 'history' && renderHistoryTab()}
            {activeTab === 'order' && renderOrderTab()}
          </div>
        </div>
      </main>
    </div>
  );
};