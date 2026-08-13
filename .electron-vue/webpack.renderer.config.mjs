'use strict'

process.env.BABEL_ENV = 'renderer'

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import Webpack from 'webpack'
import { VueLoaderPlugin } from 'vue-loader'
import Components from 'unplugin-vue-components/webpack'
import AutoImport from 'unplugin-auto-import/webpack'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import ESLintPlugin from 'eslint-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import sass from 'sass'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { dependencies } = require('../package.json')
const eslintFriendlyFormatter = require('eslint-friendly-formatter/index.js')
const devMode = process.env.NODE_ENV !== 'production'

/** 避免 require('punycode') 落到 Node 内置模块而触发 DEP0040（uri-js / ajv 等） */
let punycodeUserland
try {
  punycodeUserland = require.resolve('punycode/punycode.js', { paths: [path.join(__dirname, '..')] })
} catch {
  punycodeUserland = null
}

const tailwindEntryCss = path.resolve(__dirname, '../src/renderer/components/Theme/tailwind.css')

/**
 * List of node_modules to include in webpack bundle
 *
 * Required for specific packages like Vue UI libraries
 * that provide pure *.vue files that need compiling
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/webpack-configurations.html#white-listing-externals
 */
const whiteListedModules = ['vue']

const rendererConfig = {
  entry: {
    index: path.join(__dirname, '../src/renderer/pages/index/main.js')
  },
  experiments: {
    outputModule: !devMode
  },
  externals: [
    ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d))
  ],
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: { filename: '[name].js' }
        }
      },
      {
        test: /\.scss$/,
        use: [
          devMode ? 'vue-style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              api: 'modern',
              implementation: sass,
              additionalData: '@import "@/components/Theme/Variables.scss";',
              sassOptions: {
                includePaths: [__dirname, 'src'],
                quietDeps: true,
                silenceDeprecations: ['import']
              }
            }
          }
        ]
      },
      {
        test: /\.sass$/,
        use: [
          devMode ? 'vue-style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              api: 'modern',
              implementation: sass,
              indentedSyntax: true,
              additionalData: '@import "@/components/Theme/Variables.scss";',
              sassOptions: {
                includePaths: [__dirname, 'src'],
                quietDeps: true,
                silenceDeprecations: ['import']
              }
            }
          }
        ]
      },
      {
        test: /\.less$/,
        use: [
          devMode ? 'vue-style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'less-loader'
        ]
      },
      {
        test: /\.css$/,
        include: tailwindEntryCss,
        use: [
          devMode ? 'vue-style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.css$/,
        exclude: tailwindEntryCss,
        use: [
          devMode ? 'vue-style-loader' : MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.vue$/,
        use: 'vue-loader'
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        type: 'asset/inline'
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        type: 'asset/resource'
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset/inline'
      }
    ]
  },
  node: {
    __dirname: devMode,
    __filename: devMode
  },
  plugins: [
    AutoImport({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'css'
        })
      ],
      dts: false
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'css'
        })
      ],
      dts: false
    }),
    new VueLoaderPlugin(),
    // vue.esm-bundler 需在构建期注入特性开关，否则运行时报 __VUE_PROD_DEVTOOLS__ 等未定义
    // https://vuejs.org/api/compile-time-flags.html
    new Webpack.DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css'
    }),
    new HtmlWebpackPlugin({
      title: 'imFile',
      filename: 'index.html',
      chunks: ['index'],
      template: path.resolve(__dirname, '../src/index.ejs'),
      isBrowser: false,
      isDev: process.env.NODE_ENV !== 'production',
      scriptLoading: devMode ? 'defer' : 'module'
    }),
    new Webpack.HotModuleReplacementPlugin(),
    new ESLintPlugin({
      configType: 'flat',
      context: path.join(__dirname, '..'),
      extensions: ['js', 'vue'],
      formatter: eslintFriendlyFormatter
    })
  ],
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '../dist/electron'),
    ...(devMode
      ? { libraryTarget: 'commonjs2', globalObject: 'this' }
      : {
          module: true,
          chunkFormat: 'module',
          chunkLoading: 'import',
          environment: { module: true, dynamicImport: true }
        }),
    /**
     * 生产 Electron file:// 下懒加载 chunk 须用 publicPath:'auto'（基于 import.meta.url），
     * 勿用 './'：webpack 会拼成 file:///C:/.../102.js 等非法 URL，路由动态 import 失败，
     * 表现为安装包启动后仅标题栏/骨架、主区域无文字（#439 仅修复了入口 index.js）。
     */
    publicPath: devMode ? '/' : 'auto'
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, '../src/renderer'),
      '@shared': path.join(__dirname, '../src/shared'),
      vue$: 'vue/dist/vue.esm-bundler.js',
      ...(punycodeUserland ? { punycode: punycodeUserland } : {})
    },
    extensions: ['.js', '.vue', '.json', '.css', '.node']
  },
  target: 'electron-renderer',
  optimization: {
    emitOnErrors: false,
    minimize: !devMode,
    minimizer: [
      new TerserPlugin({
        extractComments: false
      }),
      new CssMinimizerPlugin()
    ]
  }
}

/**
 * Adjust rendererConfig for development settings
 */
if (devMode) {
  rendererConfig.devtool = 'eval-cheap-module-source-map'

  rendererConfig.plugins.push(
    new Webpack.DefinePlugin({
      __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`
    })
  )
}

/**
 * Adjust rendererConfig for production settings
 */
if (!devMode) {
  rendererConfig.plugins.push(
    new CopyWebpackPlugin({
      patterns: [{
        from: path.join(__dirname, '../static'),
        to: path.join(__dirname, '../dist/electron/static'),
        globOptions: { ignore: ['.*'] }
      }]
    }),
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"'
    }),
    new Webpack.LoaderOptionsPlugin({
      minimize: false
    })
  )
}

export default rendererConfig
