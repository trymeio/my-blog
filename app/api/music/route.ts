import { NextRequest, NextResponse } from 'next/server'

const NET_EASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://music.163.com/',
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

type SongResult = {
  id: string
  name?: string
  artist?: string
  author?: string
  cover?: string
  pic?: string
  url?: string
  lrc?: string
  error?: string
}

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const songIds = ids.split(',').map((id) => id.trim()).filter(Boolean)

  const results: SongResult[] = await Promise.all(
    songIds.map(async (songId): Promise<SongResult> => {
      try {
        // 同时获取歌曲详情、歌词和播放链接
        const [detailRes, lrcRes, urlRes] = await Promise.all([
          fetch(
            `https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`,
            { headers: NET_EASE_HEADERS, signal: AbortSignal.timeout(6000) },
          ),
          fetch(
            `https://music.163.com/api/song/lyric?id=${songId}&lv=-1&kv=-1&tv=-1`,
            { headers: NET_EASE_HEADERS, signal: AbortSignal.timeout(6000) },
          ).catch(() => null),
          fetch(
            `https://music.163.com/api/song/enhance/player/url/v1?id=${songId}&level=standard&encodeType=mp3`,
            { headers: NET_EASE_HEADERS, signal: AbortSignal.timeout(6000) },
          ).catch(() => null),
        ])

        const detail = await detailRes.json()
        const song = detail.songs?.[0]

        if (!song) {
          return { id: songId, error: 'not_found' }
        }

        // 获取歌词
        let lrcText = ''
        if (lrcRes && lrcRes.ok) {
          try {
            const lrcData = await lrcRes.json()
            lrcText = lrcData.lrc?.lyric || ''
          } catch {
            /* 歌词可选，失败不影响主流程 */
          }
        }

        // 获取播放链接
        let musicUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`
        if (urlRes && urlRes.ok) {
          try {
            const urlData = await urlRes.json()
            const url = urlData.data?.[0]?.url
            if (url) {
              musicUrl = url
            }
          } catch {
            /* 获取失败时使用默认外链 */
          }
        }

        const artistName = song.artists?.[0]?.name || '未知歌手'

        return {
          id: songId,
          name: song.name,
          artist: artistName,
          author: artistName,
          cover: song.album?.picUrl || '',
          pic: song.album?.picUrl || '',
          url: musicUrl,
          lrc: lrcText,
        }
      } catch (error) {
        console.error(`[api/music] 获取歌曲 ${songId} 失败:`, error)
        return { id: songId, error: String(error) }
      }
    }),
  )

  return NextResponse.json(results)
}
