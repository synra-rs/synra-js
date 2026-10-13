# synra-js

> **JavaScript / TypeScript 包仓库。** 面向**插件作者**的类型库、协议类型与开发期工具。
>
> 这是 **`synra` 五仓库拓扑**中的第 3 个（[设计文档 §3](https://github.com/synra-rs/design-docs)）：
>
> | 仓库                                                       | 装什么                                       |
> | ---------------------------------------------------------- | -------------------------------------------- |
> | [`synra-core`](https://github.com/synra-rs/synra-core)       | Rust 内核 + CLI + 插件工具链                    |
> | [`synra-app`](https://github.com/synra-rs/synra-app)         | Tauri 应用（桌面 + 移动 + 宿主 UI）               |
> | **`synra-js`** ← 本仓库                                      | ★ 插件 UI 的类型库（TS 包 monorepo）             |
> | [`design-docs`](https://github.com/synra-rs/design-docs)     | 设计文档（内部，唯一权威）                        |
> | [`docs`](https://github.com/synra-rs/docs)                   | 官网 + 用户文档 + schema（对外，`synra-app.dev`）  |
>
> ⚠️ **尚未开始实现。** 目前只有这份 README。

**为什么单独一个仓库**：这些包被**第三方**（插件作者）依赖、有独立的发布节奏、有自己的一套
Node 工具链 —— 放进 `synra-app` 会让它的 CI 变成两个项目拼在一起。

---

## 包里有什么

```
synra-js/
├─ package.json                 # 私有根包（不发布）
├─ pnpm-workspace.yaml          # packages/*
├─ scripts/
│  ├─ build.common.ts           # 共享 unbuild 配置
│  └─ check-shapes.ts           # 形状一致性守卫
├─ packages/
│  ├─ synra/                    # ★ 汇总入口（作者一般不装，靠传递依赖解析）
│  ├─ client/                   # @synra/client —— 类型库（.d.ts only）
│  ├─ protocol/                 # @synra/protocol —— 线协议类型（从 Rust 生成）
│  └─ testkit/                  # @synra/testkit —— 插件作者的本地 mock 运行时
└─ .github/workflows/           # 只跑 Node 相关 CI
```

| 包                   | 有运行时？ | 谁依赖它                       | 作用                                                         |
| -------------------- | ---------- | ------------------------------ | ------------------------------------------------------------ |
| **`synra`**           | ❌          | 传递依赖（作者一般不用装）        | 汇总对外类型面：re-export `@synra/client` + `@synra/protocol`   |
| **`@synra/client`**   | ❌          | 插件作者的 `devDependencies`     | 注入对象契约 + `declare global` + 错误与 HTTP 形状               |
| **`@synra/protocol`** | ❌          | `@synra/client`、宿主、其它工具   | 线协议数据类型（**从 Rust 生成**）                               |
| **`@synra/testkit`**  | ✅          | 插件作者的 `devDependencies`     | `createMockClient()`：开发期/单测用的假 `synra`                  |

> **"有运行时？"这一列是关键**：前三个是**纯类型（零运行时）**，只有 `@synra/testkit` 有实现。
> CI 对前三个有"不允许产出 `.js`"的守卫。

## 插件作者装什么

```jsonc
// 一个插件的 ui/package.json —— 只装这一个
{
  "devDependencies": {
    "@synra/client": "^1.0.0",     // ★ 类型；`synra` 由它的传递依赖提供
    "@synra/testkit": "^1.0.0"     // 可选：本地开发与单测
  }
}
```

```jsonc
// ui/tsconfig.json —— 一行拿到全局类型，不用 import
{ "compilerOptions": { "types": ["@synra/client"] } }
```

```ts
// 之后直接写（不用 import 任何东西）
synra.device.send({ to: 'dev_…', event: 'chat.text', payload: { body: 'hi' } })
```

---

## ⚠️ 两个必须知道的构建事实

**① `unbuild` 一定会产出 `.js`**（实测 3.6.1，类型包没有运行时值时会产出 1 字节空壳）。
所以"零运行时"必须靠 `build:done` hook **显式剥离**，并有 CI 守卫兜住：

```ts
hooks: {
  'build:done': async () => {
    const runtime = await glob(['dist/**/*.{js,mjs,cjs}'], { cwd: process.cwd() })
    await Promise.all(runtime.map(f => rm(f, { force: true })))
    // 若哪天 unbuild 不再产出 .js，我们要知道，而不是留着无用 hook
    if (runtime.length === 0) throw new Error('expected unbuild to emit runtime files; recipe changed?')
  },
}
```

**② 单入口 + `import './global'`（side-effect）** 才能让 `declare global` 内联进
`dist/index.d.ts`，从而让 `types: ["@synra/client"]` **一行生效**。
配 `rollup.dts.respectExternal: false` 可把 `@synra/protocol` 的类型也内联，产出**自包含**的声明。

> 完整配方（含三种 dts 配置的实测对比、每个 package.json 字段的理由、10 条 CI 守卫）
> 见设计文档 [25 JS 包 monorepo](https://github.com/synra-rs/design-docs/blob/main/25-js-monorepo.md)。

---

## 与其它仓库的关系

```
synra-core ──────────► synra-js ──────────► 插件作者
 （协议真相源）           （生成 + 手写契约）      （tsconfig / devDeps）
      │                    ▲
      │                    │ 注入脚本按同一类型实现
      ▼                    │
synra-app ─────────────────┘
 （宿主：注入 window.synra）
```

| 方向             | 机制                                                             |
| ---------------- | ---------------------------------------------------------------- |
| core → 本仓库     | `ts-rs` 生成 → `pnpm sync` → **commit 进仓库**（让类型变化在 review 里可见） |
| 本仓库 → app      | app 用 `devDependencies` 依赖 `@synra/client`（零运行时，不进产物）    |
| app **不能**自己写类型 | CI 守卫：禁止 app 里出现第二处 `SynraResponse` / `SynraError` 声明      |

## 下一步

1. 读设计文档 [25 JS 包 monorepo](https://github.com/synra-rs/design-docs/blob/main/25-js-monorepo.md)（本仓库的完整规格）；
2. 读 [23 客户端库](https://github.com/synra-rs/design-docs/blob/main/23-client-library.md)（`@synra/client` 的契约）；
3. 搭骨架 → 三个类型包走 unbuild + 剥离 hook → `testkit` 带实现；
4. 写形状快照与 CI 守卫，再加一个从 `pnpm pack` 产物安装的 fixture 工程（否则测不到 `files` 与 `exports`）。

## 许可

MIT
