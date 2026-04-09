'use strict'

process.env.BABEL_ENV = 'main'

const path = require('node:path')
const Webpack = require('webpack')
const ESLintPlugin = require('eslint-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { dependencies } = require('../package.json')
const { appId } = require('../electron-builder.json')
const devMode = process.env.NODE_ENV !== 'production'
const ssapiBuildDefaultDef = JSON.stringify(process.env.SSAPI_BUILD_DEFAULT_BASE_URL || '')

/** 避免 require('punycode') 落到 Node 内置模块而触发 DEP0040（uri-js / ajv 等） */
let punycodeUserland
try {
  punycodeUserland = require.resolve('punycode/punycode.js', { paths: [path.join(__dirname, '..')] })
} catch {
  punycodeUserland = null
}

/** 纯 ESM、exports 无 require，不能作 external 由主进程 CJS require */
const BUNDLE_IN_MAIN = new Set(['@achingbrain/nat-port-mapper'])

const mainConfig = {
  entry: {
    main: [
      path.join(__dirname, '../src/main/portable-userdata.js'),
      path.join(__dirname, '../src/main/punycode-patch.js'),
      path.join(__dirname, '../src/main/index.js')
    ]
  },
  externals: [
    ...Object.keys(dependencies || {}).filter((name) => !BUNDLE_IN_MAIN.has(name))
  ],
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
  /* 主进程需真实 __dirname，供 punycode-patch 等解析 node_modules；勿在 prod 中置 false */
  node: {
    __dirname: true,
    __filename: true
  },
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron')
  },
  plugins: [
    new Webpack.NoEmitOnErrorsPlugin(),
    new ESLintPlugin({
      configType: 'flat',
      context: path.join(__dirname, '..'),
      formatter: require('eslint-friendly-formatter/index.js')
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

/**
 * Adjust mainConfig for development settings
 */
if (devMode) {
  mainConfig.plugins.push(
    new Webpack.DefinePlugin({
      __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
      appId: `"${appId}"`,
      'process.env.SSAPI_BUILD_DEFAULT_BASE_URL': ssapiBuildDefaultDef
    })
  )
}

/**
 * Adjust mainConfig for production settings
 */
if (!devMode) {
  mainConfig.plugins.push(
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"',
      appId: `"${appId}"`,
      'process.env.SSAPI_BUILD_DEFAULT_BASE_URL': ssapiBuildDefaultDef
    })
  )
}

module.exports = mainConfig
