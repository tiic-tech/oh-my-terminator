// Type definitions for testing

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
  message?: string;
};

export type PaginationParams = {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

// Generic utility type
export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;