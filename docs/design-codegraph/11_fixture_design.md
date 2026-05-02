# CodeGraph 测试 Fixture 设计规格

> **目标**: 为 CodeGraph 的单元测试和集成测试提供完整、精确、可复用的 fixture 仓库结构
> **版本**: v1.0
> **创建日期**: 2026-05-02

---

## 目录

1. [Fixture 总览](#1-fixture-总览)
2. [sample-project（核心测试 fixture）](#2-sample-project核心测试-fixture)
3. [期望结果定义](#3-期望结果定义)
4. [alias-project（别名路径测试）](#4-alias-project别名路径测试)
5. [edge-case-project（边界情况测试）](#5-edge-case-project边界情况测试)
6. [cycle-project（循环依赖测试）](#6-cycle-project循环依赖测试)
7. [incremental-project（增量更新测试）](#7-incremental-project增量更新测试)
8. [Fixture 使用指南](#8-fixture-使用指南)

---

## 1. Fixture 总览

### 1.1 Fixture 项目列表

| Fixture 名称 | 主要测试场景 | 复杂度 |
|-------------|------------|-------|
| sample-project | 全量分析、分层推断、影响范围、基本解析 | 中等 |
| alias-project | tsconfig.json paths 别名解析 | 低 |
| edge-case-project | 各种导入边界情况 | 低 |
| cycle-project | 循环依赖检测 | 低 |
| incremental-project | 增量更新、级联处理 | 高（需 Git 历史） |

### 1.2 Fixture 存放位置

```
packages/codegraph/
├── src/
├── test/
│   ├── fixtures/
│   │   ├── sample-project/
│   │   ├── alias-project/
│   │   ├── edge-case-project/
│   │   ├── cycle-project/
│   │   └── incremental-project/
│   ├── unit/
│   │   ├── graph-structure.test.ts
│   │   ├── parser.test.ts
│   │   ├── intelligence-api.test.ts
│   │   └── algorithms.test.ts
│   ├── integration/
│   │   ├── full-analysis.test.ts
│   │   ├── incremental-update.test.ts
│   │   ├── cascade-effect.test.ts
│   │   └── session-monitor.test.ts
│   └── helpers/
│       ├── fixture-loader.ts
│       ├── graph-assertions.ts
│       └── mock-git.ts
```

---

## 2. sample-project（核心测试 fixture）

### 2.1 目录结构

```
fixtures/sample-project/
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── utils/
│   │   ├── format.ts          # 导出 formatDate, formatNumber
│   │   ├── validate.ts        # 导出 validateEmail, validatePhone
│   │   ├── index.ts           # 重导出 utils/* (barrel file)
│   │   └── constants.ts       # 导出常量对象
│   ├── services/
│   │   ├── auth.ts            # 导出 authenticate, logout
│   │   ├── api.ts             # 导出 fetchData, postData
│   │   ├── cache.ts           # 导出 CacheService 类
│   │   └── index.ts           # 重导出 services/*
│   ├── pages/
│   │   ├── home.ts            # 页面组件，导入 services/*
│   │   ├── login.ts           # 登录页，导入 services/auth
│   │   ├── dashboard.ts       # 导入 services/api, services/cache
│   │   └── index.ts           # 重导出 pages/*
│   ├── components/
│   │   ├── Button.tsx         # React 组件导出
│   │   ├── Form.tsx           # 导入 Button
│   │   ├── Modal.tsx          # 导入 Button
│   │   └── index.ts           # 重导出 components/*
│   ├── types/
│   │   ├── user.ts            # 导出 User interface
│   │   ├── api.ts             # 导出 ApiResponse type
│   │   └── index.ts           # 重导出 types/*
│   ├── hooks/
│   │   ├── useAuth.ts         # 导出 useAuth hook
│   │   ├── useApi.ts          # 导出 useApi hook
│   │   └── index.ts           # 重导出 hooks/*
│   ├── app.ts                 # 根入口，导入 pages/home
│   └── index.ts               # 主入口 barrel file
├── tests/
│   ├── utils/
│   │   ├── format.test.ts     # 测试 format.ts
│   │   ├── validate.test.ts   # 测试 validate.ts
│   ├── services/
│   │   ├── auth.test.ts       # 测试 auth.ts
│   │   ├── api.test.ts        # 测试 api.ts
│   ├── components/
│   │   ├── Button.test.tsx    # 测试 Button.tsx
│   └── integration/
│   │   ├── app.test.ts        # 集成测试
└── node_modules/               # 模拟的外部依赖（不实际安装）
    └── @types/
    │   └── react/
    │       └── index.d.ts      # 类型声明
    └── lodash/
    │   └── package.json        # 模拟包信息
    └── axios/
        └── package.json
```

### 2.2 文件内容详述

#### 2.2.1 配置文件

**package.json**
```json
{
  "name": "sample-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "lodash": "^4.17.0",
    "axios": "^1.0.0"
  }
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "baseUrl": ".",
    "paths": {},
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### 2.2.2 Utils 层文件

**src/utils/format.ts**
```typescript
/**
 * Format a date to ISO string format
 * @param date - The date to format
 * @returns ISO formatted string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Format a number with specified decimal places
 * @param num - The number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

// 内部函数（不导出，用于测试复杂度计算）
function internalHelper(value: string): string {
  if (value.length > 10) {
    return value.substring(0, 10);
  }
  return value;
}
```

**src/utils/validate.ts**
```typescript
/**
 * Validate email format
 * @param email - Email string to validate
 * @returns true if valid email format
 */
export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate phone number format (US)
 * @param phone - Phone number string
 * @returns true if valid US phone format
 */
export function validatePhone(phone: string): boolean {
  const regex = /^\d{3}-\d{3}-\d{4}$/;
  return regex.test(phone);
}

/**
 * @deprecated Use validateEmail instead
 */
export function oldEmailCheck(email: string): boolean {
  return email.includes('@');
}
```

**src/utils/constants.ts**
```typescript
export const API_BASE_URL = 'https://api.example.com';
export const MAX_RETRY_COUNT = 3;
export const TIMEOUT_MS = 5000;

export const ErrorCodes = {
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  AUTH_FAILED: 401,
} as const;
```

**src/utils/index.ts** (Barrel file - 测试重导出)
```typescript
export { formatDate, formatNumber } from './format';
export { validateEmail, validatePhone } from './validate';
export { API_BASE_URL, MAX_RETRY_COUNT, TIMEOUT_MS, ErrorCodes } from './constants';
```

#### 2.2.3 Services 层文件

**src/services/auth.ts**
```typescript
import { validateEmail } from '../utils/validate';
import { formatDate } from '../utils/format';
import { API_BASE_URL } from '../utils/constants';
import axios from 'axios';  // 外部依赖

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Authenticate user with email and password
 */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  if (!validateEmail(email)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });
    return { success: true, token: response.data.token };
  } catch (error) {
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Logout user and clear session
 */
export function logout(): void {
  console.log('User logged out at:', formatDate(new Date()));
}

// 内部状态（不导出）
let currentUser: string | null = null;
```

**src/services/api.ts**
```typescript
import { authenticate, logout } from './auth';
import { API_BASE_URL, TIMEOUT_MS } from '../utils/constants';
import axios from 'axios';

export async function fetchData<T>(endpoint: string): Promise<T> {
  // 调用 auth 模块检查认证状态
  const result = await authenticate('test@test.com', 'password');
  if (!result.success) {
    throw new Error('Not authenticated');
  }

  return axios.get(`${API_BASE_URL}/${endpoint}`, {
    timeout: TIMEOUT_MS,
  }).then(res => res.data);
}

export async function postData<T>(endpoint: string, data: unknown): Promise<T> {
  return axios.post(`${API_BASE_URL}/${endpoint}`, data).then(res => res.data);
}
```

**src/services/cache.ts**
```typescript
import _ from 'lodash';  // 外部依赖

export class CacheService<T> {
  private cache: Map<string, { value: T; expiry: number }>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  clear(): void {
    this.cache.clear();
  }

  // 使用 lodash 进行批量操作
  batchGet(keys: string[]): (T | null)[] {
    return _.map(keys, key => this.get(key));
  }
}
```

**src/services/index.ts**
```typescript
export { authenticate, logout, AuthResult } from './auth';
export { fetchData, postData } from './api';
export { CacheService } from './cache';
```

#### 2.2.4 Types 层文件

**src/types/user.ts**
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

export type UserRole = User['role'];
```

**src/types/api.ts**
```typescript
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export type ApiError = {
  code: number;
  message: string;
};
```

**src/types/index.ts**
```typescript
export { User, UserRole } from './user';
export { ApiResponse, ApiError } from './api';
```

#### 2.2.5 Hooks 层文件

**src/hooks/useAuth.ts**
```typescript
import { useState, useCallback } from 'react';
import { authenticate, logout } from '../services/auth';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authenticate(email, password);
    if (result.success) {
      setIsAuthenticated(true);
      setToken(result.token);
    }
    return result;
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setIsAuthenticated(false);
    setToken(null);
  }, []);

  return { isAuthenticated, token, login, logout: handleLogout };
}
```

**src/hooks/useApi.ts**
```typescript
import { useState, useEffect } from 'react';
import { fetchData } from '../services/api';

export function useApi<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchData<T>(endpoint)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [endpoint]);

  return { data, loading, error };
}
```

**src/hooks/index.ts**
```typescript
export { useAuth } from './useAuth';
export { useApi } from './api';
```

#### 2.2.6 Components 层文件

**src/components/Button.tsx**
```typescript
import React from 'react';

export interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

/**
 * A reusable button component
 */
export function Button({ onClick, children, disabled, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}
```

**src/components/Form.tsx**
```typescript
import React, { useState } from 'react';
import { Button, ButtonProps } from './Button';
import { validateEmail } from '../utils/validate';

export interface FormProps {
  onSubmit: (data: { email: string }) => void;
}

export function Form({ onSubmit }: FormProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateEmail(email)) {
      onSubmit({ email });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <Button onClick={() => handleSubmit}>Submit</Button>
    </form>
  );
}
```

**src/components/Modal.tsx**
```typescript
import React from 'react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{title}</h2>
        <div>{children}</div>
        <Button onClick={onClose} variant="secondary">Close</Button>
      </div>
    </div>
  );
}
```

**src/components/index.ts**
```typescript
export { Button, ButtonProps } from './Button';
export { Form, FormProps } from './Form';
export { Modal, ModalProps } from './Modal';
```

#### 2.2.7 Pages 层文件

**src/pages/home.ts**
```typescript
import { fetchData } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { User } from '../types/user';

export async function renderHomePage() {
  const user = await fetchData<User>('user/profile');
  return {
    title: 'Home',
    user,
  };
}
```

**src/pages/login.ts**
```typescript
import { authenticate } from '../services/auth';
import { Form } from '../components/Form';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();

  const handleLogin = async ({ email }: { email: string }) => {
    await login(email, 'password');
  };

  return Form({ onSubmit: handleLogin });
}
```

**src/pages/dashboard.ts**
```typescript
import { CacheService } from '../services/cache';
import { fetchData, postData } from '../services/api';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';

const cache = new CacheService();

export async function loadDashboardData() {
  const cached = cache.get('dashboard');
  if (cached) return cached;

  const data = await fetchData('dashboard/stats');
  cache.set('dashboard', data);
  return data;
}
```

**src/pages/index.ts**
```typescript
export { renderHomePage } from './home';
export { LoginPage } from './login';
export { loadDashboardData } from './dashboard';
```

#### 2.2.8 入口文件

**src/app.ts**
```typescript
import { renderHomePage } from './pages/home';
import { LoginPage } from './pages/login';

export async function initApp() {
  await renderHomePage();
}
```

**src/index.ts**
```typescript
export { initApp } from './app';
export * from './pages';
export * from './services';
export * from './utils';
export * from './components';
export * from './hooks';
export * from './types';
```

#### 2.2.9 测试文件

**tests/utils/format.test.ts**
```typescript
import { formatDate, formatNumber } from '../../src/utils/format';

describe('format utils', () => {
  test('formatDate returns ISO string', () => {
    const date = new Date('2024-01-01');
    expect(formatDate(date)).toBe('2024-01-01T00:00:00.000Z');
  });

  test('formatNumber with default decimals', () => {
    expect(formatNumber(3.14159)).toBe('3.14');
  });
});
```

**tests/services/auth.test.ts**
```typescript
import { authenticate, logout } from '../../src/services/auth';
import { validateEmail } from '../../src/utils/validate';

jest.mock('axios');

describe('auth service', () => {
  test('authenticate returns success', async () => {
    const result = await authenticate('test@test.com', 'password');
    expect(result.success).toBe(true);
  });
});
```

---

## 3. 期望结果定义

### 3.1 节点计数期望

| 节点类型 | 预期数量 | 说明 |
|---------|---------|------|
| DIRECTORY | 12 | src, src/utils, src/services, src/pages, src/components, src/types, src/hooks, tests, tests/utils, tests/services, tests/components, tests/integration |
| FILE | 34 | 详见文件列表 |
| MODULE | 42 | 导出的函数、类、组件、接口、类型、常量 |
| EXTERNAL | 3 | axios, lodash, react |

**MODULE 节点详细列表**:

| 文件路径 | 导出节点 ID |
|---------|------------|
| src/utils/format.ts | MODULE:src/utils/format.ts#formatDate, MODULE:src/utils/format.ts#formatNumber |
| src/utils/validate.ts | MODULE:src/utils/validate.ts#validateEmail, MODULE:src/utils/validate.ts#validatePhone, MODULE:src/utils/validate.ts#oldEmailCheck |
| src/utils/constants.ts | MODULE:src/utils/constants.ts#API_BASE_URL, MODULE:src/utils/constants.ts#MAX_RETRY_COUNT, MODULE:src/utils/constants.ts#TIMEOUT_MS, MODULE:src/utils/constants.ts#ErrorCodes |
| src/services/auth.ts | MODULE:src/services/auth.ts#authenticate, MODULE:src/services/auth.ts#logout, MODULE:src/services/auth.ts#AuthResult |
| src/services/api.ts | MODULE:src/services/api.ts#fetchData, MODULE:src/services/api.ts#postData |
| src/services/cache.ts | MODULE:src/services/cache.ts#CacheService |
| src/types/user.ts | MODULE:src/types/user.ts#User, MODULE:src/types/user.ts#UserRole |
| src/types/api.ts | MODULE:src/types/api.ts#ApiResponse, MODULE:src/types/api.ts#ApiError |
| src/hooks/useAuth.ts | MODULE:src/hooks/useAuth.ts#useAuth |
| src/hooks/useApi.ts | MODULE:src/hooks/useApi.ts#useApi |
| src/components/Button.tsx | MODULE:src/components/Button.tsx#Button, MODULE:src/components/Button.tsx#ButtonProps |
| src/components/Form.tsx | MODULE:src/components/Form.tsx#Form, MODULE:src/components/Form.tsx#FormProps |
| src/components/Modal.tsx | MODULE:src/components/Modal.tsx#Modal, MODULE:src/components/Modal.tsx#ModalProps |
| src/pages/home.ts | MODULE:src/pages/home.ts#renderHomePage |
| src/pages/login.ts | MODULE:src/pages/login.ts#LoginPage |
| src/pages/dashboard.ts | MODULE:src/pages/dashboard.ts#loadDashboardData |
| src/app.ts | MODULE:src/app.ts#initApp |

### 3.2 边计数期望

| 边类型 | 预期数量 | 说明 |
|-------|---------|------|
| CONTAINS | 46 | 目录→文件/子目录关系 |
| IMPORTS | 28 | 文件间静态导入 |
| RE_EXPORTS | 7 | barrel file 重导出 |
| DYNAMIC_IMPORTS | 0 | sample-project 无动态导入 |
| CALLS | 15+ | 函数调用关系（需 TypeChecker） |
| EXTENDS | 0 | 无类继承 |
| IMPLEMENTS | 0 | 无接口实现 |

**IMPORTS 边详细列表**:

| 源文件 | 目标文件 | 导入内容 |
|-------|---------|---------|
| src/services/auth.ts | src/utils/validate.ts | validateEmail |
| src/services/auth.ts | src/utils/format.ts | formatDate |
| src/services/auth.ts | src/utils/constants.ts | API_BASE_URL |
| src/services/auth.ts | EXTERNAL:axios | axios |
| src/services/api.ts | src/services/auth.ts | authenticate |
| src/services/api.ts | src/utils/constants.ts | API_BASE_URL, TIMEOUT_MS |
| src/services/api.ts | EXTERNAL:axios | axios |
| src/services/cache.ts | EXTERNAL:lodash | lodash |
| src/hooks/useAuth.ts | EXTERNAL:react | useState, useCallback |
| src/hooks/useAuth.ts | src/services/auth.ts | authenticate, logout |
| src/hooks/useApi.ts | EXTERNAL:react | useState, useEffect |
| src/hooks/useApi.ts | src/services/api.ts | fetchData |
| src/components/Form.tsx | src/components/Button.tsx | Button, ButtonProps |
| src/components/Form.tsx | src/utils/validate.ts | validateEmail |
| src/components/Form.tsx | EXTERNAL:react | useState |
| src/components/Modal.tsx | src/components/Button.tsx | Button |
| src/pages/home.ts | src/services/api.ts | fetchData |
| src/pages/home.ts | src/hooks/useAuth.ts | useAuth |
| src/pages/home.ts | src/components/Button.tsx | Button |
| src/pages/home.ts | src/types/user.ts | User |
| src/pages/login.ts | src/services/auth.ts | authenticate |
| src/pages/login.ts | src/components/Form.tsx | Form |
| src/pages/login.ts | src/hooks/useAuth.ts | useAuth |
| src/pages/dashboard.ts | src/services/cache.ts | CacheService |
| src/pages/dashboard.ts | src/services/api.ts | fetchData, postData |
| src/pages/dashboard.ts | src/components/Modal.tsx | Modal |
| src/pages/dashboard.ts | src/components/Button.tsx | Button |
| src/app.ts | src/pages/home.ts | renderHomePage |
| src/app.ts | src/pages/login.ts | LoginPage |

### 3.3 分层推断期望

根据导入方向，预期推断出以下分层结构：

```
Layer 1 (基础层, 被所有层依赖):
  - src/utils/
  - src/types/

Layer 2 (服务层, 依赖 Layer 1):
  - src/services/
  - src/hooks/

Layer 3 (UI层, 依赖 Layer 1 + Layer 2):
  - src/components/

Layer 4 (应用层, 依赖所有下层):
  - src/pages/
  - src/app.ts
  - src/index.ts

Layer 5 (测试层, 不参与生产代码分层):
  - tests/
```

**层级依赖规则**:
- 正常: Layer N → Layer (N-1) 及以下
- 违规: Layer N → Layer (N+1) 及以上

**预期违规检测**:
- sample-project 设计上无分层违规（所有导入方向正确）

### 3.4 影响范围分析期望

**场景: 修改 `src/services/auth.ts`**

预期受影响文件（下游依赖链）:
```
直接依赖 (1-hop):
  - src/services/api.ts
  - src/hooks/useAuth.ts
  - src/pages/login.ts
  - tests/services/auth.test.ts

间接依赖 (2-hop):
  - src/hooks/useApi.ts (因 api.ts 变化)
  - src/pages/home.ts (因 useAuth 变化)
  - src/pages/dashboard.ts (因 api.ts 变化)

间接依赖 (3-hop):
  - src/app.ts (因 home.ts, login.ts 变化)
  - src/index.ts (因 app.ts 变化)
  - tests/integration/app.test.ts
```

**影响范围总数**: 10 个文件

### 3.5 循环依赖检测结果

预期结果: **无循环依赖**

sample-project 设计时确保:
- utils 不导入任何内部模块
- services 仅导入 utils
- components 仅导入 utils 和其他 components
- pages 仅导入 services, hooks, components, types
- 无反向导入

---

## 4. alias-project（别名路径测试）

### 4.1 目录结构

```
fixtures/alias-project/
├── package.json
├── tsconfig.json              # paths 配置关键
├── src/
│   ├── utils/
│   │   ├── helpers/
│   │   │   ├── string.ts      # 导出 trimString
│   │   │   ├── number.ts      # 导出 roundNumber
│   │   │   └── index.ts       # barrel
│   │   ├── deep/
│   │   │   ├── nested/
│   │   │   │   ├── helper.ts  # 导出 deepHelper
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── processor.ts       # 使用 @utils/* 别名导入
│   │   └── calculator.ts      # 使用 @utils/deep/* 别名
│   ├── components/
│   │   ├── app/
│   │   │   ├── main.tsx       # 使用 @components/* 别名
│   │   │   └── sidebar.tsx
│   │   ├── shared/
│   │   │   ├── button.tsx
│   │   │   └── modal.tsx
│   │   └── index.ts
│   ├── app.ts                 # 多种别名混合使用
│   └── index.ts
```

### 4.2 tsconfig.json 配置

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@utils/*": ["src/utils/*"],
      "@utils/helpers/*": ["src/utils/helpers/*"],
      "@utils/deep/*": ["src/utils/deep/*", "src/utils/deep/nested/*"],
      "@services/*": ["src/services/*"],
      "@components/*": ["src/components/*"],
      "@components/shared/*": ["src/components/shared/*"],
      "@/*": ["src/*"]
    }
  }
}
```

### 4.3 关键测试文件

**src/services/processor.ts**
```typescript
import { trimString } from '@utils/helpers/string';
import { roundNumber } from '@utils/helpers/number';
import { deepHelper } from '@utils/deep/nested/helper';

export function process(input: string): number {
  const trimmed = trimString(input);
  return roundNumber(Number(trimmed));
}
```

**src/components/app/main.tsx**
```typescript
import { Button } from '@components/shared/button';
import { Modal } from '@components/shared/modal';

export function MainApp() {
  return (
    <div>
      <Button>Click</Button>
      <Modal>Content</Modal>
    </div>
  );
}
```

**src/app.ts** (混合别名测试)
```typescript
import { process } from '@services/processor';
import { trimString } from '@utils/helpers/string';
import { MainApp } from '@components/app/main';
import { config } from '@/config';  // @/* 别名

// 同一文件使用多种别名路径
```

### 4.4 期望解析结果

| 别名导入路径 | 解析为实际文件路径 |
|------------|------------------|
| `@utils/helpers/string` | `src/utils/helpers/string.ts` |
| `@utils/deep/nested/helper` | `src/utils/deep/nested/helper.ts` |
| `@components/shared/button` | `src/components/shared/button.tsx` |
| `@services/processor` | `src/services/processor.ts` |
| `@/config` | `src/config.ts` |

**测试断言**:
- 所有 IMPORTS 边的目标节点 ID 应为实际文件路径而非别名路径
- 别名解析失败时应创建 EXTERNAL 节点（如 `@unknown/path`）

---

## 5. edge-case-project（边界情况测试）

### 5.1 目录结构

```
fixtures/edge-case-project/
├── package.json
├── tsconfig.json
├── src/
│   ├── imports/
│   │   ├── default-import.ts      # 默认导入测试
│   │   ├── named-import.ts        # 命名导入测试
│   │   ├── mixed-import.ts        # 混合导入测试
│   │   ├── namespace-import.ts    # namespace 导入测试
│   │   ├── side-effect-import.ts  # 副作用导入测试
│   │   ├── dynamic-import.ts      # 动态导入测试
│   │   ├── reexport-all.ts        # export * from 测试
│   │   ├── reexport-named.ts      # export { x } from 测试
│   │   ├── reexport-renamed.ts    # export { x as y } from 测试
│   │   └── reexport-default.ts    # export { default } from 测试
│   ├── exports/
│   │   ├── default-export.ts      # 默认导出测试
│   │   ├── named-export.ts        # 命名导出测试
│   │   ├── multi-export.ts        # 多重导出测试
│   │   ├── inline-export.ts       # inline export 测试
│   │   ├── type-export.ts         # type-only export 测试
│   │   └── const-export.ts        # const enum export 测试
│   ├── definitions/
│   │   ├── function-decl.ts       # 函数声明导出
│   │   ├── function-expr.ts       # 函数表达式导出
│   │   ├── arrow-func.ts          # 箭头函数导出
│   │   ├── class-decl.ts          # 类声明导出
│   │   ├── class-expr.ts          # 类表达式导出
│   │   ├── interface.ts           # 接口导出
│   │   ├── type-alias.ts          # 类型别名导出
│   │   ├── enum.ts                # enum 导出
│   │   ├── const-enum.ts          # const enum 导出
│   │   ├── variable.ts            # 变量导出
│   │   └── destructure.ts         # 解构导出
│   ├── external/
│   │   ├── external-package.ts    # 外部包导入
│   │   ├── external-types.ts      # @types 包导入
│   │   ├── external-scoped.ts     # scoped 包导入
│   │   └── built-in.ts            # Node.js 内置模块导入
│   ├── relative/
│   │   ├── self-import.ts         # 导入自身（错误情况）
│   │   ├── missing-import.ts      # 导入不存在文件
│   │   ├── circular-ref.ts        # 相对路径循环引用
│   │   ├── deep-relative.ts       # ../../.. 深层相对路径
│   │   └── extension-import.ts    # 带 .ts 扩展名导入
│   ├── complex/
│   │   ├── decorators.ts          # 装饰器语法
│   │   ├── generics.ts            # 泛型复杂用法
│   │   ├── async-await.ts         # async/await 模式
│   │   ├── callbacks.ts           # callback 模式
│   │   └── event-handlers.ts      # 事件处理器模式
│   └── index.ts                   # 入口文件
```

### 5.2 关键测试文件内容

#### 默认导入/导出测试

**src/exports/default-export.ts**
```typescript
export default function defaultFunction(): string {
  return 'default';
}

// 也导出命名导出
export const namedExport = 'named';
```

**src/imports/default-import.ts**
```typescript
import defaultFunc from '../exports/default-export';
import { namedExport } from '../exports/default-export';

export function useDefault(): string {
  return defaultFunc();
}
```

#### 命名导入测试

**src/imports/named-import.ts**
```typescript
import { formatDate, formatNumber } from '../exports/multi-export';
import { formatDate as formatD } from '../exports/multi-export';  // 重命名导入

export function useNamed(): void {
  formatDate(new Date());
}
```

#### namespace 导入测试

**src/imports/namespace-import.ts**
```typescript
import * as utils from '../exports/multi-export';

export function useNamespace(): void {
  utils.formatDate(new Date());
  utils.formatNumber(123);
}
```

#### 动态导入测试

**src/imports/dynamic-import.ts**
```typescript
export async function loadModule() {
  const module = await import('../exports/multi-export');
  return module.formatDate;
}

export async function loadDefault() {
  const module = await import('../exports/default-export');
  return module.default;
}
```

#### 重导出测试

**src/imports/reexport-all.ts**
```typescript
export * from '../exports/multi-export';
// 重导出所有命名导出
```

**src/imports/reexport-named.ts**
```typescript
export { formatDate, formatNumber } from '../exports/multi-export';
// 选择性重导出
```

**src/imports/reexport-renamed.ts**
```typescript
export { formatDate as formatD, formatNumber as formatN } from '../exports/multi-export';
// 重导出并重命名
```

**src/imports/reexport-default.ts**
```typescript
export { default } from '../exports/default-export';
// 重导出默认导出
```

#### 外部依赖测试

**src/external/external-package.ts**
```typescript
import axios from 'axios';
import _ from 'lodash';
import { useState } from 'react';

export function useExternal(): void {
  axios.get('/');
  _.map([1, 2, 3], x => x);
  useState(0);
}
```

**src/external/built-in.ts**
```typescript
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export function useBuiltIn(): void {
  fs.readFileSync('test.txt');
  path.join('a', 'b');
}
```

#### type-only 导出测试

**src/exports/type-export.ts**
```typescript
export type MyType = {
  name: string;
  age: number;
};

export interface MyInterface {
  id: string;
}

// TypeScript 5.0+ type-only import/export
export type { MyType, MyInterface };
```

#### 解构导出测试

**src/exports/destructure.ts**
```typescript
export const { a, b } = { a: 1, b: 2 };
export const [x, y] = [1, 2];
export const { nested: { deep } } = { nested: { deep: 'value' } };
```

### 5.3 期望结果定义

#### IMPORTS 边类型识别

| 导入语法 | 预期边类型 | metadata.importSpecifier |
|---------|-----------|------------------------|
| `import foo from './bar'` | IMPORTS | `"default"` |
| `import { a, b } from './bar'` | IMPORTS | `"named:a"`, `"named:b"` |
| `import * as ns from './bar'` | IMPORTS | `"namespace"` |
| `import './bar'` | IMPORTS | `"side-effect"` |
| `await import('./bar')` | DYNAMIC_IMPORTS | `"dynamic"` |

#### RE_EXPORTS 边类型识别

| 导出语法 | 预期边类型 | metadata.importSpecifier |
|---------|-----------|------------------------|
| `export * from './bar'` | RE_EXPORTS | `"all"` |
| `export { a } from './bar'` | RE_EXPORTS | `"named:a"` |
| `export { default } from './bar'` | RE_EXPORTS | `"named:default"` |
| `export { a as b } from './bar'` | RE_EXPORTS | `"named:a→b"` |

#### MODULE 节点 kind 分类

| 导出语法 | 预期 kind |
|---------|---------|
| `export function foo()` | `"function"` |
| `export const foo = () => {}` | `"function"` |
| `export const foo = function() {}` | `"function"` |
| `export class Foo {}` | `"class"` |
| `export interface Foo {}` | `"interface"` |
| `export type Foo = {}` | `"type"` |
| `export enum Foo {}` | `"variable"` |
| `export const foo = 123` | `"variable"` |
| `export function Component()` (JSX) | `"component"` |

---

## 6. cycle-project（循环依赖测试）

### 6.1 目录结构

```
fixtures/cycle-project/
├── package.json
├── tsconfig.json
├── src/
│   ├── simple-cycle/
│   │   ├── a.ts               # 导入 b.ts
│   │   ├── b.ts               # 导入 a.ts
│   │   ├── index.ts           # 导入两者
│   ├── multi-cycle/
│   │   ├── a.ts               # 导入 b.ts
│   │   ├── b.ts               # 导入 c.ts
│   │   ├── c.ts               # 导入 a.ts (形成3节点环)
│   │   ├── index.ts
│   ├── complex-cycle/
│   │   ├── a.ts               # 导入 b.ts, c.ts
│   │   ├── b.ts               # 导入 c.ts
│   │   ├── c.ts               # 导入 d.ts
│   │   ├── d.ts               # 导入 a.ts, b.ts
│   │   ├── index.ts
│   ├── indirect-cycle/
│   │   ├── a.ts               # 导入 b.ts
│   │   ├── b.ts               # 导入 c.ts
│   │   ├── c.ts               # 导入 d.ts
│   │   ├── d.ts               # 导入 b.ts (非直接回 a)
│   │   ├── index.ts
│   ├── barrel-cycle/
│   │   ├── module.ts          # 导出函数
│   │   ├── index.ts           # barrel file 导入 module.ts 并导出
│   │   ├── consumer.ts        # 从 barrel 导入，但 barrel 也导入 consumer?
│   ├── self-cycle/
│   │   ├── a.ts               # 导入自身（极端情况）
│   │   ├── index.ts
│   └── no-cycle/
│   │   ├── a.ts               # 导入 b.ts
│   │   ├── b.ts               # 不导入 a.ts
│   │   ├── index.ts
```

### 6.2 关键测试文件内容

#### 简单循环

**src/simple-cycle/a.ts**
```typescript
import { funcB } from './b';

export function funcA(): string {
  return 'A calls ' + funcB();
}
```

**src/simple-cycle/b.ts**
```typescript
import { funcA } from './a';

export function funcB(): string {
  return 'B calls ' + funcA();
}
```

#### 三节点循环

**src/multi-cycle/a.ts**
```typescript
import { funcB } from './b';
export function funcA(): string {
  return 'A -> ' + funcB();
}
```

**src/multi-cycle/b.ts**
```typescript
import { funcC } from './c';
export function funcB(): string {
  return 'B -> ' + funcC();
}
```

**src/multi-cycle/c.ts**
```typescript
import { funcA } from './a';
export function funcC(): string {
  return 'C -> ' + funcA();
}
```

#### 复杂循环（多环）

**src/complex-cycle/a.ts**
```typescript
import { funcB, funcC } from './b';
import { funcC as funcC2 } from './c';
export function funcA(): void {}
```

**src/complex-cycle/b.ts**
```typescript
import { funcC } from './c';
export function funcB(): void {}
export function funcC(): void {}
```

**src/complex-cycle/c.ts**
```typescript
import { funcD } from './d';
export function funcC(): void {}
```

**src/complex-cycle/d.ts**
```typescript
import { funcA } from './a';
import { funcB } from './b';
export function funcD(): void {}
```

循环链分析:
- 环1: a → b → c → d → a
- 环2: a → b → d → a
- 环3: b → c → d → b

#### 自循环（极端情况）

**src/self-cycle/a.ts**
```typescript
import { funcA } from './a';  // 导入自身！

export function funcA(): string {
  return 'self';
}
```

### 6.3 期望循环检测结果

| 测试目录 | 预期检测到的循环 | 循环大小 |
|---------|----------------|---------|
| simple-cycle | `[FILE:src/simple-cycle/a.ts, FILE:src/simple-cycle/b.ts]` | 2 |
| multi-cycle | `[FILE:src/multi-cycle/a.ts, FILE:src/multi-cycle/b.ts, FILE:src/multi-cycle/c.ts]` | 3 |
| complex-cycle | 3个独立环（见上方分析） | 4, 3, 3 |
| indirect-cycle | `[FILE:src/indirect-cycle/b.ts, FILE:src/indirect-cycle/c.ts, FILE:src/indirect-cycle/d.ts]` | 3 |
| barrel-cycle | 取决于 barrel 是否引入反向依赖 | 待分析 |
| self-cycle | `[FILE:src/self-cycle/a.ts]` (自引用) | 1 |
| no-cycle | 无循环 | 0 |

### 6.4 循环依赖告警格式

预期 API 输出格式:
```
## Circular Dependencies Detected

### Cycle #1 (size: 2)
- FILE:src/simple-cycle/a.ts
- FILE:src/simple-cycle/b.ts

### Cycle #2 (size: 3)
- FILE:src/multi-cycle/a.ts
- FILE:src/multi-cycle/b.ts
- FILE:src/multi-cycle/c.ts

Total: 2 cycles, 5 affected files
```

---

## 7. incremental-project（增量更新测试）

### 7.1 设计说明

此 fixture 需要包含完整的 Git 历史，用于测试增量更新引擎。

**实现方案**: 使用 fixture-loader.ts 中的 `setupGitFixture` 函数，基于初始文件创建临时 Git 仓库，然后模拟多次 commit。

### 7.2 目录结构（初始状态）

```
fixtures/incremental-project/
├── package.json
├── tsconfig.json
├── src/
│   ├── utils/
│   │   ├── helper.ts           # 初始版本
│   │   └── math.ts
│   ├── services/
│   │   ├── core.ts             # 导入 utils/helper
│   │   ├── api.ts              # 导入 services/core
│   ├── app.ts                  # 导入 services/*
│   └── index.ts
└── baseline/                    # 预生成的基线文件（用于对比）
    ├── initial.json            # 初始状态基线
    ├── after-change-1.json     # commit 1 后的期望基线
    ├── after-change-2.json     # commit 2 后的期望基线
    └── after-change-3.json     # commit 3 后的期望基线
```

### 7.3 Git 历史模拟场景

#### Commit 1: 新增文件

**变更内容**:
- 新增 `src/utils/format.ts`
- 新增 `src/services/renderer.ts`（导入 utils/format）

**预期增量更新结果**:
```typescript
{
  commitFrom: "initial",
  commitTo: "commit-1",
  changedFiles: ["src/utils/format.ts", "src/services/renderer.ts"],
  newModules: [
    "MODULE:src/utils/format.ts#formatDate",
    "MODULE:src/services/renderer.ts#render"
  ],
  removedModules: [],
  affectedFiles: [],  // 无级联影响（新增文件不影响现有文件）
  newCycles: null
}
```

#### Commit 2: 修改文件（导出变化）

**变更内容**:
- 修改 `src/utils/helper.ts`，删除导出 `helperA`，新增导出 `helperB`
- 此变更触发级联重解析

**预期级联影响**:
```
直接导入 helper.ts 的文件:
  - src/services/core.ts

间接影响（需要更新 CALLS 边）:
  - src/services/api.ts (因 core.ts 被重解析)
  - src/app.ts (因 api.ts 被重解析)
```

**预期增量更新结果**:
```typescript
{
  commitFrom: "commit-1",
  commitTo: "commit-2",
  changedFiles: ["src/utils/helper.ts"],
  newModules: ["MODULE:src/utils/helper.ts#helperB"],
  removedModules: ["MODULE:src/utils/helper.ts#helperA"],
  affectedFiles: [
    "src/services/core.ts",
    "src/services/api.ts",
    "src/app.ts"
  ],  // 级联影响
  newCycles: null
}
```

#### Commit 3: 删除文件

**变更内容**:
- 删除 `src/services/renderer.ts`

**预期增量更新结果**:
```typescript
{
  commitFrom: "commit-2",
  commitTo: "commit-3",
  changedFiles: ["src/services/renderer.ts"],
  newModules: [],
  removedModules: ["MODULE:src/services/renderer.ts#render"],
  affectedFiles: [],  // renderer.ts 无下游依赖
  newCycles: null
}
```

#### Commit 4: 引入循环依赖

**变更内容**:
- 修改 `src/services/api.ts`，新增导入 `src/app.ts`（反向依赖）

**预期结果**:
```typescript
{
  commitFrom: "commit-3",
  commitTo: "commit-4",
  changedFiles: ["src/services/api.ts"],
  newModules: [],
  removedModules: [],
  affectedFiles: ["src/app.ts"],  // app.ts 被 api.ts 导入
  newCycles: [
    ["FILE:src/services/api.ts", "FILE:src/app.ts"]
  ]
}
```

### 7.4 级联处理测试场景

**测试用例**: 导出变化触发多层级联

```
初始依赖链:
  utils/helper.ts (导出 A, B)
    → services/core.ts (导入 A)
      → services/api.ts (导入 core.funcX)
        → app.ts (导入 api.fetchData)

变更: utils/helper.ts 删除导出 A

级联处理流程:
1. 解析 helper.ts，检测到导出 A 被删除
2. 查找导入 helper.ts 的文件 → core.ts
3. 重解析 core.ts，发现其导出的 funcX 依赖 A
4. funcX 可能被删除或改变签名
5. 查找导入 core.ts 的文件 → api.ts
6. 重解析 api.ts，更新 CALLS 边
7. 查找导入 api.ts 的文件 → app.ts
8. 重解析 app.ts
9. 检查是否有新的级联影响 → 无
10. 完成
```

---

## 8. Fixture 使用指南

### 8.1 Fixture 加载器实现

**test/helpers/fixture-loader.ts**
```typescript
import fs from 'fs';
import path from 'path';
import { CodeGraph } from '@harness/codegraph';

export interface FixtureOptions {
  name: string;
  setupGit?: boolean;
  initialCommit?: string;
}

export async function loadFixture(options: FixtureOptions): Promise<{
  projectRoot: string;
  graph: CodeGraph;
  cleanup: () => void;
}> {
  const fixturePath = path.join(__dirname, '../fixtures', options.name);

  // 创建临时目录（避免修改原始 fixture）
  const tempDir = await createTempDir(fixturePath);

  // 如果需要 Git，初始化仓库并创建 commit
  if (options.setupGit) {
    await initGitRepo(tempDir);
    if (options.initialCommit) {
      await checkoutCommit(tempDir, options.initialCommit);
    }
  }

  // 执行全量分析
  const graph = await CodeGraph.analyzeFull(tempDir);

  return {
    projectRoot: tempDir,
    graph,
    cleanup: () => cleanupTempDir(tempDir),
  };
}

export async function loadFixtureBaseline(fixtureName: string, baselineName: string): Promise<SerializedCodeGraph> {
  const baselinePath = path.join(
    __dirname,
    '../fixtures',
    fixtureName,
    'baseline',
    `${baselineName}.json`
  );
  return JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
}
```

### 8.2 Graph 断言工具

**test/helpers/graph-assertions.ts**
```typescript
import { CodeGraph, GraphNode, GraphEdge } from '@harness/codegraph';

export function assertNodeCount(graph: CodeGraph, type: NodeType, expected: number): void {
  const count = [...graph.nodes.values()].filter(n => n.type === type).length;
  if (count !== expected) {
    throw new Error(`Expected ${expected} ${type} nodes, got ${count}`);
  }
}

export function assertEdgeCount(graph: CodeGraph, type: EdgeType, expected: number): void {
  const count = graph.edges.filter(e => e.type === type).length;
  if (count !== expected) {
    throw new Error(`Expected ${expected} ${type} edges, got ${count}`);
  }
}

export function assertNodeExists(graph: CodeGraph, id: string): void {
  if (!graph.nodes.has(id)) {
    throw new Error(`Node ${id} does not exist in graph`);
  }
}

export function assertEdgeExists(graph: CodeGraph, from: string, to: string, type: EdgeType): void {
  const exists = graph.edges.some(e => e.from === from && e.to === to && e.type === type);
  if (!exists) {
    throw new Error(`Edge ${type}: ${from} → ${to} does not exist`);
  }
}

export function assertNoCycles(graph: CodeGraph): void {
  const cycles = detectCycles(graph);
  if (cycles.length > 0) {
    throw new Error(`Graph has ${cycles.length} cycles: ${JSON.stringify(cycles)}`);
  }
}

export function assertCycles(graph: CodeGraph, expectedCycles: string[][]): void {
  const cycles = detectCycles(graph);
  // 比较循环依赖（忽略顺序）
  const normalizedExpected = expectedCycles.map(c => c.sort());
  const normalizedActual = cycles.map(c => c.sort());

  // 深度比较
  // ...
}

export function assertImpactScope(graph: CodeGraph, target: string, expectedAffected: string[]): void {
  const affected = graph.getImpact([target]);
  // 比较影响范围
  // ...
}

export function assertLayerOrder(graph: CodeGraph, expectedLayers: string[][]): void {
  const layers = graph.getArchitectureLayers();
  // 解析分层结果并比较
  // ...
}
```

### 8.3 测试用例示例

**test/integration/full-analysis.test.ts**
```typescript
import { loadFixture } from '../helpers/fixture-loader';
import { assertNodeCount, assertEdgeCount, assertNoCycles } from '../helpers/graph-assertions';

describe('Full Analysis: sample-project', () => {
  let fixture: Awaited<ReturnType<typeof loadFixture>>;

  beforeAll(async () => {
    fixture = await loadFixture({ name: 'sample-project' });
  });

  afterAll(() => {
    fixture.cleanup();
  });

  test('generates correct DIRECTORY nodes', () => {
    assertNodeCount(fixture.graph, 'DIRECTORY', 12);
  });

  test('generates correct FILE nodes', () => {
    assertNodeCount(fixture.graph, 'FILE', 34);
  });

  test('generates correct MODULE nodes', () => {
    assertNodeCount(fixture.graph, 'MODULE', 42);
  });

  test('generates correct EXTERNAL nodes', () => {
    assertNodeCount(fixture.graph, 'EXTERNAL', 3);
  });

  test('generates correct IMPORTS edges', () => {
    assertEdgeCount(fixture.graph, 'IMPORTS', 28);
  });

  test('generates correct CONTAINS edges', () => {
    assertEdgeCount(fixture.graph, 'CONTAINS', 46);
  });

  test('resolves specific import edge', () => {
    assertEdgeExists(
      fixture.graph,
      'FILE:src/services/auth.ts',
      'FILE:src/utils/validate.ts',
      'IMPORTS'
    );
  });

  test('detects no cycles', () => {
    assertNoCycles(fixture.graph);
  });

  test('infers correct layer order', () => {
    assertLayerOrder(fixture.graph, [
      ['src/utils', 'src/types'],
      ['src/services', 'src/hooks'],
      ['src/components'],
      ['src/pages'],
    ]);
  });
});
```

**test/unit/parser.test.ts**
```typescript
import { loadFixture } from '../helpers/fixture-loader';
import { assertEdgeExists } from '../helpers/graph-assertions';

describe('Parser: alias resolution', () => {
  test('resolves @utils/helpers/* alias', async () => {
    const { graph, cleanup } = await loadFixture({ name: 'alias-project' });

    // 验证别名路径被正确解析为实际文件路径
    assertEdgeExists(
      graph,
      'FILE:src/services/processor.ts',
      'FILE:src/utils/helpers/string.ts',
      'IMPORTS'
    );

    cleanup();
  });
});
```

**test/integration/incremental-update.test.ts**
```typescript
import { loadFixture, loadFixtureBaseline } from '../helpers/fixture-loader';
import { mockGitCommits } from '../helpers/mock-git';

describe('Incremental Update', () => {
  test('handles new file addition', async () => {
    const { projectRoot, graph, cleanup } = await loadFixture({
      name: 'incremental-project',
      setupGit: true,
      initialCommit: 'initial'
    });

    // 模拟 commit 1: 新增文件
    await mockGitCommits(projectRoot, [
      { files: ['src/utils/format.ts', 'src/services/renderer.ts'], type: 'add' }
    ]);

    const { delta } = await graph.updateIncrementally();

    expect(delta.changedFiles).toEqual(['src/utils/format.ts', 'src/services/renderer.ts']);
    expect(delta.newModules).toContain('MODULE:src/utils/format.ts#formatDate');
    expect(delta.affectedFiles).toEqual([]);

    cleanup();
  });

  test('handles export change cascade', async () => {
    const { projectRoot, graph, cleanup } = await loadFixture({
      name: 'incremental-project',
      setupGit: true,
      initialCommit: 'commit-1'
    });

    // 模拟 commit 2: 修改导出
    await mockGitCommits(projectRoot, [
      { files: ['src/utils/helper.ts'], type: 'modify' }
    ]);

    const { delta } = await graph.updateIncrementally();

    expect(delta.removedModules).toContain('MODULE:src/utils/helper.ts#helperA');
    expect(delta.newModules).toContain('MODULE:src/utils/helper.ts#helperB');
    expect(delta.affectedFiles).toEqual([
      'src/services/core.ts',
      'src/services/api.ts',
      'src/app.ts'
    ]);

    cleanup();
  });
});
```

### 8.4 Mock Git 工具

**test/helpers/mock-git.ts**
```typescript
import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';

export interface CommitSpec {
  files: string[];
  type: 'add' | 'modify' | 'delete';
  content?: Record<string, string>;  // 文件内容（用于 modify/add）
}

export async function initGitRepo(projectRoot: string): Promise<void> {
  await git.init({ fs, dir: projectRoot });

  // 初始 commit
  await git.commit({
    fs,
    dir: projectRoot,
    message: 'Initial commit',
    author: { name: 'Test', email: 'test@test.com' }
  });
}

export async function mockGitCommits(projectRoot: string, commits: CommitSpec[]): Promise<void> {
  for (const commit of commits) {
    // 应用文件变更
    for (const filePath of commit.files) {
      const fullPath = path.join(projectRoot, filePath);

      if (commit.type === 'delete') {
        fs.unlinkSync(fullPath);
      } else if (commit.type === 'add' || commit.type === 'modify') {
        const content = commit.content?.[filePath] || generateDefaultContent(filePath);
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
    }

    // 创建 commit
    await git.commit({
      fs,
      dir: projectRoot,
      message: `Mock commit: ${commit.type} ${commit.files.join(', ')}`,
      author: { name: 'Test', email: 'test@test.com' }
    });
  }
}

function generateDefaultContent(filePath: string): string {
  // 根据文件路径生成基本内容
  const basename = path.basename(filePath, '.ts');
  return `export function ${basename}(): void {}\n`;
}
```

---

## 附录 A: Fixture 文件生成脚本

为避免手动维护大量 fixture 文件，建议提供生成脚本：

```typescript
// scripts/generate-fixtures.ts
import fs from 'fs';
import path from 'path';

const fixtures = [
  { name: 'sample-project', spec: sampleProjectSpec },
  { name: 'alias-project', spec: aliasProjectSpec },
  // ...
];

for (const { name, spec } of fixtures) {
  const fixtureDir = path.join('test/fixtures', name);
  fs.mkdirSync(fixtureDir, { recursive: true });

  for (const [filePath, content] of Object.entries(spec.files)) {
    fs.writeFileSync(path.join(fixtureDir, filePath), content);
  }
}
```

---

## 附录 B: 性能基准 Fixture

用于第 16.3 章性能测试的大型 fixture：

```
fixtures/performance-benchmark/
├── (1000+ .ts 文件)
├── src/
│   ├── modules/          # 100个子目录
│   ├── services/         # 50个文件
│   ├── utils/            # 30个文件
│   ├── types/            # 20个文件
│   └── index.ts
```

生成方式: 使用脚本随机生成文件树，包含:
- 每个文件 20-50 行代码
- 每个文件导入 2-5 个其他文件
- 约 5% 的文件包含循环依赖

---

## 附录 C: 测试覆盖矩阵

| 功能模块 | 对应 Fixture | 测试类型 |
|---------|-------------|---------|
| 图数据结构 | sample-project (基线) | 单元测试 |
| 文件扫描 | sample-project | 单元测试 |
| 导入解析 | edge-case-project | 单元测试 |
| 别名解析 | alias-project | 单元测试 |
| MODULE 提取 | edge-case-project/definitions | 单元测试 |
| 调用图 | sample-project | 集成测试 |
| 循环检测 | cycle-project | 单元测试 |
| 分层推断 | sample-project | 集成测试 |
| 影响范围 | sample-project | 集成测试 |
| 增量更新 | incremental-project | 集成测试 |
| 级联处理 | incremental-project | 集成测试 |
| 约束验证 | cycle-project (违规检测) | 单元测试 |
| 会话监控 | incremental-project (模拟 diff) | 集成测试 |