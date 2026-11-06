---
name: project-docs
description: 按静态 Web、全栈 SaaS、Python、CLI、AI Agent、遗留重组六类项目一键生成针对性文档，验证结构并维护变更。
---

# 按项目类型生成文档

触发：用户要求准备项目文档、缺失设计/验收/上线/交接文档，或半成品需要第二次原型审计。输入：项目绝对路径、已有 README/AGENTS/合同、项目类型和已知需求。输出：针对性 Markdown 与机器可检的 `.dct/doc-contract.json`。本包 `templates/profiles.json` 是可读模板主源，`lib/docs.mjs` 提供共同文档与渲染；不生成假业务实现。

先读真实项目及 dirty 状态。沿用现有文档；不替换合同、不重复建立最高真相源、不向原目录搬动历史版本。按实际交付形态选择，不凭目录名字或 mtime 猜版本。

| 类型 | 适用 | 重点验收 |
|---|---|---|
| static-web | 静态内容/无后端 | 构建、深链、404、移动/键盘、资源失败 |
| fullstack-saas | 自有后端/多用户/持久化 | API、租户隔离、管理员 seed/找回、CORS、health、重启读写 |
| python | Python 脚本/库/服务 | 环境、真实输入输出、异常、打包后导入 |
| cli | 终端程序 | 参数、退出码、JSON 流、路径空格、无覆盖、隔离安装 |
| ai-agent | 模型/工具/多 Agent | 预算、工具权限、恢复、恶意输入、真实模型与合成评测分开 |
| legacy-reorg | 混乱版本/遗留重组 | 现场清单、运行切片、三条重组方向、来源 hash、新旧回归 |

## 一键命令

```sh
node "$DCT_HOME/bin/dct.mjs" types
node "$DCT_HOME/bin/dct.mjs" docs --project /absolute/project --type static-web
node "$DCT_HOME/bin/dct.mjs" docs --project /absolute/project --type static-web --apply
```

默认只预览。`init` 另加任务配置和缺失的 AGENTS。docs/init 的所有目标预检冲突；任何已有目标文件阻断整个计划，保留原文件。符号链接、硬链接、越界路径拒绝。文件系统中途失败时保留已创建列表，不假称事务全部成功，不自动清理他人文件。新建目录可能在失败后保留。

已有文档发生冲突：读取原文，人工/Agent 最小合并所需章节；不得删除原文件后重跑。若沿用不同命名文档，当前 CLI 固定契约不自动映射，标 NOT_READY，单独采用项目自身验证，不伪造本工具 PASS。

## 内容补全和维护

生成八份文档：discovery、product-design、technical-design、test-matrix、launch-checklist、change-log、project-profile、HANDOVER。模板明确 TODO，必须替换为已核验项目事实；未知保留未知并阻断，不用通用话术假充完成。每节检查存在、非空与无占位，仅结构有效，不证明语义正确。

- 需求改变：改产品目标、范围、验收，列受影响依赖和授权来源。
- API/数据/权限改变：改技术方案、profile、测试矩阵、上线清单。
- 缺陷/历史回归：补真实输入与预期、失败→修复证据；不得用新 golden 掩盖旧失败。
- 交接/切换版本：HANDOVER 和 PROGRESS 记录失败、原因、下一步；运行 handoff 保存机器现场。
- 发布/环境改变：重新检查用户进入、凭据变量、管理员/找回、真实数据、健康监控、备份恢复。纯静态可说明某项不适用及原因，不强加 Docker 或后端。

运行 doctor 看结构问题；填完配置后 check --run 执行真实验收。任何合同、文档、源码或工具变化都会使旧运行证据失效，重跑受影响检查并重新审查。最终给出适用条件、生成文件、实际内容验收和未完成项；模板生成完成不等于项目立项获批。
