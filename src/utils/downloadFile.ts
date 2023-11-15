import { createWriteStream } from 'fs'
import https from 'https'
import http from 'http'

export function downloadFile(urlString: string, dest: string, headers: any) {
    const destStream = createWriteStream(dest)
    const url = new URL(urlString)
    const req = (url.protocol === 'https:' ? https : http).request(url, {
        headers
    })
    req.on('response', (res) => {
        if (res.statusCode !== 200) {
            res.resume()
            return
        }
        res.pipe(destStream)
    })
    req.on('error', (err) => {
        downloadFile(urlString, dest, headers)
    })
    req.end()
}