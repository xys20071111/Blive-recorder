import { createWriteStream } from 'fs'
import https from 'https'
import http from 'http'
import { AppConfig } from '../IConfig'

const GET_HEADER = {
    Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
    'host': 'api.live.bilibili.com',
    'Referer': 'https://live.bilibili.com'
}

export function downloadFile(urlString: string, dest: string, headers: any) {
    const destStream = createWriteStream(dest)
    const url = new URL(urlString)
    const req = (url.protocol === 'https:' ? https : http).request(url, {
        headers: {

        }
    })
    req.on('response', (res) => {
        if (res.statusCode !== 200) {
            res.resume()
            return
        }
        res.pipe(destStream)
    })
    req.end()
}