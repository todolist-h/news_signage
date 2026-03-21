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
      
      // ニュース内容に合わせたキーワード（英語にすると精度が上がります）
      let query = "japan,city"; 
      if (title.match(/大谷|野球|選手|試合|五輪|サッカー/)) query = "stadium,athlete";
      else if (title.match(/雨|雪|天気|台風|気象/)) query = "weather,sky";
      else if (title.match(/宇宙|ロケット|月|星/)) query = "space,galaxy";
      else if (title.match(/IT|AI|技術|スマホ/)) query = "technology";
      else if (title.match(/事件|事故|警察|火災/)) query = "night,city";
      else if (title.match(/学校|教育|生徒|子供|受験/)) query = "school,classroom";
      else if (title.match(/経済|株|円安|市場/)) query = "business,money";
      else if (title.match(/首相|政府|政治|選挙/)) query = "government,japan";

      // 修正：特定のIDを消し、キーワードとランダムな数字(sig)だけで構成
      // これにより、同じキーワードでも違う画像が選ばれやすくなります
      const randomID = Math.floor(Math.random() * 10000);
      const imageUrl = `https://images.unsplash.com/featured/1920x1080?${encodeURIComponent(query)}&sig=${index}_${randomID}`;

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
