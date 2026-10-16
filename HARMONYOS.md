# 系统播控兼容说明

下载 [YesPlayMusic-Android-Tablet.apk](https://github.com/461c/YesPlayMusic/raw/refs/heads/android/YesPlayMusic-Android-Tablet.apk)，显示名统一为 **YesPlayMusic**。只发布这一个版本，采用已测试的 `com.luna.music` 安装包身份。

应用已经使用 Android Media3 MediaLibrarySession，包含系统会话、媒体通知、MediaBrowser、耳机控制及续播。媒体通知仍然存在是正常现象，不能据此判断是否接入了系统媒体会话。华为控制中心还会筛选支持的应用；其[官方支持清单](https://consumer.huawei.com/cn/support/content/zh-cn15940389/)适用于鸿蒙 4.2，未列出 YesPlayMusic。

[LX Music 的直接用户实测](https://github.com/lyswhut/lx-music-mobile/issues/908)显示，鸿蒙 4 使用 `com.luna.music` 包名后可以进入播控中心；[FeiNiuMusic](https://github.com/kuilei0926/FeiNiuMusic)也提供同类可选包。这是社区兼容办法，非华为官方准入。本构建据此采用兼容包名，但用户已实测其鸿蒙平板仍未显示播控卡片，该方案对目标平板未奏效。

## 安装与验证

- 此包占用汽水音乐的 `com.luna.music` 包名，不能和汽水音乐同时安装，也不能覆盖其不同签名的安装包。
- 旧 `com.yesplaymusic.tablet` 安装包的数据独立，迁移时需要重新登录；此前 `com.luna.music` 兼容版可以同签名覆盖更新，保留数据。
- 安装后从 **YesPlayMusic** 启动并播放一首歌，打开右上角控制中心的播控卡片，检查封面、标题、暂停、下一首；再锁屏和退到后台测试。仅出现通知不算验证通过。
- 华为应用市场可能按包名把它识别为汽水音乐；不要对该兼容包执行汽水音乐更新。
- 若仍未出现，记录设备型号、完整系统构建号及兼容版是否显示正在播放。开发者可用 `adb shell dumpsys media_session` 检查 `com.luna.music` 是否有活动会话及播放状态；通知截图不能代替会话诊断。

## 构建

使用 `gradle -p android assembleRelease` 构建单一 APK。包名为 `com.luna.music`，Java 命名空间和组件类名保持 `com.yesplaymusic.tablet`，开发证书不变。工作流校验包名、媒体入口及 APK 签名，发布 SHA-256 校验文件。

标准实现依据：[Android Media3 后台播放官方文档](https://developer.android.com/media/media3/session/background-playback)。本仓库已声明 MEDIA_BUTTON 接收器及回调；此次排查没有发现缺失此入口。

## 当前排查结论

2026-10-16 用户反馈：非鸿蒙设备可使用系统媒体控制，目标鸿蒙平板仍不能进入华为播控中心。[椒盐音乐作者的说明](https://github.com/Moriafly/SaltPlayerSource/issues/1708#issuecomment-3446863282)也指出该功能受华为白名单控制，沟通后没有进展。目前没有查到可供此 Android APK 直接接入且能保证华为平板接纳的公开接口。

可在设置 → 其它 → 系统播控诊断复制当前平台会话状态、曲目元数据、可用控制动作和连接端信息。报告读取 Media3 自身创建的 Android 会话，不另外伪造第二个会话，也不申请系统通知读取权限。播放中若报告状态为 3、包名正确、标题和动作存在，说明 Android 标准发布链路正常；这仍不能证明华为已接纳该应用。若这些字段缺失，应继续排查应用会话实现。
