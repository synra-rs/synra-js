# JS 库开发

## 环境与构建

使用 `package.json` 中指定的 pnpm，Node 版本满足 `engines`。
与 Rust 契约对照时，将内核检出到同级 `synra-rust-core/`。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm check
pnpm lint
```

`check` 包含编译、真实声明消费方、形状检查与文档示例检查。
三个类型包只输出声明；testkit 和 theme 包含运行时代码，使用各自的 TypeScript 构建配置。

## 契约来源

`@synra/protocol` 同时维护线协议与 IPC 的 TypeScript 对照，由检查脚本核对 Rust 字段、
枚举与省略规则。不要假定所有声明都由 ts-rs 自动生成，也不要手写另一份消费方返回类型。

页面客户端由应用注入；修改类型后同步应用实现、testkit、消费方测试与文档。
测试环境能模拟能力和错误，但不会提供真实设备连接或平台效果。

## 主题

`@synra/theme` 的根入口提供 token，适配器位于 `./antd`、`./css`、
`./unocss` 与 `./vitepress`。只在需要对应适配器时引入其外部依赖。
保持应用、独立页面和文档的主题语义一致。

## 联调与版本

本地路径覆盖用于跨仓库联调；交付前使用明确版本并确认锁文件。
发布脚本与标签规则见 package.json 和 CI；文档维护本身不触发包发布。
