'use strict'

// 必须置于所有其他 import 之前，见 set-production-env.mjs / #439
import './set-production-env.mjs'
import chalk from 'chalk'
import Webpack from 'webpack'
import Multispinner from '@motrix/multispinner'
import cfonts from 'cfonts'
import { deleteSync } from 'del'
import mainConfig from './webpack.main.config.mjs'
import rendererConfig from './webpack.renderer.config.mjs'
import webConfig from './webpack.web.config.mjs'

const { say } = cfonts
const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '
const okayLog = chalk.bgBlue.white(' OKAY ') + ' '
const isCI = process.env.CI || false

try {
  if (process.env.BUILD_TARGET === 'clean') {
    clean()
  } else if (process.env.BUILD_TARGET === 'web') {
    web()
  } else {
    build()
  }
} catch (err) {
  console.error(err)
  process.exit(1)
}

function clean () {
  deleteSync(['release/*', '!.gitkeep'])
  console.log(`\n${doneLog}\n`)
  process.exit()
}

function build () {
  greeting()

  deleteSync(['dist/electron/*', '!.gitkeep'])

  const tasks = ['main', 'renderer']
  const m = new Multispinner(tasks, {
    preText: 'building',
    postText: 'process'
  })

  let results = ''

  m.on('success', () => {
    process.stdout.write('\x1B[2J\x1B[0f')
    console.log(`\n\n${results}`)
    console.log(`${okayLog}take it away ${chalk.yellow('`electron-builder`')}\n`)
    process.exit()
  })

  const mainPromise = pack(mainConfig).then(result => {
    results += result + '\n\n'
    m.success('main')
  })

  const rendererPromise = pack(rendererConfig).then(result => {
    results += result + '\n\n'
    m.success('renderer')
  })

  Promise.all([mainPromise, rendererPromise]).catch(err => {
    // If an error occurs in either build, mark both as completed appropriately
    // and exit with a non-zero status code.
    console.log(`\n  ${errorLog}failed to build electron processes`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })
}

function pack (config) {
  return new Promise((resolve, reject) => {
    config.mode = 'production'
    Webpack(config, (err, stats) => {
      if (err) {
        reject(err.stack || err)
      } else if (stats.hasErrors()) {
        let err = ''

        err = stats.toString({
          chunks: false,
          colors: true
        })
          .split(/\r?\n/)
          .reduce((acc, line) => acc + `    ${line}\n`, '')

        reject(err)
      } else {
        resolve(stats.toString({
          chunks: false,
          colors: true
        }))
      }
    })
  })
}

function web () {
  deleteSync(['dist/web/*', '!.gitkeep'])
  webConfig.mode = 'production'
  Webpack(webConfig, (err, stats) => {
    if (err || (stats && stats.hasErrors())) {
      if (err) {
        console.error(err)
      }
      if (stats && stats.hasErrors()) {
        console.error(stats.toString({
          chunks: false,
          colors: true,
          errors: true
        }))
      }
    } else {
      console.log(stats.toString({
        chunks: false,
        colors: true
      }))
    }

    process.exit()
  })
}

function greeting () {
  const cols = process.stdout.columns
  let text = ''

  if (cols > 85) {
    text = 'lets-build'
  } else if (cols > 60) {
    text = 'lets-|build'
  } else {
    text = false
  }

  if (text && !isCI) {
    say(text, {
      colors: ['magentaBright'],
      font: 'simple3d',
      space: false
    })
  } else console.log(chalk.magentaBright.bold('\n  lets-build'))
  console.log()
}
