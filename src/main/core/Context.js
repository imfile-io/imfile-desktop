import logger from './Logger'
import {
  getEnginePath,
  getAria2ConfPath,
  getEngineBinPathByBackend,
  getSessionPath,
  getGoAria2SessionJsonPath,
  inferDownloadEngineBackendFromUserStore
} from '../utils'

const { platform, arch } = process

export default class Context {
  /**
   * @param {import('./ConfigManager').default} configManager 须已初始化，用于推断 download-engine
   */
  constructor (configManager) {
    this.configManager = configManager
    this.init()
  }

  getLogPath () {
    const { path } = logger.transports.file.getFile()
    return path
  }

  init () {
    const engineBackend = inferDownloadEngineBackendFromUserStore(
      this.configManager
    )
    const engineBinPath = getEngineBinPathByBackend(
      platform,
      arch,
      engineBackend
    )

    // The key of Context cannot be the same as that of userConfig and systemConfig.
    this.context = {
      platform,
      arch,
      'log-path': this.getLogPath(),
      'session-path': getSessionPath(),
      'go-aria2-session-path': getGoAria2SessionJsonPath(),
      'engine-path': getEnginePath(platform, arch),
      /** 当前下载引擎可执行文件绝对路径（go-aria2 或 aria2c） */
      'engine-bin-path': engineBinPath,
      /**
       * 与 engine-bin-path 相同；历史键名沿用 aria2，并非表示一定是 aria2c。
       */
      'aria2-bin-path': engineBinPath,
      'aria2-conf-path': getAria2ConfPath(platform, arch)
    }

    logger.info('[imFile] Context.init===>', this.context)
  }

  get (key) {
    if (typeof key === 'undefined') {
      return this.context
    }

    return this.context[key]
  }

  set (key, value) {
    this.context[key] = value
  }
}
