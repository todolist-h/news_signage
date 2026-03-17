import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml';

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
      
      // 画像検索用キーワードの選定（ニュース内容に合わせて英語に変換）
      let query = "news";
      if (title.includes("大谷") || title.includes("野球") || title.includes("スポーツ")) query = "baseball,sports";
      else if (title.includes("大雨") || title.includes("天気") || title.includes("気象")) query = "weather,rain";
      else if (title.includes("地震") || title.includes("災害")) query = "earthquake,disaster";
      else if (title.includes("株") || title.includes("円安") || title.includes("経済")) query = "finance,city";
      else if (title.includes("宇宙") || title.includes("ロケット")) query = "space,rocket";
      else if (title.includes("事件") || title.includes("事故")) query = "police,night";
      else if (title.includes("学校") || title.includes("子供")) query = "school,classroom";
      else {
        // キーワードがない場合はタイトルの最初の2文字などでバリエーションを作る
        query = "news,japan," + index;
      }

      // 修正ポイント：キャッシュを防ぐための sig パラメータと、より確実なUnsplashのURL
      const imageUrl = `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1920&q=80&sig=${index}_${Date.now()}&query=${query}`;

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
    res.setHeader('Cache-Control', 'no-store'); // キャッシュを絶対にさせない
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
