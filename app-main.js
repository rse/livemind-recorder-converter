/*
**  Livemind Recorder Converter
**  Copyright (c) 2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  standard requirements  */
const fs           = require("fs")
const path         = require("path")

/*  external requirements  */
const electron     = require("electron")
const electronLog  = require("electron-log")
const Store        = require("electron-store")

/*  internal requirements  */
const FFmpeg       = require("./app-ffmpeg")

/*  control run-time debugging (increase tracing or even avoid warnings)  */
if (typeof process.env.DEBUG !== "undefined") {
    process.traceProcessWarnings = true
    delete process.env.ELECTRON_ENABLE_SECURITY_WARNINGS
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true
}
else
    process.noDeprecation = true

/*  enter an asynchronous environment in main process  */
const app = electron.app
;(async () => {
    /*  initialize global information  */
    app.win       = null
    app.connected = false

    /*  provide APIs for communication  */
    app.ipc   = electron.ipcMain

    /*  provide logging facility  */
    app.log = electronLog
    if (typeof process.env.DEBUG !== "undefined") {
        app.log.transports.file.level    = "debug"
        app.log.transports.console.level = "debug"
    }
    else {
        app.log.transports.file.level    = "info"
        app.log.transports.console.level = false
    }
    app.log.transports.remote.level  = false
    app.log.transports.ipc.level     = false
    app.log.transports.console.format = "{h}:{i}:{s}.{ms} › [{level}] {text}"
    app.log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}"
    app.log.debug(`(persistent log under ${app.log.transports.file.getFile()})`)
    app.log.info("main: starting up")

    /*  redirect exception error boxes to the console  */
    electron.dialog.showErrorBox = (title, content) =>
        app.log.info(`main: UI: exception: ${title}: ${content}`)

    /*  initialize store  */
    const store = new Store()

    /*  start startup procedure once Electron is ready  */
    app.on("ready", async () => {
        /*  establish settings and their default values  */
        app.x = store.get("window-x", 200)
        app.y = store.get("window-y", 200)

        /*  ensure to-be-restored window position is still valid
            (because if external dispays are used, they can be no longer connected)  */
        const visible = electron.screen.getAllDisplays().some((display) => {
            return (
                app.x          >= display.bounds.x
                && app.y       >= display.bounds.y
                && app.x + 200 <= display.bounds.x + display.bounds.width
                && app.y + 200 <= display.bounds.y + display.bounds.height
            )
        })
        if (!visible) {
            app.x = 100
            app.y = 100
        }

        /*  save back the settings once at startup  */
        store.set("window-x", app.x)
        store.set("window-y", app.y)

        /*  provide helper functions for renderer  */
        const ffmpeg = new FFmpeg({ log: (msg) => app.log.info(msg) })
        app.ipc.handle("convertFile", async (event, filename) => {
            const basename = filename.replace(/\.mov$/, "")
            let result = null
            try {
                /*  extract and convert audio
                    - the AAC ensures maximum compatibility with subsequent production steps
                    - the two steps have to be done to circumvent conversion problems
                    - the 96Kbit/s bitrate provides a rather good audio quality for AAC  */
                await ffmpeg.exec("-v", "error", "-i", filename,
                    "-vn", "-c:a", "pcm_f32le", "-y", `${basename}-tmp-audio.wav`)
                await ffmpeg.exec("-v", "error", "-i", `${basename}-tmp-audio.wav`,
                    "-c:a", "aac", "-b:a", "96k", "-y", `${basename}-tmp-audio.m4a`)
                await fs.promises.unlink(`${basename}-tmp-audio.wav`)

                /*  extract and convert video
                    - the H.264/AVC ensures maximum compatibility with subsequent production steps
                    - the 5Mbit/s bitrate provides a rather good video quality
                    - the chroma subsampling of 8-bit 4:2:0 (yuv420p) ensures compatibility with Windows Media Player  */
                await ffmpeg.exec("-v", "error", "-i", filename,
                    "-an", "-c:v", "libx264", "-b:v", "5000k", "-pix_fmt", "yuv420p", "-y", `${basename}-tmp-video.m4v`)

                /*  merge video and audio  */
                await ffmpeg.exec("-v", "error", "-i", `${basename}-tmp-video.m4v`, "-i", `${basename}-tmp-audio.m4a`,
                    "-c:v", "copy", "-c:a", "copy", "-shortest", "-y", `${basename}.m4v`)

                /*  cleanup  */
                await fs.promises.unlink(`${basename}-tmp-audio.m4a`)
                await fs.promises.unlink(`${basename}-tmp-video.m4v`)
            }
            catch (err) {
                result = err.toString()
                app.log.info(`error converting file: ${result}`)
            }
            return result
        })

        /*  provide function to UI: select files with native dialog  */
        app.ipc.handle("selectFiles", async (event) => {
            return electron.dialog.showOpenDialog({
                title:       "Choose Livemind Recorder Output Files",
                properties:  [ "openFile", "multiSelections" ],
                filters:     [ { name: "MOV", extensions: [ "mov" ] } ]
            }).then((result) => {
                if (result.canceled)
                    return null
                return result.filePaths
            }).catch(() => {
                return null
            })
        })

        /*  create user interface window  */
        app.win = new electron.BrowserWindow({
            icon:            path.join(__dirname, "app-res-icon.png"),
            backgroundColor: "#336699",
            useContentSize:  false,
            frame:           true,
            transparent:     false,
            show:            false,
            x:               app.x,
            y:               app.y,
            width:           200,
            height:          200,
            minWidth:        200,
            minHeight:       200,
            closable:        true,
            minimizable:     true,
            maximizable:     false,
            fullscreenable:  false,
            resizable:       false,
            webPreferences: {
                devTools:                   (typeof process.env.DEBUG !== "undefined"),
                nodeIntegration:            true,
                nodeIntegrationInWorker:    true,
                contextIsolation:           false,
                worldSafeExecuteJavaScript: true,
                disableDialogs:             true,
                enableRemoteModule:         true,
                autoplayPolicy:             "no-user-gesture-required",
                spellcheck:                 false
            }
        })
        app.win.setHasShadow(true)
        app.win.loadURL("file://" + path.join(__dirname, "app-ui.html"))
        if (typeof process.env.DEBUG !== "undefined") {
            setTimeout(() => {
                app.win.webContents.openDevTools()
            }, 1000)
        }
        app.win.on("ready-to-show", () => {
            app.win.show()
            app.win.focus()
        })
        app.win.webContents.on("did-finish-load", () => {
            app.win.webContents.setZoomFactor(1.0)
            app.win.webContents.setZoomLevel(0)
            app.win.webContents.setVisualZoomLevelLimits(1, 1)
        })

        /*  configure application menu
            (actually only relevant under macOS where even frameless windows have a menu)  */
        const menuTemplate = [
            {
                label: app.name,
                submenu: [
                    { role: "about" },
                    { type: "separator" },
                    { role: "hide" },
                    { role: "hideothers" },
                    { role: "unhide" },
                    { type: "separator" },
                    { role: "quit" }
                ]
            }, {
                role: "window",
                submenu: [
                    { role: "minimize" },
                    { role: "front" }
                ]
            }
        ]
        const menu = electron.Menu.buildFromTemplate(menuTemplate)
        electron.Menu.setApplicationMenu(menu)

        /*  react on implicit window close  */
        app.win.on("closed", () => {
            app.quit()
        })

        /*  react on all windows closed  */
        app.on("window-all-closed", () => {
            app.quit()
        })

        /*  handle window minimize functionality  */
        let minimized = false
        app.win.on("minimize", () => { minimized = true  })
        app.win.on("restore",  () => { minimized = false })
        app.ipc.handle("minimize", (event) => {
            if (minimized) {
                app.win.restore()
                app.win.focus()
            }
            else
                app.win.minimize()
        })

        /*  track application window changes  */
        const updateBounds = () => {
            const bounds = app.win.getBounds()
            app.x = bounds.x
            app.y = bounds.y
            store.set("window-x", app.x)
            store.set("window-y", app.y)
        }
        app.win.on("move", () => {
            updateBounds()
        })
    })
})().catch((err) => {
    if (app.log)
        app.log.error(`main: ERROR: ${err}`)
    else
        console.log(`main: ERROR: ${err}`)
})

