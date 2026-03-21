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
      
      // ニュースの内容からキーワードを決定
      let query = "landscape,nature"; 
      if (title.match(/大谷|野球|選手|試合|サッカー/)) query = "stadium,sports";
      else if (title.match(/雨|雪|天気|台風|気象/)) query = "weather,clouds";
      else if (title.match(/宇宙|ロケット|月|星/)) query = "space,stars";
      else if (title.match(/IT|AI|技術|スマホ/)) query = "technology,cyber";
      else if (title.match(/事件|事故|警察|火災/)) query = "city,night";
      else if (title.match(/学校|教育|生徒|子供/)) query = "school,classroom";
      else if (title.match(/経済|株|円安/)) query = "business,finance";
      else if (title.match(/首相|政府|政治/)) query = "japan,building";

      // 安定して画像が出る Source Unsplash の新しい形式
      // sigパラメータを付けることで、同じキーワードでも違う画像が選ばれます
      const imageUrl = `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}&sig=${index}`;

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
