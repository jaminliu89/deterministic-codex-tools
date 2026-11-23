# Anchored Gate：远端证据采集器（WP-03）

本切片提供只读 GitHub REST 证据采集与确定性拒绝测试。它**不是**可信默认分支服务、签名证明或合并授权。

## 使用前提

Node >=22。调用方必须从可信宿主注入：
- `DCT_GITHUB_TOKEN`：只读 GitHub token；
- `DCT_REQUIRED_CHECKS`：JSON 字符串数组，例如 `["Trusted CI"]`；
- `DCT_TRUSTED_APP_IDS`：可信 GitHub App ID 的逗号分隔整数，例如 `15368`。

这些策略值不得从 PR checkout、PR 修改的 workflow、项目内 JSON 或 PR 描述读取。必须由独立可信服务/默认分支 workflow 管理。token 至少具备 Pull requests、Checks、Commit statuses 和 Administration 的只读权限。不得输出 token。

## 执行

```sh
DCT_GITHUB_TOKEN="$READ_ONLY_TOKEN" \
DCT_REQUIRED_CHECKS='["Trusted CI"]' \
DCT_TRUSTED_APP_IDS='15368' \
node scripts/anchored-gate.mjs --repo owner/name --pr 123
```

命令只 GET GitHub API，不 checkout、不执行 PR 代码、不写 GitHub。分页未完整读取、403、超时、字段缺失、SHA 漂移、检查失败/来源不可信、review 自批/旧 SHA、策略不可读均返回 BLOCKED。

## 当前策略范围

当前实现只接受可读取的 **classic branch protection**，且要求：
- base branch protected；
- enforce admins；
- 至少一个 PR approval，并 dismiss stale reviews；
- strict required checks，且每个 required check 绑定明确的 trusted App ID；
- 禁止 force-push 和 branch deletion；
- 当前 PR head SHA 上对应可信 App 的 required check 全部成功；
- 至少一个非 PR 作者 reviewer 对当前 head SHA 的最新状态为 APPROVED。

Ruleset-only 策略暂不接受，返回 BLOCKED；后续必须单独实现 ruleset 规则、bypass actor 和继承策略解析，不能把 rulesets 列表为空当作 branch protection。

## 结果语义

- `BLOCKED`：任何关键事实不可读或不满足。
- `REMOTE_POLICY_MATCHED_NOT_RELEASE_AUTHORIZED`：本次只读采集到的远端事实满足输入策略。
- 所有结果都固定 `releaseAuthorized: false`。当前 Node CLI 无法证明自身由可信默认分支身份执行，也不签名结果；因此不能单独作为 required check、merge gate 或生产发布授权。

## 当前仓库已知状态（2026-11-23）

此前读取 DCT main 分支元数据得到 `protected=false`、required-check enforcement `off`；详细 protection endpoint 对当前连接器仍返回 403。故当前真实状态为 **BLOCKED**。即使采集器和测试通过，也不能替代仓库管理员启用服务端保护与独立只读身份验证。

## 测试

```sh
node --test tests/anchored.test.mjs
npm test
npm run check
```
