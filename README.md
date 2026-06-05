# 文策 AI WPS 加载项

这是一个基于 Vue 3 + Vite 构建的 WPS 文字加载项项目，核心目标是在 WPS 文档编辑场景中接入大模型能力，为用户提供写作、改写、文档问答、全文总结、排版建议、图片生成和历史会话管理等 AI 辅助能力。

项目通过 `public/ribbon.xml` 注册 WPS Ribbon 入口，并在 `src/components/ribbon.js` 中统一处理按钮回调、任务窗格、对话框和右键菜单逻辑。

## 核心功能

### 1. 文策 AI Ribbon 工具栏

插件在 WPS 顶部 Ribbon 中新增“文策 AI”标签页，提供以下功能入口：

- 帮我写：根据用户输入的写作需求、风格和长度生成正文内容，并支持插入到文档末尾。
- 帮我改：针对选中文本提供续写、扩写、重写、缩写、润色、更正式、党政风转换和全文润色。
- 伴写：以任务窗格形式进行连续对话，可选择读取当前文档作为上下文。
- 文档问答：围绕当前文档进行问答，也可叠加外部知识库检索结果。
- 全文总结：读取当前文档全文，生成结构化总结并支持写回文档。
- AI 排版：提供通用排版、论文排版和公文排版建议，并支持应用基础排版规则。
- 文档生成 PPT：根据当前文档生成 PPT 页面结构、大纲和演讲备注。
- AI 生成图片：调用兼容 OpenAI 图片生成接口生成图片，并尝试插入文档。
- AI 总结生图：先基于文档总结生成图片提示词，再调用图片生成接口。
- 历史会话：查看本地保存的写作、问答、改写、排版和图片生成记录。
- 设置：配置大模型接口地址、API Key、模型名称和可选知识库地址。

### 2. 右键菜单快捷处理

插件在 WPS 文本右键菜单中新增“文策 AI”入口。当用户选中文本后，可以直接执行：

- 润色
- 重写
- 扩写
- 缩写
- 续写
- 更正式
- 党政风

右键菜单会检测当前是否存在选区，没有选中文本时相关按钮不可用。

### 3. OpenAI 兼容大模型接入

项目封装了 OpenAI 兼容接口调用：

- 文本对话接口：`/v1/chat/completions`
- 图片生成接口：`/v1/images/generations`
- 支持普通调用和 SSE 流式输出
- 支持自定义 Base URL、API Key 和模型名称
- 设置页内置连接测试能力

因此可以接入 OpenAI、DeepSeek、通义千问、智谱、Moonshot，或企业内部兼容 OpenAI 协议的大模型服务。

### 4. WPS 文档读写能力

`src/components/js/wpsDoc.js` 对 WPS JSAPI 做了统一封装，当前支持：

- 获取当前选区文本
- 获取当前文档全文
- 获取当前文档名称
- 替换当前选区
- 在选区后插入续写内容
- 在文档末尾追加内容
- 替换整篇文档文本
- 插入 AI 生成图片
- 应用通用、论文、公文基础排版规则
- 检测当前是否存在文本选区

普通浏览器环境只能预览 Vue 页面，完整文档读写能力必须在 WPS 宿主环境中验证。

## 技术栈

- Vue 3
- Vue Router
- Vite
- Axios
- WPS JSAPI
- wpsjs Vite 插件
- OpenAI 兼容大模型接口

## 项目结构

```text
.
├── manifest.xml                 # WPS 加载项清单
├── public/
│   ├── ribbon.xml               # WPS Ribbon 与右键菜单定义
│   └── images/                  # Ribbon 图标资源
├── src/
│   ├── App.vue                  # 根组件，暴露 window.ribbon
│   ├── main.js                  # Vue 入口
│   ├── router/index.js          # Hash 路由配置
│   └── components/
│       ├── ribbon.js            # WPS Ribbon 回调核心逻辑
│       ├── ai/
│       │   ├── AiTaskPane.vue   # AI 写作、伴写、文档问答任务窗格
│       │   ├── AiDialog.vue     # 改写、总结、排版、图片等对话框
│       │   ├── AiSettings.vue   # 大模型与知识库配置
│       │   └── HistoryPane.vue  # 历史会话
│       └── js/
│           ├── ai.js            # 大模型与图片生成 API 封装
│           ├── aiConfig.js      # AI 配置管理
│           ├── aiHistory.js     # 本地历史会话管理
│           ├── wpsDoc.js        # WPS 文档操作封装
│           └── util.js          # WPS 加载项 URL 与枚举工具
├── vite.config.js               # Vite 与 WPS 清单复制配置
└── package.json
```

