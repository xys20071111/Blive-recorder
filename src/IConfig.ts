import { readFileSync } from 'fs'

export interface ProgramConfig {
	output: string
	port: number
}

export interface RoomConfig {
	name: string
	realRoomId: number
	displayRoomId: number
}

export const AppConfig: ProgramConfig = JSON.parse(readFileSync(process.argv[2], {encoding: 'utf-8'}))