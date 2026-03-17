import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml';

export default async function handler(req, res) {
  // 1. 画像プロキシ機能 (CORB/CORS回避)
  if (req.query.proxy) {
    try {
      const targetUrl = decodeURIComponent(req.query.proxy);
      const imgRes = await fetch(targetUrl, { 
        headers: { 'User-Agent': 'Mozilla/5.0' } 
      });
      if (!imgRes.ok) throw new Error('Failed to fetch image');
      
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buffer);
    } catch (e) {
      // プロキシで画像が取れなかった場合は、透明な1pxの画像を返すか、404を返す
      return res.status(404).end();
    }
  }

  // 2. ニュース配信
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = items.slice(0, 10).map((item) => {
      let imageUrl = null;

      // RSSのサムネイルを抽出
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
        // _s.jpg (小) を _l.jpg (大) に変換
        imageUrl = imageUrl.replace('_s.jpg', '_l.jpg');
      }

      // 画像がない、またはロゴの場合はNHKの共通OGP画像に差し替え
      if (!imageUrl || imageUrl.includes('news_logo')) {
        imageUrl = 'https://www3.nhk.or.jp/news/special/common/images/ogp.png';
      }

      // 全ての画像をプロキシ経由にする
      const proxyImageUrl = `/api/news?proxy=${encodeURIComponent(imageUrl)}`;

      return {
        title: item.title || '',
        excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...' : '',
        image: proxyImageUrl,
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
