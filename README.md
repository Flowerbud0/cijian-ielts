# 词间 · IELTS

暖灰白 / 墨绿界面，支持移动端。当前为可运行的 **0.2 试用版本**。

正式网站：https://flowerbud0.github.io/cijian-ielts/

2026-11-10 已上线：GitHub Pages 自动检查通过；正式网址 GitHub 登录、公网与本地来源之间的设置双向同步已验证。以下本地配置过程保留作开发参考；当前 Site URL 和 GitHub 应用主页均为正式网址，返回白名单另保留两个本机地址。真实手机尚未测试。

## 当前状态

- 已实现：章节入口、每日新词目标 / 自由模式、翻卡与间隔复习、逐词语境解释、搭配和派生扩展、生词本、独立拼写记录、笔记、记录统计、备份导入导出、浅色 / 深色 / 跟随系统。
- 本地记录按访客和账号隔离。跨标签页合并，备份导入去重。
- 云同步：Supabase 免费项目已配置，GitHub PKCE 真实登录与回调通过；本机与正式网页已验证设置经云端双向同步。数据库角色隔离测试通过。**真实手机尚未验证**。
- 内容：22 章全部开放，3,592 个参考词目加 6 个早期补充词，共 3,598 词。相同单词跨章节共享进度，保留原有试用词卡 ID。
- 34 张词卡含原创语境例句、逐词解释与扩展；其余 3,564 张为基础释义卡，例句与辨析仍待补充。不能将此版本称为全部内容已完成。基础词典释义尚未逐条完成教学语境校订。
- 例句查词内容是预先编写的本句释义，不是调用实时翻译。首次收藏额外词保留原句；尚无完整卡片的收藏词暂不进入自动复习。
- 发音来自设备 Web Speech 语音，不是教材原版录音。无语音能力时会提示。
- 仅在页面已加载时支持断网继续记录；尚未加入完整离线安装包 / PWA 缓存。

## 本地运行

需要 Node.js 20 或以上（推荐 22）。无本地安装依赖。

```sh
npm start
npm test
```

访问 http://127.0.0.1:4173 。此地址只用于本机开发；手机和同学请使用上方正式网址。

## 启用自动同步

1. 已创建免费项目 `cijian-ielts`（新加坡）；项目引用 `dkteqfxijaopkprvkfeg`。
2. 已在 SQL Editor 创建 `supabase/schema.sql` 中的表和策略；`supabase/verify-rls.sql` 实测通过并回滚所有测试身份/记录。
3. 用户选择 GitHub 登录，不使用默认邮件服务。GitHub OAuth App 的 callback 为 `https://dkteqfxijaopkprvkfeg.supabase.co/auth/v1/callback`。
4. 用户已创建 GitHub OAuth App 并在 Supabase 保存凭据、完成首次授权。真实登录返回成功，仅请求 user:email。密钥仅存 Supabase，不能写入网页或仓库。
5. `public/config.js` 已填项目 URL 和公开 publishable key，没有管理密钥。前端采用 PKCE，返回当前部署路径；Site URL 和 GitHub 应用主页为 `https://flowerbud0.github.io/cijian-ielts/`，精确返回白名单包含正式网址和两个本机地址。
6. 已验证同一 GitHub 账号在独立存储来源的设置双向同步、刷新、退出及再次登录；测试目标值 20 → 21 → 20，未改动背词进度、未合并访客记录。退出仅注销当前会话。允许返回地址另含 http://localhost:4173/ 和 http://127.0.0.1:4173/ 用于本机测试。公网与本机设置同步已验证，仍需真实手机及其网络环境测试。

云端使用不可变事件表：浏览器只允许读取/插入自己的事件，不允许覆盖或删除别人的记录。新笔记和移出收藏以新事件记录。登录不会自动上传访客记录；用户可在账号页主动合并。同步采用拉取合并再补传，并由 UUID 保证重试幂等。长期大量记录需要升级为游标增量同步，目前适合小规模试用。

登录 SDK 固定为 `@supabase/supabase-js@2.119.0`，配置云服务后从 esm.sh 加载。公开发布前应测试实际网络可达性，必要时将该 MIT SDK 固定版本打包为本地资源。

## GitHub Pages

仓库 `cijian-ielts` 的 main 分支已启用 **GitHub Actions** 发布。工作流测试通过后仅发布 `public/`。

远程仓库：https://github.com/Flowerbud0/cijian-ielts 。正式网站：https://flowerbud0.github.io/cijian-ielts/ 。Supabase 数据库、正式网址 GitHub 登录返回及独立存储来源间的设置同步已实测。

## 数据与来源

- 程序与语境例句、逐词解释、翻译及相应扩展由本项目独立编写。
- 章节名称参照学为贵官方目录：https://www.guixue.com/words/primary.shtml
- 英文词目与章节编号参考：https://github.com/LynnShaw/vocabulary_for_ielts/blob/main/word_list.csv 。仅提取词目/编号，不使用其中的中文释义和音标；未逐项核对纸质书版本，不是官方授权电子书。
- 基础释义、音标及词形来自 ECDICT（MIT）：https://github.com/skywind3000/ECDICT 。许可全文保留在 public/data/ECDICT-LICENSE.txt；词目筛选、去重、展示格式由本项目处理。未匹配词 shade-tolerant 的释义独立编写。
- public/data/chapter-headwords.csv 为可下载词目索引；manifest.json 记录统计和来源文件摘要。scripts/build-wordbook.py 为生成脚本，原始下载文件位于被忽略的 private/sources，不发布。
- 不复制书中完整释义、例句和原音频。正式词库的收录、版本和内容来源需要另外记录。
- 技术依据：Supabase 邮箱 OTP / RLS 官方文档及 GitHub Pages 官方文档。

## 复习方式

当前采用透明的固定阶梯间隔：忘记 10 分钟、模糊 1 天；认识从 1、3、7、14、30、60 天递增。它不宣称精确预测遗忘。词义评价和拼写成绩各自独立，已学数量按词条去重，不把浏览次数算成掌握。
