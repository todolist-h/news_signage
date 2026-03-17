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
      // タイトルから記号を消して単語に分解
      const cleanTitle = item.title.replace(/[「」『』【】（）]/g, ' ').trim();
      const words = cleanTitle.split(/[\s　]/).filter(w => w.length > 1);
      
      // 最初の方にある単語を検索ワードにする（なければ"news"）
      const searchWord = words.length > 0 ? words[0] : "news";

      // 説明文の掃除
      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: item.title,
        excerpt: cleanDescription,
        // sigパラメータを付けてキャッシュを防ぎ、キーワードで画像を絞り込む
        image: `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1920&q=80&sig=${index}&keywords=${encodeURIComponent(searchWord)}`,
        keyword: searchWord,
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
