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

const rendererConfig = {
  entry: {
    index: path.join(__dirname, '../src/renderer/pages/index/main.js')
  },
  /**
   * 安装包 asar 只含 dist/electron，不含 node_modules。
   * 渲染进程依赖必须打进 bundle；勿把 ws 等 production 依赖标为 external。
   */
  externals: [],
  module: {
    rules: [
      {
        // 勿用 /\.worker\.js$/：Vite 的 ?worker 查询会使绝对匹配失败
        test: /\.worker\.js/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].js',
            inline: 'no-fallback'
          }
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
      /**
       * 生产必须用经典脚本而非 type=module：
       * ESM 入口在 Electron file:// 下没有模块作用域 require，
       * 且 import() 懒加载 chunk 在 Windows 上会失败，只剩骨架屏。
       */
      scriptLoading: 'defer'
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
    libraryTarget: 'commonjs2',
    globalObject: 'this',
    /**
     * 经典脚本 + 相对路径：chunk 以 <script src="./123.js"> 加载，相对 index.html 解析。
     * 勿用 output.module / type=module：Windows file:// 下动态 import 失败只剩骨架。
     */
    publicPath: devMode ? '/' : './'
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
