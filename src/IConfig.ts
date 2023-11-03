import { readFileSync } from 'fs'

export interface ProgramConfig {
	output: string
	port: number
	credential: Credential
}

export interface Credential {
	sessdata: string
	csrf: string
	buvid3: string
	uid: number
}

export interface RoomConfig {
	name: string
	realRoomId: number
	displayRoomId: number
}

export const AppConfig: ProgramConfig = JSON.parse(readFileSync(process.argv[2], { encoding: 'utf-8' }))