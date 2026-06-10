/** 台灣常見姓氏（粗略依比例加權，前段重複） */
export const SURNAMES = [
  '陳', '陳', '陳', '林', '林', '林', '黃', '黃', '張', '張', '李', '李', '王', '王',
  '吳', '吳', '劉', '劉', '蔡', '蔡', '楊', '楊', '許', '鄭', '謝', '郭', '洪', '曾',
  '邱', '廖', '賴', '徐', '周', '葉', '蘇', '莊', '呂', '江', '何', '蕭', '羅', '高',
  '潘', '簡', '朱', '鍾', '彭', '游', '詹', '胡', '施', '沈', '余', '盧', '梁', '趙',
  '顏', '柯', '翁', '魏', '孫', '戴', '范', '方', '宋', '鄧', '杜', '傅', '侯', '曹',
  '溫', '薛', '丁', '馬', '蔣', '唐', '卓', '藍', '馮', '姚', '石', '董', '紀', '古',
]

export const GIVEN_FIRST = [
  '冠', '宗', '志', '建', '俊', '家', '承', '哲', '柏', '宇', '泰', '偉', '智', '明',
  '文', '金', '龍', '國', '皓', '彥', '廷', '睿', '弘', '振', '景', '嘉', '鴻', '易',
  '世', '博', '昱', '聖', '政', '力', '大', '正', '育', '思', '少', '富', '凱', '威',
]

export const GIVEN_SECOND = [
  '宇', '翰', '傑', '豪', '宏', '融', '瑄', '恩', '文', '成', '軒', '霖', '毅', '誠',
  '安', '鈞', '廷', '睿', '賢', '杰', '倫', '凱', '昌', '瑋', '達', '輝', '聰', '銘',
  '琛', '育', '良', '興', '平', '生', '賓', '德', '佑', '霆', '陞', '緯', '丞', '元',
]

/** 洋將譯名池（虛構音譯） */
export const FOREIGN_NAMES = [
  '布雷頓', '萊德爾', '魔神鷹', '德魯加', '卡斯托', '威森', '羅曼尼', '鋼霸',
  '飛力士', '艾爾頓', '杜蘭特', '米契爾', '布坎拿', '海克力', '雷鳴', '道森',
  '黑騎士', '范德萊', '克魯茲', '聖騎', '猛威爾', '泰勒斯', '伍德', '霸林格',
  '齊洛', '曼尼漢', '銳克', '波塞頓', '吉爾摩', '阿格西', '戰將', '貝克漢默',
  '洛基', '渥太華', '麥金利', '富勒頓',
]

let usedNames = new Set<string>()
export function resetUsedNames() { usedNames = new Set() }

import { choice, rand } from '../engine/util'

export function genName(): string {
  for (let i = 0; i < 50; i++) {
    const single = rand() < 0.08
    const name = choice(SURNAMES) + choice(GIVEN_FIRST) + (single ? '' : choice(GIVEN_SECOND))
    if (!usedNames.has(name)) { usedNames.add(name); return name }
  }
  return choice(SURNAMES) + choice(GIVEN_FIRST) + choice(GIVEN_SECOND)
}

export function genForeignName(): string {
  for (let i = 0; i < 50; i++) {
    const name = choice(FOREIGN_NAMES)
    if (!usedNames.has(name)) { usedNames.add(name); return name }
  }
  return choice(FOREIGN_NAMES) + '二世'
}
