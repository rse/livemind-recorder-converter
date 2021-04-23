/*
**  Livemind Recorder Converter
**  Copyright (c) 2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  external requirements  */
const electron    = require("electron")
const electronLog = require("electron-log")

/*  control run-time debugging (increase tracing or even avoid warnings)  */
if (process.env.DEBUG)
    process.traceProcessWarnings = true
else
    process.noDeprecation = true

/*  enter an asynchronous environment in renderer process  */
const ui = {}
;(async () => {
    /*  provide logging  */
    ui.log = electronLog
    if (typeof process.env.DEBUG !== "undefined") {
        ui.log.transports.file.level    = false
        ui.log.transports.console.level = false
        ui.log.transports.ipc.level     = "debug"
    }
    else {
        ui.log.transports.file.level    = false
        ui.log.transports.console.level = false
        ui.log.transports.ipc.level     = "info"
    }
    ui.log.transports.remote.level   = false
    ui.log.transports.console.format = "{h}:{i}:{s}.{ms} › [{level}] {text}"
    ui.log.info("ui: starting up")

    /*  delay processing a certain amount of time  */
    ui.delay = (delay) =>
        new Promise((resolve) => setTimeout(resolve, delay))

    /*  persistent configuration settings  */
    ui.ipc = electron.ipcRenderer

    /*  ensure the DOM is now finally available  */
    await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", (event) => {
            resolve()
        })
    })
    ui.log.info("ui: DOM ready")

    const UI = document.querySelector(".ui")
    const aw = document.querySelector(".await")
    const pr = document.querySelector(".progress")
    const qu = document.querySelector(".queue")

    const queue = []
    let flushing = false
    const flushQueue = async () => {
        if (flushing)
            return
        flushing = true
        aw.style.display = "none"
        pr.style.display = "block"
        while (queue.length > 0) {
            const path = queue[0]
            const result = await ui.ipc.invoke("convertFile", path)
            ui.log.info(`converting ${path} ${result === null ? "succeeded" : "failed (" + result + ")"}`)
            queue.shift()
            qu.innerText = "" + queue.length
            ui.log.info(`removed ${path} from queue (${queue.length} items now in queue)`)
        }
        aw.style.display = "block"
        pr.style.display = "none"
        flushing = false
    }
    const queueFile = (path) => {
        queue.push(path)
        qu.innerText = "" + queue.length
        ui.log.info(`add ${path} to queue (${queue.length} items now in queue)`)
        if (!flushing)
            flushQueue()
    }

    UI.addEventListener("click", async (event) => {
        event.preventDefault()
        event.stopPropagation()
        const files = await ui.ipc.invoke("selectFiles")
        if (files !== null)
            for (const file of files)
                queueFile(file)
    })

    document.addEventListener("drop", (event) => {
        event.preventDefault()
        event.stopPropagation()
        for (const file of event.dataTransfer.files)
            queueFile(file.path)
    })
    document.addEventListener("dragover", (event) => {
        event.preventDefault()
        event.stopPropagation()
    })
    document.addEventListener("dropenter", (event) => {
        event.preventDefault()
        event.stopPropagation()
    })
    document.addEventListener("dropleave", (event) => {
        event.preventDefault()
        event.stopPropagation()
    })

    /*  finally signal main thread we are ready  */
    ui.log.info("ui: UI ready")
})().catch((err) => {
    ui.log.error(`ui: ERROR: ${err}`)
})

