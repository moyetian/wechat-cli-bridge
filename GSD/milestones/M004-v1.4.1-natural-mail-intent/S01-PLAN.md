# M004 S01 Plan: Natural Text Mail Intent

## Goal

定义一个足够保守的自然语言邮件解析器，只覆盖纯文本主路径。

## Must-haves

- 识别明确的发邮件动作
- 提取收件人、主题、正文
- 支持 `mail.defaultTo` fallback
- 缺失字段时返回 clarify

## Result

- [x] 已新增 `src/mail/natural-intent.ts`
- [x] 已新增 `src/mail/natural-intent.test.ts`
