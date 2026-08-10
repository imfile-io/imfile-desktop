/**
 * Node 21+ 对 require('punycode') 会发 DEP0040；依赖仍用裸模块名时，
 * 在主进程最早将 punycode 指到 npm 包内的 punycode.js（非内置模块）。
 */
import path from 'node:path'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const projectRoot = path.join(__dirname, '..', '..')
let punyResolved
try {
  punyResolved = require.resolve('punycode/punycode.js', { paths: [projectRoot] })
} catch {
  try {
    punyResolved = require.resolve('punycode/punycode.js', { paths: [process.cwd()] })
  } catch {
    punyResolved = null
  }
}

if (punyResolved) {
  const orig = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'punycode') {
      return orig.call(this, punyResolved, parent, isMain)
    }
    return orig.apply(this, arguments)
  }
}
