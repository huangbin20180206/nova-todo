# Nova Todo 公网分享说明

这个待办应用是**纯前端本地应用**，数据存在浏览器 IndexedDB。
要分享给朋友/亲戚，有两种靠谱路径：

## 方案 A：分享应用本身（推荐先做）
让对方也能打开同一个网页工具。

### 1) 临时公网地址（不需要自己的域名）
在本机启动一个静态服务，再用隧道工具生成临时公网 URL。

Windows PowerShell:

```powershell
cd "C:\Users\huang\Documents\Codex\2026-07-18\he\outputs\todo-app"
npx --yes serve -l 4173 .
```

另开一个终端：

```powershell
npx --yes localtunnel --port 4173
```

或（如果已安装 cloudflared）：

```powershell
cloudflared tunnel --url http://localhost:4173
```

你会得到类似：
- `https://xxxx.loca.lt`
- `https://xxxx.trycloudflare.com`

把这个链接发给朋友即可。  
**特点：** 免费、无需域名；但电脑关机/断网后链接失效。

### 2) 固定一点的免费托管（仍可不买域名）
把 `todo-app` 文件夹发布到：
- Cloudflare Pages
- Netlify
- Vercel
- GitHub Pages

它们通常会给你一个免费二级域名（例如 `xxx.pages.dev`），
这不是你自己买的一级域名，但足够分享。

## 方案 B：分享“数据内容”
应用内已支持：
1. 点 **导出分享包**
2. 把 JSON 发给对方
3. 对方打开同一应用后点 **导入 JSON**

适合“把我的任务列表给别人看/接手”，不要求实时同步。

## 重要限制
- 当前没有云账号系统，所以**不能多人实时共享同一份实时数据**
- 浏览器提醒只在本机、本浏览器、已授权通知时有效
- 临时隧道链接依赖你的电脑在线

## 建议你怎么选
- 只是给亲戚玩玩页面：**临时隧道 / Pages 托管**
- 想给别人一份任务数据：**导出分享包**
- 想要真正的多人协作云待办：需要后续加后端（Supabase / Firebase 等）
