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
      
      // キーワード判定（画像の雰囲気を変えるため）
      let keyword = "nature"; 
      if (title.match(/大谷|野球|選手|試合|スポーツ/)) keyword = "sport";
      else if (title.match(/雨|雪|天気|台風|気象/)) keyword = "weather";
      else if (title.match(/宇宙|ロケット|星/)) keyword = "space";
      else if (title.match(/IT|AI|技術|コンピュータ/)) keyword = "technology";
      else if (title.match(/事件|事故|警察|夜/)) keyword = "city";
      else if (title.match(/学校|教育|子供/)) keyword = "study";
      else if (title.match(/経済|株|円安|金/)) keyword = "business";

      // 取得元を変更：Lorem Picsum（シード値を変えることで重複を防ぐ）
      // 形式: https://picsum.photos/seed/{識別子}/1920/1080
      const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(keyword + index)}/1920/1080`;

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

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
