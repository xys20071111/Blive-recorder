import { getTimeString } from './Time'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function printLog(log: any) {
	console.log(`${getTimeString()} ${log}`)
}

export function printWarning(log: any) {
	console.warn(`${getTimeString()} ${log}`)
}

export function printError(log: any) {
	console.error(`${getTimeString()} ${log}`)
}