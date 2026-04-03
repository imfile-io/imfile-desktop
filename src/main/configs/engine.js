/** go-aria2 可执行文件名 */
export const engineGoAria2BinMap = {
  darwin: 'go-aria2',
  win32: 'go-aria2.exe',
  linux: 'go-aria2'
}

/**
 * 盘上可能出现的 go-aria2 系文件名（按优先顺序尝试）。
 * 部分构建产物名为 go-aria2c.exe，与经典 aria2c.exe 不同。
 */
export const getGoAria2ExecutableNames = (platform) => {
  if (platform === 'win32') {
    return ['go-aria2.exe', 'go-aria2c.exe']
  }
  if (platform === 'darwin' || platform === 'linux') {
    return ['go-aria2', 'go-aria2c']
  }
  return [engineGoAria2BinMap[platform] || 'go-aria2']
}

/** 兼容：历史代码引用名 */
export const engineBinMap = engineGoAria2BinMap

/** 经典 aria2c 可执行文件名（用户拒绝升级时使用） */
export const engineAria2cBinMap = {
  darwin: 'aria2c',
  win32: 'aria2c.exe',
  linux: 'aria2c'
}

export const goed2kdBinMap = {
  darwin: 'goed2kd',
  win32: 'goed2kd.exe',
  linux: 'goed2kd'
}

export const engineArchMap = {
  darwin: {
    x64: 'x64',
    arm64: 'arm64'
  },
  win32: {
    ia32: 'ia32',
    x64: 'x64',
    arm64: 'x64'
  },
  linux: {
    x64: 'x64',
    arm: 'armv7l',
    arm64: 'arm64'
  }
}
