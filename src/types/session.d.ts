import { Context as TelegrafContext } from 'telegraf';

// Интерфейс товара
export interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  quantity: string;
  photoUrl?: string;
}

// Пункт корзины
export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

// Структура сессии
export interface SessionData {
  cart?: CartItem[];
  pendingProduct?: Product;
  lastMenu?: 'beer' | 'snacks'; // ← добавлено это поле
}

// Контекст сессии
export interface CustomContext extends TelegrafContext {
  session: SessionData;
}

