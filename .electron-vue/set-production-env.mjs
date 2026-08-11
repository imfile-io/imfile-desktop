/**
 * 必须作为 build.mjs 的首个 import。
 * ESM 会静态提升所有 import，模块体中的
 * `process.env.NODE_ENV = 'production'` 会晚于 webpack.*.config.mjs 求值，
 * 导致生产构建误判为 devMode（publicPath: '/'），Electron file:// 下白屏（#439）。
 */
process.env.NODE_ENV = 'production'
