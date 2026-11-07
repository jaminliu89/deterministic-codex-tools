---
name: deterministic-vibecoding
description: 用独立 DCT CLI 推进可重复验证的编码、回归、独立审查与跨 Agent 交接；不自动重置工作区。
---

# 确定性 Vibe Coding · 独立 Node 工具升级版

适用：明确的编码、修复、回归、交接；新项目可配合 project-docs。输入：目标绝对目录、原始目标与授权范围、现有规则、验收方法。输出：最小 diff、当前版本检查、审查请求/外部报告、可恢复交接及真实未完成项。

本 Skill 是流程约束，不能拦截宿主直接写文件；CLI 是核心，Git hook 和远端 required checks 才能约束各自入口。MCP 只提供运行时辅助。不要将角色名、导入报告或测试全绿等同独立身份或人工接受。

## 安装与定位

`DCT_HOME` 是本包根目录的绝对路径；所有命令显式工作目录为目标项目。无需 npm install，Node >=22 与 Git 已安装；Python 项目另需自己的 Python。不要自动更换用户技术栈、服务或下载模型。

```sh
node "$DCT_HOME/bin/dct.mjs" doctor --project /absolute/project
node "$DCT_HOME/bin/dct.mjs" gate --project /absolute/project
```

## /start

1. 读真实 AGENTS、README、PROGRESS、HANDOVER、已有设计与 Git 状态，检查 BASELINE.toml/STABLE。保留旧合同，不能改标准绕过失败。若项目已接入 CORE-01，继续其原合同与确认流程，本包 PASS 不替代该核心门禁；不自动迁移或重写。
2. 记录原话目标、最新修正、范围与不上清单、影响文件、用户可观察验收与历史保护测试。模糊新产品只问会影响决策的缺口：受众、规模、技术偏好、部署预算、交互及用户进入路径；已授权工作不重复等待。
3. 功能分支施工；dirty 状态先辨别所有权，不切走他人分支、不自动嵌套建库。现有文档优先使用，仅缺失时 project-docs 预览后创建。简单文字修改检查 diff 即可，不强制全套治理；已有正式合同不得切轻量流程绕过。
4. `.dct/config.json` 明确任务、固定 task.baseHead、允许/保护路径、必需检查 ID 与 requiredTests、真实 argv 与适用能力。检查命令是本机可信项目代码，执行前审阅，DCT 不提供 OS 隔离。不要运行陌生项目的 argv。

## /axis：每个任务重新守住原始产品目标

当业务项目存在 `.prism/mission.json`，开始编码前先执行：

```sh
node "$DCT_HOME/bin/dct.mjs" axis --project /absolute/project
node "$DCT_HOME/bin/dct.mjs" doctor --project /absolute/project
```

- `axis` 必须显示实际 Mission ID、目标范围及原始验收条款；`.dct/config.json` 的 `task.missionRef` 要匹配 ID 和 `specHash`，`task.branch` 精确匹配本功能分支，`task.missionAcceptance` 至少引用一个原始验收项索引。旧任务配置不得跨分支续用。
- 开工前写下受影响清单：函数/消息链的所有调用方、不同平台和 CDN 的差异、历史可用路径、降级路径、可见用户反馈、预计可能退化的场景。不能用“我只改这一行”取代影响分析。
- 每次新增功能至少有一条“新增行为应成功”的正向断言和一条“已有行为不得变差”的反向断言；关键 UI/产物必须真实执行。已有测试 SKIP、无浏览器、无 ffprobe 或 CDN 限流只代表证据缺失，不能称为产品 PASS。
- Mission 原始目标、scope 或 acceptance 发生变化，必须停止并由 Prism/任务 owner 审批变更，再重建当前任务合同与证据。任何新点子先登记，不自动改写任务轴线。
- `dct axis` 只是只读合同一致性检查，不授权自动修改 Mission、推送、合并或发布。没有 Prism Mission 的独立项目仍沿用本包原流程。

## 实现与回归

Bug 必须先复现，同一场景修后复验；至少记录新行为及受影响历史行为。使用项目原有框架，DCT 支持 Node TAP、Python unittest 和 JSON stdin→stdout 精确对账；其他测试格式不能伪装。零测试、skip、todo、仅 exit0、打印 ok 均不足。

```sh
node "$DCT_HOME/bin/dct.mjs" check --project /absolute/project --run
```

检查绑定源码、配置/文档、工具实现、HEAD 与分支。变化后旧证据失效。测试失败保留现场、报告和退出码；不 reset/clean/restore/checkout、不删锁、不重打基线、不改 golden/断言来变绿。连续两次无进展换真实诊断方法。文档/API/范围变化先更新原因与影响，必要时重新获得变更授权。

## /review

```sh
node "$DCT_HOME/bin/dct.mjs" review-request --project /absolute/project
```

把输出请求与真实 diff、测试变更、任务和代码交给另一个独立上下文；不得让 coder 自己代签、复制一个 QA 名字。外部审查结果保存为 `.dct/reviews/incoming.json`，须保留 binding/task/coder，填写 reviewer/context/verdict/blockers/notes。

```sh
node "$DCT_HOME/bin/dct.mjs" review-import --project /absolute/project --file .dct/reviews/incoming.json
node "$DCT_HOME/bin/dct.mjs" gate --project /absolute/project
```

导入仅本地声明，identityVerified=false。无法获得独立执行者时明确 NOT_READY；继续授权内修复与交接，不伪造审查。SkillHub、Prism、VibeGuard 均为可选接口来源，不安装也可运行；本包没有调用其真实服务的证明。

## Git / PR / CI

先审实际 diff、测试断言与跳过项变化。选择性 add，禁止 add 全目录混入他人改动；提交后 HEAD 变化，必须重跑并重新审查。PR 创建前展示 body，远端操作遵守当前授权。hooks 子命令默认预览，--apply 安装时拒绝覆盖已有 hook/core.hooksPath。hook 可绕过，CI 配方只执行 checks；服务端必须另外设置 required status、禁止直推和独立 PR review，不能由本地工具自证。

## /handover

```sh
node "$DCT_HOME/bin/dct.mjs" handoff --project /absolute/project --notes relay-notes.json
node "$DCT_HOME/bin/dct.mjs" resume --project /absolute/project --file .dct/handoffs/ACTUAL-ID.json
```

notes 为 goal/traps/next 三个字符串。记录原目标、进展、失败日志、陷阱、具体下一文件和验证路径。缺 notes 会明确 NOT_PROVIDED，不代表可用的人类交接。接棒者先读、简述核心陷阱，再看当前源码与状态；resume 漂移时重新诊断。

## 交付

分别列本机修改、自动测试、真实运行、独立审查、用户接受、commit、远端 CI、部署；未发生即 NOT_READY/NOT_VERIFIED。生产/费用/外发/破坏性操作的授权不来自 gate PASS。归档源码、证据与失败记录，勿归档秘密；静态扫描是启发式，不代表完整安全审计。
