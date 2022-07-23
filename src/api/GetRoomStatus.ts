import { Request, Response } from 'express'
import { getLivingStatus, getRecordingStatus } from '../recorder/Rooms'
import { filterInt } from '../utils'

export function getRoomStatus(req: Request, res: Response) {
	const room = filterInt(req.query.room_id as string)
	if (isNaN(room)) {
		res.json({
			code: 1,
			data: '房间号格式错误'
		})
		return
	}
	res.json({
		code: 0,
		data: {
			isLiving: getLivingStatus(room),
			isRecording: getRecordingStatus(room)
		}
	})
}