## 快速开始

安装依赖：

```sh
npm install
```

启动开发服务：

```sh
npm run dev
```

默认开发端口为 `3889`，对应命令为：

```sh
vite --port 3889
```

生产构建：

```sh
npm run build
```

代码检查与格式化：

```sh
npm run lint
npm run format
```

注意：`npm run lint` 当前带有 `--fix` 参数，会直接修改代码。

## WPS 插件安装说明

本项目是 WPS JS 加载项，不是普通浏览器插件，也不是直接双击 `manifest.xml` 安装。WPS 客户端会读取本机的 `publish.xml`，再根据其中配置的插件地址加载：

- `ribbon.xml`：顶部 Ribbon 菜单和右键菜单定义。
- `index.html`：插件前端入口页面。

官方加载流程中，在线模式会请求“插件地址 + `/ribbon.xml`”和“插件地址 + `/index.html`”。因此开发调试时使用本地 Vite 服务地址，正式交付时应使用部署后的 HTTPS/HTTP 地址。

### 1. 开发调试地址

先在项目目录启动开发服务：

```sh
cd /Users/kratos/work/lzs/wps
npm install
npm run dev
```

默认端口是 `3889`，对应插件地址为：

```text
http://127.0.0.1:3889/
```

如果 WPS 和开发服务不在同一台电脑上，不能使用 `127.0.0.1`，需要改为开发机的局域网 IP，例如：

```text
http://192.168.1.20:3889/
```

安装前建议先验证以下地址能正常访问：

```sh
curl http://127.0.0.1:3889/
curl http://127.0.0.1:3889/ribbon.xml
```

如果第二个地址不能返回 XML，WPS 无法生成插件菜单。

### 2. publish.xml 配置内容

本项目是 WPS 文字插件，`type` 应设置为 `wps`。开发调试时可使用下面的配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
    name="HelloWps"
    install="http://127.0.0.1:3889/"
    url="http://127.0.0.1:3889/"
    type="wps"
    debug="true"/>
</jsplugins>
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名称，需要保持唯一。当前 `manifest.xml` 中为 `HelloWps`，后续可统一改为“文策 AI”。 |
| `install` | 插件安装地址，开发调试时和 `url` 保持一致即可。 |
| `url` | 插件资源地址，WPS 会请求该地址下的 `ribbon.xml` 和 `index.html`。 |
| `type` | 插件所属 WPS 组件：`wps` 表示文字，`et` 表示表格，`wpp` 表示演示。 |
| `debug` | 开发调试建议设置为 `true`，正式环境可以去掉或置空。 |

如果同一台电脑已有其他 WPS JS 加载项，不要直接覆盖原有 `publish.xml`。应先备份，再把本插件的 `<jspluginonline ... />` 合并到原有 `<jsplugins>` 节点内。

### 3. macOS 安装方法

macOS 版 WPS 常用加载项目录为：

```text
~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/
```

在终端执行：

```sh
mkdir -p "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"

cp "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/publish.xml" \
   "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/publish.xml.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true

cat > "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/publish.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
    name="HelloWps"
    install="http://127.0.0.1:3889/"
    url="http://127.0.0.1:3889/"
    type="wps"
    debug="true"/>
</jsplugins>
EOF
```

然后彻底退出 WPS，再重新打开 WPS 文字。正常情况下，顶部 Ribbon 会出现本插件定义的“文策 AI”标签页。

如果你的 WPS 是国际版或企业定制版，目录可能不同。可优先检查这些候选目录：

```sh
ls -ld "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
ls -ld "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac.global/Data/.kingsoft/wps/jsaddons"
```

