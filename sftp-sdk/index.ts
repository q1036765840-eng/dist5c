// Interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface DriveInfo {
  name: string;
  path: string;
  type: string;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface UploadAction {
  localDir: string;
  remoteDir?: string;
  dirName?: string;
  fileTypeFilter?: 'video' | 'image' | 'excel' | 'all';
  customerFilter?: string[] | Set<string>;
  callbackUrl?: string;
  callbackMethod?: string;
  callbackHeaders?: Record<string, string> | Map<string, string>;
  callbackBody?: any;
}

export interface UploadTask {
  taskId: string;
  status: string;
  progress: number;
  message: string;
  // Add other fields as needed
}

export class SftpSdk {
  private baseUrl: string;
  private startPort = 16666;
  private maxPort = 16700;
  private probePath = '/api/v1/health';
  private probeTimeout = 1000;
  private autoDiscoverPort = false;
  private _isProbing = false;

  static defaultInstance = new SftpSdk();

  static async discoverBackendPort(startPort = 16666, maxPort = 16700): Promise<boolean> {
    return this.defaultInstance.discoverBackendPort(startPort, maxPort);
  }

  static setDiscoveryOptions(options: {
    autoDiscoverPort?: boolean;
    probeTimeout?: number;
    startPort?: number;
    maxPort?: number;
  }): void {
    return this.defaultInstance.setDiscoveryOptions(options);
  }

  static async health(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.defaultInstance.health();
  }

  static async getLocalDrives(): Promise<ApiResponse<DriveInfo[]>> {
    return this.defaultInstance.getLocalDrives();
  }

  static async listLocalFiles(localDir: string): Promise<ApiResponse<FileInfo[]>> {
    return this.defaultInstance.listLocalFiles(localDir);
  }

  static async uploadDirectoryAsync(action: UploadAction): Promise<{ taskId: string; status: string; message: string }> {
    return this.defaultInstance.uploadDirectoryAsync(action);
  }

  static async getTaskProgress(taskId: string): Promise<{ task: UploadTask }> {
    return this.defaultInstance.getTaskProgress(taskId);
  }

  static async pauseTask(taskId: string): Promise<{ message: string; taskId: string; status: string }> {
    return this.defaultInstance.pauseTask(taskId);
  }

  static async resumeTask(taskId: string): Promise<{ message: string; taskId: string; status: string }> {
    return this.defaultInstance.resumeTask(taskId);
  }

  static async deleteTask(taskId: string): Promise<{ message: string; taskId: string }> {
    return this.defaultInstance.deleteTask(taskId);
  }

  static async getAllTasks(): Promise<{ success: boolean; count: number; tasks: UploadTask[] }> {
    return this.defaultInstance.getAllTasks();
  }

  static async clearTasks(type: 'completed' | 'all' = 'completed'): Promise<{ success: boolean; clearedCount: number; message: string }> {
    return this.defaultInstance.clearTasks(type);
  }

  static async clearSingleTask(taskId: string): Promise<{ success: boolean; message: string; taskId: string } | { success: false; error: string }> {
    return this.defaultInstance.clearSingleTask(taskId);
  }

  static async mkdir(remoteDir: string): Promise<ApiResponse<any>> {
    return this.defaultInstance.mkdir(remoteDir);
  }

  static async rmdir(remoteDir: string): Promise<ApiResponse<any>> {
    return this.defaultInstance.rmdir(remoteDir);
  }

  static async deleteFile(remoteFilePath: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.defaultInstance.deleteFile(remoteFilePath);
  }

