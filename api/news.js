import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_SOURCES = [
  // 大分ローカル
  { genre: '大分・社会', url: 'https://www.oita-press.co.jp/rss/news_society.xml', icon: 'fa-solid fa-location-dot' },
  { genre: '大分・経済', url: 'https://www.oita-press.co.jp/rss/news_economy.xml', icon: 'fa-solid fa-coins' },
  { genre: '大分ニュース', url: 'https://www.nhk.or.jp/rss/news/oita.xml', icon: 'fa-solid fa-map-pin' },
  // 全国・分野別
  { genre: '科学・文化', url: 'https://www3.nhk.or.jp/rss/news/cat3.xml', icon: 'fa-solid fa-flask' },
  { genre: '政治', url: 'https://www3.nhk.or.jp/rss/news/cat4.xml', icon: 'fa-solid fa-landmark' },
  { genre: '経済', url: 'https://www3.nhk.or.jp/rss/news/cat5.xml', icon: 'fa-solid fa-chart-line' }
];

// 学校にふさわしくないネガティブな単語を除外
const NG_WORDS = /殺人|死体|遺体|刺殺|強盗|逮捕|容疑|死刑|死亡|遺棄|事故|火災|転落|重傷|重体/;

export default async function handler(req, res) {
  try {
    const allNewsPromises = RSS_SOURCES.map(async (source) => {
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
    });

    const results = await Promise.all(allNewsPromises);
    let combinedItems = results.flat();

    const filteredNews = combinedItems
      .filter(item => !NG_WORDS.test(item.title) && (!item.description || !NG_WORDS.test(item.description)))
      .map(item => ({
        title: item.title,
        genre: item.genre,
        icon: item.icon,
        source: item.sourceName,
        excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...' : '',
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      }))
      .sort(() => Math.random() - 0.5);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(filteredNews.slice(0, 20));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
