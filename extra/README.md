# go-aria2

Source code: https://github.com/chenjia404/go-aria2

## 同步 go-aria2 可执行文件（开发者手动）

```bash
pnpm run sync-go-aria2
```

默认同步版本见 `scripts/sync-go-aria2.mjs` 中的 `GO_ARIA2_VERSION`（可用环境变量覆盖）。脚本会扫描已有的 `extra/<darwin|win32|linux>/<arch>/engine/` 目录，仅对**本地已存在的**平台/架构下载并覆盖对应二进制。

# ed2k (goed2kd)

Source code: https://github.com/chenjia404/goed2kd

## 同步 goed2kd 可执行文件（开发者手动）

```bash
pnpm run sync-goed2kd
```

脚本会扫描已有的 `extra/<darwin|win32|linux>/<arch>/goed2kd/` 目录，仅对**本地已存在的**平台/架构下载并覆盖对应二进制，不会为未创建的目录拉取其它架构。
