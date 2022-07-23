const listener = require('./dist/LiveStatusListener')
const a = new listener.LiveStatusLinstener({'name':'土拨鼠信用社_Official','realRoomId':867806,'displayRoomId':867806})
const recorder = require('./dist/Recorder')
const b = new recorder.default(867806, './')
b.on('RecordStop', () => {
	a.isLiving()
})
a.on('LiveStart', () => {
	b.start()
})

