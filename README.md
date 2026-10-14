# YesPlayMusic 安卓平板版

下载 [YesPlayMusic-Android-Tablet.apk](https://github.com/461c/YesPlayMusic/raw/refs/heads/android/YesPlayMusic-Android-Tablet.apk)，在平板上允许该下载来源安装应用。支持 Android 7.0（API 24）及以上，建议使用更新的 Android System WebView。

应用内置 Node.js 和 `@neteaseapireborn/api`，启动时自动将接口文件安装到应用私有目录，在本机 `127.0.0.1` 上启动接口，等待就绪后打开界面。无需自建服务器、安装 Termux 或填写 API 地址。API 在应用内的独立服务进程运行，与 WebView 和播放器原生库隔离，通过绑定保持与播放服务相同的后台重要性。接口仅本机可访问；退出界面时不会终止后台播放所需的接口，系统结束应用进程后，下次启动会自动重新启动。

从旧版升级后默认切换为内置接口。设置中的接口地址留空即使用内置接口；仍可填写自己的 HTTP/HTTPS 地址作为可选覆盖。登录与音乐内容仍需要联网访问网易云，本地接口不代表离线音乐服务。支持 arm64-v8a、armeabi-v7a、x86_64。应用等待本地接口完成启动，启动失败会显示提示。

音乐由原生 Media3/ExoPlayer 的 MediaLibraryService 后台服务播放，向系统媒体播放器提供曲目信息、进度、媒体会话 token、播放控制和最近播放的队列，支持系统浏览与续播、通知栏、锁屏、耳机控制、后台队列切歌、音频焦点及拔出耳机时暂停。界面退到后台后停止 WebView 的计时器，播放服务继续运行。重新打开界面会连接已有的播放会话。

默认关闭动态歌词背景，降低绘制负担，并调整触控尺寸及平板布局。外部 CSS 网址继续可用；Electron 的托盘、全局快捷键、Rust 音源解锁、桌面文件路径不属于安卓实现。

这是用于自用体验的开发签名版本，不是应用商店发行包。开发证书在仓库中固定，后续同签名 APK 可覆盖更新。安装时允许媒体通知；部分厂商的省电策略仍可能限制长时间后台播放，可在系统中允许此应用后台运行。

`build-info.json` 记录对应的源码提交和构建链接，`.sha256` 文件提供安装包校验值。后台稳定性、续播和流畅程度还需要在目标平板上实际体验。


## 从源码构建

安装 Node.js 16、Yarn 1、JDK 17、Android SDK 35、Gradle 8.9、NDK 27.3.13750724 和 CMake 3.22.1。执行 `yarn install --frozen-lockfile --ignore-engines --ignore-scripts`、`yarn android:web`、`yarn android:api`。依照 `.github/workflows/android.yml` 下载并校验固定版本 Node.js Mobile，将 zip 解压到 `android/app/libnode`，将 `dist/` 内容复制到 `android/app/src/main/assets/web/`，解码开发证书后运行 `gradle -p android assembleRelease`。API 的生产依赖从现有 `yarn.lock` 安装结果收集，不会把桌面 Electron 或 Rust 原生插件打包到安卓 API 中。

安装后可验证：首次打开无需地址设置；扫码登录、搜索、播放及切歌；退到后台切歌并恢复界面；编辑歌单与上传头像；关闭应用进程后重新启动；覆盖安装同签名更新。运行库和 JNI 桥接使用 16 KB 对齐；实际登录、播放及设备兼容性仍需在目标设备验证。

内置运行库固定为 [fogtape/nodejs-mobile v24.21.0-0](https://github.com/fogtape/nodejs-mobile/releases/tag/v24.21.0-0) 的完整 Android 构建（基于 Node.js 24.21.0，移动端构建为预发布修订），下载时校验固定 SHA-256。使用其匹配的 NDK r27d；接口依赖仍使用本仓库的 `yarn.lock`。

安卓界面延伸到透明状态栏和系统导航栏下方，顶部导航栏的背景覆盖时间栏区域并使用 10px 模糊，导航控件按状态栏、刘海安全区加 12dp 留白。歌词背景覆盖整个窗口，顶部收起按钮避让状态栏，不再有独立黑色横条或全屏按钮。外观选择“自动”时，通过原生 Configuration.uiMode 读取并实时跟随系统夜间模式；手动选择浅色或深色时保持用户设置。

应用使用 Media3 创建的原生 android.media.session.MediaSession，通过 PlaybackState、MediaMetadata、媒体 token 和 MediaBrowserService 接入系统播放器。系统媒体卡片和后台媒体通知属于同一套标准接口，系统面板的具体样式由 Android 版本与厂商决定。构建使用离线 PCM 音频，验证系统快捷面板的媒体卡片、进度条和实际播放/暂停按钮，以及 MediaBrowser 队列、切歌、进度控制和续播，不需要音乐账号。Android-UI-verification 构建产物保存系统播放器与浅色、深色、歌词界面的截图和媒体会话诊断。

歌词浮层打开时，平板播放栏立即完全隐藏，不再保留透明点击区域；使用歌词顶部收起按钮或系统返回键关闭浮层。平板不显示桌面自定义滚动条，也不应用桌面滚动条样式，保留系统默认滚动行为和页面滚动位置记忆。
