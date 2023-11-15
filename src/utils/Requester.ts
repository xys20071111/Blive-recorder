import https from 'https'
import { AppConfig } from '../IConfig'
import { printError } from './PrintLog'

const POST_HEADER = {
	Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf}`,
	'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
	'host': 'api.live.bilibili.com',
	'Referer': 'https://live.bilibili.com',
	'Content-Type': 'application/json'
}

const GET_HEADER = {
	Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
	'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
	'host': 'api.live.bilibili.com',
	'Referer': 'https://live.bilibili.com'
}


function pathBuilder(path: string, data: any): string {
	let result = `${path}?`
	for (const item in data) {
		result += `${item}=${data[item]}&`
	}
	return result
}

function request(path: string, method: 'GET' | 'POST', data: object): Promise<any> {
	return new Promise((resolve, reject) => {
		const req = https.request({
			method,
			host: 'api.live.bilibili.com',
			path: method === 'POST' ? path : pathBuilder(path, data),
			headers: method === 'POST' ? POST_HEADER : GET_HEADER
		})
		req.on('error', (err) => {
			printError(`${path} ${err}`)
			reject(2)
		})
		req.on('response', (stream) => {
			if (stream.statusCode !== 200) {
				stream.resume()
				reject(stream.statusCode)
			}
			let responseJson = ''
			stream.setEncoding('utf-8')
			stream.on('data', (chunk) => responseJson += chunk)
			stream.on('end', () => {
				try {
					const responseObject = JSON.parse(responseJson)
					resolve(responseObject)
				} catch (e) {
					request(path, method, data).then((data) => {
						resolve(data)
					})
				}
			})
		})
		if (method === 'POST') {
			req.write(JSON.stringify(data))
		}
		req.end()
	})
}
export { request }