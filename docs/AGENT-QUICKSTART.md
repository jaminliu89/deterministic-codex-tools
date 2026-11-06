# 其他 Agent 一键部署与使用

仓库：https://github.com/jaminliu89/deterministic-codex-tools 。私有仓库，执行机器需已有 GitHub 读取权限。没有云服务需要部署；这是本地 Node CLI/Skill/MCP 工具。已有 Node >=22、Git、GitHub CLI；Python unittest 项目另外需要 Python。无 npm install、模型调用或下载依赖。

## 首次一键准备

把三个路径换成真实绝对路径。DCT_HOME 是尚不存在的工具目录，PROJECT 是已存在的业务项目，SKILLS_DIR 是当前客户端允许的 Skill 目录；不要填工具源码目录或业务项目内部目录。示例在 zsh/bash 中执行：

```sh
DCT_HOME=/absolute/tools/deterministic-codex-tools
PROJECT=/absolute/business-project
SKILLS_DIR=/absolute/client/skills
gh repo clone jaminliu89/deterministic-codex-tools "$DCT_HOME" && node "$DCT_HOME/scripts/setup.mjs" --project "$PROJECT" --type cli --skills-dir "$SKILLS_DIR" --apply
```

只有最后一行执行安装。想先看计划，去掉 --apply。已有工具目录时不重新 clone，直接运行 setup 命令。安装不自动拉取/重置旧工具，不改模型、费用、权限、现有客户端全局配置或 Git 状态。

--type 可选 static-web / fullstack-saas / python / cli / ai-agent / legacy-reorg。不需要自动复制 Skill 时可省略 --skills-dir，直接让 Agent 读取工具根目录内两个 SKILL.md。

一次执行会：

1. 生成该项目类型的设计、技术、测试矩阵、上线、变更、交接文档和任务配置。
2. 把两个 Skill 安装到显式指定的目录；相同内容重复执行返回 UNCHANGED，内容不同则拒绝整批写入，不覆盖旧Skill。
3. 生成 `.dct/AGENT-START.md` 和已填实际 Node/项目路径的 `.dct/mcp.config.json`。

已有项目文档冲突会保留并阻断；先读旧文档做定向合并，不能删后重跑。安装成功仍 projectAcceptance=NOT_READY：这表示需求、任务基线、真实检查与独立审查尚待项目自己填写，而非工具没装好。

## 立即使用 CLI

```sh
node "$DCT_HOME/bin/dct.mjs" doctor --project "$PROJECT"
node "$DCT_HOME/bin/dct.mjs" --help
```

doctor 在模板未补全时返回 NOT_READY 是预期。按 [CONFIG.md](CONFIG.md) 填真实 task/baseHead/allowedPaths/protectedPaths/checks/requiredTests，补文档与历史回归。只在功能分支工作，git init/首次commit由当前项目授权处理，脚本不替用户建立假基线。

```sh
node "$DCT_HOME/bin/dct.mjs" check --project "$PROJECT" --run
node "$DCT_HOME/bin/dct.mjs" review-request --project "$PROJECT"
node "$DCT_HOME/bin/dct.mjs" review-import --project "$PROJECT" --file .dct/reviews/incoming.json
node "$DCT_HOME/bin/dct.mjs" gate --project "$PROJECT"
```

外部独立 reviewer 的报告须绑定当前源码，不得让实现者自己填 PASS。运行 checks 是执行本机项目代码，应先审阅。无OS沙箱，陌生项目用外部隔离环境。

## 客户端 Skill 与 MCP

新会话要求 Agent 明确读到两个 Skill，并读取 `.dct/AGENT-START.md`。自动发现能力仍取决于客户端；不要仅凭目录已复制就声称加载成功。

若使用MCP，审阅 `.dct/mcp.config.json` 后合并其 mcpServers 条目到客户端配置；已有配置先备份。Codex、Claude、Hermes 的配置格式/位置不同，不能用同一脚本盲目覆盖。纯CLI使用无需配置MCP。

也可以让宿主直接用配置内 command/args 启动服务；当前只实现 MCP 2025-11-25 stdio。正式连接后应看到 generate_handover、git_sentinel、request_independent_review 三工具。MCP不调用模型，也拦不住宿主直接写文件。

## 升级与远端门禁

升级先检查工具仓库 dirty 和当前版本，在授权功能分支用普通 Git 流程更新；禁止reset/force。setup对同名不同内容Skill拒绝，须保留备份并审diff后按客户端安装流程更新，不能为了安装成功删除保护。

本地hook可选，运行 hooks预览，--apply会保存Git配置备份且拒覆盖已有hook。真实远端门禁见 [CI.md](CI.md)，项目管理员需设置必需CI、独立PR review与保护分支。工具自己的CI不等于业务项目CI。

本次上传新增setup/CI配方的验证记录见 [UPLOAD-VERIFICATION.md](UPLOAD-VERIFICATION.md)；原核心独立审查仍只覆盖其报告声明的版本，不自动替新增安装器背书。
