import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  status?: number;
  error?: string;
  success?: boolean;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user?: any;
}

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.loadTokens();
    this.setupInterceptors();
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      const token = localStorage.getItem('refresh_token');
      if (token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      }
    }
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.client.post('/users/token', {
                refresh_token: refreshToken,
              });

              const { access_token } = response.data.data;
              this.accessToken = access_token;
              localStorage.setItem('access_token', access_token);
              this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
              console.log("Tooken", access_token);
              console.log('Token refreshed successfully', this.client.defaults.headers.common['Authorization']);
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async signup(email: string, phone: string, password: string, role: string) {
    const response = await this.client.post<ApiResponse>('/users/signup', {
      email,
      phone,
      password,
      role,
    });
    return response;
  }

  async login(userIdentification: string, password: string, rememberMe: boolean = false) {
    const response = await this.client.post<ApiResponse>('/users/login', {
      user_identification: userIdentification,
      password,
      remember_me: rememberMe,
    });
    return response;
  }

  async verifyOtp(requestId: string, otp: string) {
    const response = await this.client.post<ApiResponse<AuthTokens>>(
      '/verify/otp',
      {
        request_id: requestId,
        otp,
      }
    );
    
    if (response.data?.data) {
      const tokens = response.data.data;
      const { access_token, refresh_token } = tokens;
      this.accessToken = access_token;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    }
    
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get<ApiResponse>('/users/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.client.put<ApiResponse>('/users/profile', data);
    return response.data;
  }

  async logout() {
    try {
      await this.client.delete('/users/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      this.accessToken = null;
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  // Routes endpoints
  async listRoutes() {
    const response = await this.client.get<ApiResponse>('/routes');
    return response.data;
  }

  async getRoute(id: string) {
    const response = await this.client.get<ApiResponse>(`/routes/${id}`);
    return response.data;
  }

  async createRoute(data: any) {
    const response = await this.client.post<ApiResponse>('/routes', data);
    return response.data;
  }

  async updateRoute(id: string, data: any) {
    const response = await this.client.put<ApiResponse>(`/routes/${id}`, data);
    return response.data;
  }

  async deleteRoute(id: string) {
    const response = await this.client.delete<ApiResponse>(`/routes/${id}`);
    return response.data;
  }

  async matchRoute(weight: number, origin: string, destination: string, transport_mode: string, service_level: string) {
    const response = await this.client.post<ApiResponse>('/routes/match', {
      weight,
      origin_city: origin,
      destination_city: destination,
      transport_mode,
      service_level,
    });
    return response.data;
  }

  // Shipments endpoints
  async createShipment(data: any) {
    const response = await this.client.post<ApiResponse>('/shipments', data);
    return response.data;
  }

  async getAllShipments(filters?: any) {
    const response = await this.client.get<ApiResponse>('/shipments', { params: filters });
    return response.data;
  }

  async listShipments(userId: number, filters?: any) {
    const response = await this.client.get<ApiResponse>(`/shipments/users/${userId}`, {params: filters });
    return response.data;
  }

  async getAdminStats() {
    const response = await this.client.get<ApiResponse>('/shipments/admin/stats');
    return response.data;
  }

  async getShipment(id: string) {
    const response = await this.client.get<ApiResponse>(`/shipments/track/${id}`);
    return response.data;
  }

  async updateShipmentStatus(id: string, status: string, notes?: string) {
    const response = await this.client.put<ApiResponse>(`/shipments/${id}/status`, {
      status,
      notes,
    });
    return response.data;
  }

  // Drivers endpoints
  async listDrivers() {
    const response = await this.client.get<ApiResponse>('/users?role=driver');
    return response.data;
  }

  async getDriver(id: string) {
    const response = await this.client.get<ApiResponse>(`/users/${id}`);
    return response.data;
  }

  async createDriver(data: any) {
    const response = await this.client.post<ApiResponse>('/users', {
      ...data,
      account_type: 'driver',
    });
    return response.data;
  }

  async updateDriver(id: string, data: any) {
    const response = await this.client.put<ApiResponse>(`/users/${id}`, data);
    return response.data;
  }

  async deleteDriver(id: string) {
    const response = await this.client.delete<ApiResponse>(`/users/${id}`);
    return response.data;
  }

  // Requests endpoints
  async listRequests() {
    const response = await this.client.get<ApiResponse>('/requests');
    return response.data;
  }

  async getRequest(id: string) {
    const response = await this.client.get<ApiResponse>(`/requests/${id}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export type { ApiResponse, AuthTokens };
