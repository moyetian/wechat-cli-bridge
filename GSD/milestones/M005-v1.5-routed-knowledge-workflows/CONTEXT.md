# M005 Context

## Current Reality

1. 当前仓库核心仍是 `微信 -> iLink -> bridge -> CLI agent`。
2. `M002` 已补齐文件/图片下发，`M003/M004` 已补齐邮件发送与自然语言邮件入口。
3. 当前系统已经具备“微信前门 + agent 调度 + 审批 + context manager”的最小控制平面雏形。
4. 用户当前构想不再只是“多一个命令”，而是把微信桥升级为多 lane 知识工作入口。

## Planned Evolution

### Lane Split

- `general cli lane`
  - 保留当前修代码、跑命令、读写文件等通用能力
- `writing lane`
  - 公众号文章、选题、草稿、风格学习、草稿箱交付
- `research lane`
  - 研究想法、研究计划、实验执行、论文草稿

### Control Split

- 微信前门不再直接决定“调用哪个 agent”
- 先经过 route selection 和 gate selection
- 再决定是否：
  - 直接响应
  - 进入短任务 lane
  - 进入异步高成本 lane

## Key Constraints

1. **科研 lane 不能默认同步执行** - 必须走异步、预算门和安全门
2. **文章 lane 与研究 lane 不要共享一套 prompt 杂糅流程** - 二者产物和失败面差异太大
3. **PRISM 不应等同于“保存所有聊天记录”** - 应以 `memory + artifact + retrieval tier` 为核心
4. **当前 bridge 仍需保持 release ready** - `M005` 只能在不破坏现有 CLI / media / mail 能力的前提下推进

## Open Questions

1. `WeWrite` 是以 repo 级集成还是服务级集成更合适？
2. `AI Scientist-v2` 的 GPU runtime 应独立成单独服务还是嵌入当前控制平面？
3. `semantic-router` 是用本地向量路由还是远端 embedding service？
4. `mem0` 与现有 GSD/context manager 的边界怎么拆？
