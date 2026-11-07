# Deterministic Codex Tools 1.0.0

独立 Node CLI + 项目文档 Skill + 跨 Agent 流程 Skill + 最小 MCP。以《Claude 的建议.md》为首要约束；本包不依赖 SkillHub、Prism、VibeGuard 或旧 Python CORE-01。2026年11月06日。

## 其他 Agent 一键安装

新仓库：[jaminliu89/deterministic-codex-tools](https://github.com/jaminliu89/deterministic-codex-tools)（私有，需读取权限）。已有 Node >=22、Git 和 GitHub CLI 后，设置真实绝对路径：

```sh
DCT_HOME=/absolute/tools/deterministic-codex-tools
PROJECT=/absolute/business-project
SKILLS_DIR=/absolute/client/skills
gh repo clone jaminliu89/deterministic-codex-tools "$DCT_HOME" && node "$DCT_HOME/scripts/setup.mjs" --project "$PROJECT" --type cli --skills-dir "$SKILLS_DIR" --apply
```

项目目录须已存在，工具目录须尚不存在。支持六种 --type；已有工具目录只运行 setup。去掉 --apply 可预览；重复执行不覆盖，已有不同内容会阻断。脚本生成针对性文档、两个Skill和填好绝对路径的项目MCP配置，CLI立即可用；安装成功不代表项目已验收。无需 npm install。

完整操作见 [Agent 快速开始](docs/AGENT-QUICKSTART.md)，可直接交给其他 Agent 的执行指令见 [安装任务指令](docs/AGENT-INSTALL-PROMPT.md)。MCP客户端格式不同，生成配置需审阅合并；不会覆盖全局客户端配置。

## 直接运行

需要已有 Node >=22、Git；Python unittest 检查另需项目自己的 Python。零第三方运行时依赖，无自动安装钩子、不下载模型。解压后将下方 DCT_HOME 改为包的绝对路径，PROJECT 改为已存在、非符号链接目录。可直接运行，不必 npm install。

```sh
DCT_HOME=/absolute/deterministic-codex-tools
PROJECT=/absolute/project
node "$DCT_HOME/bin/dct.mjs" --help
node "$DCT_HOME/bin/dct.mjs" init --project "$PROJECT" --type cli
node "$DCT_HOME/bin/dct.mjs" init --project "$PROJECT" --type cli --apply
node "$DCT_HOME/bin/dct.mjs" doctor --project "$PROJECT"
```

init 默认预览；--apply 只创建不存在的文件，不初始化 Git、不提交、推送或更换技术栈。已有 AGENTS 原样保留，其他目标有冲突则整组拒绝。先读取原文再定向合并，不删除旧文档重跑。模板 TODO 是正常 NOT_READY，须填真实项目内容，不能把模板生成当需求获批。

类型：static-web / fullstack-saas / browser-extension / python / cli / ai-agent / legacy-reorg。只生成文档用 docs 子命令。完整适用条件和变更维护见 skills/project-docs/SKILL.md。

## Mission 守轴（可选，存在 Prism Mission 时强制）

`node "$DCT_HOME/bin/dct.mjs" axis --project "$PROJECT"` 只读取得 Prism 的 Mission ID 与 `specHash`，经任务 owner 审查后填入 `.dct/config.json` 的 `task.missionRef`。当项目有 `.prism/mission.json` 却未绑定或发生目标/范围/验收漂移时，`doctor/check/gate` 均拒绝放行。绑定还需精确的 Git 分支名与原 Mission 验收项索引，不得跨任务复用；没有 Prism Mission 的项目保持独立模式。机器只能核查合同一致性，不能替代目标语义审查。参见 [守轴合同](docs/AXIS.md)。

新增 `browser-extension` 模板，不再强迫 Chrome 扩展使用 SaaS 的管理员初始化与 seed 资料；迁移既有项目类型需单独审核项目文档契约，不能自行改绿。

## 配置真实检查

填写 `.dct/config.json`，将 task.baseHead 固定为核验过的 Git 基线，scope 检查包含该基线之后已提交的改动；配置 schema 见 docs/CONFIG.md 与 examples/config.json。argv 是可信项目代码，只有 `check --run` 或 `gate --run` 执行；默认 doctor/gate/MCP 不运行项目命令。命令不用 shell，但仍可执行任意本机项目代码；必须先审阅，不把此工具当 OS 安全隔离。

```sh
node "$DCT_HOME/bin/dct.mjs" check --project "$PROJECT" --run
node "$DCT_HOME/bin/dct.mjs" review-request --project "$PROJECT"
node "$DCT_HOME/bin/dct.mjs" review-import --project "$PROJECT" --file .dct/reviews/incoming.json
node "$DCT_HOME/bin/dct.mjs" gate --project "$PROJECT"
```

把 review-request 输出交给另一个真实独立上下文核验 diff/测试/历史行为/安全/文档；其结果存 `.dct/reviews/incoming.json`。导入验证绑定及字段，不认证身份或证明审查质量。缺审查就 NOT_READY。源码/配置/文档/工具/HEAD/分支变化会使证据失效。gate PASS 仅本地检查与外部审查声明；`--release` 始终保守阻断远端/人工证据缺口。退出码：0 成功/预览，1 验收未通过，2 用法/环境/安全拒绝。

## Git 与交接

```sh
node "$DCT_HOME/bin/dct.mjs" hooks --project "$PROJECT"
node "$DCT_HOME/bin/dct.mjs" hooks --project "$PROJECT" --apply
node "$DCT_HOME/bin/dct.mjs" sentinel --project "$PROJECT"
node "$DCT_HOME/bin/dct.mjs" handoff --project "$PROJECT" --notes relay-notes.json
node "$DCT_HOME/bin/dct.mjs" resume --project "$PROJECT" --file .dct/handoffs/ACTUAL-ID.json
```

notes 格式为 goal/traps/next 字符串，不能含凭据。先在项目 `.gitignore` 合并 `.dct/runs/`、`.dct/reviews/`、`.dct/handoffs/`、`.dct/operation.lock`，不要忽略 config 和文档契约。hook 安装后先审 diff、配置与权限，再重跑检查、真实独立审查、选择性暂存；部分暂存/未纳入文件会阻断。提交后 HEAD 变化须重新验证。已有 hook/core.hooksPath 原样保留；迁移包位置后要自行按备份/审阅流程调整 hook。

sentinel 只保存状态和失败诊断，不自动 reset、restore、clean、checkout、commit、tag、push 或 merge。不自动删锁，操作锁存在时核查持有者，保留现场。

## 其他 Agent 严格执行

1. 将 skills/deterministic-vibecoding（同名升级分发版）与 skills/project-docs 安装到该 Agent 支持的目录，或明确加载 SKILL.md。现有安装先备份并审 diff，本次仅打包，不覆盖本机已安装 Skill。Codex/Claude/Hermes 等客户端的发现机制各不相同，需实测新会话加载。
2. 每个项目维护自身 AGENTS、任务 scope、真实 check IDs 与历史回归；每次会话先 doctor，结束 check/review/gate/handoff。不得把工具 PASS 当生产授权。
3. 可选配置 mcp/config.example.json 的绝对路径。只支持 MCP **2025-11-25 stdio 兼容档**；新 stateless 协议未实现。客户端启动 server 后核验列出三个工具，再实测交接。MCP 不调用模型、不执行任意命令、不阻止宿主直接写文件。
4. 独立 reviewer 由用户/宿主配置成另一个真实上下文。模型 API 未集成、不产生费用；未配 reviewer 仍可检查/交接，但 gate 不放行。
5. 本地 hook 可 `--no-verify` 绕过。远端必须由管理员另外设置保护分支、必需 CI 与独立 PR review，禁止自批；本地工具不能证明远端设置。ci 子命令仅生成可选的同级 project/dct checkout 配方，需配置工具独立远端与固定 commit SHA，见 docs/CI.md。

## 验证与边界

```sh
npm test
npm run check
```

真实验证记录与 NOT_READY 见 docs/VERIFICATION.md；独立复核见 docs/INDEPENDENT-REVIEW.md。测试用合成项目真实执行进程/Git，不是生产业务证据。扫描是启发式；不完整识别混淆密钥、Mock、恶意测试伪造或语义弱化。运行器无网络/文件系统沙箱、不清理脱离子进程，未知项目必须在外部隔离环境审阅执行。文件系统保护防常见误操作，不保证抵抗同权限恶意并发写者。详见 docs/SECURITY.md。
