import fetch from 'node-fetch';
import xml2js from 'xml2js';

const SOURCES_OITA = [
  { genre: '大分・社会', url: 'https://www.oita-press.co.jp/rss/news_society.xml', icon: 'fa-solid fa-location-dot' },
  { genre: '大分・経済', url: 'https://www.oita-press.co.jp/rss/news_economy.xml', icon: 'fa-solid fa-coins' },
  { genre: '大分ニュース', url: 'https://www.nhk.or.jp/rss/news/oita.xml', icon: 'fa-solid fa-map-pin' }
];

const SOURCES_GLOBAL = [
  { genre: '科学・文化', url: 'https://www3.nhk.or.jp/rss/news/cat3.xml', icon: 'fa-solid fa-flask' },
  { genre: '政治', url: 'https://www3.nhk.or.jp/rss/news/cat4.xml', icon: 'fa-solid fa-landmark' },
  { genre: '経済', url: 'https://www3.nhk.or.jp/rss/news/cat5.xml', icon: 'fa-solid fa-chart-line' }
];

const NG_WORDS = /殺人|死体|遺体|刺殺|強盗|逮捕|容疑|死刑|死亡|遺棄|事故|火災|転落|重傷|重体/;

async function fetchFeed(source) {
  try {
    const response = await fetch(source.url);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    let items = parsed.rss.channel.item;
    if (!items) return [];
    if (!Array.isArray(items)) items = [items];
    
    return items.map(item => ({
      title: item.title,
      description: item.description,
      pubDate: item.pubDate,
      genre: source.genre,
      icon: source.icon,
      sourceName: source.genre.includes('大分') ? '大分現地情報' : 'NHK NEWS'
    }));
  } catch (e) { return []; }
}

export default async function handler(req, res) {
  try {
    // 大分と全国を別々に取得
    const oitaResults = await Promise.all(SOURCES_OITA.map(fetchFeed));
    const globalResults = await Promise.all(SOURCES_GLOBAL.map(fetchFeed));

    const filter = (item) => !NG_WORDS.test(item.title) && (!item.description || !NG_WORDS.test(item.description));
    const format = (item) => ({
      title: item.title,
      genre: item.genre,
      icon: item.icon,
      source: item.sourceName,
      excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...' : '',
      time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
    });

    const oitaNews = oitaResults.flat().filter(filter).map(format);
    const globalNews = globalResults.flat().filter(filter).map(format);

    // --- ここがポイント：大分と全国を交互に近い形で混ぜる ---
    let finalNews = [];
    const maxLen = Math.max(oitaNews.length, globalNews.length);
    
    for (let i = 0; i < maxLen; i++) {
      // 大分ニュースを優先的に差し込む（大分が2回、全国が1回の比率にするなど調整可能）
      if (oitaNews[i]) finalNews.push(oitaNews[i]);
      if (oitaNews[i+1]) finalNews.push(oitaNews[i+1]); // 大分を多めに入れる
      if (globalNews[i]) finalNews.push(globalNews[i]);
      i++; 
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(finalNews.slice(0, 25)); // 最大25件
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
