# M005 Research

## External References

### 1. WeWrite

**Repository**: https://github.com/oaker-io/wewrite

**Relevant Takeaways**
- 已有较完整的公众号文章生产流水线
- 覆盖热点、选题、写作、SEO、配图、排版、草稿箱
- 适合作为 `writing lane` 的核心能力来源

**How It Maps To M005**
- 不是把 `WeWrite` 当作普通单次 CLI 命令
- 而是把它包成 lane-specific orchestrator，产出结构化 article artifacts

### 2. AI Scientist-v2

**Repository**: https://github.com/SakanaAI/AI-Scientist-v2

**Relevant Takeaways**
- 适合自动化研究与论文初稿生成
- 明确依赖 Linux、NVIDIA GPU、CUDA
- 会执行 LLM 生成代码，存在安全与成本边界
- 更适合作为后台异步研究引擎，而不是微信同步对话引擎

**How It Maps To M005**
- `S04` 只先做 proposal mode
- `S05` 才做 sandboxed run
- 必须配合预算门、安全门和人工批准

### 3. mem0

**Repository**: https://github.com/mem0ai/mem0

**Relevant Takeaways**
- 强项在长期记忆
- 适合按 user / session / agent 维度存偏好与经验
- 工作流上天然支持 `search -> inject -> add`

**How It Maps To M005**
- 作为 `PRISM logic layer` 的长期记忆基座
- 不承担完整 workflow orchestration

### 4. prism-mcp

**Repository**: https://github.com/dcostenco/prism-mcp

**Relevant Takeaways**
- 重点不只是记忆存储，而是主动上下文工程
- 有 `quick / standard / deep` 渐进装载概念
- 有 ledger、行为记忆、时间衰减、压缩检索、三层搜索等设计

**How It Maps To M005**
- 作为 `PRISM logic layer` 的工作记忆与上下文装载参考
- 直接影响如何从微信短消息扩展到复杂多步骤 job

### 5. semantic-router

**Repository**: https://github.com/aurelio-labs/semantic-router

**Relevant Takeaways**
- 适合在入口层做 route selection
- 命中失败时适合走 clarify，而不是进入错误 workflow
- 比“先丢给大模型再猜意图”更可控

**How It Maps To M005**
- 作为 `PRISM gateway layer` 的核心参考
- 用于微信消息 -> workflow route 的第一步

## Planning Conclusions

### Conclusion 1

`M005` 的本质是“控制平面升级”，不是“再多接两个工具”。

### Conclusion 2

`AI Scientist-v2` 必须被视为高成本异步系统，不能与普通微信问答共用同一执行语义。

### Conclusion 3

`PRISM` 在本项目里应定义为三层：

- logic layer：`mem0 + prism-mcp style retrieval`
- gateway layer：`semantic-router`
- compute layer：queue + budget + sandbox + hardware pool

### Conclusion 4

如果正式启动 `M005`，最稳的顺序应是：

1. 先做网关和 job model
2. 再做 memory / artifact substrate
3. 优先接入 `writing lane`
4. 然后只做 `research proposal lane`
5. 最后才碰 `AI Scientist-v2` 的 sandboxed execution
