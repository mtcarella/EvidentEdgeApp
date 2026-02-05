import nicknameData from '../data/nickname_mapping.csv?raw';

interface NicknameMap {
  [key: string]: string[];
}

let nicknameMap: NicknameMap | null = null;

function parseNicknameCSV(): NicknameMap {
  if (nicknameMap) return nicknameMap;

  const map: NicknameMap = {};
  const lines = nicknameData.split('\n').slice(1);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const [formalName, nicknames] = trimmedLine.split(',');
    if (!formalName || !nicknames) continue;

    const formal = formalName.toLowerCase().trim();
    const nicknameList = nicknames.split('|').map(n => n.toLowerCase().trim());

    map[formal] = nicknameList;

    for (const nickname of nicknameList) {
      if (!map[nickname]) {
        map[nickname] = [formal, ...nicknameList.filter(n => n !== nickname)];
      }
    }
  }

  nicknameMap = map;
  return map;
}

export function expandSearchTermWithNicknames(searchTerm: string): string[] {
  const map = parseNicknameCSV();
  const words = searchTerm.toLowerCase().trim().split(/\s+/);

  const expandedTerms: string[] = [searchTerm];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const variants = map[word];

    if (variants && variants.length > 0) {
      const newTerms: string[] = [];

      for (const existingTerm of expandedTerms) {
        const existingWords = existingTerm.split(/\s+/);

        for (const variant of variants) {
          const newWords = [...existingWords];
          newWords[i] = variant;
          newTerms.push(newWords.join(' '));
        }
      }

      expandedTerms.push(...newTerms);
    }
  }

  return [...new Set(expandedTerms)];
}
