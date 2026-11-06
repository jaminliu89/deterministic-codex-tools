# 2026年11月06日 · 仓库部署与安装器验证

新增 scripts/setup.mjs：显式project/type/skills-dir，默认预览；--apply创建项目文档、两个Skill、项目MCP配置和启动入口；重复内容不覆盖，任一不同内容保留并拒绝整批预期写入。文件系统中途失败保留现场与已创建清单，不保证多目录原子事务。

本机最终 npm test：67/67 PASS，0 fail/skip；npm run check通过。新测试真实启动生成的MCP配置并列出3工具；验证空写预览、幂等、冲突、软链、类型漂移、现有客户端配置保留和用法拒绝。原始日志 evidence/setup-final-67-tests.log。

初轮5个测试失败：测试夹具放在工具本身work子目录，正确触发TOOLKIT_IS_NOT_PROJECT；修复测试隔离目录而非放宽安装保护。失败日志 evidence/setup-initial-67-tests.log 保留。

原核心60项独立审查及engine hash见 INDEPENDENT-REVIEW.md；新增安装器与远端流程没有另一个独立审查者的认证，不将旧报告泛化。GitHub CI是自动测试，不等于独立PR审查。

仓库自测工作流：.github/workflows/test.yml，Node22/Python3.12，Ubuntu和macOS。实际每个提交的状态以GitHub Actions结果为准；本文记录本地准备结果，不预填远端PASS。业务项目CI/保护分支仍需各项目单独配置。

用户授权上传至新仓库，默认私有。GitHub认证机器可clone；本包不含凭据、用户上传原文或模型调用。没有修改本机已安装Skill/客户端全局配置、CORE-01或SkillHub。远端发布不是业务项目生产部署。
