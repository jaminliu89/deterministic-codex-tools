# 独立代码复核 · 2026年11月06日

审查者：本会话独立 Code Reviewer 子 Agent，任务 `/root/independent_review`。独立执行和上下文不等于外部机构认证、独立人员身份认证或真实用户验收。

范围：读取 AGENTS、README、PROGRESS、REQUIREMENTS、CLI、lib、MCP、模板和测试；只改本报告，夹具和日志放 work；没有改业务实现、操作远端或调用模型服务。

首轮历史结论：NEEDS_WORK。以下为当时真实复现，修复后的最终复审见后文；不得删除此失败历史。

| 级别 | 问题 | 实际证据 | 建议 |
|---|---|---|---|
| P1 | 被 inventory 排除的目录可承载实际检查代码，修改后旧绿灯仍有效 | work/fixture-846m1V：JSON 检查执行 `.dct/reviews/runtime.mjs` 得 PASS；导入测试用审查声明后改为 exit(9)，binding 不变，gate 仍 PASS。lib/fs.mjs:60–61；lib/core.mjs:18–20 | 排除只能用于受限数据收据；任何实际入口/导入源码不能静默逃出 hash。拒绝保留目录中的源码或纳入绑定，并明示外部依赖不在当前绑定内 |
| P1 | CI 推荐 vendoring 工具后，扫描器自身被 Mock 规则误报 | work/fixture-gZsnmy：复制 lib 到 tools/dct/lib 即 doctor 返回 MOCK_IN_RUNTIME:tools/dct/lib/core.mjs。lib/core.mjs:63 | 加入真正 vendored-project 集成测试，避免将扫描规则自身文字误认 Mock 实现，不用宽泛豁免运行时代码 |
| P1 | 空 Node 测试文件被当真实测试通过 | 独立 npm test：tests/core.test.mjs 的 zero Node tests refused 期望 NOT_READY，实际 PASS，work/reviewer-test.log:133 | 识别 Node 文件级 synthetic test 与真实用例，不能仅信汇总 count |
| P1 | Python 修改断言后仍复用旧结果 | 同轮 npm test 的 Python unittest actual pass then failure 第二次期望 NOT_READY，实际 PASS，work/reviewer-test.log:179 | 诊断同秒同大小 `.pyc` 缓存；每次执行使用能排除旧字节码的隔离缓存位置或等效方法 |
| P2 | MCP 通知方法带请求 ID 返回非法响应 | work/reviewer-mcp-id.log：发送 notifications/initialized 且 id=2，返回 `{jsonrpc:"2.0",id:2}`，没有 result/error。mcp/server.mjs:17、38 | 对非通知形式拒绝或按请求错误返回，补协议测试 |
| P2 | hooks --apply 修改 Git 本地配置前未创建备份 | lib/core.mjs:175–176 | 按用户配置变更规则先保存真实旧配置或可验证的原值快照，再最小修改 |

已观察到的正向实现：默认 init/docs 预览；目标文件冲突预检、拒绝常见符号/硬链接、锁争用保留现场；测试失败无自动 destructive reset；本地 gate 明确不认证审查身份，release 保守 NOT_READY。此描述仅是代码核查，不能抵消上表缺陷。

首轮独立测试：`npm test`，52 tests / 50 pass / 2 fail / 0 skip，退出过程由原始日志记录（work/reviewer-test.log）。测试产生真实 Node/Python/Git 子进程，但使用合成工程，不是生产或真实商业证据。

未验：正式 MCP 客户端/Inspector、Windows/Linux、远端 PR/CI/保护分支、独立身份认证、真实项目双样本、人类产品接受、生产部署、完整安全审计。


## 修复后独立复审

当前结论：PASS（仅限本地代码与自动化复核范围），未发现本轮已知阻塞项仍未修复。不是生产 READY、远端 CI 验证、外部身份认证或真人产品接受。

固定运行核心 engine SHA-256：`2d8f1531738ce3ec3a8e93063f2a9772828b91df3057ccd02cef760f4941bed7`。独立运行前后 engine hash 完全一致；`npm test` 实际退出0，60 tests / 60 pass / 0 fail / 0 skip。原始日志 `work/reviewer-final-bound.log`，机器结果 `work/reviewer-final-bound.json`。该 hash 绑定 CLI/lib/MCP/profile 实现，不冒充 ZIP 或全部文档 hash；最终打包清单由实现者另行保存。

| 首轮问题 | 修复与独立重放结果 |
|---|---|
| 证据目录源码漂移漏检 | inventory 仅排除识别出的顶层收据 JSON，其他源码/普通数据纳入 hash。独立重放 runtime.mjs 得初始 PASS，修改为 exit(9) 后 binding 改变且 gate NOT_READY。已检查任意 data.json 同样不再静默排除 |
| vendoring 导致扫描器自报 Mock | CI 改为业务 project/ 与工具 dct/ 两个同级 checkout。独立实际复制完整运行核心到 sibling toolkit 后，通过该复制版本 CLI 对业务 project 执行 check --run，真实返回 PASS/exit0。见 work/reviewer-sibling-ci.json。仍未运行远端 GitHub CI；将工具嵌入业务源码目录仍可能触发启发式误报，不是通用 vendor 豁免 |
| 空 Node 文件假绿 | 必需 requiredTests 精确匹配实际 Node subtest；空文件没有配置的用例，真实进程结果被拒绝 |
| Python 旧 pyc 假绿 | 每次唯一 PYTHONPYCACHEPREFIX 且禁写字节码；独立同大小即时将 assertEqual(2+3,5) 改为 assertEqual(2+3,6)，第二轮被正确拒绝 |
| MCP 非通知形式 | 带 id 的 notifications/initialized 明确返回 -32600，而不是缺 result/error 的非法响应 |
| Git 配置无备份 | 安装 hook 前复制真实 local Git config 到旁边独占新文件。独立核验备份字节等于修改前内容，mode=0600 |

追加核查：task.baseHead 为真实完整 SHA 且必须为 HEAD 祖先；scope/protected diff 包含任务基线后的已提交变化，独立提交保护文件后仍正确阻断。CI 项目 checkout 已设 fetch-depth:0；自动化场景真实 file:// 浅克隆先缺 baseline 拒绝，fetch --unshallow 后通过。配置基线的审批真实性仍由用户/服务端控制，本地 JSON 无法认证审批。

独立定向缺陷重放记录：work/reviewer-retest.log。当前完整测试还包括真实 staged hook 成功提交后旧 HEAD 证据失效，避免仅验证“所有情况都拒绝”。

剩余边界保持明确：本机收据可被同权限写者修改；依赖目录/外部可执行文件/网络状态不在 source hash 全覆盖内；项目 argv 是可信代码而非沙箱；不完整清理派生进程；扫描启发式不证明无秘密或无 Mock；文档结构与 artifact 非空不证明业务语义；独立 reviewer 字段不认证身份。

未完成验收项仍为 NOT_READY/NOT_VERIFIED：正式 Agent Skill 自动发现、正式 MCP 客户端/Inspector、新 stateless MCP、Windows/Linux、远端 required checks/分支保护/独立 PR review、真实业务双样本、真人产品接受和生产部署。不能把本报告的本地 PASS 覆盖这些缺口。
