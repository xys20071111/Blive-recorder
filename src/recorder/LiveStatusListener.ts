import EventEmitter from 'events'
import DanmakuReceiver from './danmakuReceiver'
import { RoomConfig } from '../IConfig'
import { Msg, RoomInfo } from '../IMsg'
import { printLog, request } from '../utils'

export default class LiveStatusLinstener extends EventEmitter{
	private room: RoomConfig
	private danmakuReceiver: DanmakuReceiver | undefined
	private counter = 0

	constructor(room: RoomConfig) {
		super()
		this.room = room
		this.createRoom()
	}
	public createRoom() {
		request('/room/v1/Room/room_init', 'GET', {
			id: this.room.displayRoomId
		}).then((data: Msg) => {
			const roomInfo: RoomInfo = data.data as RoomInfo
			if (roomInfo.live_status === 1) {
				this.emit('LiveStart')
			}
			this.danmakuReceiver = new DanmakuReceiver(this.room.realRoomId)
			this.danmakuReceiver.on('LIVE', () => {
				if(this.counter === 0) {
					this.counter++
					return
				}
				this.emit('LiveStart', true)
			})
			this.danmakuReceiver.on('PREPARING', () => {
				this.counter = 0
				this.emit('LiveEnd')
			})
			this.danmakuReceiver.on('close', () => {
				this.tryRestartRecording()
				if (this.danmakuReceiver)
					this.danmakuReceiver.connect()
			})
			this.danmakuReceiver.connect()
		}).catch(() => {
			this.createRoom()
		})
	}
	public tryRestartRecording() {
		printLog(`尝试恢复房间 ${this.room.displayRoomId} 的录制`)
		request('/room/v1/Room/room_init', 'GET', {
			id: this.room.displayRoomId
		}).then((data: Msg) => {
			const roomInfo: RoomInfo = data.data as RoomInfo
			if (roomInfo.live_status === 1) {
				this.emit('LiveStart', false)
				return
			}
			this.emit('LiveEnd')
		})
	}

	public getRoomId(): number {
		return this.room.displayRoomId
	}

	public getRealRoomId(): number {
		return this.room.realRoomId
	}
}