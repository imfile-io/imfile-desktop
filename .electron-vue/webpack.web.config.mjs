'use strict'

process.env.BABEL_ENV = 'web'

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import Webpack from 'webpack'
import { VueLoaderPlugin } from 'vue-loader'
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

const webConfig = {
  entry: {
    index: path.join(__dirname, '../src/renderer/pages/index/main.js')
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
              additionalData: '@import "@/components/Theme/Variables.scss"',
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
              additionalData: '@import "@/components/Theme/Variables.scss"',
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
        include: [path.resolve(__dirname, '../src/renderer')],
        exclude: /node_modules/
      },
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
          options: {
            extractCSS: true,
            loaders: {
              sass: 'vue-style-loader!css-loader!sass-loader?indentedSyntax=1&api=modern',
              scss: 'vue-style-loader!css-loader!sass-loader?api=modern',
              less: 'vue-style-loader!css-loader!less-loader'
            }
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        type: 'asset/inline'
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset/inline'
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css'
    }),
    new HtmlWebpackPlugin({
      title: 'imFile',
      filename: 'index.html',
      chunks: ['index'],
      template: path.resolve(__dirname, '../src/index.ejs'),
      isBrowser: true,
      isDev: process.env.NODE_ENV !== 'production',
      nodeModules: devMode
        ? path.resolve(__dirname, '../node_modules')
        : false
    }),
    new Webpack.DefinePlugin({
      'process.env.IS_WEB': 'true'
    }),
    new Webpack.HotModuleReplacementPlugin(),
    new Webpack.NoEmitOnErrorsPlugin(),
    new ESLintPlugin({
      configType: 'flat',
      context: path.join(__dirname, '..'),
      extensions: ['js', 'vue'],
      formatter: eslintFriendlyFormatter
    })
  ],
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '../dist/web'),
    globalObject: 'this',
    publicPath: ''
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, '../src/renderer'),
      '@shared': path.join(__dirname, '../src/shared'),
      vue$: 'vue/dist/vue.esm.js',
      ...(punycodeUserland ? { punycode: punycodeUserland } : {})
    },
    extensions: ['.js', '.vue', '.json', '.css']
  },
  target: 'web',
  optimization: {
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
 * Adjust webConfig for development settings
 */
if (devMode) {
  webConfig.devtool = 'eval-cheap-module-source-map'
}

/**
 * Adjust webConfig for production settings
 */
if (!devMode) {
  webConfig.plugins.push(
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
      minimize: true
    })
  )
}

export default webConfig
