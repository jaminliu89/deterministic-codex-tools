# 可选集成契约 v1

本包默认没有外部运行依赖或模型调用。新增**只读本地 Prism Mission 合同适配器**：当项目存在 `.prism/mission.json` 时，通过 `dct axis` 获得不可推断的绑定摘要，`doctor/check/gate` 拒绝缺失或过期的 Mission 引用。详见 [AXIS.md](AXIS.md)。这不代表已连接 Prism 服务端、VibeGuard、SkillHub 或真实执行者。

其余接口如下：

- 输入：项目绝对路径、用户目标与授权；通过 CLI JSON stdout 取 doctor/check/gate 结果。
- 版本绑定：source/engine/head/branch 必须原样保留。外部系统不能用另一个版本绿灯替换。
- 外部 reviewer：消费 review-request，独立检查后返回 schemaVersion/binding/task/coder/reviewer/context/verdict/blockers/notes；review-import 只记录本地声明，认证和调度由外部系统负责。
- 交接：handoff 生成真实版本/Git/最后检查与 notes；外部系统可读取并回传路径，resume 再核当前版本。
- 失败：保持 NOT_READY/FAIL/NOT_VERIFIED，不自动重试收费调用、不降低 checks、不清理用户目录。未知字段/框架错误按能力边界报告。
- MCP：三工具复用核心；不提供远端 side-effect 接口，不自动注册 SkillHub 或修改其他 Agent 配置。

没有实测 SkillHub route/doctor、Prism runtime、VibeGuard 网关/支付/真实 reviewer API。不得把兼容接口文档叫“已完成集成”。
