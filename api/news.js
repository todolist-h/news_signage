import fetch from 'node-fetch';
import xml2js from 'xml2js';
import cheerio from 'cheerio';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml'; 

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    // itemsが単一オブジェクトの場合でも配列として扱うための処理
    let items = parsed.rss.channel.item;
    if (!items) {
      return res.status(200).json([]); // ニュースが空なら空配列を返す
    }
    if (!Array.isArray(items)) {
      items = [items];
    }

    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      // --- 画像取得ロジック ---
      let imageUrl = null;

      // 1. media:thumbnail プロパティを安全にチェック
      // (xml2jsの解析結果によって構造が微妙に変わることがあるため、より安全な書き方にしています)
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
      }

      // 2. なければ記事のURLからOGP画像(og:image)を取得
      if (!imageUrl && item.link) {
        try {
          const pageRes = await fetch(item.link, { timeout: 3000 }); // 3秒でタイムアウト設定
          if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);
            imageUrl = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content');
          }
        } catch (e) {
          console.error("Image fetch error:", item.link);
        }
      }

      // 3. それでも取得できなければ代替画像
      if (!imageUrl) {
        imageUrl = 'https://via.placeholder.com/1920x1080?text=NHK+News';
      }

      // 本文の掃除（タグ除去、空白整理、短縮）
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

    // Vercel用のキャッシュ設定とCORS許可
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.status(200).json(newsData);

  } catch (error) {
    console.error("Critical API error:", error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
