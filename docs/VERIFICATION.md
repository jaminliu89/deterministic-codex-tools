# 2026年11月06日 · 验证清单

本地工程交付：PASS_WITH_LIMITATIONS。正式产品/跨平台/部署验收：NOT_READY。

| 模块 | 状态 | 实际证据 |
|---|---|---|
| 六类 init/docs 模板、适用条件与待办拒绝 | PASS | 六类真实生成/配置执行、无覆盖/结构漂移测试 |
| CLI Node TAP / Python unittest / JSON 对账 | PASS | 真实子进程；必需用例、零测试、skip、失败、超时、旧pyc、输入输出与源码漂移 |
| Git 基线、范围/保护与无破坏 | PASS | 固定 baseHead 包含已提交变化；失败后源码/index保留；不执行自动 reset |
| hook | PASS | 已有 hook/config 保留；实际拒绝失败提交；有效 staged 流程成功提交；提交后旧 HEAD 证据拒绝；config 备份字节一致 |
| 交接/恢复 | PASS | 真实失败收据、goal/traps/next、版本匹配与漂移拒绝；不代写事实 |
| 独立 review 接口 | PASS（字段/绑定） | 自审/缺context/陈旧拒绝；导入总是 identityVerified=false |
| 本包独立子 Agent 代码复核 | PASS（本地） | docs/INDEPENDENT-REVIEW.md，独立60/60，核心hash前后一致；非外部机构认证 |
| MCP 2025-11-25 stdio | PASS（协议夹具） | 真实子进程 initialize/list/call、三工具、非法帧/方法/参数、非通知形式拒绝 |
| npm 包隔离安装 | PASS | 本地 tgz，--offline --ignore-scripts 安装后 help 实际执行；无第三方依赖 |
| 可执行示例 | PASS（TEST_ONLY） | 带空格目录真实 Unicode JSON 输入输出、非法 JSON 拒绝、2项回归；无独立审查时 gate 正确 NOT_READY |
| CI 配方的本地同级目录链路 | PASS（本地） | 独立复制工具到 sibling 并由复制版本 check；浅克隆缺基线拒绝、取完整历史后通过 |
| ZIP 隔离复跑 | 见 evidence/isolated-zip.json | 候选包解压后清单hash、全套测试和命令冒烟；最终包再校验 |
| 远端 GitHub PR / required CI / branch protection | NOT_READY | 只生成配方，未操作/运行远端，管理员需配置 DCT_REPOSITORY/DCT_REF/保护分支 |
| 正式 Codex/Claude/Hermes Skill 发现与 MCP 客户端 | NOT_READY | 仅交付安装包和配置，未覆盖本机安装，未用正式客户端/Inspector验证 |
| 新 stateless MCP / Windows / Linux | NOT_READY | 明确只实现2025-11-25档，本次实测macOS环境 |
| 真实业务双样本/用户接受/生产上线 | NOT_READY | 合成夹具实际执行不替代真实用户与部署 |
| SkillHub / Prism / VibeGuard | NOT_READY | 只有可选接口契约，没有真实服务调用或集成验证 |
| 全面安全/身份/进程/依赖隔离 | NOT_READY | 启发式扫描/脱敏、可信项目命令、无OS沙箱；无认证签名或完整子进程清理 |

最终实现者60 tests/60 pass/0 fail/0 skipped；独立子 Agent另跑60/60，分别保存日志。核心 SHA-256：`2d8f1531738ce3ec3a8e93063f2a9772828b91df3057ccd02cef760f4941bed7`。

失败历史保存：首轮45项42过3失败；52项修复前50过2失败；独立初审 NEEDS_WORK；复现和修复均保留。没有删除测试或弱化断言。后续加入 requiredTests、隔离Python缓存、收据目录源码绑定、配置备份、固定任务基线、CI同级目录等修复。原始日志在 evidence/。

commit 是本地版本存档；没有远端、PR、CI或部署。模板结构存在与CLI返回PASS均不证明业务语义。用户无需亲自补工程验证；尚需的正式客户端配置与真实使用接受见 README。
