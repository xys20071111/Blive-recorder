import { Request, Response } from 'express'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { AppConfig, RoomConfig } from '../IConfig'
import { BroadcasterInfoRoot, Msg, RoomInfo } from '../IMsg'
import { initRoomRecorder } from '../recorder/Rooms'
import { filterInt, request } from '../utils'

export function addRoom(req: Request, res: Response) {
	const roomIdString = req.query.room_id as string
	if (!roomIdString) {
		res.json({
			code: 1,
			msg: '需要房间号'
		})
		return
	}
	const displayRoomId = filterInt(roomIdString)
	if (isNaN(displayRoomId)) {
		res.json({
			code: 1,
			msg: '房间号错误'
		})
		return
	}
	request('/room/v1/Room/room_init', 'GET', {
		id: displayRoomId
	}).then((data: Msg) => {
		if (data.code !== 0) {
			res.json({
				code: 1,
				msg: `房间 ${roomIdString} 不存在`
			})
			return
		}
		const roomInfo: RoomInfo = data.data as RoomInfo
		request('/live_user/v1/Master/info', 'GET', {
			uid: roomInfo.uid
		}).then((data: Msg) => {
			const info = (data.data as BroadcasterInfoRoot).info
			const config: RoomConfig = {
				name: info.uname,
				realRoomId: roomInfo.room_id,
				displayRoomId
			}
			writeFileSync(`./rooms/${roomIdString}.json`, JSON.stringify(config))
			if(!existsSync(`${AppConfig.output}${info.uname}-${displayRoomId}`)){
				mkdirSync(`${AppConfig.output}${info.uname}-${displayRoomId}`)
			}
			initRoomRecorder(config)
			res.json({
				code: 0
			})
		})
	})
}