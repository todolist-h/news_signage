import fetch from 'node-fetch';
import xml2js from 'xml2js';
import cheerio from 'cheerio';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml';

export default async function handler(req, res) {
  // 1. 画像プロキシ機能 (CORB回避)
  if (req.query.proxy) {
    try {
      const targetUrl = decodeURIComponent(req.query.proxy);
      const imgRes = await fetch(targetUrl, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } 
      });
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buffer);
    } catch (e) {
      return res.status(404).end();
    }
  }

  // 2. ニュース取得 & 画像解析機能
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    // 上位10件を並列で処理（画像を探しにいく）
    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      let foundImageUrl = null;

      // 手順A: まずRSS内のサムネイルを確認
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        foundImageUrl = item['media:thumbnail'].$.url.replace('_s.jpg', '_l.jpg');
      }

      // 手順B: RSSに写真がない、またはロゴっぽい場合は記事ページの中を見に行く
      if (!foundImageUrl || foundImageUrl.includes('news_logo') || foundImageUrl.includes('ogp.png')) {
        try {
          const pageRes = await fetch(item.link, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);
            // 記事内のメイン画像 (OGP) を抽出
            let ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage) {
              if (ogImage.startsWith('/')) {
                ogImage = 'https://www3.nhk.or.jp' + ogImage;
              }
              foundImageUrl = ogImage;
            }
          }
        } catch (e) { /* 取得失敗時は次へ */ }
      }

      // 手順C: それでもダメなら予備（風景は出さず、NHKロゴに固定）
      if (!foundImageUrl) {
        foundImageUrl = 'https://www3.nhk.or.jp/news/special/common/images/ogp.png';
      }

      // 最終的なURLをプロキシ経由に変換
      const finalImageUrl = `/api/news?proxy=${encodeURIComponent(foundImageUrl)}`;

      return {
        title: item.title || 'No Title',
        excerpt: item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...' : '',
        image: finalImageUrl,
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      };
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
