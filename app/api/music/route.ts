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

// 双源歌词获取：先 Meting 镜像，失败则走网易云直连
async function fetchLyrics(neteaseId: string): Promise<string> {
  // 源1: Meting 镜像
  try {
    const res = await fetch(
      `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${neteaseId}`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (res.ok) {
      const text = await res.text()
      if (text && text.includes('[')) return text
    }
  } catch { /* fallthrough */ }

  // 源2: 网易云直连 API
  try {
    const res = await fetch(
      `https://music.163.com/api/song/lyric?id=${neteaseId}&lv=1`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (res.ok) {
      const data = await res.json()
      const lrc = data?.lrc?.lyric
      if (lrc) return lrc
    }
  } catch { /* fallthrough */ }

  return ''
}

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  
  // 如果没有传ids，返回所有本地音乐
  if (!ids) {
    const results = await Promise.all(
      localSongs.map(async (song) => {
        let lrcText = ''
        let playUrl = song.url
        let coverUrl = song.cover
        
        // 如果有网易云ID，尝试从网易云获取歌词和播放链接
        if (song.neteaseId) {
          // 获取歌词（双源 fallback）
          lrcText = await fetchLyrics(song.neteaseId)
          
          // 如果url是网易云外链，尝试从meting获取真实播放链接
          if (song.url.includes('music.163.com') || song.url.startsWith('http')) {
            try {
              const songRes = await fetch(
                `https://api.injahow.cn/meting/?server=netease&type=song&id=${song.neteaseId}`,
                { signal: AbortSignal.timeout(6000) },
              )
              if (songRes.ok) {
                const songData = await songRes.json()
                if (songData?.[0]?.url) {
                  playUrl = songData[0].url
                }
                if (songData?.[0]?.pic && !song.cover.startsWith('/')) {
                  coverUrl = songData[0].pic
                }
              }
            } catch {
              // 获取失败，使用原始url
            }
          }
        }
        
        return {
          id: song.id,
          name: song.name,
          artist: song.artist,
          author: song.artist,
          cover: coverUrl,
          pic: coverUrl,
          url: playUrl,
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
        
        // 如果有网易云ID，尝试从网易云获取歌词（双源 fallback）
        if (localSong.neteaseId) {
          lrcText = await fetchLyrics(localSong.neteaseId)
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
          { signal: AbortSignal.timeout(6000) },
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
        
        // 获取歌词（双源 fallback）
        const lrcText = await fetchLyrics(songId)
        
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
