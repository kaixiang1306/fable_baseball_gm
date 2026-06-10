import type { OwnerPrefs } from '../types'

export interface TeamDef {
  name: string
  short: string
  city: string
  c1: string
  c2: string
  ownerName: string
  ownerDesc: string
  prefs: OwnerPrefs
  budget: number // 年度球員薪資預算（萬）
  /** 建隊傾向：打擊 / 投手 / 均衡 */
  bias: 'bat' | 'pit' | 'even'
  strength: number // 整體強度修正（能力平均值位移）
  /** 明星賽分組：北軍 / 南軍 */
  conference: 'north' | 'south'
}

/** 原創六隊：以台灣城市為主場 */
export const TEAM_DEFS: TeamDef[] = [
  {
    name: '台北雷虎', short: '虎', city: '台北',
    c1: '#1f4e8c', c2: '#f2a900',
    ownerName: '沈樹聲',
    ownerDesc: '沈樹聲是首都金融圈的大人物，雷虎是聯盟的招牌豪門。他要求紀律、要求勝利，更要求一切配得上「台北」二字。資源不是問題，問題是你能不能扛得起這份期待。',
    prefs: { money: 3, success: 5, image: 4, involve: 4, morale: 3, patience: 2 },
    budget: 17000, bias: 'even', strength: 4, conference: 'north',
  },
  {
    name: '桃園飛龍', short: '龍', city: '桃園',
    c1: '#c8102e', c2: '#2b2b2b',
    ownerName: '葉國綸',
    ownerDesc: '葉國綸靠航空貨運起家，把飛龍經營成精密的商業機器。他凡事看報表：上座率、周邊營收、品牌聲量。戰績他有耐心等，虧損他一天都不能忍。',
    prefs: { money: 5, success: 3, image: 5, involve: 3, morale: 2, patience: 3 },
    budget: 15000, bias: 'bat', strength: 3, conference: 'north',
  },
  {
    name: '新竹風獅', short: '獅', city: '新竹',
    c1: '#0c7a43', c2: '#d9c87a',
    ownerName: '簡兆豐',
    ownerDesc: '簡兆豐是科技園區出身的工程師老闆，相信數據、相信養成、相信時間。他不要曇花一現的補強，要一支十年不墜的強隊。揮霍與躁進是他最不能接受的事。',
    prefs: { money: 4, success: 2, image: 3, involve: 2, morale: 5, patience: 5 },
    budget: 13000, bias: 'even', strength: -3, conference: 'north',
  },
  {
    name: '台中太陽', short: '陽', city: '台中',
    c1: '#f08300', c2: '#5c3c00',
    ownerName: '何駿騰',
    ownerDesc: '何駿騰年輕接班，是聯盟最敢花錢也最高調的老闆。他要太陽成為全台灣的話題中心——明星球員、滿場觀眾、總冠軍遊行。他給你全部的資源，也隨時準備換掉讓他失望的人。',
    prefs: { money: 2, success: 5, image: 3, involve: 5, morale: 3, patience: 2 },
    budget: 16000, bias: 'pit', strength: 0, conference: 'south',
  },
  {
    name: '台南武士', short: '武', city: '台南',
    c1: '#4a2c83', c2: '#b9b4c7',
    ownerName: '鄭添壽',
    ownerDesc: '鄭添壽是府城老字號食品集團的掌門人，武士承載著南台灣最深的棒球情感。他重傳統、重人情，球隊可以輸球，但不能輸了氣節與球迷的心。',
    prefs: { money: 4, success: 3, image: 4, involve: 2, morale: 4, patience: 4 },
    budget: 14000, bias: 'even', strength: 2, conference: 'south',
  },
  {
    name: '高雄海鷹', short: '鷹', city: '高雄',
    c1: '#006a8e', c2: '#7fd1e8',
    ownerName: '林滄浪',
    ownerDesc: '林滄浪靠遠洋航運白手起家，海鷹是他送給港都的禮物。他喜歡故事、喜歡熱血，重視球員像重視自己的船員。戰績要穩定向上，更要讓高雄人驕傲。',
    prefs: { money: 3, success: 4, image: 5, involve: 3, morale: 4, patience: 3 },
    budget: 14500, bias: 'bat', strength: 1, conference: 'south',
  },
]

export const PREF_LABELS: { key: keyof OwnerPrefs; label: string }[] = [
  { key: 'money', label: '金錢的重視度' },
  { key: 'success', label: '球隊成功的重視度' },
  { key: 'image', label: '球隊形象的重視度' },
  { key: 'involve', label: '參與程度' },
  { key: 'morale', label: '球隊士氣的重視度' },
  { key: 'patience', label: '耐心度' },
]
