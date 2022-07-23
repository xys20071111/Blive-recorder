/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable class-methods-use-this */
import { WebSocket } from 'ws'
import * as https from 'https'
import { EventEmitter } from 'events'
import * as zlib from 'zlib'
import { printLog } from '../utils'

enum DANMAKU_PROTOCOL {
  JSON = 0,
  HEARTBEAT,
  ZIP,
  BROTLI
}

enum DANMAKU_TYPE {
  HEARTBEAT = 2,
  HEARTBEAT_REPLY = 3,
  DATA = 5,
  AUTH = 7,
  AUTH_REPLY = 8
}

class DanmakuReceiver extends EventEmitter {
	private socket: WebSocket | null = null
	private roomId: number
	constructor(roomId: number) {
		super()
		this.roomId = roomId
	}

	public async connect() {
		// 请求弹幕服务器地址
		const request = https.request(`https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id=${this.roomId}&platform=pc&player=web`, {
			method: 'GET',
			headers: {
				'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
				host: 'api.live.bilibili.com',
			},
		})
		request.on('response', (response) => {
			if (response.statusCode !== 200) {
				response.resume()
				throw new Error(`Error, code:${response.statusCode}`)
			}
			response.setEncoding('utf8')
			let rawData = ''
			response.on('data', (chunk) => { rawData += chunk })
			response.on('end', () => {
				const parsedData = JSON.parse(rawData)
				// 连接弹幕服务器
				this.socket = new WebSocket(`wss://${parsedData.data.host_server_list[0].host}:${parsedData.data.host_server_list[0].wss_port}/sub`)
				this.socket.on('message', this.danmakuProcesser.bind(this))
				this.socket.on('close', () => { 
					printLog(`房间 ${this.roomId} 掉线了`)
					this.emit('close')
				})
				this.socket.on('open', async () => {
					// 生成并发送验证包
					const data = JSON.stringify({
						roomid: this.roomId, protover: 3, platform: 'web', uid: 0, key: parsedData.data.token,
					})
					const authPacket = this.generatePacket(1, 7, data)
					if (this.socket) {
						this.socket.send(authPacket)
						printLog(`房间 ${this.roomId} 成功连接到弹幕服务器, 发送身份验证包`)
					}
				})
			})
		})
		request.end()
	}

	private generatePacket(protocol: number, type: number, payload: string | Buffer): Buffer {
		const packetLength = 16 + Buffer.byteLength(payload, 'utf-8')
		let packet = Buffer.alloc(packetLength)
		packet.writeInt32BE(packetLength, 0) // 总长度
		packet.writeInt16BE(16, 4) // 头长度
		packet.writeUInt16BE(protocol, 6) // 协议类型
		packet.writeUInt32BE(type, 8) // 包类型
		packet.writeUInt32BE(1, 12) // 一个常数
		if (typeof payload === 'string') {
			packet.write(payload, 16) // 数据体
		} else {
			packet = Buffer.concat([packet, payload])
		}
		return packet
	}

	private danmakuProcesser(msg: Buffer) {
		// 弹幕事件处理
		const packetProtocol = msg.readInt16BE(6)
		const packetType = msg.readInt32BE(8)
		const packetPayload: Buffer = msg.slice(16)
		let jsonData: any
		switch (packetType) {
		case DANMAKU_TYPE.HEARTBEAT_REPLY:
			// 心跳包，不做处理
			break
		case DANMAKU_TYPE.AUTH_REPLY:
			printLog(`房间 ${this.roomId} 通过认证`)
			// 认证通过，每30秒发一次心跳包
			setInterval(() => {
				const heartbeatPayload = '陈睿你妈死了'
				if (this.socket) {
					this.socket.send(this.generatePacket(1, 2, heartbeatPayload))
					printLog(`房间 ${this.roomId} 发送心跳`)
				}
			}, 30000)
			this.emit('connected')
			break
		case DANMAKU_TYPE.DATA:
			switch (packetProtocol) {
			case DANMAKU_PROTOCOL.JSON:
			// 这些数据大都没用，但还是留着吧
				jsonData = JSON.parse(packetPayload.toString('utf-8'))
				this.emit(jsonData.cmd, jsonData.data)
				break
			case DANMAKU_PROTOCOL.BROTLI:
				zlib.brotliDecompress(packetPayload, (err, result) => {
					if (err) {
						console.warn(err)
					}
					let offset = 0
					while (offset < result.length) {
						const length = result.readUInt32BE(offset)
						const packetData = result.slice(offset + 16, offset + length)
						const data = JSON.parse(packetData.toString('utf8'))
						const cmd = data.cmd.split(':')[0]
						this.emit(cmd, (data.info || data.data))
						offset += length
					}
				})
				break
			default:
				break
			}
			break
		default:
			printLog('房间 ${this.roomId} 什么鬼，没见过这种包')
		}
	}

	public close(): void {
		if (this.socket) {
			this.socket.close()
			this.emit('close')
		}
	}
}

export default DanmakuReceiver
