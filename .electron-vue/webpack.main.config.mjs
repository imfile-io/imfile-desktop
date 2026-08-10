'use strict'

process.env.BABEL_ENV = 'renderer'

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import Webpack from 'webpack'
import ESLintPlugin from 'eslint-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { appId } = require('../electron-builder.json')
const eslintFriendlyFormatter = require('eslint-friendly-formatter/index.js')
const devMode = process.env.NODE_ENV !== 'production'

/** 避免 require('punycode') 落到 Node 内置模块而触发 DEP0040（uri-js / ajv 等） */
let punycodeUserland
try {
  punycodeUserland = require.resolve('punycode/punycode.js', { paths: [path.join(__dirname, '..')] })
} catch {
  punycodeUserland = null
}

/** 标记 dist/electron 为 ESM，与主进程 outputModule 产物一致 */
class EmitModulePackageJsonPlugin {
  apply (compiler) {
    compiler.hooks.emit.tap('EmitModulePackageJsonPlugin', (compilation) => {
      const source = new Webpack.sources.RawSource(
        JSON.stringify({ type: 'module' }, null, 2) + '\n'
      )
      compilation.emitAsset('package.json', source)
    })
  }
}

const mainConfig = {
  entry: {
    main: path.join(__dirname, '../src/main/index.js')
  },
  experiments: {
    outputModule: true
  },
  externals: {
    electron: 'electron'
  },
  externalsType: 'module-import',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  },
  node: {
    __dirname: true,
    __filename: true
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '../dist/electron'),
    module: true,
    chunkFormat: 'module',
    environment: {
      module: true,
      dynamicImport: true
    }
  },
  plugins: [
    new Webpack.NoEmitOnErrorsPlugin(),
    new EmitModulePackageJsonPlugin(),
    new ESLintPlugin({
      configType: 'flat',
      context: path.join(__dirname, '..'),
      formatter: eslintFriendlyFormatter
    })
  ],
  resolve: {
    alias: {
      '@': path.join(__dirname, '../src/main'),
      '@shared': path.join(__dirname, '../src/shared'),
      ...(punycodeUserland ? { punycode: punycodeUserland } : {})
    },
    extensions: ['.js', '.json', '.node']
  },
  target: 'electron-main',
  optimization: {
    minimize: !devMode,
    minimizer: [
      new TerserPlugin({
        extractComments: false
      })
    ]
  },
  ignoreWarnings: [
    {
      module: /punycode-patch\.js$/,
      message: /Critical dependency/
    }
  ]
}

const ssapiBuildDefaultDef = JSON.stringify(process.env.SSAPI_BUILD_DEFAULT_BASE_URL || '')

if (devMode) {
  mainConfig.plugins.push(
    new Webpack.DefinePlugin({
      __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
      appId: `"${appId}"`,
      'process.env.SSAPI_BUILD_DEFAULT_BASE_URL': ssapiBuildDefaultDef
    })
  )
}

if (!devMode) {
  mainConfig.plugins.push(
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"',
      appId: `"${appId}"`,
      'process.env.SSAPI_BUILD_DEFAULT_BASE_URL': ssapiBuildDefaultDef
    })
  )
}

export default mainConfig
