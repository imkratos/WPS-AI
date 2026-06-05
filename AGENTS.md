# AGENTS.md

本文件为 Codex 在本仓库内工作的项目级说明。所有交流、分析、注释与文档优先使用中文。

## 项目概览

- 项目类型：WPS 加载项前端示例。
- 技术栈：Vue 3、Vue Router、Vite、Axios、WPS JSAPI、wpsjs Vite 插件。
- 包管理：npm，当前仓库包含 `package-lock.json`，优先使用 `npm install` / `npm run ...`。
- 开发端口：`npm run dev` 默认启动 `vite --port 3889`。

## 关键目录与文件

- `src/main.js`：Vue 应用入口，挂载路由。
- `src/App.vue`：根组件，并在挂载后把 `ribbon` 暴露到 `window.ribbon`，供 WPS Ribbon 回调调用。
- `src/router/index.js`：Hash 路由配置，包含默认页、对话框页、任务窗格页。
- `src/components/ribbon.js`：WPS Ribbon 生命周期与按钮回调，包含 `OnAddinLoad`、`OnAction`、`GetImage` 等。
- `src/components/Dialog.vue`：WPS 对话框页面。
- `src/components/TaskPane.vue`：WPS 任务窗格页面。
- `src/components/js/*.js`：封装对话框、任务窗格、系统联动与工具函数。
- `public/ribbon.xml`：WPS 自定义 Ribbon 定义，回调名称需要与 `window.ribbon` 暴露的方法一致。
- `manifest.xml`：WPS 加载项清单，构建时由 `wpsjs/vite_plugins` 的 `copyFile` 复制到产物目录。
- `vite.config.js`：Vite 配置，包含 `base: './'`、别名 `@ -> src`、WPS 清单复制插件和开发服务监听配置。
- WPS系统图标存在 `/Applications/wpsoffice.app/Contents/Resources/office6/addons/kwebwpscopilot/static/img/`

## 常用命令

```sh
npm install
npm run dev
npm run build
npm run lint
npm run format
```

说明：

- `npm run lint` 当前脚本带 `--fix`，会直接修改代码；执行前先确认工作区状态。
- 仓库目前没有显式测试脚本；涉及业务行为修改时，至少执行 `npm run build` 验证。
- 不要每次修改后自动启动开发服务或打开浏览器测试；只有用户明确要求预览、截图或浏览器验证时才执行。
- WPS JSAPI 依赖宿主环境，浏览器内只能验证普通 Vue 页面与资源加载，不能完整验证 WPS 宿主能力。

## 编码规范

- Vue 组件优先保持现有 Options API 风格，除非改动范围明确需要组合式封装。
- 新增代码、注释、用户可见文案与文档使用中文。
- 保持 WPS 回调名称稳定：`public/ribbon.xml` 中的 `ribbon.xxx` 必须能在 `window.ribbon` 上找到。
- 访问 `window.Application` 前要考虑非 WPS 宿主环境，必要时增加防御性判断，避免普通浏览器预览直接报错。
- 修改路由时同步检查对话框和任务窗格打开路径：`Util.GetUrlPath() + Util.GetRouterHash() + '/dialog|/taskpane'`。
- 修改静态资源路径时注意 `base: './'` 与 WPS 插件加载环境，避免使用仅适合站点根路径的绝对路径。

## 协作约束

- 不要回滚用户已有改动；遇到未提交变更时先识别是否与当前任务相关。
- 优先小范围修改，避免顺手重构无关代码。
- 编辑文件优先使用补丁方式，减少无关格式化和大面积改写。
- 若需要查询框架或 SDK 最新文档，优先查官方文档并在回答中说明来源。

## 项目风险点

- `Dialog.vue` 与 `TaskPane.vue` 中的 `onMounted` 当前写在组件导出对象之外，`this` 不会指向组件实例；若后续处理相关页面，需要优先修正为组件内生命周期或 `setup` 写法。
- Ribbon 按钮状态依赖 `window.Application.PluginStorage`，本地浏览器预览无法完整覆盖。
- `wpsjs`、`wps-jsapi-declare` 使用 `latest`，依赖版本可能随安装时间变化；需要稳定构建时建议锁定明确版本。
