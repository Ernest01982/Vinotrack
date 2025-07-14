import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { ArrowLeft, User, Mail, Phone, MapPin, Save, FileText, History, ShoppingCart, Plus, Minus, Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable for TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Interface definitions
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
  notes?: string;
  draft_order_items?: OrderItem[]; // Added for state persistence
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
  const [success, setSuccess] = useState('');
  
  // Order tab state
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(visit.draft_order_items || []);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Modal State
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);

  // --- State Persistence Logic ---

  // Auto-save notes every 3 seconds
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes !== visit.notes) {
        handleSaveNotes();
      }
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [notes, visit.notes]);

  // Save notes before the user leaves the page (e.g., refresh)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (notes !== visit.notes) {
        handleSaveNotes();
        // Note: Most modern browsers will not display this message
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [notes, visit.notes]);

  // Save draft order whenever it changes
  const saveDraftOrder = useCallback(async (currentOrderItems: OrderItem[]) => {
    try {
      await supabase
        .from('visits')
        .update({ draft_order_items: currentOrderItems })
        .eq('id', visit.id);
    } catch (err) {
      console.error("Failed to save draft order:", err);
      // Non-critical error, so we don't show it to the user
    }
  }, [visit.id]);

  // --- End State Persistence Logic ---

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
        .neq('id', visit.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setVisitHistory(data || []);
    } catch (err: any) {
      setError('Failed to fetch visit history');
    } finally {
      setLoading(false);
    }
  };

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
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (product: Product, quantity: number) => {
    let updatedOrderItems;
    if (quantity <= 0) {
      updatedOrderItems = orderItems.filter(item => item.product_id !== product.id);
    } else {
      const total = product.price * quantity;
      const orderItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        total
      };

      const existingIndex = orderItems.findIndex(item => item.product_id === product.id);
      if (existingIndex >= 0) {
        updatedOrderItems = [...orderItems];
        updatedOrderItems[existingIndex] = orderItem;
      } else {
        updatedOrderItems = [...orderItems, orderItem];
      }
    }
    setOrderItems(updatedOrderItems);
    saveDraftOrder(updatedOrderItems); // Save draft on change
  };

  const getQuantity = (productId: string): number => {
    return orderItems.find(item => item.product_id === productId)?.quantity || 0;
  };

  const getOrderTotal = (): number => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  const generatePDF = (orderData: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 128);
    doc.text('Vino Tracker', 20, 20);
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Order Confirmation', 20, 35);
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderData.id}`, 20, 50);
    doc.text(`Date: ${new Date(orderData.created_at).toLocaleDateString()}`, 20, 60);
    doc.setFontSize(14);
    doc.text('Client Information:', 20, 80);
    doc.setFontSize(12);
    doc.text(`Name: ${client.name}`, 20, 90);
    doc.text(`Email: ${client.email}`, 20, 100);
    
    const tableData = orderItems.map(item => [
      item.product_name,
      item.quantity.toString(),
      `R${item.price.toFixed(2)}`,
      `R${item.total.toFixed(2)}`
    ]);
    
    doc.autoTable({
      head: [['Product', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      startY: 110,
      theme: 'grid',
      headStyles: { fillColor: [128, 0, 128] },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text(`Order Total: R${getOrderTotal().toFixed(2)}`, 20, finalY + 15);
    
    doc.save(`Order_${orderData.id}_${client.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePlaceOrder = async () => {
    setShowConfirmOrderModal(false);
    if (orderItems.length === 0) {
      setError('Please add items to your order.');
      return;
    }

    setPdfLoading(true);
    setError('');
    setSuccess(''); // Clear previous success messages

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: client.id,
          rep_id: visit.rep_id,
          visit_id: visit.id,
          total_amount: getOrderTotal(),
          items: orderItems,
        })
        .select()
        .single();

      if (orderError) {
        // This will now catch the specific database error
        console.error('Database Insert Error:', orderError);
        throw orderError;
      }
      
      // If the code reaches here, the database part was successful.
      // We are skipping PDF generation for this test.
      setSuccess('Order successfully saved to the database! PDF generation is the next step.');

      // Clear the cart
      setOrderItems([]);
      await saveDraftOrder([]);

    } catch (err: any) {
      // The error from the 'throw' above will be caught here
      setError(`Failed to place order. Please check the console for details.`);
      console.error('Full error object:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaveLoading(true);
    try {
      const { error } = await supabase
        .from('visits')
        .update({ notes })
        .eq('id', visit.id);

      if (error) throw error;
      setSuccess('Notes saved.');
    } catch (err: any) {
      setError('Failed to save notes');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEndVisit = async () => {
    setEndLoading(true);
    try {
      await handleSaveNotes();
      const { error } = await supabase
        .from('visits')
        .update({ end_time: new Date().toISOString() })
        .eq('id', visit.id);

      if (error) throw error;
      setSuccess('Visit ended successfully!');
      setTimeout(onEndVisit, 1000);
    } catch (err: any) {
      setError('Failed to end visit');
    } finally {
      setEndLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Button onClick={onBack} variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <h1 className="text-xl font-bold text-white">Active Visit</h1>
            <Button onClick={handleEndVisit} loading={endLoading} className="bg-red-600 hover:bg-red-700">End Visit</Button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">{error}</div>}
          {success && <div className="bg-green-800 border border-green-600 text-green-200 px-4 py-3 rounded mb-6">{success}</div>}
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <div className="flex items-center space-x-3 mb-4">
                <User className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Client: {client.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-gray-300"><Mail className="h-4 w-4 mr-3 text-purple-400" /><span>{client.email}</span></div>
                {client.phone && <div className="flex items-center text-gray-300"><Phone className="h-4 w-4 mr-3 text-purple-400" /><span>{client.phone}</span></div>}
                {client.address && <div className="flex items-center text-gray-300 md:col-span-2"><MapPin className="h-4 w-4 mr-3 text-purple-400" /><span>{client.address}</span></div>}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <nav className="border-b border-gray-700 flex space-x-8 px-6">
              <button onClick={() => setActiveTab('notes')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'notes' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>Notes</button>
              <button onClick={() => setActiveTab('order')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'order' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>Order</button>
              <button onClick={() => setActiveTab('history')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>History</button>
            </nav>
            <div className="p-6">
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Visit Notes</h3>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter visit notes..." className="w-full h-64 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                  <Button onClick={handleSaveNotes} loading={saveLoading}><Save className="h-4 w-4 mr-2" />Save Notes</Button>
                </div>
              )}
              {activeTab === 'order' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white">Place Order</h3>
                  {orderItems.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <h4 className="text-white font-medium mb-3">Order Summary</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {orderItems.map(item => <div key={item.product_id} className="flex justify-between text-sm"><span>{item.product_name} x{item.quantity}</span><span>R{item.total.toFixed(2)}</span></div>)}
                      </div>
                      <div className="border-t border-gray-600 mt-3 pt-3 flex justify-between items-center">
                        <span className="text-lg font-bold text-green-400">Total: R{getOrderTotal().toFixed(2)}</span>
                        <Button onClick={() => setShowConfirmOrderModal(true)} loading={pdfLoading} className="bg-green-600 hover:bg-green-700"><Download className="h-4 w-4 mr-2" />Place Order & Get PDF</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Available Products</h4>
                    {loading ? <p>Loading products...</p> : (
                      <div className="grid grid-cols-1 gap-4">
                        {products.map((product) => (
                          <div key={product.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 flex items-center justify-between">
                            <div>
                              <h5 className="text-white font-medium">{product.name}</h5>
                              <p className="text-green-400 font-bold">R{product.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Button onClick={() => updateQuantity(product, getQuantity(product.id) - 1)} size="sm" variant="outline" disabled={getQuantity(product.id) <= 0}><Minus className="h-3 w-3" /></Button>
                              <span className="text-white font-medium w-8 text-center">{getQuantity(product.id)}</span>
                              <Button onClick={() => updateQuantity(product, getQuantity(product.id) + 1)} size="sm" variant="outline"><Plus className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Visit History</h3>
                  {loading ? <p>Loading history...</p> : visitHistory.length === 0 ? <p>No previous visits.</p> : (
                    <div className="space-y-3">
                      {visitHistory.map(v => <div key={v.id} className="bg-gray-700 p-4 rounded-lg"><p className="font-medium text-white">{new Date(v.start_time).toLocaleString()}</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{v.notes || 'No notes for this visit.'}</p></div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showConfirmOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
                <h3 className="text-lg font-medium text-white mb-2">Confirm Order</h3>
                <p className="text-sm text-gray-400 mb-4">Are you sure you want to place this order for <span className="font-bold text-green-400">R{getOrderTotal().toFixed(2)}</span>? A PDF receipt will be generated.</p>
                <div className="flex justify-end space-x-3 pt-4">
                    <Button type="button" onClick={() => setShowConfirmOrderModal(false)} variant="secondary">Cancel</Button>
                    <Button onClick={handlePlaceOrder} className="bg-green-600 hover:bg-green-700">Yes, Place Order</Button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
