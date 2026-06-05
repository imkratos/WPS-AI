# CLAUDE.md

本文件为 Claude 在本仓库内工作的项目级说明。请全程使用中文沟通、分析、注释与编写文档。

## 项目定位

这是一个基于 Vue 3 + Vite 的 WPS 加载项项目，主要演示 WPS Ribbon、对话框、任务窗格、WPS JSAPI 调用以及与外部业务系统交互。

核心运行链路：

1. `src/main.js` 创建 Vue 应用并挂载路由。
2. `src/App.vue` 挂载后把 `src/components/ribbon.js` 暴露为 `window.ribbon`。
3. `public/ribbon.xml` 通过 `ribbon.OnAddinLoad`、`ribbon.OnAction` 等名称回调 JS。
4. `ribbon.js` 根据按钮 ID 调用 WPS 宿主能力，例如打开对话框、创建任务窗格、注册事件、发送通知。

## 技术栈

- Vue 3
- Vue Router 4，使用 Hash 路由
- Vite 5
- Axios
- WPS JSAPI / wpsjs
- ESLint + Prettier

## 常用命令

```sh
npm install
npm run dev
npm run build
npm run lint
npm run format
```

注意事项：

- 开发服务端口是 `3889`：`npm run dev` 等价于 `vite --port 3889`。
- `npm run lint` 会自动修复并改写文件，执行前先查看工作区是否有用户未提交改动。
- 当前没有测试脚本，常规验证以 `npm run build` 为底线。

## 文件职责

- `manifest.xml`：WPS 加载项清单。
- `public/ribbon.xml`：Ribbon UI 与回调声明。
- `vite.config.js`：Vite 配置，包含 `base: './'`、`@` 别名、`manifest.xml` 复制逻辑。
- `src/components/ribbon.js`：WPS Ribbon 生命周期和按钮行为入口。
- `src/components/Dialog.vue`：对话框页面。
- `src/components/TaskPane.vue`：任务窗格页面。
- `src/components/Root.vue`：默认页面。
- `src/components/js/util.js`：WPS 枚举、路径等工具能力。
- `src/components/js/dialog.js`、`taskpane.js`、`systemdemo.js`：具体 WPS 能力封装。

## 开发规范

- 优先沿用现有代码风格；组件当前以 Options API 为主，不要无必要迁移到新范式。
- 新增注释应简短、中文、解释为什么这样做，而不是复述代码表面行为。
- 修改 Ribbon 按钮时，同时检查 `public/ribbon.xml`、`src/components/ribbon.js`、相关图标资源是否一致。
- 修改对话框或任务窗格路径时，确保 `Util.GetRouterHash()` 拼接后的路由仍能访问。
- 使用 `window.Application`、`window.Application.ActiveDocument` 等 WPS 宿主对象时，考虑普通浏览器环境下的空值保护。
- 避免把业务系统地址、用户数据、鉴权信息写死到前端源码。

## 验证建议

基础验证：

```sh
npm run build
```

页面验证：

- 普通浏览器可验证 Vue 页面、路由和静态资源加载。
- WPS Ribbon、对话框、任务窗格、文档操作、事件监听需要在 WPS 宿主环境中验证。

## 已知风险

- `Dialog.vue` 与 `TaskPane.vue` 当前在组件导出对象之外调用 `onMounted`，且内部使用 `this`，这在 Vue 3 中不是组件实例上下文；处理相关功能时应优先修正。
- `wpsjs` 和 `wps-jsapi-declare` 依赖声明为 `latest`，长期维护时建议锁定具体版本，降低构建漂移风险。
- 本项目依赖 WPS 宿主注入的全局对象，构建成功不代表 WPS 端行为已完整通过。

## 协作要求

- 不要回滚用户已有改动。
- 不做无关重构，不大面积格式化无关文件。
- 变更前先理解 WPS 回调链路，避免只改 Vue 页面但遗漏 Ribbon 或清单配置。
- 回答问题时给出结论、原因和可执行下一步，避免只给笼统建议。
