import { NextRequest, NextResponse } from 'next/server'

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
        // 使用 Meting API 获取音乐信息（代理方式，无跨域问题，更稳定）
        const res = await fetch(
          `https://api.injahow.cn/meting/?server=netease&type=song&id=${songId}`,
          { signal: AbortSignal.timeout(8000) },
        )

        if (!res.ok) {
          throw new Error(`API status: ${res.status}`)
        }

        const data = await res.json()
        const song = data?.[0]

        if (!song || !song.url) {
          // 失败时回退到直接外链方式
          return {
            id: songId,
            name: song?.name || '未知歌曲',
            artist: song?.artist || '未知歌手',
            author: song?.artist || '未知歌手',
            cover: song?.pic || '',
            pic: song?.pic || '',
            url: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
            lrc: '',
          }
        }

        // 获取歌词
        let lrcText = ''
        try {
          const lrcRes = await fetch(
            `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${songId}`,
            { signal: AbortSignal.timeout(5000) },
          )
          if (lrcRes.ok) {
            lrcText = await lrcRes.text()
          }
        } catch {
          // 歌词获取失败不影响主流程
        }

        return {
          id: songId,
          name: song.name || '未知歌曲',
          artist: song.artist || '未知歌手',
          author: song.artist || '未知歌手',
          cover: song.pic || '',
          pic: song.pic || '',
          url: song.url,
          lrc: lrcText,
        }
      } catch (error) {
        console.error(`[api/music] 获取歌曲 ${songId} 失败:`, error)
        // 失败时回退到直接外链方式
        return {
          id: songId,
          name: '未知歌曲',
          artist: '未知歌手',
          author: '未知歌手',
          cover: '',
          pic: '',
          url: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
          lrc: '',
        }
      }
    }),
  )

  return NextResponse.json(results)
}
