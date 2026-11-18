// Interfaces (for reference, not enforced in JS)
// ApiResponse: { success: boolean, data?: any, message?: string }
// DriveInfo: { name: string, path: string, type: string }
// FileInfo: { name: string, path: string, type: 'file' | 'directory', size?: number }
// UploadAction: {
//   localDir: string;                // 本地目录，必填
//   remoteDir?: string;              // 远端目录，可选
//   dirName?: string;                // 上传目录名称，可选
//   fileTypeFilter?: 'video' | 'image' | 'excel' | 'all'; // 预定义文件类型过滤，可选
//   customerFilter?: string[] | Set<string>; // 自定义扩展名过滤，例如 ['mp4','xlsx','xml']
//   callbackUrl?: string;            // 回调地址
//   callbackMethod?: string;         // 回调方法，默认 POST
//   callbackHeaders?: Object|Map;    // 回调自定义请求头
//   callbackBody?: any;              // 回调自定义参数
//   platform?: string;               // 平台来源，用于多平台任务区分
// }
// UploadTask: { taskId: string, status: string, progress: number, message: string, platform?: string }
// SecretConfigAction: { secret: string }  // 配置密钥，包含所有SFTP配置参数

class SftpSdk {
  constructor(baseUrl = 'http://localhost:16666/sftp') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.startPort = 16666;
    this.maxPort = 16700;
    this.probePath = '/api/v1/health';
    this.probeTimeout = 1000;
    this.autoDiscoverPort = false;
    this._isProbing = false;
  }

  // 静态默认实例
  static defaultInstance = new SftpSdk();

  // 静态方法，直接调用默认实例
  static async health() {
    return this.defaultInstance.health();
  }

  static async getLocalDrives() {
    return this.defaultInstance.getLocalDrives();
  }

  static async listLocalFiles(localDir) {
    return this.defaultInstance.listLocalFiles(localDir);
  }

  static async uploadDirectoryAsync(action) {
    return this.defaultInstance.uploadDirectoryAsync(action);
  }

  static async getTaskProgress(taskId) {
    return this.defaultInstance.getTaskProgress(taskId);
  }

  static async pauseTask(taskId) {
    return this.defaultInstance.pauseTask(taskId);
  }

  static async resumeTask(taskId) {
    return this.defaultInstance.resumeTask(taskId);
  }

  static async deleteTask(taskId) {
    return this.defaultInstance.deleteTask(taskId);
  }

  static async getAllTasks(platform) {
    return this.defaultInstance.getAllTasks(platform);
  }

  static async getTasksByPage(params) {
    return this.defaultInstance.getTasksByPage(params);
  }

  static async clearTasks(type = 'completed') {
    return this.defaultInstance.clearTasks(type);
  }

  static async clearSingleTask(taskId) {
    return this.defaultInstance.clearSingleTask(taskId);
  }

  static async mkdir(remoteDir) {
    return this.defaultInstance.mkdir(remoteDir);
  }

  static async rmdir(remoteDir) {
    return this.defaultInstance.rmdir(remoteDir);
  }

  static async deleteFile(remoteFilePath) {
    return this.defaultInstance.deleteFile(remoteFilePath);
  }

  static async discoverBackendPort(startPort = 16666, maxPort = 16700) {
    return this.defaultInstance.discoverBackendPort(startPort, maxPort);
  }

  static setDiscoveryOptions(options = {}) {
    return this.defaultInstance.setDiscoveryOptions(options);
  }

  static async setConfig(config) {
    return this.defaultInstance.setConfig(config);
  }

  static async getConfig() {
    return this.defaultInstance.getConfig();
  }

  async request(endpoint, options = {}, retry = true) {
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
      return {
        success: false,
        message: '连接失败',
        obj: error
      }
    }
  }

  setDiscoveryOptions(options = {}) {
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

  async discoverBackendPort(startPort = this.startPort, maxPort = this.maxPort) {
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
   * 检查后端服务健康状态
   */
  async health() {
    return this.request('/api/v1/health');
  }

  async testConnection() {
    return this.health();
  }

  /**
   * 获取本地驱动器
   */
  async getLocalDrives() {
    return this.request('/api/v1/local/drives');
  }

  /**
   * 列出本地文件
   */
  async listLocalFiles(localDir) {
    const params = new URLSearchParams({ localDir });
    return this.request(`/api/v1/local/files?${params}`);
  }

  /**
   * 创建远端目录
   */
  async mkdir(remoteDir) {
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
  async rmdir(remoteDir) {
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
  async deleteFile(remoteFilePath) {
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
   * @param action { localDir, remoteDir, dirName, fileTypeFilter, customerFilter, pathFilter, callbackUrl, callbackMethod, callbackHeaders, callbackBody, platform }
   *   localDir: string - 本地目录路径，必填
   *   remoteDir?: string - 远端目录路径，可选
   *   dirName?: string - 上传时目录名称，可选
   *   fileTypeFilter?: 'video' | 'image' | 'excel' | 'all' - 预定义过滤类型，可选， 也可以video,image 用,号隔开传入多值过滤
   *   customerFilter?: string[] | Set<string> - 自定义扩展名集合，可选，例如 ['mp4', 'xlsx', 'xml'] **如果传入了自定义的扩展，则会舍弃预定义扩展**
   *   pathFilter?: string[] | Set<string> - 要上传的路径集合，可选，按选中路径过滤上传内容
   *   callbackUrl?: string - 回调地址，可选
   *   callbackMethod?: string - 回调方法，默认 POST
   *   callbackHeaders?: Object|Map - 回调自定义请求头，可选
   *   callbackBody?: any - 回调自定义参数，可选
   *   platform?: string - 平台来源，可选，用于多平台任务区分（如 'windows'）
   */
  async uploadDirectoryAsync(action) {
    if (!action || !action.localDir) {
      throw new Error('uploadDirectoryAsync requires localDir');
    }

    const payload = {
      localDir: action.localDir,
      ...(action.remoteDir ? { remoteDir: action.remoteDir } : {}),
      ...(action.dirName ? { dirName: action.dirName } : {}),
      ...(action.fileTypeFilter ? { fileTypeFilter: action.fileTypeFilter } : {}),
      ...(action.customerFilter
        ? {
            customerFilter: Array.isArray(action.customerFilter)
              ? action.customerFilter
              : Array.from(action.customerFilter),
          }
        : {}),
      ...(action.pathFilter
        ? {
            pathFilter: Array.isArray(action.pathFilter)
              ? action.pathFilter
              : Array.from(action.pathFilter),
          }
        : {}),
      ...(action.callbackUrl ? { callbackUrl: action.callbackUrl } : {}),
      ...(action.callbackMethod ? { callbackMethod: action.callbackMethod } : {}),
      ...(action.callbackHeaders
        ? {
            callbackHeaders: action.callbackHeaders instanceof Map
              ? Object.fromEntries(action.callbackHeaders)
              : action.callbackHeaders,
          }
        : {}),
      ...(action.callbackBody !== undefined ? { callbackBody: action.callbackBody } : {}),
      ...(action.platform ? { platform: action.platform } : {}),
    };

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
  async getTaskProgress(taskId) {
    const response = await fetch(`${this.baseUrl}/api/async/query/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 暂停任务
   */
  async pauseTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/async/pause/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 继续任务
   */
  async resumeTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/async/resume/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/async/delete/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 获取任务列表
   * @param platform 可选，按平台来源筛选（如 'windows'），不传则返回全部
   */
  async getAllTasks(platform) {
    const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    const response = await fetch(`${this.baseUrl}/api/async/tasks${query}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 分页查询任务列表
   * @param params.platform 可选，按平台来源筛选（如 'windows'），不传则返回全部
   * @param params.status 可选，按任务状态筛选（如 'COMPLETED'/'FAILED'/'PAUSED'/'UPLOADING'/'PENDING'），不传则返回全部
   * @param params.page 页码，从 1 开始，默认 1
   * @param params.size 每页条数，默认 20，上限 200
   * 按创建时间降序排列（最新在前），保证分页结果稳定。
   */
  async getTasksByPage(params) {
    const query = new URLSearchParams();
    if (params && params.platform) {
      query.set('platform', params.platform);
    }
    if (params && params.status) {
      query.set('status', params.status);
    }
    if (params && params.page !== undefined && params.page !== null) {
      query.set('page', String(params.page));
    }
    if (params && params.size !== undefined && params.size !== null) {
      query.set('size', String(params.size));
    }
    const qs = query.toString();
    const response = await fetch(`${this.baseUrl}/api/async/tasks/page${qs ? `?${qs}` : ''}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 清空已完成/失败的任务
   */
  async clearTasks(type = 'completed') {
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
  async clearSingleTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/async/tasks/${taskId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 配置SFTP连接参数（密钥方式）
   * 前端只需传递密钥，后端通过密钥查询所有配置参数（host, port, username, password 等）
   * @param secret { string } - 配置密钥
   * @returns { success: boolean, message: string, connectionTest: string }
   */
  async setConfig(secret) {
    if (!secret) {
      throw new Error('setConfig requires secret');
    }

    const payload = {
      secret: secret,
    };

    const response = await fetch(`${this.baseUrl}/api/v1/config`, {
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
   * 获取当前SFTP配置
   * 获取已配置的SFTP连接参数信息（密码字段不返回具体值，仅返回是否存在）
   * @returns { host: string, port: number, username: string, hasPassword: boolean, configured: boolean }
   */
  async getConfig() {
    const response = await fetch(`${this.baseUrl}/api/v1/config`, {
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
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SftpSdk;
} else if (typeof window !== 'undefined') {
  window.SftpSdk = SftpSdk;
}