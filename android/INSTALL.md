# YesPlayMusic 安卓平板版

下载 [YesPlayMusic-Android-Tablet.apk](https://github.com/461c/YesPlayMusic/raw/refs/heads/android/YesPlayMusic-Android-Tablet.apk)，在平板上允许该下载来源安装应用。支持 Android 7.0（API 24）及以上，建议使用更新的 Android System WebView。

首次启动需要填写平板能够访问的 `@neteaseapireborn/api` / 兼容网易云音乐 API 服务地址，例如 `https://你的服务地址` 或 `http://192.168.1.10:3000`。该安卓版本没有内置 Electron 的 Node.js 接口服务器；不能填写桌面应用使用的 `localhost`。接口服务器必须允许平板访问。地址也可在应用设置中修改。

音乐由原生 Media3/ExoPlayer 后台服务播放，支持通知栏、锁屏、耳机控制、后台队列切歌、音频焦点及拔出耳机时暂停。界面退到后台后停止 WebView 的计时器，播放服务继续运行。重新打开界面会连接已有的播放会话。

默认关闭动态歌词背景，降低绘制负担，并调整触控尺寸及平板布局。外部 CSS 网址继续可用；Electron 的托盘、全局快捷键、Rust 音源解锁、桌面文件路径和桌面本机服务器不属于安卓实现。

这是用于自用体验的开发签名版本，不是应用商店发行包。开发证书在仓库中固定，后续同签名 APK 可覆盖更新。安装时允许媒体通知；部分厂商的省电策略仍可能限制长时间后台播放，可在系统中允许此应用后台运行。

`build-info.json` 记录对应的源码提交和构建链接，`.sha256` 文件提供安装包校验值。后台稳定性、续播和流畅程度还需要在目标平板上实际体验。
