# 配置和证据协议

`.dct/config.json` schemaVersion=1。这是可审阅的项目合同，不是另一个模型/服务；更改会使运行与审查证据失效。

| 字段 | 约束 |
|---|---|
| type | 六个 profiles 之一 |
| task.id / outcome / coder | 非空实际值，禁止 TODO/TBD；coder 是声明不是认证身份 |
| task.baseHead | 必须为已核验的40字符 Git commit，且是当前 HEAD 祖先；固定任务基线，已提交越界改动仍检查 |
| task.allowedPaths | 非空精确相对文件/目录前缀，不支持 glob；越界、.git、符号链接拒绝 |
| task.protectedPaths | 保护文件/目录；命中改动即阻断，不自动恢复 |
| checks | 至少一项，每项唯一 id、kind、argv 数组、timeoutMs=100..300000 |
| requiredCheckIds | 非空唯一 ID；必须全部存在于 checks；所有 checks 都执行 |
| checks.minTests / requiredTests | node-tap/python-unittest 为正整数；requiredTests 非空，指定实际 Node subtest 名或 Python verbose ID |
| checks.input / expected | json-io 必填，stdin JSON→stdout 唯一 JSON 对账，不靠假 actual_output |
| capabilities | 可选 env/admin-seed/health；fullstack-saas 至少全部三个，不允许降级移除 |
| artifacts | capability→实际相对文件；检查非空只证明存在，行为必须写 checks |
| mockPaths | 仅 tests/、fixtures/、demo/ 下的明确路径；其他 runtime 疑似 Mock 阻断 |
| requireReview | 必须 true；独立审查缺失不放行 |

支持的 node-tap 命令必须直接 Node --test --test-reporter=tap，避免 npm 包装导致未知格式；完整 summary、非零计数、无 skip/todo/fail。Python 直接 python3 -m unittest；零测试、skip/expected failure 不放行。json-io 针对真实入口比对 stdout，stderr/exit/signal/timeout 单独记录。数组 argv 不经 shell，但执行项目任意代码本身有风险；DCT 无 OS 沙箱、网络隔离或完整子进程清理。Node runner 清除继承 NODE_TEST_CONTEXT，避免嵌套 Node 测试静默跳过。

运行收据保存在 `.dct/runs/TIMESTAMP-RANDOM.json`，包括 task、源码/engine/HEAD/branch binding、逐项 ID/退出码/结果、脱敏输出、源码漂移、进程隔离限制。源码 hash 包括配置、文档、普通/未跟踪/忽略文件及 mode，排除 .git、node_modules、.venv、__pycache__、operation.lock，以及 `.dct/{runs,reviews,handoffs}` 顶层识别出的收据 JSON；该目录的其他文件仍纳入绑定。构建产物不默认排除，重建会失效。每文件8MB/总量64MB/10000文件上限，超限阻断，不跳过后冒充完整扫描。

依赖安装目录在 hash 外，无法证明依赖树未被篡改；需项目锁文件、隔离安装和自己的依赖审计。排除的证据目录不能放业务代码；本机同权限写者可篡改报告或替换程序。本工具检测常见陈旧/意外漂移，不是可信计算/对抗作弊平台。

审查 request schema：schemaVersion、binding、task、coder、reviewer、context、verdict、blockers、notes；reviewer 不得等于 coder，context 须是真实独立上下文引用，verdict=PASS 且 blockers=[] 才可导入。导入总是 identityVerified=false；只验字段与版本，不证明独立身份/语义/来源真伪。生产团队应使用服务端 PR review 或有认证签名的外部系统。

`gate --release` 保持 NOT_READY，不接受手填 JSON 自证远端 CI/branch protection/真人接受。当前无生产放行模块。
