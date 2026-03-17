import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat7.xml';

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = items.slice(0, 10).map((item, index) => {
      const title = item.title || "";
      
      // カテゴリ判定（これ以外のときは「風景」や「建物」を出すようにして新聞を避ける）
      let category = "nature,architecture"; // デフォルト
      if (title.includes("大谷") || title.includes("野球") || title.includes("スポーツ")) category = "sports,stadium";
      else if (title.includes("雨") || title.includes("天気") || title.includes("雪")) category = "sky,weather";
      else if (title.includes("宇宙") || title.includes("空")) category = "space,galaxy";
      else if (title.includes("IT") || title.includes("AI") || title.includes("技術")) category = "technology,cyber";
      else if (title.includes("街") || title.includes("東京") || title.includes("ビル")) category = "city,japan";

      // 修正の要：source.unsplash.com をやめ、直接 images.unsplash.com を叩く
      // sigに「ニュースタイトル」と「時間」を混ぜて、完全にユニークなURLにする
      const randomSeed = Math.random().toString(36).substring(7);
      const imageUrl = `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1920&q=80&sig=${index}_${randomSeed}&topic=${category}`;

      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: item.title,
        excerpt: cleanDescription,
        image: imageUrl,
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); // キャッシュを徹底拒否
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
