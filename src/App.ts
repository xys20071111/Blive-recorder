import express from 'express'
import { addRoom } from './api/AddRoom'
import { getRoomStatus } from './api/GetRoomStatus'
import { removeRoom } from './api/RemoveRoom'

const app = express()

app.get('/addRoom', addRoom)
app.get('/getRoomStatus', getRoomStatus)
app.get('/removeRoom', removeRoom)

export default app
