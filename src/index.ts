import { readdirSync, readFileSync } from 'fs'
import { AppConfig } from './IConfig'
import App from './App'
import { initRoomRecorder } from './recorder/Rooms'

readdirSync('./rooms').forEach((v) => {
	if (v.endsWith('.json')) {
		initRoomRecorder(JSON.parse(readFileSync(`./rooms/${v}`, { encoding: 'utf-8' })))
	}
})

App.listen(AppConfig.port)