如果第一个目录不存在、第二个目录存在，则把上面命令中的 `com.kingsoft.wpsoffice.mac` 替换为 `com.kingsoft.wpsoffice.mac.global`。

### 4. Windows 安装方法

Windows 版 WPS 的官方加载项目录为：

```text
%APPDATA%\kingsoft\wps\jsaddons
```

通常展开后类似：

```text
C:\Users\<用户名>\AppData\Roaming\kingsoft\wps\jsaddons
```

#### PowerShell 安装

先启动开发服务：

```powershell
Set-Location D:\path\to\wps
npm install
npm run dev
```

另开一个 PowerShell 窗口，执行：

```powershell
$dir = Join-Path $env:APPDATA "kingsoft\wps\jsaddons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$publish = Join-Path $dir "publish.xml"
if (Test-Path $publish) {
  Copy-Item $publish "$publish.bak.$(Get-Date -Format yyyyMMddHHmmss)"
}

@'
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
    name="HelloWps"
    install="http://127.0.0.1:3889/"
    url="http://127.0.0.1:3889/"
    type="wps"
    debug="true"/>
</jsplugins>
'@ | Set-Content -Path $publish -Encoding UTF8
```

然后彻底退出 WPS，再重新打开 WPS 文字。

#### CMD 安装

如果使用 CMD，可执行：

```bat
mkdir "%APPDATA%\kingsoft\wps\jsaddons"
copy "%APPDATA%\kingsoft\wps\jsaddons\publish.xml" "%APPDATA%\kingsoft\wps\jsaddons\publish.xml.bak" 2>nul
notepad "%APPDATA%\kingsoft\wps\jsaddons\publish.xml"
```

在记事本中写入：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
    name="HelloWps"
    install="http://127.0.0.1:3889/"
    url="http://127.0.0.1:3889/"
    type="wps"
    debug="true"/>
</jsplugins>
```

保存后重启 WPS 文字。

如果 Windows 版 WPS 没有显示加载项，需确认当前 WPS 安装包支持 JS 加载项。部分企业版或定制版需要在 WPS 安装目录的 `cfgs/oem.ini` 中启用：

```ini
[Support]
JsApiPlugin=true
JsApiShowWebDebugger=true
```

修改安装目录下配置文件通常需要管理员权限。个人版新版 WPS 一般不需要手动配置。

### 5. 正式部署安装

正式交付不建议让用户连接开发机的 `127.0.0.1:3889`。推荐流程：

```sh
npm install
npm run build
```

然后把 `dist/` 目录部署到一个可访问的 Web 服务，例如：

```text
https://example.com/wps-addin/
```

确认这些地址可访问：

```text
https://example.com/wps-addin/index.html
https://example.com/wps-addin/ribbon.xml
```

再把 `publish.xml` 改为：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
    name="HelloWps"
    install="https://example.com/wps-addin/"
    url="https://example.com/wps-addin/"
    type="wps"/>
</jsplugins>
```

如果公司内网部署，应确保用户电脑可以访问该地址，且 WPS 客户端没有被代理、防火墙或证书策略拦截。

### 6. 安装后验证

安装后按以下顺序排查：

1. 重启 WPS 文字，而不是只关闭当前文档。
2. 检查 `publish.xml` 是否在正确目录。
3. 检查 `url` 是否能访问到 `index.html` 和 `ribbon.xml`。
4. 检查 `type` 是否为 `wps`。
5. 检查 `public/ribbon.xml` 中回调名称是否能在 `window.ribbon` 上找到。
6. 在普通浏览器打开 `http://127.0.0.1:3889/`，确认页面资源没有 404。

常用检查命令：

```sh
curl http://127.0.0.1:3889/
curl http://127.0.0.1:3889/ribbon.xml
```

macOS 查看配置：

```sh
cat "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/publish.xml"
```

Windows PowerShell 查看配置：

```powershell
Get-Content "$env:APPDATA\kingsoft\wps\jsaddons\publish.xml"
```

### 7. 卸载方法

如果 `publish.xml` 里只有本插件，直接删除即可。

macOS：

```sh
rm "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/publish.xml"
```

