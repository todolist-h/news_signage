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
    if (!Array.isArray(items)) {
      items = [items];
    }

    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      // 画像取得ロジック
      // 1. media:thumbnail を確認
      let imageUrl = null;
      if (item['media:thumbnail']) {
        imageUrl = item['media:thumbnail'].$.url;
      }

      // 2. なければ記事のOGP画像を取りに行く
      if (!imageUrl && item.link) {
        try {
          const pageRes = await fetch(item.link);
          const html = await pageRes.text();
          const $ = cheerio.load(html);
          imageUrl = $('meta[property="og:image"]').attr('content');
        } catch (e) {
          console.error("Image fetch error for:", item.link);
        }
      }

      // 3. それでもなければプレースホルダー
      if (!imageUrl) {
        imageUrl = 'https://via.placeholder.com/1920x1080?text=NHK+News';
      }

      // 説明文の掃除（HTMLタグ除去と短縮）
      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...'
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

    // キャッシュ設定（5分間キャッシュし、バックグラウンドで10分間更新を許可）
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*'); // CORS対策
    res.status(200).json(newsData);
  } catch (error) {
    console.error("Main fetch error:", error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
