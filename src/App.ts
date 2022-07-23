import express from 'express'
import { addRoom } from './api/AddRoom'
import { getRoomStatus } from './api/GetRoomStatus'

const app = express()

app.get('/addRoom', addRoom)
app.get('/getRoomStatus', getRoomStatus)

export default app
