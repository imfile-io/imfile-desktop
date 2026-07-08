import is from 'electron-is'
import logger from 'electron-log'

const level = is.production() ? 'info' : 'silly'
logger.transports.file.level = level

logger.info('[imFile] Logger init')
logger.warn('[imFile] Logger init')

export default logger
