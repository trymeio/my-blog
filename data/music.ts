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
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951171447673702',
    url: '/music/1-afterthought.mp3',
    neteaseId: '1481691186',
  },
  {
    id: '2',
    name: 'Normal People',
    artist: 'Joji, rei brown',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951171447673702',
    url: '/music/2-normal-people.mp3',
    neteaseId: '1481691185',
  },
  {
    id: '3',
    name: 'On My Own',
    artist: 'Jaden, Kid Cudi',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951164193919270',
    url: '/music/3-on-my-own.mp3',
    neteaseId: '1376076760',
  },
  {
    id: '4',
    name: 'Come Around Me',
    artist: 'Justin Bieber',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951168144739034',
    url: '/music/4-come-around-me.mp3',
    neteaseId: '1496770948',
  },
  {
    id: '5',
    name: 'Invincible',
    artist: 'Aminé',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951171748635952',
    url: '/music/9-invincible.mp3',
    neteaseId: '1333335581',
  },
  {
    id: '6',
    name: 'Sunflower',
    artist: 'Post Malone, Swae Lee',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951171748635952',
    url: '/music/6-sunflower.mp3',
    neteaseId: '1318733599',
  },
  {
    id: '7',
    name: 'her',
    artist: 'JVKE',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951169908867905',
    url: '/music/7-her.mp3',
    neteaseId: '2621307695',
  },
  {
    id: '8',
    name: 'Alive',
    artist: 'Warbly Jets',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951166302112573',
    url: '/music/8-alive.mp3',
    neteaseId: '523375615',
  },
  {
    id: '9',
    name: 'Hummingbird',
    artist: 'Metro Boomin, James Blake',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=109951168652317597',
    url: '/music/5-hummingbird.mp3',
    neteaseId: '2052348233',
  },
  {
    id: '10',
    name: 'Deadman\'s Gun',
    artist: 'Ashtar Command',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=5040239',
    url: 'https://music.163.com/song/media/outer/url?id=5040239.mp3',
    neteaseId: '5040239',
  },
  {
    id: '11',
    name: 'Yellow',
    artist: 'Coldplay',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=1450336996',
    url: 'https://music.163.com/song/media/outer/url?id=1450336996.mp3',
    neteaseId: '1450336996',
  },
  {
    id: '12',
    name: 'Take a Walk',
    artist: 'Passion Pit',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=21411019',
    url: '/music/12-take-a-walk.mp3',
    neteaseId: '21411019',
  },
  {
    id: '13',
    name: 'All The Stars',
    artist: 'Kendrick Lamar, SZA',
    cover: 'https://api.injahow.cn/meting/?server=netease&type=pic&id=28742907',
    url: '/music/10-all-the-stars.mp3',
    neteaseId: '28742907',
  },
]
