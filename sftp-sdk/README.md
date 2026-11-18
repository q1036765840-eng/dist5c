# SFTP SDK

一个用于调用后端 SFTP 服务的 JavaScript SDK，适用于前端项目快速集成。

## 说明

该 SDK 封装了后端 REST API，提供统一静态方法和实例方法。

默认基础地址：`http://localhost:16666/sftp`

> 注意：SDK 默认不会自动扫描端口，以避免在后端未启动时进行长时间探测。
> 如果你希望启用端口自动发现，请调用 `SftpSdk.setDiscoveryOptions({ autoDiscoverPort: true })`。
>
> 在调用上传或其他 SFTP 相关接口之前，必须先调用 `setConfig(config)` 配置 SFTP 连接参数。

## 安装方式

将 `src/index.js` 复制到目标项目中，作为模块使用。

## 快速开始

### 1. 配置 SFTP

第一次请求之前，先调用 `setConfig`：

```javascript
const SftpSdk = require('sftp-sdk');
// 前端只需传递密钥，后端通过密钥查询所有配置参数（host, port, username, password 等）
await SftpSdk.setConfig(secret);
```

### 2. 后续请求

```javascript
// 获取本地磁盘目录
const drives = await SftpSdk.getLocalDrives();
console.log(drives);
/**
{
    "data": [
        {
            "path": "C:\\",
            "name": "C:\\",
            "type": "drive"
        },
        {
            "path": "D:\\",
            "name": "D:\\",
            "type": "drive"
        },
        {
            "path": "E:\\",
            "name": "E:\\",
            "type": "drive"
        }
    ],
    "success": true
}
 */

// 获取指定地址目录
const files = await SftpSdk.listLocalFiles('E:\\测试');
console.log(files);
/**
{
    "data": [
        {
            "path": "E:\\测试\\111",
            "name": "111",
            "type": "directory"
        },
        {
            "path": "E:\\测试\\04.2023年1月19日花龙门（含）-普兴K47+533-K52+910.mp4",
            "size": 126586448,
            "name": "04.2023年1月19日花龙门（含）-普兴K47+533-K52+910.mp4",
            "type": "file"
        },
        {
            "path": "E:\\测试\\08.2023年1月19日太和（含）-眉山K84+531-K90+793.mp4",
            "size": 200950227,
            "name": "08.2023年1月19日太和（含）-眉山K84+531-K90+793.mp4",
            "type": "file"
        }
    ],
    "success": true
}
 */

// 把本地目录上传到线上目录
const task = await SftpSdk.uploadDirectoryAsync({
  localDir: 'E:\\测试',
  remoteDir: '/remote/path',
  dirName: 'upload-测试'
});
console.log(task);

// 目录操作示例
await SftpSdk.mkdir('/remote/new-dir');
await SftpSdk.rmdir('/remote/old-dir');
await SftpSdk.deleteFile('/remote/path/to/file.txt');
```

## API 说明

### 构造器

- `new SftpSdk(baseUrl?: string)`
  - 创建 SDK 实例
  - 默认 `baseUrl`：`http://localhost:16666/sftp`

### 静态默认实例

SDK 内部会创建一个默认实例 `SftpSdk.defaultInstance`，可以直接通过静态方法调用：

- `SftpSdk.health()`
- `SftpSdk.getLocalDrives()`
- `SftpSdk.listLocalFiles(localDir)`
- `SftpSdk.uploadDirectoryAsync(action)`
- `SftpSdk.getTaskProgress(taskId)`
- `SftpSdk.pauseTask(taskId)`
- `SftpSdk.resumeTask(taskId)`
- `SftpSdk.deleteTask(taskId)`
- `SftpSdk.getAllTasks()`
- `SftpSdk.clearTasks(type)`
- `SftpSdk.clearSingleTask(taskId)`
- `SftpSdk.mkdir(remoteDir)`
- `SftpSdk.rmdir(remoteDir)`
- `SftpSdk.deleteFile(remoteFilePath)`
- `SftpSdk.setConfig(config)`
- `SftpSdk.getConfig()`
- `SftpSdk.discoverBackendPort(startPort?, maxPort?)`
- `SftpSdk.setDiscoveryOptions(options)`

### 实例方法

和静态方法相同，使用示例：

```javascript
const sdk = new SftpSdk('http://your-server:16666/sftp');
await sdk.setConfig({
  host: 'sftp.example.com',
  port: 22,
  username: 'your-user',
  password: 'your-password',
});

const health = await sdk.health();
console.log(health);
```

