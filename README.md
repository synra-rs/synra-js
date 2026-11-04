# synra-js

Synra 的 JavaScript / TypeScript 库，连接插件页面与宿主，也为应用和文档提供共享类型与主题。
插件页面通过宿主注入的 `window.synra` 调用能力，本仓库提供它的类型契约和开发工具。

[界面开发指南](https://synra-app.dev/zh/plugins/ui) · [能力说明](https://synra-app.dev/zh/reference/capabilities) · [问题反馈](https://github.com/synra-rs/synra-js/issues)

## 包的作用

| 包 | 用途 | 包含运行时代码 |
| --- | --- | --- |
| `@synra/client` | 注入客户端、环境探测、错误及页面调用的类型 | 否 |
| `@synra/protocol` | 与 Rust 对齐的协议、IPC 数据和错误类型 | 否 |
| `synra` | 客户端与协议类型的汇总入口 | 否 |
| `@synra/testkit` | 页面开发与单元测试使用的模拟客户端 | 是 |
| `@synra/theme` | 设计 token，以及 CSS、UnoCSS、Ant Design Vue 和 VitePress 适配器 | 是 |

类型声明不会提供真实宿主连接。独立浏览器预览可使用 testkit；真实设备、授权与平台效果需要在 Synra 宿主中验证。

## 为插件页面添加类型

安装与目标宿主匹配的客户端声明：

```sh
pnpm add -D @synra/client
```

在 `tsconfig.json` 中启用全局类型：

```json
{
  "compilerOptions": {
    "types": ["@synra/client"]
  }
}
```

之后可以读取宿主设备列表：

```ts
if (typeof synra !== 'undefined') {
  const devices = await synra.device.list()
  console.log(devices)
}
```

这个调用需要插件声明并获准使用 `device:list`。不要从类型存在推断宿主已经实现某项能力；
分别使用环境查询判断宿主支持、平台支持和当前授权，并处理结构化错误。

## 与其他项目的关系

[synra-core](https://github.com/synra-rs/synra-core)维护 Rust 契约，
[synra-app](https://github.com/synra-rs/synra-app)实现并注入客户端。
本仓库维护与它们对齐的 TypeScript 类型、测试环境及共享主题。

构建、契约检查和本地联调见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可

MIT
