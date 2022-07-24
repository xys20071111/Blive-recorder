/* eslint-disable @typescript-eslint/no-empty-function */
import { WriteStream, createWriteStream } from 'fs'
import https from 'https'
import { EventEmitter } from 'events'
import { request, getTimeString } from '../utils'
import { Msg, RoomInfo, StreamInfoArray } from '../IMsg'
import { IncomingMessage } from 'http'
import { FlvPacketAudio, FlvPacketMetadata, FlvPacketVideo, FlvStreamParser } from 'node-flv'

class Recorder extends EventEmitter {
	private roomId: number
	private outputFile:string
	private outputStream: WriteStream
	private isFirstMeta = true

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputFile = `${outputPath}/${getTimeString()}.flv`
		this.outputStream = createWriteStream(this.outputFile)
	}

	start(): void {
		request('/room/v1/Room/room_init', 'GET', {
			id: this.roomId,
		}).then((data: Msg) => {
			const roomInfo: RoomInfo = data.data as RoomInfo
			if (roomInfo.live_status !== 1) {
				console.error(`房间 ${this.roomId} 直播未开始`)
				return
			}
			const cid = roomInfo.room_id

			request('/room/v1/Room/playUrl', 'GET', {
				cid,
				quality: 4
			}).then(async (data: Msg) => {
				const streamUrl: string = (data.data as unknown as StreamInfoArray)['durl'][0]['url']
				const urlReq = https.request(streamUrl,{
					method: 'GET',
					agent: new https.Agent({keepAlive: true, keepAliveMsecs: 259200000}),
					headers: {
						'Accept': '*/*',
						'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.9999.0 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com',
						'TE': 'trailers'
					},
					
				})
				urlReq.on('response', (stream) => {
					stream.on('error', () => {
						this.emit('RecordStop', 0)
					})
					switch(stream.statusCode) {
					case 302:
						// eslint-disable-next-line no-case-declarations
						const streamReq = https.get(stream.headers.location as string,{
							agent: new https.Agent({keepAlive: true, keepAliveMsecs: 259200000}),
							headers: {
								'Accept': '*/*',
								'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.9999.0 Safari/537.36',
								'Referer': 'https://live.bilibili.com',
								'Origin': 'https://live.bilibili.com',
								'TE': 'trailers',
							},
						})
						streamReq.on('response', (liveStream) => {
							liveStream.on('error', () => {
								this.emit('RecordStop', 0)
							})
							record(liveStream, this.roomId, this.outputStream, this.isFirstMeta, this)
							this.isFirstMeta = false
						})
						streamReq.on('error', () => {
							this.emit('RecordStop', 0)
						})
						break
					case 200:
						record(stream, this.roomId, this.outputStream, this.isFirstMeta, this)
						this.isFirstMeta = false
					}
				})
				urlReq.on('error', () => {
					this.emit('RecordStop', 0)
				})
				urlReq.end()
			})

		})
	}
}

const lastClipA = new Set<number>()
const lastClipV = new Set<number>()
function record(liveStream: IncomingMessage, roomId: number, outputStream: WriteStream, isFirstMeta: boolean,emitter: EventEmitter) {
	if (liveStream.statusCode !== 200) {
		console.error(`无法访问 ${roomId} 直播流 错误码: ${liveStream.statusCode}`)
		emitter.emit('RecordStop', liveStream.statusCode)
		return
	}
	const flvStream = new FlvStreamParser()
	flvStream.on('flv-header', (flvPacket: FlvPacketMetadata) => {
		if(isFirstMeta)	{
			outputStream.write(flvPacket.build())
		}
	})
	flvStream.on('flv-packet-metadata', (flvPacket: FlvPacketMetadata) => {
		if(isFirstMeta)	{
			outputStream.write(flvPacket.build())
		}
	})
	flvStream.on('flv-packet-audio', (flvPacket: FlvPacketAudio) => {
		const packet = flvPacket.build()
		if(lastClipA.has(flvPacket.header.timestampLower)) {
			return
		} else {
			outputStream.write(packet)
		}
		lastClipA.add(flvPacket.header.timestampLower)
	})
	flvStream.on('flv-packet-video', (flvPacket: FlvPacketVideo) => {
		const packet = flvPacket.build()
		if(lastClipV.has(flvPacket.header.timestampLower)) {
			return
		} else {
			outputStream.write(packet)
		}
		lastClipV.add(flvPacket.header.timestampLower)
	})
	emitter.emit('RecordStart')
	liveStream.pipe(flvStream).on('close', () => {
		emitter.emit('RecordStop', 0)
	})
}

export default Recorder
