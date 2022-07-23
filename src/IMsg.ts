export interface Msg{
    code: number
    msg: string
    message: string
    data: RoomInfo | BroadcasterInfoRoot | RoomInfo
}
export interface RoomInfo{
      room_id: number
      short_id: number
      uid: number
      need_p2p: number
      is_hidden: boolean
      is_locked: boolean
      is_portrait: boolean
      live_status: number
      hidden_till: number
      lock_till: number
      encrypted: boolean
      pwd_verified: boolean
      live_time: number
      room_shield: number
      is_sp: number
      special_type: number
}

export interface BroadcasterInfoRoot {
    info: BroadcasterInfo
}

export interface BroadcasterInfo {
    uname: string
}

export interface StreamInfoArray {
    durl: Array<StreamInfo>
}

export interface StreamInfo {
    url: string
}