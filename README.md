# Nova Todo

本地优先的智能待办清单（零构建依赖）。

## 打开方式
- 本地：直接打开 `index.html`
- 固定公网地址：https://huangbin20180206.github.io/nova-todo/

## 本轮升级
- 子任务清单（编辑器维护 + 卡片进度/勾选）
- 自然语言快加：`明天 !! #工作 @生活 提醒09:30 | 写大纲 / 发邮件`
- 置顶、多选批处理、撤销、紧凑模式、快捷键
- PWA（manifest + service worker）
- IndexedDB 持久化、标签库、多清单、重复与提醒

## 说明
数据保存在当前浏览器 IndexedDB，不会跨设备自动同步。
