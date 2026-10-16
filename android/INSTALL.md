# YesPlayMusic 安卓平板版

下载 [YesPlayMusic-Android-Tablet.apk](https://github.com/461c/YesPlayMusic/raw/refs/heads/android/YesPlayMusic-Android-Tablet.apk)，在平板上允许该下载来源安装应用。支持 Android 7.0（API 24）及以上，建议使用更新的 Android System WebView。

**鸿蒙 4.2 播控中心：** 可选下载 [YesPlayMusic-Android-HarmonyOS.apk](https://github.com/461c/YesPlayMusic/raw/refs/heads/android/YesPlayMusic-Android-HarmonyOS.apk)。此版本采用社区验证的兼容包名，与汽水音乐冲突，需重新登录；普通版可保留。安装前阅读 [兼容版说明与实机验证方法](HARMONYOS.md)。

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

安卓界面延伸到透明状态栏和系统导航栏下方，顶部导航栏的背景覆盖时间栏区域并使用 10px 模糊。导航控件只避让实际覆盖 WebView 的状态栏和刘海区域，不再增加 12dp 留白；厂商系统已经预留的状态栏高度不会重复计算。歌词背景覆盖整个窗口，顶部收起按钮避让状态栏，不再有独立黑色横条或全屏按钮。外观选择“自动”时，通过原生 Configuration.uiMode 读取并实时跟随系统夜间模式；手动选择浅色或深色时保持用户设置。

应用使用 Media3 创建的原生 android.media.session.MediaSession，通过 PlaybackState、MediaMetadata、媒体 token 和 MediaBrowserService 提供标准媒体控制。音乐元数据包含标题、显示标题、艺术家、副标题、专辑、封面、音乐类型和可播放标志，媒体卡片可通过会话入口打开应用。

鸿蒙 4.2 的控制中心与普通媒体通知并不等同。华为公布了[音频播控中心支持应用清单](https://consumer.huawei.com/cn/support/content/zh-cn15940389/)，其中没有 YesPlayMusic。补齐 Android MediaSession 并不能保证被鸿蒙播控中心接纳；厂商专属接入需要在目标设备确认，不能将 HarmonyOS NEXT 的 AVSession 接口直接用于此 Android APK。

安卓的首首播放、后台切歌和系统续播统一由原生服务按所选音质请求 `/song/url/v1`，支持标准、较高、极高、无损和 Hi-Res；实际可用档位依赖账号权限和曲目。缓存按曲目、音质、账号与接口地址区分，音源按实际格式识别，不再统一标记 MP3。设置页显示当前音源的实际格式、码率、采样率、声道和已知位深，以及请求档位与返回档位；没有返回的参数不会猜测。歌词浮层不显示音质信息。未登录时使用公开音源，不能保证无损或 Hi-Res。

设置页提供“允许与其他应用同时播放”开关，默认关闭。开启后，本应用不申请或自动响应音频焦点，避免其他媒体应用播放时因焦点变化而自动暂停；关闭后恢复常规焦点处理。设置即时应用到后台播放器并在重启、续播时保留。拔出耳机仍会暂停；该开关不能改变系统通话静音或厂商强制音频策略。

歌曲使用原生磁盘缓存，边播放边写入应用私有目录，重启后仍保留。再次播放同一音源时优先读取已缓存内容；未缓存的片段继续联网读取。缓存按曲目、所选音质、账号及接口配置区分，内置接口重启更换端口不会导致缓存失效，临时音源链接过期时会重新获取。完整缓存不代表已缓存歌词、封面或所有在线页面。

“缓存与存储”提供自动缓存开关、容量上限、占用大小、完整音源与部分缓存数量，以及清除按钮。关闭自动缓存只停止后续新加载音源的写入，保留已有缓存；切换音质也不会删除其他档位的缓存。达到容量限制时优先淘汰最久未使用的片段，修改容量不需要重启播放器。清除不会主动停止播放，继续播放时可能再次产生缓存。

设置页使用播放、缓存、外观、其它四个栏目；平板隐藏桌面专属选项。页脚保留原作者署名，并注明由 [kuanzzz.pages.dev](https://kuanzzz.pages.dev) 修改。

默认仅构建和发布 APK；手动触发工作流时可选择设备测试。可选离线 PCM 测试覆盖系统快捷面板、MediaBrowser 队列、播放控制和续播；可选界面测试覆盖主题切换、顶部安全区和自定义 bottom 下的播放栏滑动。测试截图与媒体会话诊断保存在 Android-UI-verification 构建产物中。

歌词浮层打开时，平板播放栏通过 translateY 向下移到屏幕外，关闭时滑回原位；动画不修改 bottom，兼容用户 CSS 修改停靠位置，歌词打开期间不接受播放栏交互。使用歌词顶部收起按钮或系统返回键关闭浮层。平板不显示桌面自定义滚动条，也不应用桌面滚动条样式，保留系统默认滚动行为和页面滚动位置记忆。
