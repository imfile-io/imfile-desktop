# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

imFile is a full-featured Electron-based download manager that supports HTTP, FTP, BitTorrent, and Magnet downloads. It's forked from Motrix and uses Vue.js with Element UI for the frontend and Aria2 as the download engine.

## Development Commands

### Core Development
- `yarn run dev` - Start development mode with hot reload
- `yarn run build` - Build production release
- `yarn run build:dir` - Build without packaging
- `yarn run build:clean` - Clean build artifacts

### Platform-Specific Builds
- `yarn run build:win7` - Build for Windows 7 (uses Electron 22)
- `yarn run build:win10` - Build for Windows 10/11
- `yarn run build:applesilicon` - Build for Apple Silicon Macs

### Code Quality
- `yarn run lint` - Run ESLint
- `yarn run lint:fix` - Fix ESLint issues automatically

### Individual Webpack Builds
- `yarn run pack:main` - Build main process only
- `yarn run pack:renderer` - Build renderer process only
- `yarn run dev:renderer` - Development server for renderer (port 9080)

## Architecture

### Main Process (`src/main/`)
- **Application.js** - Main application class that orchestrates all managers
- **core/** - Core functionality including Engine (Aria2 wrapper), ConfigManager, UpdateManager
- **ui/** - UI managers for windows, menus, tray, themes, touch bar
- **utils/** - Shared utilities for main process

### Renderer Process (`src/renderer/`)
- **Vue.js application** with Vuex store and Vue Router
- **store/modules/** - App state (app.js), preferences (preference.js), tasks (task.js)
- **components/** - Vue components organized by feature
- **api/** - Communication layer with main process

### Shared Code (`src/shared/`)
- **constants.js** - Application constants and enums
- **locales/** - Internationalization files for 30+ languages
- **aria2/** - Aria2 client implementation with WebSocket/HTTP support
- **utils/** - Utilities shared between main and renderer processes

### Key Technologies
- **Electron** - Desktop app framework
- **Vue 2.7** + Vuex + Vue Router - Frontend framework
- **Element UI** - Component library
- **Aria2** - Download engine (bundled binaries in `extra/`)
- **Webpack** - Module bundler with separate configs for main/renderer

### Build System
- **.electron-vue/** - Custom webpack configurations and build scripts
- **electron-builder.json** - Packaging configuration
- Supports multiple platforms with platform-specific aria2 binaries

### Download Engine Integration
- Aria2 runs as separate process managed by `Engine.js`
- Communication via JSON-RPC over WebSocket/HTTP
- Engine binaries located in `extra/{platform}/{arch}/engine/`
- Configuration files: `aria2.conf` per platform

### State Management
- Main process state managed by individual manager classes
- Renderer state in Vuex store with modules for different concerns
- IPC communication between processes via Electron's built-in mechanisms