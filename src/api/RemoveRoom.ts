import { Request, Response } from 'express'
import { existsSync, unlinkSync } from 'fs'
import { removeRoomFromMap } from '../recorder/Rooms'
import { filterInt } from '../utils'

export function removeRoom(req: Request, res: Response) {
	const room = filterInt(req.query.room_id as string)
	if (isNaN(room)) {
		res.json({
			code: 1,
			data: '房间号格式错误'
		})
		return
	}
	if (existsSync(`./rooms/${room}.json`)) {
		unlinkSync(`./rooms/${room}.json`)
		if (removeRoomFromMap(room)) {
			res.json({
				code: 0,
				data: ''
			})
			return
		} else {
			res.json({
				code: 1,
				data: '无此房间'
			})
			return
		}
	}
}