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
	private outputFile:string
	private outputStream: WriteStream
	private isFirstMeta = true
	private isFirstHeader = true
	private lastClipA = new Set<number>()
	private lastClipV = new Set<number>()

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputFile = `${outputPath}/${getTimeString()}.flv`
		this.outputStream = createWriteStream(this.outputFile, {flags: 'a', encoding: 'binary'})
	}

	async start() {
		const data: Msg = await request('/room/v1/Room/playUrl', 'GET', {
			cid: this.roomId,
			quality: 4
		})
		const streamUrl: string = (data.data as unknown as StreamInfoArray)['durl'][0]['url']
		const urlReq = https.request(streamUrl,{
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
			switch(stream.statusCode) {
			case 302:
				// eslint-disable-next-line no-case-declarations
				const streamReq = https.get(stream.headers.location as string,{
					headers: {
						'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.9999.0 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com',
					},
				})
				streamReq.on('response', (liveStream) => {
					liveStream.on('error', () => {
						this.emit('RecordStop', 1)
					})
					this.record(liveStream, this.roomId, this.outputStream)
					this.isFirstMeta = false
				})
				streamReq.on('error', (err) => {
					console.log(err)
					this.emit('RecordStop', 1)
				})
				break
			case 200:
				this.record(stream, this.roomId, this.outputStream)
				this.isFirstMeta = false
				break
			case 404:
				printLog(`无法访问 ${this.roomId} 直播流 错误码: ${stream.statusCode}`)
				this.emit('RecordStop', 1)
			}
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
			this.emit('RecordStop', liveStream.statusCode)
			return
		}
		const flvStream = new FlvStreamParser()
		flvStream.on('flv-header', (flvPacket: FlvPacketMetadata) => {
			if(this.isFirstHeader)	{
				outputStream.write(flvPacket.build())
				this.isFirstHeader = false
			}
		})
		flvStream.on('flv-packet-metadata', (flvPacket: FlvPacketMetadata) => {
			if(this.isFirstMeta)	{
				outputStream.write(flvPacket.build())
				this.isFirstMeta = false
			}
		})
		flvStream.on('flv-packet-audio', (flvPacket: FlvPacketAudio) => {
			const packet = flvPacket.build()
			if(!this.lastClipA.has(flvPacket.header.timestampLower)) {
				outputStream.write(packet)
			}
			this.lastClipA.add(flvPacket.header.timestampLower)
		})
		flvStream.on('flv-packet-video', (flvPacket: FlvPacketVideo) => {
			const packet = flvPacket.build()
			if(!this.lastClipV.has(flvPacket.header.timestampLower)) {
				outputStream.write(packet)
			}
			this.lastClipV.add(flvPacket.header.timestampLower)
		})
		this.emit('RecordStart')
		liveStream.on('data', (chunk) => {
			flvStream.write(chunk)
		})
		liveStream.on('end', () => {
			this.emit('RecordStop', 0)
		})
	}
}

export default Recorder
