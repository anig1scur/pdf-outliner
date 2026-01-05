
export type CounterStyle =
    'decimal'|'roman_upper'|'alpha_upper'|'chinese_simple';

export interface LevelConfig {
  style: CounterStyle;
  prefix: string;
  suffix: string;
  inheritParent: boolean;
  separator: string;
}

export const DEFAULT_PREFIX_CONFIG: LevelConfig[] = [
  {
    style: 'decimal',
    prefix: '',
    suffix: '.',
    inheritParent: false,
    separator: '.'
  },  // Level 1
  {
    style: 'decimal',
    prefix: '',
    suffix: '',
    inheritParent: true,
    separator: '.'
  },  // Level 2
];

export const convertNum = (num: number, style: CounterStyle): string => {
  if (style === 'decimal') return num.toString();
  if (style === 'alpha_upper') return String.fromCharCode(64 + num);
  if (style === 'roman_upper') {
    const lookup: [number, string][] =
        [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let roman = '';
    let n = num;
    for (const [val, sym] of lookup) {
      while (n >= val) {
        roman += sym;
        n -= val;
      }
    }
    return roman;
  }
  if (style === 'chinese_simple') {
    const chars =
        ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return num <= 10 ? chars[num] : num.toString();
  }
  return num.toString();
};

export function applyCustomPrefix(
    items: any[], configs: LevelConfig[], parentPath: number[] = [],
    level: number = 0): any[] {
  const config = configs[level] || configs[configs.length - 1];

  return items.map((item, index) => {
    const currentNum = index + 1;
    const currentPath = [...parentPath, currentNum];

    let coreNumber = '';

    if (config.inheritParent && parentPath.length > 0) {
      const parentStr = parentPath.join(config.separator);
      const selfStr = convertNum(currentNum, config.style);
      coreNumber = `${parentStr}${config.separator}${selfStr}`;
    } else {
      coreNumber = convertNum(currentNum, config.style);
    }

    const finalPrefix = `${config.prefix}${coreNumber}${config.suffix}`;

    return {
      ...item,
      title: `${finalPrefix} ${item.title}`,
      children: applyCustomPrefix(
          item.children || [], configs, currentPath, level + 1)
    };
  });
}
