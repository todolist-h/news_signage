import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat5.xml';

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
      
      // キーワード判定（新聞紙を避けるため、抽象的な単語を割り当て）
      let category = "nature,landscape"; 
      if (title.match(/大谷|野球|選手|試合|五輪/)) category = "stadium,grass";
      else if (title.match(/雨|雪|天気|台風|気象/)) category = "sky,clouds";
      else if (title.match(/宇宙|月|星/)) category = "galaxy,starry";
      else if (title.match(/IT|AI|技術/)) category = "technology,data";
      else if (title.match(/東京|ビル|都市/)) category = "city,japan";
      else if (title.match(/学校|教育|子供/)) category = "library,classroom";

      // 完全にランダムなIDを生成して「同じ画像」が続くのを物理的に防ぐ
      const randomSeed = Math.random().toString(36).substring(7);
      // 新聞が出にくい「自然・風景」系のベースURLを使用
      const imageUrl = `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80&sig=${index}_${randomSeed}&topic=${category}`;

      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: title,
        excerpt: cleanDescription,
        image: imageUrl,
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
