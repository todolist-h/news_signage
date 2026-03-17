import fetch from 'node-fetch';
import xml2js from 'xml2js';
import cheerio from 'cheerio';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml'; 

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      let imageUrl = null;

      // 1. RSS内のサムネイルをチェック
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
      }

      // 2. NHKの記事ページから高画質なOGP画像を取得
      if (item.link) {
        try {
          // NHKの画像取得をより確実にするため、User-Agentを追加
          const pageRes = await fetch(item.link, { 
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' } 
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);
            // og:image または twitter:image を取得
            const ogImage = $('meta[property="og:image"]').attr('content') || 
                            $('meta[name="twitter:image"]').attr('content');
            if (ogImage) imageUrl = ogImage;
          }
        } catch (e) {
          console.error("Image fetch error:", item.link);
        }
      }

      // 3. 画像が取れなかった時の予備（placeholder.comが死んでいるので別のサービスに変更）
      if (!imageUrl) {
        // プレースホルダーを「picsum.photos（安定しているサービス）」に変更
        imageUrl = `https://picsum.photos/seed/${encodeURIComponent(item.title)}/1920/1080`;
      }

      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: item.title || 'No Title',
        excerpt: cleanDescription,
        image: imageUrl,
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.status(200).json(newsData);

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
