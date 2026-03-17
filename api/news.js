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

    const newsData = items.slice(0, 10).map((item) => {
      let imageUrl = null;

      // 1. NHKのRSSにあるサムネイルを優先取得
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
        
        // 【重要】NHKのサムネイルURLを加工して「大きい画像」に変換する
        // 例: _s.jpg を _l.jpg に書き換えることで高画質化を試みる
        imageUrl = imageUrl.replace('_s.jpg', '_l.jpg');
      }

      // 2. 画像がどうしてもない場合のみ、NHKニュースのイメージ画像
      if (!imageUrl) {
        imageUrl = 'https://www3.nhk.or.jp/news/special/common/images/ogp.png';
      }

      // 説明文の掃除
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
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.status(200).json(newsData);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