### 方法详情

#### `setConfig(config)`
配置 SFTP 连接参数。首次请求前必须调用。

参数 `config`：
- `host`：SFTP 主机地址，必填
- `port`：SFTP 端口，默认 `22`
- `username`：用户名，必填
- `password`：密码，可选
- `privateKeyPath`：私钥路径，可选

#### `getConfig()`
获取当前已配置的 SFTP 连接信息。

#### `health()`
检查后端服务健康状态。

#### `getLocalDrives()`
获取本地驱动器列表。

#### `listLocalFiles(localDir)`
列出指定本地目录的文件和目录。

参数：
- `localDir`：本地目录路径。

#### `mkdir(remoteDir)`
创建远端目录。

参数：
- `remoteDir`：远端目录路径。

#### `rmdir(remoteDir)`
删除远端目录。

参数：
- `remoteDir`：远端目录路径。

#### `deleteFile(remoteFilePath)`
删除远端文件。

参数：
- `remoteFilePath`：远端文件完整路径。

返回：
- `success`：是否成功
- `message`：操作结果消息

#### `uploadDirectoryAsync(action)`
提交异步上传任务。

参数 `action`：
- `localDir`：本地目录路径（必填）
- `remoteDir`：远端目标目录（可选）
- `dirName`：上传时的目录名（可选）
- `fileTypeFilter`：文件过滤类型，可选值 `video`、`image`、`excel`、`all`， 也可以video,image 用,号隔开传入多值过滤
- `customerFilter`：自定义文件过滤类型数组或 Set，例如 `['mp4','xlsx','xml']` **如果传入了自定义的扩展，则会舍弃预定义扩展**
- `callbackUrl`：上传完成后回调地址，可选
- `callbackMethod`：回调请求方法，默认 `POST`
- `callbackHeaders`：回调请求头，自定义对象或 `Map<string, string>`
- `callbackBody`：回调请求体，自定义参数对象

如果不传 `remoteDir`，后端会使用默认远端路径。

#### `getTaskProgress(taskId)`
查询上传任务进度。

参数：
- `taskId`：任务 ID。

返回结果示例字段：
- `taskId`：任务 ID
- `status`：任务状态，可能值 `PENDING`、`UPLOADING`、`COMPLETED`、`FAILED`、`CANCELLED`
- `localDir`：本地目录路径
- `remoteDir`：远端目录路径
- `dirName`：文件夹名称
- `createTime`：任务创建时间
- `updateTime`：任务更新时间
- `errorMessage`：错误提示信息
- `totalFiles`：总文件数
- `successFiles`：已成功上传文件数
- `failedFiles`：失败文件数
- `totalBytes`：总字节数
- `uploadedBytes`：已上传字节数
- `progressPercent`：任务进度数值（例如 `1`、`20`、`30`，不带％号）

#### `pauseTask(taskId)`
暂停任务。

#### `resumeTask(taskId)`
继续任务。

#### `deleteTask(taskId)`
删除任务。

#### `getAllTasks()`
获取所有任务列表。

返回结果：
- `success`：是否成功
- `count`：任务总数
- `tasks`：任务列表数组

#### `clearTasks(type)`
清空已完成/失败的任务。

参数：
- `type`：清除类型，`'completed'`（默认）或 `'all'`

返回结果：
- `success`：是否成功
- `clearedCount`：清除的任务数量
- `message`：操作消息

#### `clearSingleTask(taskId)`
清空单个任务（仅限已完成或失败的任务）。

参数：
- `taskId`：任务 ID

返回结果：
- `success`：是否成功
- `message`：操作消息
- `taskId`：任务 ID

如果失败：
- `success`：false
- `error`：错误信息

## 浏览器使用

如果在浏览器环境中直接引入 `src/index.js`，SDK 会自动挂载到 `window.SftpSdk`：

```html
<script src="/path/to/index.js"></script>
<script>
  SftpSdk.setConfig({
    host: 'sftp.example.com',
    port: 22,
    username: 'your-user',
    password: 'your-password',
  }).then(() => {
    return SftpSdk.health();
  }).then(console.log);
</script>
```

## 本地测试

可以使用 `node test.js` 测试 SDK 是否可用。

```bash
node test.js
```

## 说明

该项目当前直接使用 `src/index.js`，无需编译。

如果以后改为 TypeScript，可在 `package.json` 中添加构建流程。