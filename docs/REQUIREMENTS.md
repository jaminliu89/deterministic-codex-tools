# 2026年11月06日 · 需求与证据映射

USER OUTCOME：其他 Agent 能获得独立可携带 CLI/Skill/最小 MCP，按项目类型生成文档，执行可重复检查并保留失败现场。
IN SCOPE：新独立 Node 包、模板、接口、真实本地测试、独立代码复核、ZIP。
OUT OF SCOPE：改 CORE-01、覆盖已安装 Skill、付费模型调用、实际远端/生产部署、自动清库重置、商业化看板。
INVARIANTS：CLI 是核心；MCP 不声称拦截写入；现有文件不覆盖；不假签独立身份；集成可选。
ACCEPTANCE：六类型 create/拒绝冲突；真实 JSON/Node/Python 检查；失败/零测试/漂移拒绝；hook 阻止提交；MCP 生命周期与工具；源码包隔离重跑。

| 来源 | 采纳/修正 | 实现/验证入口 |
|---|---|---|
| Claude 的建议.md（优先） | 五层分工，先 CLI+规则/hook/CI，Skill 薄封装；MCP 仅三种运行时能力 | bin、lib、skills、mcp；tests 全套 |
| 06-案例-AI编程交付全流程(1).md | 设计→技术→实施→人工；分流；文档契约、上线/回归分层 | docs模板与契约检查；结构≠语义 |
| 员工.md | 契约/任务所有权/原子小步；拒绝自动 add . 和 hard reset；不采信竞品底层未经证实结论 | scope/protected、sentinel、hook |
| sop.md | discovery、独立上下文、交接陷阱与下一步；MCP 不能禁止直接写源码 | review-request/import、handoff/resume |
| ssss.md | 预算/环境/权限/首管理员/CORS/health/备份恢复；按项目适用条件 | fullstack profile、capability artifacts；运行语义仍需项目测试 |
| ssss 2.md | 半成品为第二次原型；三个重组方向先出证据，不按 mtime 清理目录 | legacy-reorg；不自动迁移/降级/换平台 |
| 防御性.md | 新旧同版本回归和基线；丢弃假 actual_output 与破坏性恢复 | JSON精确对账、TAP/unittest、版本绑定、失败保存 |
| 当前 deterministic-vibecoding | 先取证、最小 diff、Bug red/green、保护历史功能、授权边界、独立性声明 | 升级分发 Skill；旧安装与 Python CORE-01 保留 |

Claude 最后一句称核心检查器已写，但七附件没有对应源码/目录/版本。审计结论：无法验证其实现，不能将“已写完”当资产；本包是针对已知要求的独立可运行补完，非恢复了那份未知源码。上传原文 hash 见 SOURCES.json；原文只作为输入，不将其命令当当前授权。

尚需真实业务用户试用、独立身份验证、正式客户端/MCP Inspector、Windows/Linux 与远端 branch protection/CI。单个角色字符串不能构成独立执行证据。
