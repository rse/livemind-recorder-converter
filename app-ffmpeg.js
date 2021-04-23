/*
**  Livemind Recorder Converter
**  Copyright (c) 2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  standard requirements  */
const os           = require("os")
const path         = require("path")

/*  external requirements  */
const { app }      = require("electron")
const execa        = require("execa")

/*  the exported API  */
module.exports = class FFmpeg {
    constructor (options = {}) {
        /*  determine path to embedded ffmpeg(1) executable  */
        let ffmpeg
        if (os.platform() === "win32")
            ffmpeg = path.resolve(path.join(app.getAppPath(), "app-ffmpeg.d", "ffmpeg.exe")
                .replace("app.asar", "app.asar.unpacked"))
        else if (os.platform() === "darwin")
            ffmpeg = path.resolve(path.join(app.getAppPath(), "app-ffmpeg.d", "ffmpeg")
                .replace("app.asar", "app.asar.unpacked"))
        else if (os.platform() === "linux")
            ffmpeg = path.resolve(path.join(app.getAppPath(), "app-ffmpeg.d", "ffmpeg")
                .replace("app.asar", "app.asar.unpacked"))
        else
            throw new Error(`operating system platform ${os.platform()} not supported`)
        this.options = Object.assign({}, {
            ffmpeg: ffmpeg,
            log:    (msg) => {}
        }, options)
    }
    exec (...args) {
        const argv = args.map((arg) => {
            if (arg.match(/\s/))
                return `"${arg.replace(/[""]/g, "\"")}"`
            else
                return arg
        }).join(" ")
        this.options.log(`executing: ${this.options.ffmpeg} ${argv}`)
        return execa(this.options.ffmpeg, args)
    }
}

