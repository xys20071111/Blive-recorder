import EventEmitter from 'events'
import DanmakuReceiver from './danmakuReceiver'
import { RoomConfig } from '../IConfig'
import { Msg, RoomInfo } from '../IMsg'
import { request } from '../utils'

export default class LiveStatusLinstener extends EventEmitter{
	private room: RoomConfig
	private danmakuReceiver: DanmakuReceiver | undefined
	private livingFlag = false

	constructor(room: RoomConfig) {
		super()
		this.room = room
		request('/room/v1/Room/room_init', 'GET', {
			id: room.displayRoomId
		}).then((data: Msg) => {
			const roomInfo: RoomInfo = data.data as RoomInfo
			if (roomInfo.live_status === 1) {
				this.emit('LiveStart')
			}
			this.danmakuReceiver = new DanmakuReceiver(room.realRoomId)
			this.danmakuReceiver.once('LIVE', () => {
				if(this.livingFlag) {
					return
				}
				this.emit('LiveStart')
				this.livingFlag = true
			})
			this.danmakuReceiver.on('PREPARING', () => {
				this.emit('LiveEnd')
				this.livingFlag = false
			})
			this.danmakuReceiver.on('close', () => {
				if (this.danmakuReceiver)
					this.danmakuReceiver.connect()
			})
			this.danmakuReceiver.connect()
		})
	}

	public tryRestartRecording() {
		request('/room/v1/Room/room_init', 'GET', {
			id: this.room.displayRoomId
		}).then((data: Msg) => {
			const roomInfo: RoomInfo = data.data as RoomInfo
			if (roomInfo.live_status === 1) {
				this.emit('LiveStart')
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