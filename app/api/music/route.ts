import { NextRequest, NextResponse } from 'next/server'
import { localSongs } from '@/data/music'

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
  
  // 如果没有传ids，返回所有本地音乐
  if (!ids) {
    const results = await Promise.all(
      localSongs.map(async (song) => {
        let lrcText = ''
        
        // 如果有网易云ID，尝试从网易云获取歌词
        if (song.neteaseId) {
          try {
            const lrcRes = await fetch(
              `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${song.neteaseId}`,
              { signal: AbortSignal.timeout(5000) },
            )
            if (lrcRes.ok) {
              lrcText = await lrcRes.text()
            }
          } catch {
            // 歌词获取失败不影响主流程
          }
        }
        
        return {
          id: song.id,
          name: song.name,
          artist: song.artist,
          author: song.artist,
          cover: song.cover,
          pic: song.cover,
          url: song.url,
          lrc: lrcText,
        }
      })
    )
    return NextResponse.json(results)
  }
  
  // 如果传了ids，返回指定的歌曲
  const songIds = ids.split(',').map((id) => id.trim()).filter(Boolean)
  const results: SongResult[] = await Promise.all(
    songIds.map(async (songId): Promise<SongResult> => {
      // 先查找本地音乐
      const localSong = localSongs.find(s => s.id === songId || s.neteaseId === songId)
      
      if (localSong) {
        let lrcText = ''
        
        // 如果有网易云ID，尝试从网易云获取歌词
        if (localSong.neteaseId) {
          try {
            const lrcRes = await fetch(
              `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${localSong.neteaseId}`,
              { signal: AbortSignal.timeout(5000) },
            )
            if (lrcRes.ok) {
              lrcText = await lrcRes.text()
            }
          } catch {
            // 歌词获取失败不影响主流程
          }
        }
        
        return {
          id: localSong.id,
          name: localSong.name,
          artist: localSong.artist,
          author: localSong.artist,
          cover: localSong.cover,
          pic: localSong.cover,
          url: localSong.url,
          lrc: lrcText,
        }
      }
      
      // 如果不是本地音乐，尝试从网易云获取（兼容旧的ID方式）
      try {
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
