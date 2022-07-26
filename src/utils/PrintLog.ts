import { getTimeString } from './Time'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function printLog(log: any) {
	console.log(`${getTimeString()} ${log}`)
}