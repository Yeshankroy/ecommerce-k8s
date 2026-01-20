import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, TrendingUp, AlertCircle } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function ECommerceDashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('products');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/orders`)
      ]);

      if (!productsRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();

      setProducts(productsData);
      setOrders(ordersData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price
          }))
        })
      });

      if (!res.ok) throw new Error('Failed to place order');

      const newOrder = await res.json();
      setOrders([...orders, newOrder]);
      setCart([]);
      setActiveTab('orders');
    } catch (err) {
      setError(err.message);
    }
  };

  const totalCartValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">E-Commerce Platform</h1>
          <p className="text-gray-600">Kubernetes-deployed microservices demo</p>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-semibold">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Package size={20} />
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={20} />
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('cart')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'cart'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShoppingCart size={20} />
            Cart ({cart.length})
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                  <Package size={64} className="text-white opacity-50" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
                  <p className="text-gray-600 mb-4">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-indigo-600">${product.price}</span>
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cart' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Shopping Cart</h2>
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Your cart is empty</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-4 border-b">
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-gray-600">Quantity: {item.quantity}</p>
                    </div>
                    <span className="text-lg font-bold text-indigo-600">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-bold text-gray-800">Total:</span>
                    <span className="text-2xl font-bold text-indigo-600">${totalCartValue.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Place Order
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Order History</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-800">Order #{order.id}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-indigo-600">
                      Total: ${parseFloat(order.total_amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
