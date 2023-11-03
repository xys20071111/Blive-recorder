/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream, existsSync } from 'fs'
import https from 'https'
import { mkdirSync } from 'fs'
import { EventEmitter } from 'events'
import { request, getTimeString } from '../utils'
import { BliveM3u8Parser } from '../utils/Blivem3u8Parser'
import { downloadFile } from '../utils/downloadFile'
import { AppConfig } from '../IConfig'


class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private outputFile?: string
	private clipDir?: string
	private outputFileStream?: WriteStream
	private clipList: Array<string> = []
	private isFirstRequest = true

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
	}

	public createFileStream() {
		console.log('创建新文件')
		this.outputFile = `${this.outputPath}/${getTimeString()}.m3u8`
		this.outputFileStream = createWriteStream(this.outputFile)
		this.clipDir = this.outputFile.replace('.m3u8', '/')
		if (!existsSync(this.clipDir)) {
			mkdirSync(this.clipDir)
		}

	}

	async start() {
		const data = (await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
			room_id: this.roomId,
			no_playurl: 0,
			mask: 1,
			qn: 10000,
			platform: 'web',
			protocol: '0,1',
			format: '0,1,2',
			codec: '0,1',
			panorama: '1'
		})).data
		let streamHost: string = ''
		let streamParma: string = ''
		let streamPath: string = ''
		for (const streamInfo of data.playurl_info.playurl.stream) {
			if (streamInfo.protocol_name === 'http_hls') {
				for (const streamItem of streamInfo.format) {
					console.log(streamItem)
					if (streamItem.format_name === 'fmp4' && streamItem.codec[0]['current_qn'] === 10000) {
						streamHost = streamItem.codec[0].url_info[0].host
						streamParma = streamItem.codec[0].url_info[0].extra
						streamPath = streamItem.codec[0].base_url
					}
				}
			}
		}
		const streamUrl = `${streamHost}${streamPath}${streamParma}`
		if (!streamUrl || streamUrl.length < 10) {
			this.emit('RecordStop', 1)
			return
		}
		this.createFileStream()
		this.outputFileStream!.write('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n')
		const recordInterval = setInterval(() => {
			const m3u8Req = https.request(streamUrl, {
				headers: {
					Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
					'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
					'Referer': 'https://live.bilibili.com',
					'Origin': 'https://live.bilibili.com'
				}
			})
			m3u8Req.on('response', (m3u8Res) => {
				if (m3u8Res.statusCode !== 200 && m3u8Res.statusCode !== 206) {
					m3u8Res.resume()
					clearInterval(recordInterval)
					this.outputFileStream?.write('#EXT-X-ENDLIST')
					this.outputFileStream?.close()
					this.isFirstRequest = true
					this.emit('RecordStop', 1)
					return
				}
				m3u8Res.setEncoding('utf-8')
				let data = ''
				m3u8Res.on('data', chunk => data += chunk)
				m3u8Res.on('end', () => {
					const m3u8 = BliveM3u8Parser.parse(data)
					if (this.isFirstRequest) {
						this.isFirstRequest = false
						this.outputFileStream?.write(`#EXT-X-MEDIA-SEQUENCE:${m3u8.clips[0].filename.replace('.m4s', '')}\n`)
						this.outputFileStream?.write(`#EXT-X-MAP:URI="${this.clipDir}${m3u8.mapFile}"\n`)
						downloadFile(streamUrl.replace('index.m3u8', m3u8.mapFile), `${this.clipDir}${m3u8.mapFile}`, {
							'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
							'Referer': 'https://live.bilibili.com',
							'Origin': 'https://live.bilibili.com',
							Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
						})
					}
					for (const item of m3u8.clips) {
						if (item.filename && !this.clipList.includes(item.filename)) {
							this.clipList.push(item.filename)
							this.outputFileStream!.write(`${item.info}\n${this.clipDir}${item.filename}\n`)
							downloadFile(streamUrl.replace('index.m3u8', item.filename), `${this.clipDir}${item.filename}`, {
								'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
								'Referer': 'https://live.bilibili.com',
								'Origin': 'https://live.bilibili.com',
								Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
							})
						}
					}
				})
			})
			m3u8Req.end()
		}, 5000)
	}
}

export default Recorder
