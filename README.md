# Nova Todo

本地优先的智能待办清单（零构建依赖）。

## 打开方式
- 本地：直接打开 `index.html`
- 固定公网地址：https://huangbin20180206.github.io/nova-todo/

## 第 4 波：云同步协作（稳定版）
- 可插拔同步：GitHub Gist（推荐）/ 通用 HTTP
- 立即同步、仅推送、仅拉取
- 合并策略：按 `updatedAt` 最后写入优先（LWW）
- 删除同步：tombstone（90 天），避免跨设备删除后复活
- 导出/备份自动剥离 Token
- 同步前自动本地备份；Token 仅存本机，不进远端快照
- 自动同步：1 / 5 / 15 分钟，并在回前台、联网、本地变更时触发
- 冲突可见：同 ID 不同内容按最新写入，并在侧栏展示最近冲突
- tombstone 管理：可清理过期或清空删除标记

### Gist 用法
1. GitHub 创建 classic PAT（至少 `gist` 权限）
2. 在侧栏填入 Token
3. Gist ID 可留空，点“仅推送/立即同步”自动创建
4. 另一台设备填入同一 Token + Gist ID 后拉取/同步

## 前几波能力
移动端、快加预览、备份、批处理、模板、搜索增强、提醒面板、schema 迁移、PWA 更新提示。
