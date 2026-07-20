# Nova Todo

本地优先的智能待办清单（零构建依赖）。

## 打开方式
- 本地：直接打开 `index.html`
- 固定公网地址：https://huangbin20180206.github.io/nova-todo/

## 第 4 波：云同步 MVP
- 可插拔同步：GitHub Gist（推荐）/ 通用 HTTP
- 立即同步、仅推送、仅拉取
- 合并策略：按 `updatedAt` 最后写入优先（LWW）
- 同步前自动本地备份；Token 仅存本机，不进远端快照
- 可选 15 分钟自动同步

### Gist 用法
1. GitHub 创建 classic PAT（至少 `gist` 权限）
2. 在侧栏填入 Token
3. Gist ID 可留空，点“仅推送/立即同步”自动创建
4. 另一台设备填入同一 Token + Gist ID 后拉取/同步

## 前几波能力
移动端、快加预览、备份、批处理、模板、搜索增强、提醒面板、schema 迁移、PWA 更新提示。
