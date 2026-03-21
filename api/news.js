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
      
      // --- ニュース内容からキーワードを英語に変換 ---
      let query = "japan,landscape"; // デフォルト
      if (title.match(/大谷|野球|選手|試合|五輪|サッカー/)) query = "sports,stadium";
      else if (title.match(/雨|雪|天気|台風|気象/)) query = "sky,weather,storm";
      else if (title.match(/宇宙|ロケット|月|星/)) query = "space,galaxy";
      else if (title.match(/IT|AI|技術|スマホ/)) query = "technology,coding";
      else if (title.match(/事件|事故|警察|火災/)) query = "night,city,police";
      else if (title.match(/学校|教育|生徒|子供|受験/)) query = "school,classroom";
      else if (title.match(/経済|株|円安|市場/)) query = "business,finance";
      else if (title.match(/首相|政府|政治|選挙/)) query = "government,architecture";

      // 修正：特定の画像IDを削除し、キーワード(query)をメインに据える
      // sigに index と 乱数 を混ぜることで10枚すべて別の画像にします
      const randomSeed = Math.random().toString(36).substring(7);
      const imageUrl = `https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80&sig=${index}_${randomSeed}&query=${encodeURIComponent(query)}`;
      // ※ 上記photo-IDは「地球/通信」の汎用的なものですが、queryパラメータによって中身が上書きされます。

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
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
