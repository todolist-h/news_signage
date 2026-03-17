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

      // 1. media:thumbnail のチェック
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
      }

      // 2. 記事ページから OGP 画像を取得 (強化)
      if (item.link) {
        try {
          const pageRes = await fetch(item.link, { 
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } 
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);
            
            // og:image を取得
            let ogImage = $('meta[property="og:image"]').attr('content') || 
                          $('meta[name="twitter:image"]').attr('content');

            if (ogImage) {
              // 重要：URLが "/" から始まる相対パスだった場合、ドメインを補完する
              if (ogImage.startsWith('/')) {
                const urlObj = new URL(item.link);
                ogImage = urlObj.origin + ogImage;
              }
              imageUrl = ogImage;
            }
          }
        } catch (e) {
          console.error("Image fetch error:", item.link);
        }
      }

      // 3. NHKのロゴ画像を最終予備にする（風景写真ではなく）
      if (!imageUrl) {
        imageUrl = 'https://www3.nhk.or.jp/news/special/common/images/ogp.png';
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
