import fetch from 'node-fetch';
import xml2js from 'xml2js';

// 取得するジャンルのリスト（Font Awesomeアイコン名を追加）
const RSS_SOURCES = [
  { genre: '社会', url: 'https://www3.nhk.or.jp/rss/news/cat1.xml', icon: 'fa-solid fa-earth-asia' }, // 地球アイコン
  { genre: '科学・文化', url: 'https://www3.nhk.or.jp/rss/news/cat3.xml', icon: 'fa-solid fa-flask' }, // フラスコアイコン
  { genre: '政治', url: 'https://www3.nhk.or.jp/rss/news/cat4.xml', icon: 'fa-solid fa-landmark' }, // ランドマーク（国会議事堂的な）アイコン
  { genre: '経済', url: 'https://www3.nhk.or.jp/rss/news/cat5.xml', icon: 'fa-solid fa-chart-line' } // 折れ線グラフアイコン
];

const NG_WORDS = /殺人|死体|遺体|刺殺|強盗|逮捕|容疑|死刑|死亡|遺棄|事故|火災|転落/;

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
          ...item,
          genre: source.genre,
          icon: source.icon // Font Awesomeのクラス名を渡す
        }));
      } catch (e) { return []; }
    });

    const results = await Promise.all(allNewsPromises);
    let combinedItems = results.flat();

    const filteredNews = combinedItems
      .filter(item => !NG_WORDS.test(item.title) && !NG_WORDS.test(item.description))
      .map(item => ({
        title: item.title,
        genre: item.genre,
        icon: item.icon,
        excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...' : '',
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      }))
      .sort(() => Math.random() - 0.5);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(filteredNews.slice(0, 15));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
