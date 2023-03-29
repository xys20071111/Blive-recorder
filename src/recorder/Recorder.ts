/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream } from 'fs'
import https from 'https'
import { EventEmitter } from 'events'
import { request, getTimeString, printLog } from '../utils'
import { IncomingMessage } from 'http'
import { spawn } from 'child_process'


class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private outputFile: string
	private outputStream?: WriteStream
	private isFirstMeta = true
	private isFirstHeader = true
	private lastClipA = new Set<number>()
	private lastClipV = new Set<number>()

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
		this.outputFile = `${outputPath}/${getTimeString()}.flv`
	}

	public createFileStream() {
		console.log('创建新文件')
		this.outputFile = `${this.outputPath}/${getTimeString()}.flv`
		this.outputStream = createWriteStream(this.outputFile, { flags: 'a', encoding: 'binary' })
		this.isFirstHeader = true
		this.isFirstMeta = true
		this.lastClipA.clear()
		this.lastClipV.clear()
	}

	async start(isNewLive: boolean) {
		if (isNewLive) {
			this.createFileStream()
		}
		const data = (await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
			room_id:this.roomId,
			no_playurl:0,
			mask:1,
			qn:	10000,
			platform:'web',
			protocol:'0,1',
			format:'0,2',
			codec:'0,1'
		})).data
		let streamHost: string = '';
		let streamParma: string = '';
		let streamPath: string  = '';
		for(const item of data.playurl_info.playurl.stream) {
			if (item.protocol_name === 'http_hls') {
				streamHost = item.format[0].codec[0].url_info[0].host
				streamParma = item.format[0].codec[0].url_info[0].extra
				streamPath = item.format[0].codec[0].base_url
			}
		}
		const streamUrl = `${streamHost}${streamPath}${streamParma}`
		const task = spawn('ffmpeg', [
			'-headers',
			'Accept: */*\r\nAccept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2\r\nAccept-Encoding: gzip, deflate, br\r\nReferer: https://live.bilibili.com/\r\nOrigin: https://live.bilibili.com\r\nDNT: 1\r\nConnection: keep-alive\r\nSec-Fetch-Dest: empty\r\nSec-Fetch-Mode: cors\r\nSec-Fetch-Site: cross-site\r\nSec-GPC: 1\r\nPragma: no-cache\r\nCache-Control: no-cache\r\nTE: trailers',
			'-user_agent',
			'Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
			'-i',
			streamUrl,
			'-c:v', 'copy',
			'-c:a', 'copy',
			`${this.outputPath}/${getTimeString()}.flv`
		])
		task.on('exit', () => {
			this.emit('RecordStop', 1)
		})
	}
}

export default Recorder
