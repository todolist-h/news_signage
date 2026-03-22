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
    let items = parsed.rss.channel.item;
    if (!items) return [];
    if (!Array.isArray(items)) items = [items];
    
    return items.map(item => {
      // Yahooニュース特有の末尾の出典表記（例： (OBS大分放送)）を削除してスッキリさせる
      const cleanTitle = item.title ? item.title.replace(/\s\(.+\)$/, '') : '';
      return {
        title: cleanTitle,
        description: item.description || '',
        pubDate: item.pubDate,
        genre: source.genre,
        icon: source.icon,
        sourceName: source.genre.includes('大分') || source.genre.includes('OBS') ? '大分現地情報' : 'NHK NEWS'
      };
    });
  } catch (e) { return []; }
}

export default async function handler(req, res) {
  try {
    const oitaResults = await Promise.all(SOURCES_OITA.map(fetchFeed));
    const globalResults = await Promise.all(SOURCES_GLOBAL.map(fetchFeed));

    const filter = (item) => !NG_WORDS.test(item.title) && !NG_WORDS.test(item.description);
    const format = (item) => ({
      title: item.title,
      genre: item.genre,
      icon: item.icon,
      source: item.source,
      excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...' : '',
      time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
    });

    const oitaNews = oitaResults.flat().filter(filter).map(format);
    const globalNews = globalResults.flat().filter(filter).map(format);

    // 大分ニュースを2件に対して、全国を1件混ぜる（大分を体感7割にする）
    let finalNews = [];
    let oitaIdx = 0;
    let globalIdx = 0;

    while (oitaIdx < oitaNews.length || globalIdx < globalNews.length) {
      if (oitaNews[oitaIdx]) finalNews.push(oitaNews[oitaIdx++]);
      if (oitaNews[oitaIdx]) finalNews.push(oitaNews[oitaIdx++]);
      if (globalNews[globalIdx]) finalNews.push(globalNews[globalIdx++]);
      if (finalNews.length > 30) break; // 最大30件
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(finalNews);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
