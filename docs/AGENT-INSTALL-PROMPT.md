# 交给其他 Agent 的执行指令

请从 https://github.com/jaminliu89/deterministic-codex-tools 获取工具，按 docs/AGENT-QUICKSTART.md 执行。私有仓库先核验当前机器有读取权限，不索取或输出密钥。

先读取目标项目AGENTS、README、PROGRESS、HANDOVER和Git状态，确认绝对路径、现有技术栈和需要保护的功能。工具与业务项目分开放置。加载 skills/deterministic-vibecoding/SKILL.md 与 skills/project-docs/SKILL.md。

按真实项目形态选择 static-web/fullstack-saas/python/cli/ai-agent/legacy-reorg。先setup预览，授权内--apply创建项目文档、两个Skill和项目MCP配置。禁止覆盖已有文档/Skill/客户端配置；冲突时保留现场并定向合并。

补真实需求与适用能力、固定task.baseHead、允许/保护路径、新行为及历史回归、requiredTests；不要用模板、假Mock、角色名或exit0代替功能证据。Bug先复现再修复，新旧功能同一最终版本共同通过。禁止自动reset/clean/checkout/restore、全目录提交、删测试或降标准变绿。

主动运行真实check；安排另一个实际独立上下文review；通过当前版本gate后如实交付。缺review则NOT_READY，继续授权内修复/交接，不代签。提交/配置/源码变化后重新验证。外发、生产、费用操作不由gate获得授权。

结束时handoff记录目标、失败、陷阱和下一步。分别说明本机修改、自动测试、实际运行、独立审查、commit、远端CI和用户接受；未发生即未验证。不要把本工具CI通过当作业务项目生产就绪。
