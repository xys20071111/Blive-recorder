/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RoomConfig, AppConfig } from '../IConfig'
import Recorder from './Recorder'
import LiveStatusLinstener from './LiveStatusListener'
import { existsSync, mkdirSync } from 'fs'
import { printLog } from '../utils'

class Room {
	private recorder?: Recorder
	private isRecording = false
	private isLiving = false
	private liveStatusListener: LiveStatusLinstener

	constructor(config: RoomConfig) {
		this.liveStatusListener = new LiveStatusLinstener(config)
		this.createNewRecorder(config)
		this.liveStatusListener.on('LiveStart', (isNewLive: boolean) => {
			this.recorder?.start()
			if (isNewLive) {
				printLog(`房间 ${config.displayRoomId} 开始直播`)
				this.isLiving = true
			}
		})
		this.liveStatusListener.on('LiveEnd', () => {
			this.createNewRecorder(config)
			printLog(`房间 ${config.displayRoomId} 直播结束`)
			this.isLiving = false
		})
	}
	public getLiving() {
		return this.isLiving
	}
	public getRecording() {
		return this.isRecording
	}
	private createNewRecorder(config: RoomConfig) {
		this.recorder = new Recorder(config.realRoomId, `${AppConfig.output}${config.name}-${config.displayRoomId}`)
		this.recorder.on('RecordStop', (code) => {
			this.isRecording = false
			setTimeout(() => {
				this.liveStatusListener.tryRestartRecording()
			}, 1000)
			printLog(`房间 ${config.displayRoomId} 录制结束`)
		})
		this.recorder.on('RecordStart', () => {
			if (this.isRecording) {
				return
			}
			this.isRecording = true
			printLog(`房间 ${config.displayRoomId} 开始录制`)
		})
	}
}

const roomMap = new Map<number, Room>()

export function initRoomRecorder(config: RoomConfig) {
	if (!existsSync(`${AppConfig.output}${config.name}-${config.displayRoomId}`)) {
		mkdirSync(`${AppConfig.output}${config.name}-${config.displayRoomId}`)
	}
	if (!roomMap.has(config.displayRoomId))
		roomMap.set(config.displayRoomId, new Room(config))
}

export function getLivingStatus(room: number): boolean {
	if (roomMap.has(room)) {
		return roomMap.get(room)!.getLiving()
	}
	return false
}

export function getRecordingStatus(room: number): boolean {
	if (roomMap.has(room)) {
		return roomMap.get(room)!.getRecording()
	}
	return false
}

export function removeRoomFromMap(room: number): boolean {
	return roomMap.delete(room)
}