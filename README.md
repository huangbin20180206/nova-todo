# Nova Todo

本地优先的智能待办清单（零构建依赖）。

## 打开方式
- 本地：直接打开 `index.html`
- 固定公网地址：https://huangbin20180206.github.io/nova-todo/

## 第 3 波升级
- 数据 schema 版本化与迁移（`js/schema.js`）
- 轻量模块拆分：`schema.js` / `pwa.js`
- PWA 更新提示、缓存策略优化、离线状态提示

## 第 1-2 波保留
移动端、快加预览、备份、批量操作、模板、搜索增强、提醒面板、子任务等。

## 本地冒烟
```bash
node test-smoke.js
```
