
<img src="https://raw.githubusercontent.com/rse/livemind-recorder-convert/master/app-res-icon.png" width="150" align="right" alt=""/>

Livemind Recorder Converter
===========================

**Convert Output Files of Livemind Recorder**

About
-----

**Livemind Recorder Converter** is a small
[Electron](https://www.electronjs.org/)-based desktop application for
use under Windows, macOS or Linux to post-process the output files
of the commercial [Livemind Recorder](https://livemind.tv/recorder)
application when recording [NDI](https://www.ndi.tv/)-multicasted video
streams. Just drag a resulting `foo.mov` file onto the user interface of
**Livemind Recorder Converter** and receive a converted `foo.m4v` file
back.

The problem is that the recordings of [Livemind
Recorder](https://livemind.tv/recorder) are in an uncompressed and
unusual MPEG-4/SHQ2/PCM32 format and for subsequent processing in video
playing and cutting applications (except for the special case of Adobe
Premiere) this format is recommended to be first converted into a
"standard" MPEG-4/AVC/AAC format. **Livemind Recorder Converter** does
this conversion with the help of an embedded version of the awesome
[FFmpeg](https://www.ffmpeg.org/) video/audio processing tool.

Copyright & License
-------------------

Copyright &copy; 2021 [Dr. Ralf S. Engelschall](mailto:rse@engelschall.com)<br/>
Licensed under [GPL 3.0](https://spdx.org/licenses/GPL-3.0-only)

