# Mission 守轴合同 v1（WP-02）

DCT 独立运行，不依赖 Prism 服务。项目若存在 `.prism/mission.json`，则 DCT `doctor/check/gate` **强制要求**当前任务显式绑定这份 Mission 的身份与规范摘要。若不存在 Mission，原独立工作模式不改变。

## 任务开始前

```bash
node "$DCT_HOME/bin/dct.mjs" axis --project "$PROJECT"
```

在已审查的 `.prism/mission.json` 中必须有：
- `schema_version: 1`、非空 Mission `id`
- `spec.goal`、`spec.scope`、`spec.target`、至少一项非空 `spec.acceptance`
- `spec.implementation_authorized === true`、明确 `authorization_statement`

`axis` 以只读方式返回 `missionRef`。项目 DCT `.dct/config.json` 应由任务 owner 在审查任务范围后登记：

```json
{
  "task": {
    "id": "WP-EXAMPLE",
    "outcome": "本次具体交付结果",
    "coder": "executing-agent",
    "baseHead": "任务开始时的真实 SHA",
    "allowedPaths": ["src/", "test/"],
    "protectedPaths": ["protected/"],
    "branch": "feat/this-exact-wp-branch",
    "missionAcceptance": [0],
    "missionRef": {
      "id": "MSN-EXAMPLE",
      "specHash": "由 dct axis 计算的 64 位 SHA-256"
    }
  }
}
```

示例只展示任务字段，不能直接复制并声称验证通过。

- `task.branch` 必须是当前 Git feature branch 的精确名称，禁止用旧任务合同在新分支持续施工。
- `task.missionAcceptance` 是本次工作包映射到 Mission 原始 `spec.acceptance` 的 **0 起始索引数组**，必须非空、有效且不可重复；`dct axis` 会输出索引对应的原始验收文字。匹配索引只做可追踪性，仍须独立审核相关性和真实结果。该 `specHash` 是 DCT 对 Mission `spec` 的递归键排序紧凑 JSON 所做 SHA-256，不等同于 Prism Python 中含空格的 `contract_hash`。**不要手填、猜测或静默重算**；Mission 变化应回到 Prism 走 `amend` 与批准流程，然后更新 DCT 任务范围，失效旧测试和审查证据。

## 机器行为

| 条件 | doctor 结果 |
|---|---|
| 没有 Prism Mission 且没有绑定 | 保持原 DCT 行为 |
| 存在 Mission、缺 `missionRef` | `MISSION_REF_REQUIRED` |
| Mission 缺失/读取失败、合同格式无效、未经授权 | `NOT_READY` |
| Mission ID 或 spec 摘要变化 | `MISSION_ID_DRIFT` / `MISSION_SPEC_DRIFT` |
| Mission 绑定存在，但任务分支或验收映射缺失/不匹配 | `NOT_READY`，不得复用旧任务或不注明交付目标 |
| ID、spec、分支与验收映射完全一致 | 这一关通过；仍须其他检查、独立审查与真实产物 |

审查请求将附上 `mission` 回执，但仍需**真正独立执行者**判断本次 `task.outcome` 是否支持原始 goal、是否在 scope 内、是否覆盖相关历史功能。机器哈希只证明合同没被偷偷换掉，不会理解用户意图。

## 安全/边界

- 只读本地文件，不运行 Prism，不调用模型，不改写 Git、任务或 Mission。
- `missionRef` 不是签名，也不能阻止恶意执行者同时修改 Mission 与配置。必须结合 GitHub 可信分支保护、独立 PR Review、受保护配置变更和真实检查。
- DCT 当前其他业务门禁仍然只提供局部证据；实际产物、云端执行者认证和发布授权都不由本适配器证明。
- `browser-extension` profile 是文档/配置适配，不会自动下载影片或验证扩展。
