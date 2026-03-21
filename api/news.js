import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://news.yahoo.co.jp/rss/topics/top-picks.xml';

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = items.slice(0, 10).map((item) => {
      // YahooのRSSから画像URLを探す（media:content や enclosure など）
      let imageUrl = "";
      if (item['media:content'] && item['media:content'].$.url) {
        imageUrl = item['media:content'].$.url;
      } else if (item['enclosure'] && item['enclosure'].$.url) {
        imageUrl = item['enclosure'].$.url;
      }

      return {
        title: item.title || '',
        excerpt: item.description || '',
        image: imageUrl,
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
