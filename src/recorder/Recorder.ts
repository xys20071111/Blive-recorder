/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream, existsSync } from 'fs'
import https from 'https'
import { mkdirSync } from 'fs'
import { EventEmitter } from 'events'
import { request, getTimeString, downloadFile, BliveM3u8Parser, printWarning, printLog } from '../utils'
import { AppConfig } from '../IConfig'


class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: WriteStream
	private clipList: Array<string> = []
	private isFirstRequest = true

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
	}

	public async createFileStream() {
		const title = (await request('/xlive/web-room/v1/index/getRoomBaseInfo', 'GET', {
			room_ids: this.roomId,
			req_biz: 'BiLive'
		}))['data']['by_room_ids'][this.roomId.toString()].title
		const outputFile = `${this.outputPath}/${getTimeString()}-${title}.m3u8`
		this.outputFileStream = createWriteStream(outputFile)
		printLog(`房间${this.roomId} 创建新文件 ${outputFile}`)
		this.clipDir = outputFile.replace('.m3u8', '/')
		if (!existsSync(this.clipDir)) {
			mkdirSync(this.clipDir)
		}

	}

	async start() {
		let streamHost: string = ''
		let streamParma: string = ''
		let streamPath: string = ''
		let streamUrl: string = ''
		// 获取直播流信息
		try {
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
			// 处理直播流信息
			for (const streamInfo of data.playurl_info.playurl.stream) {
				// 找出hls流
				if (streamInfo.protocol_name === 'http_hls') {
					for (const streamItem of streamInfo.format) {
						if (streamItem.format_name === 'fmp4' && streamItem.codec[0]['current_qn'] === 10000) {
							streamHost = streamItem.codec[0].url_info[0].host
							streamParma = streamItem.codec[0].url_info[0].extra
							streamPath = streamItem.codec[0].base_url
						}
					}
				}
			}
			// 拼接出url
			streamUrl = `${streamHost}${streamPath}${streamParma}`
			if (!streamUrl || streamUrl.length < 10) {
				this.emit('RecordStop', 1)
				return
			}
		} catch {
			this.emit('RecordStop', 1)
		}
		// 创建新文件
		await this.createFileStream()
		this.outputFileStream!.write('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n')
		// 开始下载流
		const recordInterval = setInterval(() => {
			try {
				const m3u8Req = https.request(streamUrl, {
					headers: {
						Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com'
					}
				})
				m3u8Req.on('error', (err) => {
					printWarning(`房间${this.roomId} ${err}`)
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
			} catch (err) {
				printWarning(`房间${this.roomId} ${err}`)
				this.emit('RecordStop', 1)
			}
		}, 3500)
	}
}

export default Recorder
