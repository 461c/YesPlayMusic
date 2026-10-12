# YesPlayMusic Win64 Setup

此分支保存由 `master` 自动构建的 Windows 64 位 NSIS Setup 安装包。

- [下载最新安装包](https://github.com/461c/YesPlayMusic/raw/refs/heads/win64/YesPlayMusic-Setup-x64.exe)
- [查看自动构建状态和备用下载产物](https://github.com/461c/YesPlayMusic/actions/workflows/win64.yml)
- `YesPlayMusic-Setup-x64.exe.sha256`：SHA256 校验文件。
- `build-info.json`：版本、源代码提交、构建时间及构建链接。

首次成功构建后生成安装包。源码修改直接提交 `master`，此分支由构建流程自动维护。超过普通 Git 文件大小限制的安装包自动使用 Git LFS。
