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
}

/** 致敬中職六隊（隊名微調） */
export const TEAM_DEFS: TeamDef[] = [
  {
    name: '鼎信兄弟', short: '兄', city: '台中',
    c1: '#f5c518', c2: '#1a1a1a',
    ownerName: '辜振邦',
    ownerDesc: '辜振邦出身金融世家，視球隊為家族榮耀的延伸。他要求紀律與勝利，黃衫軍的傳統不容玷汙。他願意花錢，但每一分都要看到回報——也就是冠軍。',
    prefs: { money: 3, success: 5, image: 4, involve: 4, morale: 3, patience: 2 },
    budget: 16000, bias: 'even', strength: 4,
  },
  {
    name: '統盛獅', short: '獅', city: '台南',
    c1: '#f08300', c2: '#0c5c3c',
    ownerName: '高清標',
    ownerDesc: '高清標是聯盟元老級的經營者，重視傳承與在地連結。他不急於一時的勝敗，但府城的榮光與球迷的支持是他最在乎的事。穩健經營、細水長流是他的座右銘。',
    prefs: { money: 4, success: 3, image: 4, involve: 2, morale: 4, patience: 4 },
    budget: 13500, bias: 'even', strength: 2,
  },
  {
    name: '樂添桃猿', short: '猿', city: '桃園',
    c1: '#9e1b32', c2: '#5c0f1e',
    ownerName: '三木谷誠',
    ownerDesc: '三木谷誠是跨國集團派駐的職業經理人，凡事看數據與報表。球隊是集團品牌的一環，獲利與形象並重。他對戰績有耐心，但對虧損沒有。',
    prefs: { money: 5, success: 3, image: 5, involve: 3, morale: 2, patience: 3 },
    budget: 14500, bias: 'bat', strength: 3,
  },
  {
    name: '福邦悍將', short: '將', city: '新北',
    c1: '#003876', c2: '#6cace4',
    ownerName: '蔡明憲',
    ownerDesc: '蔡明憲接手球隊多年，始終等不到一座冠軍。金控的銀彈充足，他已經受夠了「重建」這兩個字。他給你資源，也給你壓力——把悍將帶回頂峰，否則就換人來做。',
    prefs: { money: 2, success: 5, image: 3, involve: 5, morale: 3, patience: 2 },
    budget: 15500, bias: 'pit', strength: 0,
  },
  {
    name: '味泉龍', short: '龍', city: '台北',
    c1: '#c8102e', c2: '#00337f',
    ownerName: '魏永亨',
    ownerDesc: '魏永亨讓老字號的龍隊重返一軍舞台，背負著老球迷三十年的情懷。他相信明星球員與話題性能把球場填滿，戰績要好，故事更要動人。',
    prefs: { money: 3, success: 4, image: 5, involve: 3, morale: 4, patience: 3 },
    budget: 14000, bias: 'bat', strength: 1,
  },
  {
    name: '台鈦雄鷹', short: '鷹', city: '高雄',
    c1: '#00573d', c2: '#b58500',
    ownerName: '謝裕國',
    ownerDesc: '謝裕國是重工業起家的實業家，把南台灣的新軍當作十年大計。他不期待立刻奪冠，但要看到球隊一年比一年強、年輕人一年比一年好。揮霍與躁進是他最不能接受的事。',
    prefs: { money: 4, success: 2, image: 3, involve: 2, morale: 5, patience: 5 },
    budget: 12500, bias: 'even', strength: -3,
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
