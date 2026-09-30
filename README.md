# 徐逸峰 · 技术美术作品集

浅灰底、石墨色文字与细线排版的个人作品集。页面和资源均可直接用于 GitHub Pages。

## 预览

解压网站包后，双击 `index.html` 即可预览。保持 `assets` 文件夹、`styles.css`、`script.js` 与首页的相对位置不变。

每次打开或刷新网站会播放约 4～5 秒的引擎图标入场动画，可跳过或重播。系统开启“减少动态效果”时，自动动画会相应减少。

背景等高线缓慢流动，短光段沿线游走，物体周围的轨迹与刻度持续运动。鼠标移动和点击会带起细线波纹；手机滑动会推动背景流动，改变物体姿态。分隔线和作品悬停也有线条动画。背景不阻止页面滑动、链接点击或文字选择。

页面顺序为「项目与经历 → 作品集 → 技术与工具 → 公开项目与文章 → 联系」。项目经历位于作品集上方。

作品固定按“春招 → 秋招”排列，整张卡片直接打开对应 B 站视频：

- 春招：<https://www.bilibili.com/video/BV1x3P2zKEXb/>
- 秋招：<https://www.bilibili.com/video/BV1gGaNzaECM/>

公司经历按“不鸣科技 → 腾讯天美 J3 → 上海宝可拉”排列。宝可拉显示的是简历中「代号 H」的项目时间，不替代简历中的入职日期。完整简历保留原 PDF，通过图片页提供手机友好的预览。

## 发布到 GitHub Pages

1. 本项目使用 [f2015805589/f2015805589.github.io](https://github.com/f2015805589/f2015805589.github.io) 仓库，发布在账户的根地址。
2. 网站文件位于仓库根目录，包括 `.github` 文件夹、`package.json` 与 `package-lock.json`。首页 `index.html` 直接位于根目录。
3. 在仓库的 **Settings → Pages → Source** 中选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/ (root)**。本仓库已经按此方式配置。
4. 打开 **Actions → Sync public content and publish portfolio → Run workflow**。流程会同步内容、检查构建，再请求 GitHub 原生 Pages 发布，并等待对应提交发布成功。

网站地址为 [https://f2015805589.github.io/](https://f2015805589.github.io/)。仓库名称必须保持为 `f2015805589.github.io`，才能使用这个账户根地址。Pages 的 Custom domain 保持为空；此地址不需要 `CNAME` 文件。

后续更新主分支会自动发布。工作流每天在香港时间 08:17 左右尝试同步公开内容并发布；运行时间由 GitHub 调度决定。是否已上线以 Pages 设置和工作流结果为准。

发布方式参考 [GitHub Pages 发布来源官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。同步提交后，通过 [官方 Pages Build API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build) 显式请求发布。

## GitHub 项目

页面读取 `f2015805589` 的公开仓库，默认展示个人项目，也可以切换为包含 Fork。初始快照包含本人账户中实际读取到的公开仓库。网络不可用或接口暂时受限时，页面仍显示已保存的内容。

在线访问页面时，滚动到项目区域会尝试更新公开仓库；发布工作流也会更新快照。所有读取均使用公开仓库接口，不在网页中放置登录凭据。接口依据 [GitHub 官方仓库 API](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)。

## 知乎文章

同步脚本会直接读取 `https://www.zhihu.com/people/shen-feng-60-57/posts`，依次尝试公开主页、文章接口和浏览器加载后的列表，仅保存文章标题、链接、摘要与日期。

当前实测：公开主页和匿名浏览器被导向知乎登录／安全验证，文章接口返回访问限制。页面因此显示知乎文章主页入口，**没有编造文章标题**。已有成功同步的文章不会因为下一次抓取失败而被清空。

如果需要登录后读取，先在本机安装同步工具，再自行登录独立浏览器：

```text
npm install
npx playwright install chromium
npm run zhihu:login
npm run sync
```

`zhihu:login` 会打开独立浏览器。由你完成登录，再回终端按 Enter。登录状态保存在 `.local/zhihu-session.json`，该目录已排除在版本库和发布文件之外。脚本不会自动处理安全验证。

如需 GitHub 自动同步已登录状态，可把该文件的内容放入仓库 **Settings → Secrets and variables → Actions** 的 `ZHIHU_SESSION_JSON` Secret。登录状态失效时需重新登录并更新 Secret；网站本身不向访客提供任何登录状态。

也可以在 `content-config.json` 的 `manualArticles` 中填写确切的文章标题、链接和摘要，再运行 `npm run sync`。公开项目的 GitHub 账号及知乎主页账号也在此配置文件中。

## 修改内容

- 个人介绍、作品和经历：`index.html`
- 颜色、排版、手机布局：`styles.css`
- 入场时长和交互：`script.js`（`duration` 控制读条序列时长，转场另约 0.85 秒）
- 头像：`assets/avatar.jpg`
- 原始简历：`assets/resume.pdf`
- 简历预览：`assets/resume-page-1.webp` 至 `resume-page-3.webp`。替换 PDF 后，应同时更新预览图片。
- 公开内容快照：`assets/content.json` 和 `assets/content-data.js`，由同步脚本一起生成。

`npm run build` 复制网站所需文件到 `dist`，用于构建检查和其他静态平台。这个仓库的 GitHub Pages 使用 `main` 根目录发布；`.local` 登录状态不进入仓库，始终不会被上传或发布。

引擎与 GitHub 图标来自 [Simple Icons](https://github.com/simple-icons/simple-icons)。Godot 图标原始来源及许可见 [Godot 品牌资源](https://godotengine.org/press/)。作品卡片采用本地绘制的示意封面，不依赖原站已不可访问的远程图片。
