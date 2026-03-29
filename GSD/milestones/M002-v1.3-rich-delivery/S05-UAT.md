# S05 UAT: Docs, UAT & Release Gate

**Status**: Passed

## Automated Checklist

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] `README.md` 已同步 rich delivery 当前命令面
- [x] `README_CN.md` 已同步当前阶段状态与限制
- [x] `package.json` / startup banner / channel version 已统一到 `v1.3.0`
- [x] `RELEASE-CHECKLIST.md` 已创建

## Manual Release Checklist

- [x] 在真实微信会话中验证 `/sendimage "<图片路径>"`
- [x] 在真实微信会话中验证 `/sendfile "<普通文件路径>"`
- [x] 确认手机端可以正常下载第二轮 `/sendfile` 的文件
- [x] 验证失败路径：不存在路径、超限、敏感路径、错误图片类型
- [x] 复核 README 中的安装、启动和媒体发送示例
- [x] 确认 GitHub 仓库 metadata 不再使用 `your-username`

## Pass Criteria

- 自动化门全部通过
- 真实设备 UAT 通过
- 发布前人工检查完成
- 可将 M002 标记为发布就绪
