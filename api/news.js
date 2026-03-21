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

    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      let imageUrl = "";
      if (item['media:content']) imageUrl = item['media:content'].$.url;
      else if (item['enclosure']) imageUrl = item['enclosure'].$.url;

      // --- 重要：画像をサーバー側で取得してデータ化する ---
      let imageData = "";
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          imageData = `data:image/jpeg;base64,${base64}`;
        } catch (e) {
          console.error("Image fetch error");
        }
      }

      return {
        title: item.title || '',
        excerpt: item.description || '',
        image: imageData, // URLではなく画像データそのものを渡す
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      };
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
