import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Save,
  FileText, History, ShoppingCart, Plus, Minus,
  Download, X
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
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
  notes?: string;
  draft_order_items?: OrderItem[];
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
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(visit.draft_order_items || []);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes !== visit.notes) {
        handleSaveNotes();
      }
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [notes, visit.notes]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (notes !== visit.notes) {
        handleSaveNotes();
        event.returnValue = 'You have unsaved changes.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [notes, visit.notes]);

  const saveDraftOrder = useCallback(async (items: OrderItem[]) => {
    try {
      await supabase.from('visits').update({ draft_order_items: items }).eq('id', visit.id);
    } catch (err) {
      console.error('Failed to save draft order:', err);
    }
  }, [visit.id]);

  useEffect(() => {
    if (activeTab === 'history') fetchVisitHistory();
    else if (activeTab === 'order') fetchProducts();
  }, [activeTab, client.id]);

  const fetchVisitHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', client.id)
        .neq('id', visit.id)
        .order('start_time', { ascending: false });
      if (error) throw error;
      setVisitHistory(data || []);
    } catch (err) {
      setError('Failed to fetch visit history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError('Failed to fetch products.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (product: Product, quantity: number) => {
    let updated;
    if (quantity <= 0) {
      updated = orderItems.filter(i => i.product_id !== product.id);
    } else {
      const total = product.price * quantity;
      const newItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        total
      };
      const index = orderItems.findIndex(i => i.product_id === product.id);
      updated = [...orderItems];
      if (index >= 0) updated[index] = newItem;
      else updated.push(newItem);
    }
    setOrderItems(updated);
    saveDraftOrder(updated);
  };

  const getQuantity = (id: string) => orderItems.find(i => i.product_id === id)?.quantity || 0;

  const getOrderTotal = () => orderItems.reduce((sum, item) => sum + item.total, 0);

  const generatePDF = (orderData: any) => {
    try {
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
      doc.text('Client Info:', 20, 80);
      doc.setFontSize(12);
      doc.text(`Name: ${client.name}`, 20, 90);
      doc.text(`Email: ${client.email}`, 20, 100);

      const tableData = orderItems.map(i => [
        i.product_name,
        i.quantity.toString(),
        `R${i.price.toFixed(2)}`,
        `R${i.total.toFixed(2)}`
      ]);

      doc.autoTable({
        head: [['Product', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        startY: 110,
        theme: 'grid',
        headStyles: { fillColor: [128, 0, 128] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 130;
      doc.setFontSize(14);
      doc.text(`Order Total: R${getOrderTotal().toFixed(2)}`, 20, finalY + 15);

      const filename = `Order_${orderData.id}_${client.name.replace(/\s+/g, '_')}.pdf`;
      console.log('Saving PDF:', filename);
      doc.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const handlePlaceOrder = async () => {
    setShowConfirmOrderModal(false);
    if (orderItems.length === 0) {
      setError('Please add items to your order.');
      return;
    }
    setPdfLoading(true);
    setError('');
    try {
      const { data: order, error } = await supabase
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

      if (error) throw error;

      generatePDF(order);

      setOrderItems([]);
      await saveDraftOrder([]);
      setSuccess('Order placed and PDF downloaded!');
    } catch (err) {
      console.error('Order placement error:', err);
      setError('Failed to place order.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaveLoading(true);
    try {
      const { error } = await supabase.from('visits').update({ notes }).eq('id', visit.id);
      if (error) throw error;
      setSuccess('Notes saved.');
    } catch {
      setError('Failed to save notes.');
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
      setSuccess('Visit ended!');
      setTimeout(onEndVisit, 1000);
    } catch {
      setError('Failed to end visit.');
    } finally {
      setEndLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Active Visit: {client.name}</h1>
      {error && <p className="text-red-500">{error}</p>}
      {success && <p className="text-green-500">{success}</p>}

      {/* Notes */}
      <div className="my-4">
        <textarea
          className="w-full border p-2"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button onClick={handleSaveNotes} loading={saveLoading}>
          <Save className="w-4 h-4 mr-2" /> Save Notes
        </Button>
      </div>

      {/* Order */}
      <div className="my-6">
        <h2 className="text-lg font-semibold mb-2">Place Order</h2>
        {products.map((product) => (
          <div key={product.id} className="flex justify-between border p-2 mb-2">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-green-600">R{product.price.toFixed(2)}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => updateQuantity(product, getQuantity(product.id) - 1)}>-</Button>
              <span>{getQuantity(product.id)}</span>
              <Button onClick={() => updateQuantity(product, getQuantity(product.id) + 1)}>+</Button>
            </div>
          </div>
        ))}
        <div className="mt-4">
          <Button onClick={() => setShowConfirmOrderModal(true)} disabled={orderItems.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Place Order & Get PDF
          </Button>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <h3 className="text-lg font-bold mb-2">Confirm Order</h3>
            <p>Total: R{getOrderTotal().toFixed(2)}</p>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setShowConfirmOrderModal(false)}>Cancel</Button>
              <Button onClick={handlePlaceOrder} loading={pdfLoading}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
