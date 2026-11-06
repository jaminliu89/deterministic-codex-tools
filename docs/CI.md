# Git/PR/CI 集成

`ci` 默认预览，`--apply` 创建 `.github/workflows/dct.yml`，已有文件不覆盖。它是配方，不代表已在任何远端运行。

需要项目管理员：

1. 将工具包放到可由 CI 读取的独立仓库，设置 vars.DCT_REPOSITORY 与 vars.DCT_REF（完整40字符固定 commit SHA）。当前没有实际发布该远端；没配置就 NOT_READY，不自动获取陌生实现。
2. 配方把业务仓库 checkout 到 project/，工具仓库 checkout 到 dct/，两者为同级目录，避免工具自身进入业务源码扫描。PR checkout 使用 head SHA；本地策略分支为 ci/dct；执行 check --run，不导入或伪造独立 review。项目须提供真实 tests、固定 task.baseHead；actions/checkout 默认浅克隆无法包含旧 baseline，须将第一 checkout 的 fetch-depth 设为0（本配方已设置）。不可信 PR 不提供 secrets/写权限；例中 permissions contents:read。维护者应将 actions 固定到审阅过的 commit SHA，示例 @v4 尚未锁定。
3. 远端保护默认分支，required CI + 独立 PR review、禁止自批/直推、必要时 CODEOWNERS。用户创建 PR 前展示完整 body；工具不自动创建或合并 PR。
4. CI 只证明对应 head 的 checks。远端审查/部署/真实业务验收分别保存证据；更改测试和删除断言必须人工检查。自动脚本不能证明测试充分。

本地 hook 调 `gate --precommit`，先运行并审查、再暂存，index/worktree 必须一致；仅证据目录可不纳入提交。Git 暂存动作不改变内容绑定，commit 改 HEAD 会失效，需要下轮重跑。hook 安装使用绝对 toolkit 路径，仅本机可用，跨机器需重新安装。

不可绕过的强制性取决于服务器设置与权限；本地 hook 可绕过、CLI 可不调用、MCP 不能禁止直接写文件。`--release` 因缺少认证远端/真人证据始终 NOT_READY。无 GitHub 网络调用、远端配置变更或实际 CI 运行发生。