  constructor(baseUrl: string = 'http://localhost:16666/sftp') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (retry && this.autoDiscoverPort && await this.discoverBackendPort(this.startPort, this.maxPort)) {
        return this.request(endpoint, options, false);
      }
      throw error;
    }
  }

  setDiscoveryOptions(options: {
    autoDiscoverPort?: boolean;
    probeTimeout?: number;
    startPort?: number;
    maxPort?: number;
  }): void {
    if (typeof options.autoDiscoverPort === 'boolean') {
      this.autoDiscoverPort = options.autoDiscoverPort;
    }
    if (typeof options.probeTimeout === 'number') {
      this.probeTimeout = options.probeTimeout;
    }
    if (typeof options.startPort === 'number') {
      this.startPort = options.startPort;
    }
    if (typeof options.maxPort === 'number') {
      this.maxPort = options.maxPort;
    }
  }

  async discoverBackendPort(startPort = this.startPort, maxPort = this.maxPort): Promise<boolean> {
    if (this._isProbing || !this.autoDiscoverPort) {
      return false;
    }

    this._isProbing = true;
    const origin = new URL(this.baseUrl);
    const host = origin.hostname;
    const path = origin.pathname.replace(/\/$/, '');
    const protocol = origin.protocol;

    try {
      for (let port = startPort; port <= maxPort; port += 1) {
        const candidateBase = `${protocol}//${host}:${port}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.probeTimeout);

        try {
          const probeResponse = await fetch(`${candidateBase}${this.probePath}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (probeResponse.ok) {
            this.baseUrl = candidateBase;
            return true;
          }
        } catch (probeError) {
          // continue scanning
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } finally {
      this._isProbing = false;
    }

    return false;
  }

  /**
   * 测试SFTP服务器连接
   */
  async health(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/api/v1/health');
  }

  async testConnection(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.health();
  }

  /**
   * 获取本地驱动器
   */
  async getLocalDrives(): Promise<ApiResponse<DriveInfo[]>> {
    return this.request('/api/v1/local/drives');
  }

  /**
   * 列出本地文件
   */
  async listLocalFiles(localDir: string): Promise<ApiResponse<FileInfo[]>> {
    const params = new URLSearchParams({ localDir });
    return this.request(`/api/v1/local/files?${params}`);
  }

  /**
   * 创建远端目录
   */
  async mkdir(remoteDir: string): Promise<ApiResponse<any>> {
    if (!remoteDir) {
      throw new Error('mkdir requires remoteDir');
    }
    const params = new URLSearchParams({ remoteDir });
    const response = await fetch(`${this.baseUrl}/api/v1/mkdir?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 删除远端目录
   */
  async rmdir(remoteDir: string): Promise<ApiResponse<any>> {
    if (!remoteDir) {
      throw new Error('rmdir requires remoteDir');
    }
    const params = new URLSearchParams({ remoteDir });
    const response = await fetch(`${this.baseUrl}/api/v1/rmdir?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 删除远端文件
   */
  async deleteFile(remoteFilePath: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    if (!remoteFilePath) {
      throw new Error('deleteFile requires remoteFilePath');
    }
    const params = new URLSearchParams({ remoteFilePath });
    const response = await fetch(`${this.baseUrl}/api/v1/delete/file?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 提交异步上传任务
   * @param action UploadAction
   */
  async uploadDirectoryAsync(action: UploadAction): Promise<{ taskId: string; status: string; message: string }> {
    if (!action || !action.localDir) {
      throw new Error('uploadDirectoryAsync requires localDir');
    }

    const payload: Record<string, any> = {
      localDir: action.localDir,
    };

    if (action.remoteDir) {
      payload.remoteDir = action.remoteDir;
    }
    if (action.dirName) {
      payload.dirName = action.dirName;
    }
    if (action.fileTypeFilter) {
      payload.fileTypeFilter = action.fileTypeFilter;
    }
    if (action.customerFilter) {
      payload.customerFilter = Array.isArray(action.customerFilter)
        ? action.customerFilter
        : Array.from(action.customerFilter);
    }
    if (action.callbackUrl) {
      payload.callbackUrl = action.callbackUrl;
    }
    if (action.callbackMethod) {
      payload.callbackMethod = action.callbackMethod;
    }
    if (action.callbackHeaders) {
      if (action.callbackHeaders instanceof Map) {
        const headers: Record<string, string> = {};
        for (const [key, value] of action.callbackHeaders) {
          headers[key] = value;
        }
        payload.callbackHeaders = headers;
      } else {
        payload.callbackHeaders = action.callbackHeaders;
      }
    }
    if (action.callbackBody !== undefined) {
      payload.callbackBody = action.callbackBody;
    }

    const response = await fetch(`${this.baseUrl}/api/async/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 查询任务进度
   */
  async getTaskProgress(taskId: string): Promise<{ task: UploadTask }> {
    const response = await fetch(`${this.baseUrl}/api/async/query/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 暂停任务
   */
  async pauseTask(taskId: string): Promise<{ message: string; taskId: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/api/async/pause/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 继续任务
   */
  async resumeTask(taskId: string): Promise<{ message: string; taskId: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/api/async/resume/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<{ message: string; taskId: string }> {
    const response = await fetch(`${this.baseUrl}/api/async/delete/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 获取所有任务列表
   */
  async getAllTasks(): Promise<{ success: boolean; count: number; tasks: UploadTask[] }> {
    const response = await fetch(`${this.baseUrl}/api/async/tasks`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 清空已完成/失败的任务
   */
  async clearTasks(type: 'completed' | 'all' = 'completed'): Promise<{ success: boolean; clearedCount: number; message: string }> {
    const params = new URLSearchParams({ type });
    const response = await fetch(`${this.baseUrl}/api/async/tasks/clear?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 清空单个任务（仅限已完成或失败的任务）
   */
  async clearSingleTask(taskId: string): Promise<{ success: boolean; message: string; taskId: string } | { success: false; error: string }> {
    const response = await fetch(`${this.baseUrl}/api/async/tasks/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}

// Default export
export default SftpSdk;