Windows PowerShell：

```powershell
Remove-Item "$env:APPDATA\kingsoft\wps\jsaddons\publish.xml"
```

如果 `publish.xml` 中还有其他插件，不要删除整个文件，只删除本项目对应的：

```xml
<jspluginonline
  name="HelloWps"
  install="http://127.0.0.1:3889/"
  url="http://127.0.0.1:3889/"
  type="wps"
  debug="true"/>
```

然后重启 WPS。

### 8. 参考资料

- WPS 官方文档：[WPS 加载项开发说明](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/wps-addin-development-instructions)，说明在线模式会请求插件地址下的 `ribbon.xml` 和 `index.html`，并给出 Windows 路径 `%appdata%/kingsoft/wps/jsaddons`。
- WPS 官方文档：[WPS 加载项可用性](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/availability-of-wps-add-ins)，说明部分环境需要通过 `oem.ini` 启用 `JsApiPlugin`。
- 第三方安装示例：[SallyBot WPS 插件安装文档](https://sallybot.cn/install/wps)，提供 macOS 和 Windows 的 `publish.xml` 写入示例。

## AI 配置说明

在 WPS 中打开插件后，进入 Ribbon 的“文策 AI”标签页，点击“设置”，填写：

- 接口地址 Base URL：例如 `https://api.openai.com` 或企业内部模型网关地址。
- API Key：模型服务访问密钥。
- 模型名称：例如 `gpt-4o`、`deepseek-chat`、`qwen-plus` 等。
- 知识库服务地址：可选。配置后文档问答会请求该服务的 `POST /query` 接口。

知识库接口当前约定：

```http
POST /query
Content-Type: application/json

{
  "question": "用户问题",
  "top_k": 5
}
```

插件会兼容以下返回格式：

- `results: [{ content: string }]`
- `results: [{ text: string }]`
- `context: string`

## 路由说明

插件使用 Hash 路由，便于在 WPS 加载项环境中以相对路径运行：

- `#/`：默认页
- `#/dialog`：原始示例对话框
- `#/taskpane`：原始示例任务窗格
- `#/ai-pane?mode=write`：帮我写任务窗格
- `#/ai-pane?mode=companion`：伴写任务窗格
- `#/ai-pane?mode=qa`：文档问答任务窗格
- `#/ai-dialog?mode=rewrite`：AI 改写、总结、排版、图片等功能对话框
- `#/ai-settings`：AI 设置页
- `#/ai-history`：历史会话页

## WPS 集成说明

WPS 回调入口由 `src/App.vue` 挂载后暴露：

```js
window.ribbon = ribbon
```

`public/ribbon.xml` 中的回调名称需要与 `window.ribbon` 上导出的方法一致，例如：

- `ribbon.OnAddinLoad`
- `ribbon.OnAction`
- `ribbon.GetImage`
- `ribbon.OnGetEnabled`
- `ribbon.OnGetVisible`
- `ribbon.OnGetLabel`

构建时，`vite.config.js` 使用 `wpsjs/vite_plugins` 的 `copyFile` 将 `manifest.xml` 复制到产物目录。

## 运行限制

- WPS JSAPI 依赖 WPS 宿主环境，浏览器中无法完整验证文档读取、写入、排版和任务窗格能力。
- 大模型配置存储在浏览器 `localStorage` 中，当前适合本地或单机插件场景；企业级交付建议接入统一配置、加密存储或服务端托管。
- 图片插入依赖 WPS 宿主对远程 URL 或 base64 图片的支持；失败时插件会尝试把图片地址写入文档。
- `wpsjs` 和 `wps-jsapi-declare` 当前使用 `latest`，如需稳定构建，建议锁定明确版本。

## 后续优化建议

- 完善 `manifest.xml` 的插件名称和描述，使其与“文策 AI”品牌一致。
- 增加模型配置加密或后端代理，避免 API Key 长期明文存储在本地。
- 为 WPS 文档读写能力增加宿主版本兼容性测试。
- 为知识库接口增加错误提示、召回来源展示和引用定位。
- 根据企业模板扩展论文、公文、报告等排版规则。
