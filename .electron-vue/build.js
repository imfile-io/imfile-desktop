'use strict'

process.env.NODE_ENV = 'production'

const { say } = require('cfonts')
const chalk = require('chalk')
const Webpack = require('webpack')
const Multispinner = require('@motrix/multispinner')

const mainConfig = require('./webpack.main.config')
const rendererConfig = require('./webpack.renderer.config')
const webConfig = require('./webpack.web.config')

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '
const okayLog = chalk.bgBlue.white(' OKAY ') + ' '
const isCI = process.env.CI || false

;(async () => {
  const { deleteSync } = await import('del')
  if (process.env.BUILD_TARGET === 'clean') {
    clean(deleteSync)
  } else if (process.env.BUILD_TARGET === 'web') {
    web(deleteSync)
  } else {
    build(deleteSync)
  }
})().catch((err) => {
  console.error(err)
  process.exit(1)
})

function clean (deleteSync) {
  deleteSync(['release/*', '!.gitkeep'])
  console.log(`\n${doneLog}\n`)
  process.exit()
}

function build (deleteSync) {
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

  pack(mainConfig).then(result => {
    results += result + '\n\n'
    m.success('main')
  }).catch(err => {
    m.error('main')
    console.log(`\n  ${errorLog}failed to build main process`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })

  pack(rendererConfig).then(result => {
    results += result + '\n\n'
    m.success('renderer')
  }).catch(err => {
    m.error('renderer')
    console.log(`\n  ${errorLog}failed to build renderer process`)
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

        stats.toString({
          chunks: false,
          colors: true
        })
        .split(/\r?\n/)
        .forEach(line => {
          err += `    ${line}\n`
        })

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

function web (deleteSync) {
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
