/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream } from 'fs'
import https from 'https'
import { mkdirSync } from 'fs'
import { EventEmitter } from 'events'
import { request, getTimeString } from '../utils'
import { response } from 'express'


class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private outputFile: string
	private clipDir: string
	private outputFileStream: WriteStream
	private clipList: Array<string> = []

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
		this.outputFile = `${outputPath}/${getTimeString()}.m3u8`
		this.outputFileStream = createWriteStream(this.outputFile)
		this.clipDir = this.outputFile.replace('.m3u8', '/')
	}

	public createFileStream() {
		console.log('创建新文件')
		this.outputFile = `${this.outputPath}/${getTimeString()}.m3u8`
		this.outputFileStream = createWriteStream(this.outputFile)
		this.outputFileStream.write('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-MEDIA-SEQUENCE:39148412\n#EXT-X-TARGETDURATION:1\n')
		this.clipDir = this.outputFile.replace('.m3u8', '/')
		mkdirSync(this.clipDir)
	}

	async start(isNewLive: boolean) {
		if (isNewLive) {
			this.createFileStream()
		}
		const data = (await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
			room_id: this.roomId,
			no_playurl: 0,
			mask: 1,
			qn: 10000,
			platform: 'web',
			protocol: '0,1',
			format: '0,2',
			codec: '0,1'
		})).data
		let streamHost: string = '';
		let streamParma: string = '';
		let streamPath: string = '';
		for (const item of data.playurl_info.playurl.stream) {
			if (item.protocol_name === 'http_hls') {
				streamHost = item.format[0].codec[0].url_info[0].host
				streamParma = item.format[0].codec[0].url_info[0].extra
				streamPath = item.format[0].codec[0].base_url
			}
		}
		const streamUrl = `${streamHost}${streamPath}${streamParma}`
		console.log(streamUrl)
		const recordInterval = setInterval(async () => {
			try {
				const m4slist = await this.getM4sList(streamUrl)
				for (const item of m4slist) {
					if (!this.clipList.includes(item)) {
						const req = https.request(streamUrl.replace('index.m3u8', item), {
							headers: {
								'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
								Referer: 'https://live.bilibili.com/',
								origin: 'https://live.bilibili.com/'
							}
						})
						req.on('response', (res) => {
							if (res.statusCode !== 200) {
								return
							}
							const resultPath = `${this.clipDir}${item}`
							const file = createWriteStream(resultPath)
							res.pipe(file)
							this.clipList.push(item)
							this.outputFileStream.write(`#EXTINF:1.00\nfile://${resultPath}\n`)
						})
						req.end()
					}
				}

			} catch {
				this.emit('RecordStop', 1)
				clearInterval(recordInterval)
			}
		}, 10000)
	}
	getM4sList(urlString: string): Promise<Array<string>> {
		return new Promise((resolve, reject) => {
			const req = https.request(urlString, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
					Referer: 'https://live.bilibili.com/',
					origin: 'https://live.bilibili.com/'
				}
			})
			req.on('response', (res) => {
				if (res.statusCode !== 200 && res.statusCode !== 206) {
					reject(res.statusCode)
					return
				}
				res.setEncoding('utf-8')
				let data = ''
				res.on('data', chunk => data += chunk)
				res.on('end', () => {
					const list: Array<string> = []
					const lines = data.split('\n')
					for (const line of lines) {
						if (line[0] === '#') {
							continue
						}
						list.push(line)
					}
					resolve(list)
				})
			})
			req.end()
		})
	}
}

export default Recorder
