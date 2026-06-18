import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  AlertTriangle,
  Info,
  RefreshCw,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import type { Product, Customer, Order, DashboardStats } from './types';

let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
if (rawApiUrl && !rawApiUrl.endsWith('/api') && !rawApiUrl.endsWith('/api/')) {
  rawApiUrl = `${rawApiUrl.replace(/\/$/, '')}/api`;
}
const API_BASE_URL = rawApiUrl;

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'customers' | 'orders'>('dashboard');
  
  // Passcode State
  const [passcode, setPasscode] = useState(localStorage.getItem('admin_passcode') || 'admin123');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    return {
      ...extraHeaders,
      ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
    };
  };

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Form States - Product
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    stock_quantity: ''
  });

  // Form States - Customer
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: ''
  });

  // Form States - Order
  const [orderCustomerId, setOrderCustomerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<{ product_id: number; quantity: number }[]>([
    { product_id: 0, quantity: 1 }
  ]);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [resProducts, resCustomers, resOrders, resStats] = await Promise.all([
        fetch(`${API_BASE_URL}/products`, { headers }),
        fetch(`${API_BASE_URL}/customers`, { headers }),
        fetch(`${API_BASE_URL}/orders`, { headers }),
        fetch(`${API_BASE_URL}/dashboard-stats`, { headers })
      ]);

      if (!resProducts.ok || !resCustomers.ok || !resOrders.ok || !resStats.ok) {
        throw new Error("Failed to fetch data from API. Please make sure the backend server is running.");
      }

      const productsData = await resProducts.json();
      const customersData = await resCustomers.json();
      const ordersData = await resOrders.json();
      const statsData = await resStats.json();

      setProducts(productsData);
      setCustomers(customersData);
      setOrders(ordersData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Show auto-dismiss notifications
  const triggerNotification = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(null), 6000);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword) {
      triggerNotification('error', "New passcodes do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passcode}`
        },
        body: JSON.stringify({
          current_password: changePasswordForm.currentPassword,
          new_password: changePasswordForm.newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to change admin passcode.");
      }

      triggerNotification('success', "Admin passcode updated successfully.");
      setPasscode(changePasswordForm.newPassword);
      localStorage.setItem('admin_passcode', changePasswordForm.newPassword);
      setShowChangePasswordModal(false);
      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: any) {
      triggerNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PRODUCT CRUD Actions ---
  const handleOpenProductModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stock_quantity: product.stock_quantity.toString()
      });
    } else {
      setEditingProduct(null);
      setProductForm({ sku: '', name: '', description: '', price: '', stock_quantity: '' });
    }
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingProduct ? `${API_BASE_URL}/products/${editingProduct.id}` : `${API_BASE_URL}/products/`;
      const method = editingProduct ? 'PUT' : 'POST';
      
      const payload = {
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        stock_quantity: parseInt(productForm.stock_quantity)
      };

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error saving product");
      }

      triggerNotification('success', `Product successfully ${editingProduct ? 'updated' : 'created'}`);
      setShowProductModal(false);
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  const handleProductDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete product");
      }
      triggerNotification('success', "Product deleted successfully");
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  // --- CUSTOMER CRUD Actions ---
  const handleOpenCustomerModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        name: customer.name,
        email: customer.email,
        phone: customer.phone || ''
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({ name: '', email: '', phone: '' });
    }
    setShowCustomerModal(true);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingCustomer ? `${API_BASE_URL}/customers/${editingCustomer.id}` : `${API_BASE_URL}/customers/`;
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const payload = {
        name: customerForm.name,
        email: customerForm.email,
        phone: customerForm.phone || null
      };

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error saving customer");
      }

      triggerNotification('success', `Customer successfully ${editingCustomer ? 'updated' : 'created'}`);
      setShowCustomerModal(false);
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  const handleCustomerDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete customer");
      }
      triggerNotification('success', "Customer deleted successfully");
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  // --- ORDER Placement Actions ---
  const handleOpenOrderModal = () => {
    setOrderCustomerId('');
    setOrderItems([{ product_id: 0, quantity: 1 }]);
    setShowOrderModal(true);
  };

  const handleAddOrderItemRow = () => {
    setOrderItems([...orderItems, { product_id: 0, quantity: 1 }]);
  };

  const handleRemoveOrderItemRow = (index: number) => {
    const list = [...orderItems];
    list.splice(index, 1);
    setOrderItems(list);
  };

  const handleOrderItemChange = (index: number, field: 'product_id' | 'quantity', value: number) => {
    const list = [...orderItems];
    list[index][field] = value;
    setOrderItems(list);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Client-side validation: ensure valid customer & products selected
    if (!orderCustomerId) {
      triggerNotification('error', "Please select a customer.");
      return;
    }

    const filteredItems = orderItems.filter(item => item.product_id !== 0);
    if (filteredItems.length === 0) {
      triggerNotification('error', "Please select at least one product.");
      return;
    }

    // Client-side validation: check local stock before placing order
    for (const item of filteredItems) {
      const prod = products.find(p => p.id === item.product_id);
      if (prod && prod.stock_quantity < item.quantity) {
        triggerNotification('error', `Insufficient stock for '${prod.name}'. Available: ${prod.stock_quantity}, requested: ${item.quantity}.`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/orders/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          customer_id: parseInt(orderCustomerId),
          items: filteredItems
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error placing order");
      }

      triggerNotification('success', "Order placed successfully! Stock updated.");
      setShowOrderModal(false);
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm("Are you sure you want to cancel this order? This will restore the stock levels.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'Cancelled' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to cancel order");
      }
      triggerNotification('success', "Order cancelled. Inventory levels restored.");
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(data);
      }
      fetchData();
    } catch (err: any) {
      triggerNotification('error', err.message);
    }
  };

  const formatPrice = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
  };

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <ShoppingCart className="logo" size={20} color="white" />
          </div>
          <span className="logo-text">Aether Inventory</span>
        </div>
        
        <ul className="nav-links">
          <li>
            <div 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard />
              <span>Dashboard</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <Package />
              <span>Products</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              <Users />
              <span>Customers</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <ShoppingCart />
              <span>Orders</span>
            </div>
          </li>
        </ul>

        {/* Admin Access Panel */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔑 Admin Passcode</span>
            {passcode && (
              <span 
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem' }}
                onClick={() => setShowChangePasswordModal(true)}
              >
                Change Passcode
              </span>
            )}
          </label>
          <input 
            type="password" 
            className="form-control" 
            placeholder="Enter passcode..."
            value={passcode}
            onChange={e => {
              setPasscode(e.target.value);
              localStorage.setItem('admin_passcode', e.target.value);
            }}
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
          />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
            Required for adding, editing, or deleting items. Default: admin123
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Banner Alert/Notifications */}
        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <Check size={20} />
            <span>{success}</span>
          </div>
        )}

        {/* Dynamic Headers */}
        <div className="header-container">
          <h1 className="page-title">
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'products' && 'Product Directory'}
            {activeTab === 'customers' && 'Customer Registry'}
            {activeTab === 'orders' && 'Order Transactions'}
          </h1>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? 'spin' : ''} size={16} />
              Refresh
            </button>
            {activeTab === 'products' && (
              <button className="btn btn-primary" onClick={() => handleOpenProductModal(null)}>
                <Plus size={16} /> Add Product
              </button>
            )}
            {activeTab === 'customers' && (
              <button className="btn btn-primary" onClick={() => handleOpenCustomerModal(null)}>
                <Plus size={16} /> Add Customer
              </button>
            )}
            {activeTab === 'orders' && (
              <button className="btn btn-primary" onClick={handleOpenOrderModal}>
                <Plus size={16} /> Create Order
              </button>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && !stats && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading workspace details...</div>}

        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <div className="stats-grid">
              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper icon-primary">
                  <Package size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Products</span>
                  <span className="stat-value">{stats.total_products}</span>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper icon-secondary">
                  <Users size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Customers</span>
                  <span className="stat-value">{stats.total_customers}</span>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper icon-accent">
                  <ShoppingCart size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Orders</span>
                  <span className="stat-value">{stats.total_orders}</span>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper icon-success">
                  <DollarSign size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Revenue</span>
                  <span className="stat-value">{formatPrice(stats.total_revenue)}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-details">
              {/* Low Stock Alerts */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header">
                  <h3 className="card-title" style={{ color: stats.low_stock_products.length > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    <AlertTriangle size={20} />
                    Inventory Shortage Alerts
                  </h3>
                </div>
                <div className="panel-body" style={{ flexGrow: 1 }}>
                  {stats.low_stock_products.length === 0 ? (
                    <div className="empty-state">
                      <Check size={40} color="var(--success)" />
                      <p>All products are sufficiently stocked (&gt;= 10 units).</p>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Product Name</th>
                            <th className="text-right">Stock</th>
                            <th className="text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.low_stock_products.map(p => (
                            <tr key={p.id}>
                              <td><code>{p.sku}</code></td>
                              <td>{p.name}</td>
                              <td className="text-right">
                                <span className={`badge ${p.stock_quantity === 0 ? 'badge-danger' : 'badge-warning'}`}>
                                  {p.stock_quantity} remaining
                                </span>
                              </td>
                              <td className="text-right">{formatPrice(p.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="glass-panel">
                <div className="panel-header">
                  <h3 className="card-title">
                    <TrendingUp size={20} />
                    Business Operations
                  </h3>
                </div>
                <div className="panel-body">
                  <p style={{ marginBottom: '1.25rem' }}>Use the quick links below to jump to operational registry management actions.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setActiveTab('products')}>
                      <Package size={16} /> Manage Product Inventory
                    </button>
                    <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setActiveTab('customers')}>
                      <Users size={16} /> Register New Customers
                    </button>
                    <button className="btn btn-primary" style={{ justifyContent: 'flex-start' }} onClick={handleOpenOrderModal}>
                      <ShoppingCart size={16} /> Dispatch New Customer Order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- PRODUCTS TAB --- */}
        {activeTab === 'products' && (
          <div className="glass-panel">
            <div className="panel-body">
              {products.length === 0 ? (
                <div className="empty-state">
                  <Package size={48} />
                  <p>No products registered yet. Click "Add Product" to populate the catalog.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>SKU Code</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Stock Balance</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td><code>{p.sku}</code></td>
                          <td><strong>{p.name}</strong></td>
                          <td style={{ color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description || '-'}
                          </td>
                          <td className="text-right">{formatPrice(p.price)}</td>
                          <td className="text-right">
                            <span className={`badge ${p.stock_quantity === 0 ? 'badge-danger' : p.stock_quantity < 10 ? 'badge-warning' : 'badge-success'}`}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleOpenProductModal(p)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleProductDelete(p.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CUSTOMERS TAB --- */}
        {activeTab === 'customers' && (
          <div className="glass-panel">
            <div className="panel-body">
              {customers.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} />
                  <p>No customers registered. Click "Add Customer" to add one.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Full Name</th>
                        <th>Email Address</th>
                        <th>Contact Number</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => (
                        <tr key={c.id}>
                          <td><code>#{c.id}</code></td>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.phone || '-'}</td>
                          <td className="actions-cell">
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleOpenCustomerModal(c)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleCustomerDelete(c.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- ORDERS TAB --- */}
        {activeTab === 'orders' && (
          <div className="glass-panel">
            <div className="panel-body">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={48} />
                  <p>No order history recorded. Click "Create Order" to request customer checkout.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Order Ref</th>
                        <th>Customer</th>
                        <th>Order Date</th>
                        <th className="text-right">Items</th>
                        <th className="text-right">Grand Total</th>
                        <th className="text-right">Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td><code>#{o.id}</code></td>
                          <td>
                            <strong>{o.customer.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{o.customer.email}</div>
                          </td>
                          <td>{new Date(o.order_date).toLocaleString()}</td>
                          <td className="text-right">{o.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
                          <td className="text-right"><strong>{formatPrice(o.total_amount)}</strong></td>
                          <td className="text-right">
                            <span className={`badge ${
                              o.status === 'Completed' ? 'badge-success' :
                              o.status === 'Pending' ? 'badge-info' :
                              o.status === 'Processing' ? 'badge-warning' :
                              'badge-danger'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setSelectedOrder(o)}>
                              <Info size={12} /> Details
                            </button>
                            {o.status !== 'Cancelled' && (
                              <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleCancelOrder(o.id)}>
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- ADD/EDIT PRODUCT MODAL --- */}
      {showProductModal && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h3>{editingProduct ? 'Update Product Catalog' : 'Register New Product'}</h3>
              <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="form-group">
                <label className="form-label">SKU Code (Unique)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. ELEC-PH-009"
                  required
                  value={productForm.sku}
                  onChange={e => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. iPhone 15 Pro Max"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-control" 
                  placeholder="Provide product details..."
                  rows={3}
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Price ($ USD)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    className="form-control" 
                    placeholder="0.00"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Balance</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="form-control" 
                    placeholder="0"
                    required
                    value={productForm.stock_quantity}
                    onChange={e => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Save Changes' : 'Create Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT CUSTOMER MODAL --- */}
      {showCustomerModal && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h3>{editingCustomer ? 'Update Customer Profile' : 'Register Customer Profile'}</h3>
              <button className="modal-close" onClick={() => setShowCustomerModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCustomerSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. John Doe"
                  required
                  value={customerForm.name}
                  onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address (Unique)</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="john.doe@company.com"
                  required
                  value={customerForm.email}
                  onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Number (Optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="+1 (555) 019-2834"
                  value={customerForm.phone}
                  onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingCustomer ? 'Save Changes' : 'Register Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE ORDER MODAL --- */}
      {showOrderModal && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Create Sales Order</h3>
              <button className="modal-close" onClick={() => setShowOrderModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleOrderSubmit}>
              {/* Customer Select */}
              <div className="form-group">
                <label className="form-label">Select Registered Customer</label>
                <select 
                  className="form-control"
                  required
                  value={orderCustomerId}
                  onChange={e => setOrderCustomerId(e.target.value)}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              {/* Items Section */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Items & Checkout Quantities</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={handleAddOrderItemRow}>
                    <Plus size={12} /> Add Item
                  </button>
                </label>
                
                <div className="order-items-builder">
                  {orderItems.map((item, index) => {
                    const selectedProd = products.find(p => p.id === item.product_id);
                    const isStockInsufficient = selectedProd ? selectedProd.stock_quantity < item.quantity : false;
                    
                    return (
                      <div className="order-builder-row" key={index}>
                        <div style={{ flexGrow: 1 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Product</label>
                          <select
                            className="form-control"
                            value={item.product_id}
                            required
                            onChange={e => handleOrderItemChange(index, 'product_id', parseInt(e.target.value))}
                          >
                            <option value={0}>-- Select Product --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (SKU: {p.sku}) - {formatPrice(p.price)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ width: '90px' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            required
                            value={item.quantity}
                            onChange={e => handleOrderItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>

                        {/* Stock status indicator */}
                        <div style={{ paddingBottom: '0.5rem', minWidth: '120px', display: 'flex', alignItems: 'center' }}>
                          {selectedProd && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.7rem', color: isStockInsufficient ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                Avail: {selectedProd.stock_quantity}
                              </span>
                              {isStockInsufficient && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <AlertTriangle size={10} /> Insufficient Stock
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {orderItems.length > 1 && (
                          <button 
                            type="button" 
                            className="btn btn-danger" 
                            style={{ padding: '0.65rem', borderRadius: '10px' }}
                            onClick={() => handleRemoveOrderItemRow(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Summary */}
              <div style={{ 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '10px', 
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 600 }}>Estimated Order Total:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                  {formatPrice(
                    orderItems.reduce((sum, item) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return sum + (prod ? prod.price * item.quantity : 0);
                    }, 0)
                  )}
                </span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Place Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ORDER DETAILS MODAL --- */}
      {selectedOrder && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Order Detail: Reference #{selectedOrder.id}</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <span className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>Customer Profile</span>
                <strong>{selectedOrder.customer.name}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedOrder.customer.email}</div>
                {selectedOrder.customer.phone && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedOrder.customer.phone}</div>}
              </div>
              
              <div>
                <span className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>Order Information</span>
                <div>Date: {new Date(selectedOrder.order_date).toLocaleString()}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
                  <span>Status:</span>
                  <span className={`badge ${
                    selectedOrder.status === 'Completed' ? 'badge-success' :
                    selectedOrder.status === 'Pending' ? 'badge-info' :
                    selectedOrder.status === 'Processing' ? 'badge-warning' :
                    'badge-danger'
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
            </div>

            <span className="form-label" style={{ fontSize: '0.75rem' }}>Ordered Items</span>
            <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem' }}>
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product Name</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map(item => (
                      <tr key={item.id}>
                        <td><code>{item.product?.sku || 'UNKNOWN'}</code></td>
                        <td>{item.product?.name || 'Deleted Product'}</td>
                        <td className="text-right">{formatPrice(item.unit_price)}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{formatPrice(item.unit_price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedOrder.status !== 'Cancelled' && (
                  <button className="btn btn-danger" onClick={() => handleCancelOrder(selectedOrder.id)}>
                    Cancel Order
                  </button>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.1rem' }}>Grand Total</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                  {formatPrice(selectedOrder.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CHANGE PASSCODE MODAL --- */}
      {showChangePasswordModal && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Change Admin Passcode</h3>
              <button className="modal-close" onClick={() => setShowChangePasswordModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePasswordSubmit}>
              <div className="form-group">
                <label className="form-label">Current Passcode</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Enter current passcode..."
                  required
                  value={changePasswordForm.currentPassword}
                  onChange={e => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Passcode</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Minimum 6 characters..."
                  required
                  value={changePasswordForm.newPassword}
                  onChange={e => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Passcode</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Re-enter new passcode..."
                  required
                  value={changePasswordForm.confirmNewPassword}
                  onChange={e => setChangePasswordForm({ ...changePasswordForm, confirmNewPassword: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChangePasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Passcode</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
