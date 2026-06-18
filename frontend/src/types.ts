export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product: Product;
}

export interface Order {
  id: number;
  customer_id: number;
  order_date: string;
  status: string; // "Pending" | "Processing" | "Completed" | "Cancelled"
  total_amount: number;
  items: OrderItem[];
  customer: Customer;
}

export interface DashboardStats {
  total_products: number;
  total_customers: number;
  total_orders: number;
  total_revenue: number;
  low_stock_products: Product[];
}
