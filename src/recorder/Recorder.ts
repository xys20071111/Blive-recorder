/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream } from 'fs'
import https from 'https'
import { EventEmitter } from 'events'
import { request, getTimeString, printLog } from '../utils'
import { Msg, StreamInfoArray } from '../IMsg'
import { IncomingMessage } from 'http'
import { FlvPacketAudio, FlvPacketMetadata, FlvPacketVideo, FlvStreamParser } from 'node-flv'

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
			room_id:25755118,
			no_playurl:0,
			mask:1,
			qn:0,
			platform:'web',
			protocol:'0,1',
			format:'0,2',
			codec:'0,1'
		})).data
		let streamHost: string = '';
		let streamParma: string = '';
		let streamPath: string  = '';
		for(const item of data.playurl_info.playurl.stream) {
			if (item.protocol_name === 'http_stream') {
				streamHost = item.format[0].codec[0].url_info[0].host
				streamParma = item.format[0].codec[0].url_info[0].extra
				streamPath = item.format[0].codec[0].base_url
			}
		}
		const streamUrl = `${streamHost}${streamPath}?${streamParma}`
		const urlReq = https.request(streamUrl, {
			method: 'GET',
			headers: {
				'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.9999.0 Safari/537.36',
				'Referer': 'https://live.bilibili.com',
				'Origin': 'https://live.bilibili.com',
			}
		})
		urlReq.on('response', (stream) => {
			stream.on('error', () => {
				this.emit('RecordStop', 0)
			})
			this.record(stream, this.roomId, this.outputStream as WriteStream)
		})
		urlReq.on('error', (err) => {
			console.log(err)
			this.emit('RecordStop', 1)
		})
		urlReq.end()
	}
	record(liveStream: IncomingMessage, roomId: number, outputStream: WriteStream) {
		if (liveStream.statusCode !== 200) {
			printLog(`无法访问 ${roomId} 直播流 错误码: ${liveStream.statusCode}`)
			this.emit('RecordStop', 1)
			return
		}
		const flvStream = new FlvStreamParser()
		flvStream.on('flv-header', (flvPacket: FlvPacketMetadata) => {
			if (this.isFirstHeader) {
				outputStream.write(flvPacket.build())
				this.isFirstHeader = false
			}
		})
		flvStream.on('flv-packet-metadata', (flvPacket: FlvPacketMetadata) => {
			if (this.isFirstMeta) {
				outputStream.write(flvPacket.build())
				this.isFirstMeta = false
			}
		})
		flvStream.on('flv-packet-audio', (flvPacket: FlvPacketAudio) => {
			const packet = flvPacket.build()
			if (!this.lastClipA.has(flvPacket.header.timestampLower)) {
				outputStream.write(packet)
			}
			this.lastClipA.add(flvPacket.header.timestampLower)
		})
		flvStream.on('flv-packet-video', (flvPacket: FlvPacketVideo) => {
			const packet = flvPacket.build()
			if (!this.lastClipV.has(flvPacket.header.timestampLower)) {
				outputStream.write(packet)
			}
			this.lastClipV.add(flvPacket.header.timestampLower)
		})
		this.emit('RecordStart')
		liveStream.on('end', () => {
			this.emit('RecordStop', 0)
		})
		liveStream.pipe(flvStream)
	}
}

export default Recorder
