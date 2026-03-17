import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml'; 

export default async function handler(req, res) {
  // 1. 画像プロキシ機能 (URLに ?proxy=... がついている場合)
  if (req.query.proxy) {
    try {
      const targetUrl = decodeURIComponent(req.query.proxy);
      const imgRes = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 画像は1日キャッシュ
      return res.status(200).send(buffer);
    } catch (e) {
      return res.status(404).end();
    }
  }

  // 2. ニュース配信機能
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = items.slice(0, 10).map((item) => {
      let rawImageUrl = null;
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        rawImageUrl = item['media:thumbnail'].$.url.replace('_s.jpg', '_l.jpg');
      }

      // 自分のAPI経由のURLに変換して返す (CORB回避の鍵)
      const finalImageUrl = rawImageUrl 
        ? `/api/news?proxy=${encodeURIComponent(rawImageUrl)}`
        : 'https://picsum.photos/1920/1080?grayscale';

      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: item.title || 'No Title',
        excerpt: cleanDescription,
        image: finalImageUrl,
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
