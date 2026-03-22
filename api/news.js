import fetch from 'node-fetch';
import xml2js from 'xml2js';

const SOURCES_OITA = [
  { genre: '大分合同新聞', url: 'https://news.yahoo.co.jp/rss/media/mjikenbo/all.xml', icon: 'fa-solid fa-newspaper' },
  { genre: 'OBS大分放送', url: 'https://news.yahoo.co.jp/rss/media/obsnews/all.xml', icon: 'fa-solid fa-tv' },
  { genre: 'NHK大分', url: 'https://www.nhk.or.jp/rss/news/oita.xml', icon: 'fa-solid fa-map-pin' }
];

const SOURCES_GLOBAL = [
  { genre: '科学・文化', url: 'https://www3.nhk.or.jp/rss/news/cat3.xml', icon: 'fa-solid fa-flask' },
  { genre: '政治', url: 'https://www3.nhk.or.jp/rss/news/cat4.xml', icon: 'fa-solid fa-landmark' },
  { genre: '経済', url: 'https://www3.nhk.or.jp/rss/news/cat5.xml', icon: 'fa-solid fa-chart-line' }
];

const NG_WORDS = /殺人|死体|遺体|刺殺|強盗|逮捕|容疑|死刑|死亡|遺棄|事故|火災|転落|重傷|重体|ひき逃げ/;

async function fetchFeed(source) {
  try {
    const response = await fetch(source.url);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss?.channel?.item || [];
    if (!Array.isArray(items)) items = [items];
    
    return items.map(item => {
      // タイトルの取得とクリーニング
      let title = typeof item.title === 'string' ? item.title : (item.title?._ || "");
      // 末尾の (大分合同新聞) や (OBS大分放送) を除去
      title = title.replace(/\s*[\(（][^）\)]+[\)）]\s*$/, '').trim();

      // 本文の取得（Yahoo!ニュースの特殊なタグにも対応）
      let desc = "";
      if (typeof item.description === 'string') desc = item.description;
      else if (item.description?._) desc = item.description._;
      
      return {
        title: title,
        description: desc,
        pubDate: item.pubDate,
        genre: source.genre,
        icon: source.icon,
        // すべて「大分現地情報」という名前に統一
        sourceLabel: source.genre.includes('大分') || source.genre.includes('OBS') ? '大分現地情報' : 'NHK NEWS'
      };
    });
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const [oitaResults, globalResults] = await Promise.all([
      Promise.all(SOURCES_OITA.map(fetchFeed)),
      Promise.all(SOURCES_GLOBAL.map(fetchFeed))
    ]);

    // フィルタ：タイトルがあること ＆ NGワードを含まないこと
    const filter = (item) => item.title && !NG_WORDS.test(item.title);
    
    const format = (item) => ({
      title: item.title,
      genre: item.genre,
      icon: item.icon,
      source: item.sourceLabel,
      excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 90) + '...' : '詳細はニュースをご確認ください。',
      time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
    });

    const oitaNews = oitaResults.flat().filter(filter).map(format);
    const globalNews = globalResults.flat().filter(filter).map(format);

    // 大分ニュースを優先的に交互に混ぜる
    let finalNews = [];
    let oIdx = 0, gIdx = 0;
    while (finalNews.length < 40 && (oIdx < oitaNews.length || gIdx < globalNews.length)) {
      if (oitaNews[oIdx]) finalNews.push(oitaNews[oIdx++]);
      if (oitaNews[oIdx]) finalNews.push(oitaNews[oIdx++]);
      if (globalNews[gIdx]) finalNews.push(globalNews[gIdx++]);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(finalNews);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
