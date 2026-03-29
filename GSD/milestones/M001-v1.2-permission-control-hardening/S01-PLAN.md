# S01 Plan: Runtime Base & Testability

**Milestone**: M001
**Depends On**: none
**Status**: Implemented

## Slice Goal

移除运行时导入副作用，建立可移植的路径与测试底座，为后续权限改造提供稳定验证环境。

## Must-Haves

### Truths
- 导入 `logger` 或 `storage` 不会自动写入 `~/.wechat-cli-bridge`
- bridge home 目录可以通过单一入口显式解析
- 测试可在临时目录下独立运行
- `npm run build`、`npm run lint`、`npm test` 在当前仓库能稳定执行

### Artifacts
- `src/utils/paths.ts` 或等价路径服务模块
- 重构后的 `src/utils/logger.ts`
- 重构后的 `src/utils/storage.ts`
- 更新后的测试配置和必要测试

### Key Links
- `path service -> storage/logger bootstrap`
- `index.ts/setup.ts -> explicit initialization`
- `tests -> temp bridge home -> no global side effects`

## Task Breakdown

### T01 - Introduce Path Service
- 统一定义 bridge home、accounts、sessions、projects、logs 路径
- 支持环境变量覆盖或测试注入
- 明确默认值仍为 `~/.wechat-cli-bridge`

### T02 - Refactor Storage Bootstrap
- 把 `export const storage = new Storage()` 改为可控初始化
- 避免模块导入时立即 `ensureDirSync`
- 保留默认实例获取方式，但改为 lazy

### T03 - Refactor Logger Bootstrap
- 移除导入即创建日志目录的行为
- 用工厂或 lazy singleton 创建 logger
- 确保控制台日志在目录不可写时仍可用

### T04 - Wire Explicit Initialization
- 更新 `src/index.ts`
- 更新 setup 流程
- 确保程序启动时显式初始化路径和依赖

### T05 - Repair Test Isolation
- 测试环境显式指向 temp bridge home
- 消除因为全局实例导入导致的脆弱耦合
- 为路径服务和 lazy init 增加测试

### T06 - Verification And Documentation
- 跑通 build/lint/test
- 更新 S01 实际结果
- 同步根级 GSD 状态

## Implementation Notes

1. 不要在多个模块里重复拼接 `os.homedir()` 路径。
2. 不要为了修测试而绕过真实初始化流程。
3. 如需 fallback，优先降级到 console transport，而不是直接静默失败。

## Out Of Scope

- 权限命令扩展
- 审批状态机
- agent 参数重构
- CI workflow

## Risks

1. logger 单例重构可能影响现有导入方式
2. storage 单例重构可能影响现有测试
3. setup/index 若各自维护不同初始化流程，容易重新分叉

## Verification Plan

### Automated
- `npm run build`
- `npm run lint`
- `npm test`

### Manual
- 启动 bridge，确认首次运行仍会正确创建默认目录
- 在设置自定义 home 目录时，确认 logs/sessions/accounts 都落在同一根路径下

## Exit Criteria

- 上述 must-haves 全部为真
- 不再出现因导入模块导致的 home 目录写入失败
- 可以无阻塞进入 S02

## Result

- 已新增 `src/utils/paths.ts` 作为统一路径入口
- 已将 `logger/storage` 改为显式初始化 + lazy fallback
- 已接线 `src/index.ts`、`src/setup.ts`、`bin/daemon.js`
- 已新增 bootstrap/paths 测试并修复存储测试
- 自动化验证通过：`npm run build`、`npm run lint`、`npm test -- --runInBand --ci`
