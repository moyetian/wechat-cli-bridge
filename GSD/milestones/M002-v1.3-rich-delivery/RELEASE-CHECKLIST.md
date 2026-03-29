# M002 Release Checklist

**Milestone**: M002
**Version Target**: v1.3.0
**Status**: Release Ready

## Code Gate

- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm test -- --runInBand --ci`
- [x] rich delivery 命令面已具备 `/sendimage` / `/sendfile`
- [x] 默认安全边界已具备：大小限制、敏感路径限制、图片类型限制

## Docs Gate

- [x] `README.md` 已同步 rich delivery 当前能力
- [x] `README_CN.md` 已同步 rich delivery 当前能力
- [x] `GSD/STATE.md` 已同步到 S05
- [x] milestone `S01` ~ `S05` 文档齐全
- [x] 版本口径已统一到 `v1.3.0`

## Device UAT Gate

- [x] 在真实微信会话中验证 `/sendimage "<图片路径>"`
- [x] 在真实微信会话中验证 `/sendfile "<普通文件路径>"`
- [x] 确认手机端能正常下载文件附件
- [x] 验证失败路径反馈
  - 不存在路径
  - 超限文件
  - 敏感路径
  - 非图片走 `/sendimage`

## Open Items Before Public Release

- [x] 确认真实 GitHub 仓库地址并替换 `your-username`
- [x] 确认第二轮 `/sendfile` 在手机端的最终下载效果
- [ ] 判断是否需要在后续版本新增更通用的 `/sendmedia`
- [ ] 准备进入 `M003-v1.4-mail-channel`
