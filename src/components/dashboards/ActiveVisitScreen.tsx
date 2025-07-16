import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Clock, Save, FileText, History, ShoppingCart, Plus, Minus, Download, Send, Gift } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Client, OrderItem, Visit, Product } from '../../types';
import { useProducts } from '../../hooks/useProducts';
import { useVisits } from '../../hooks/useVisits';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
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
  const [notes, setNotes] = useState(() => localStorage.getItem('visitNotes') || visit.notes || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>(() => {
    const savedOrder = localStorage.getItem('orderItems');
    return savedOrder ? JSON.parse(savedOrder) : [];
  });
  
  const [saveLoading, setSaveLoading] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const { visitHistory, loading: historyLoading, error: historyError, refetch: refetchHistory } = useVisits(client.id, visit.id);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('visitNotes', notes);
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('orderItems', JSON.stringify(orderItems));
  }, [orderItems]);

  useEffect(() => {
    if (productsError) setError(productsError);
    if (historyError) setError(historyError);
  }, [productsError, historyError]);

  const updateQuantity = (product: Product, quantity: number) => {
    setOrderItems(prev => {
      const existingItem = prev.find(item => item.product_id === product.id);
      if (quantity <= 0) {
        return prev.filter(item => item.product_id !== product.id);
      }
      
      const is_free_stock = existingItem?.is_free_stock || false;
      const price = is_free_stock ? 0 : product.price;
      const total = price * quantity;
      
      const orderItem: OrderItem = { product_id: product.id, product_name: product.name, price, quantity, total, is_free_stock };
      
      if (existingItem) {
        return prev.map(item => item.product_id === product.id ? orderItem : item);
      } else {
        return [...prev, orderItem];
      }
    });
  };

  const toggleFreeStock = (productId: string) => {
    setOrderItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        const originalProduct = products.find(p => p.id === productId);
        if (!originalProduct) return item; // Should not happen

        const is_free_stock = !item.is_free_stock;
        const price = is_free_stock ? 0 : originalProduct.price;
        return { ...item, is_free_stock, price, total: price * item.quantity };
      }
      return item;
    }));
  };

  const getQuantity = (productId: string): number => orderItems.find(item => item.product_id === productId)?.quantity || 0;
  const getOrderTotal = (): number => orderItems.reduce((sum, item) => sum + item.total, 0);

  const generatePDF = (orderData: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 128);
    doc.text('VINO TRACKER', 20, 20);
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
      item.is_free_stock ? `${item.product_name} (Free)` : item.product_name, 
      item.quantity.toString(), 
      `R${item.price.toFixed(2)}`, 
      `R${item.total.toFixed(2)}`
    ]);

    autoTable(doc, { head: [['Product', 'Quantity', 'Unit Price', 'Total']], body: tableData, startY: 110, theme: 'grid', headStyles: { fillColor: [128, 0, 128] } });
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text(`Order Total: R${getOrderTotal().toFixed(2)}`, 20, finalY + 10);
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for your business!', 20, finalY + 20);
    return doc;
  };

  const handlePlaceOrderAndDownload = async () => {
    if (orderItems.length === 0) {
      setError('Please add items to your order before placing it');
      return;
    }

    setPdfLoading(true);
    setError('');

    try {
      const orderData = { client_id: client.id, rep_id: visit.rep_id, visit_id: visit.id, total_amount: getOrderTotal(), items: orderItems };
      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
      if (orderError) throw orderError;

      const doc = generatePDF(order);
      doc.save(`Order_${order.id}_${client.name.replace(/\s+/g, '_')}.pdf`);

      setOrderItems([]);
      alert('Order placed successfully! PDF has been downloaded.');
    } catch (err: any) {
      setError('Failed to place order and download PDF');
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
      const { error } = await supabase.from('visits').update({ notes }).eq('id', visit.id);
      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      setError('Failed to save notes');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEndVisit = async () => {
    setEndLoading(true);
    setError('');
    try {
      await supabase.from('visits').update({ end_time: new Date().toISOString(), notes }).eq('id', visit.id);
      alert('Visit ended successfully!');
      onEndVisit();
    } catch (err: any) {
      setError('Failed to end visit');
    } finally {
      setEndLoading(false);
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };
  
  const renderNotesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Visit Notes</h3>
        <Button onClick={handleSaveNotes} loading={saveLoading} size="sm" variant="outline"><Save className="h-4 w-4 mr-2" />Save Notes</Button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter your visit notes here..."
        className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
      />
    </div>
  );

  const renderOrderTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">Place Order</h3>
        {orderItems.length > 0 && <p className="text-xl font-bold text-green-400">Total: R{getOrderTotal().toFixed(2)}</p>}
      </div>
      {orderItems.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-medium mb-3">Order Summary</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderItems.map((item) => (
                    <div key={item.product_id} className={`flex justify-between items-center text-sm p-2 rounded-md ${item.is_free_stock ? 'bg-purple-900/50' : ''}`}>
                        <div>
                            <span className="text-gray-300">{item.product_name}</span>
                            {item.is_free_stock && <span className="text-purple-400 text-xs ml-2 font-bold">[FREE]</span>}
                        </div>
                        <span className="text-white">{item.quantity} × R{item.price.toFixed(2)} = R{item.total.toFixed(2)}</span>
                    </div>
                ))}
            </div>
            <div className="border-t border-gray-600 mt-3 pt-3">
                <Button onClick={handlePlaceOrderAndDownload} loading={pdfLoading} className="w-full bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" /> Place Order & Download PDF
                </Button>
            </div>
        </div>
      )}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Available Products</h4>
        {productsLoading ? <p>Loading products...</p> : (
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => {
              const quantity = getQuantity(product.id);
              const isFree = orderItems.find(item => item.product_id === product.id)?.is_free_stock || false;
              return (
                <div key={product.id} className={`bg-gray-700 rounded-lg p-4 border border-gray-600 ${isFree ? 'border-purple-500' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="text-white font-medium text-lg">{product.name}</h5>
                      <p className="text-gray-300 text-sm mb-2">{product.description}</p>
                      <span className={`font-bold text-lg ${isFree ? 'text-purple-400 line-through' : 'text-green-400'}`}>R{product.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-3 ml-4">
                      <Button onClick={() => updateQuantity(product, quantity - 1)} size="sm" variant="outline" disabled={quantity <= 0}>–</Button>
                      <span className="text-white font-medium w-8 text-center">{quantity}</span>
                      <Button onClick={() => updateQuantity(product, quantity + 1)} size="sm" variant="outline">+</Button>
                    </div>
                  </div>
                  {quantity > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600 flex items-center">
                          <input 
                              type="checkbox"
                              id={`free-${product.id}`}
                              checked={isFree}
                              onChange={() => toggleFreeStock(product.id)}
                              className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-purple-600 focus:ring-purple-500"
                          />
                          <label htmlFor={`free-${product.id}`} className="ml-2 text-sm text-gray-300 flex items-center">
                              <Gift className="h-4 w-4 mr-2 text-purple-400"/>
                              Mark as Free Stock
                          </label>
                      </div>
                  )}
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
      <h3 className="text-lg font-medium text-white">Visit History for {client.name}</h3>
      {historyLoading ? <p>Loading history...</p> : (
        visitHistory.length === 0 ? <p className="text-gray-400">No past visits found.</p> : (
          <div className="space-y-3">
            {visitHistory.map((historyVisit) => (
              <div key={historyVisit.id} className="bg-gray-700 rounded-lg p-4">
                <p className="text-white font-medium">Date: {new Date(historyVisit.start_time).toLocaleDateString()}</p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{historyVisit.notes || "No notes for this visit."}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Active Visit: {client.name}</h1>
            <Button onClick={handleEndVisit} loading={endLoading} className="bg-red-600 hover:bg-red-700">End Visit</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="bg-red-900 text-white p-3 rounded-md mb-6">{error}</div>}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="border-b border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button onClick={() => setActiveTab('notes')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'notes' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400'}`}>Notes</button>
              <button onClick={() => setActiveTab('order')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'order' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400'}`}>Order</button>
              <button onClick={() => setActiveTab('history')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400'}`}>History</button>
            </nav>
          </div>
          <div className="p-6">
            {activeTab === 'notes' && renderNotesTab()}
            {activeTab === 'order' && renderOrderTab()}
            {activeTab === 'history' && renderHistoryTab()}
          </div>
        </div>
      </main>
    </div>
  );
};