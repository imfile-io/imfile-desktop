# aria2

Source code: https://github.com/agalwood/aria2

# ed2k (goed2kd)

Source code: https://github.com/chenjia404/goed2kd

## 同步 goed2kd 可执行文件（开发者手动）

```bash
pnpm run sync-goed2kd
```

脚本会扫描已有的 `extra/<darwin|win32|linux>/<arch>/goed2kd/` 目录，仅对**本地已存在的**平台/架构下载并覆盖对应二进制，不会为未创建的目录拉取其它架构。
