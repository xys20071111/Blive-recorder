import { readdirSync, readFileSync } from 'fs'
import { AppConfig } from './IConfig'
import App from './App'
import { initRoomRecorder } from './recorder/Rooms'
import { printLog } from './utils'

readdirSync('./rooms').forEach((v) => {
	if (v.endsWith('.json')) {
		initRoomRecorder(JSON.parse(readFileSync(`./rooms/${v}`, { encoding: 'utf-8' })))
	}
})

App.listen(AppConfig.port, () => {
	printLog(`程序正在监听端口 ${AppConfig.port}`)
})