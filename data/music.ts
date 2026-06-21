// 本地音乐配置
export interface LocalSong {
  id: string
  name: string
  artist: string
  cover: string
  url: string
  neteaseId?: string // 网易云ID，用于获取歌词
}

export const localSongs: LocalSong[] = [
  {
    id: '1',
    name: 'Afterthought',
    artist: 'Joji, BENEE',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/1-afterthought.mp3',
    neteaseId: '1481691186',
  },
  {
    id: '2',
    name: 'Normal People',
    artist: 'Joji, rei brown',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/2-normal-people.mp3',
    neteaseId: '1481691185',
  },
  {
    id: '3',
    name: 'On My Own',
    artist: 'Jaden, Kid Cudi',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/3-on-my-own.mp3',
    neteaseId: '1376076760',
  },
  {
    id: '4',
    name: 'Come Around Me',
    artist: 'Justin Bieber',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/4-come-around-me.mp3',
    neteaseId: '1496770948',
  },
  {
    id: '5',
    name: 'Invincible',
    artist: 'Aminé',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/9-invincible.mp3',
    neteaseId: '1333335581',
  },
  {
    id: '6',
    name: 'Sunflower',
    artist: 'Post Malone, Swae Lee',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/6-sunflower.mp3',
    neteaseId: '1318733599',
  },
  {
    id: '7',
    name: 'her',
    artist: 'JVKE',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/7-her.mp3',
    neteaseId: '2621307695',
  },
  {
    id: '8',
    name: 'Alive',
    artist: 'Warbly Jets',
    cover: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885801.jpg',
    url: '/music/8-alive.mp3',
    neteaseId: '523375615',
  },
  {
    id: '9',
    name: 'Hummingbird',
    artist: 'Metro Boomin, James Blake',
    cover: '/hummingbird-cover.jpg',
    url: '/music/5-hummingbird.mp3',
    // Hummingbird 是蜘蛛侠：纵横宇宙的原声，暂时没有网易云ID
  },
]
