<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>School Digital Signage</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #000; color: #fff; font-family: "Helvetica Neue", Arial, sans-serif; cursor: none; }
        #app { position: relative; width: 100vw; height: 100vh; }
        .slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 1.5s ease-in-out; z-index: 1; background: #000; }
        .active { opacity: 1; z-index: 2; }
        .slide img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; filter: brightness(0.6); }
        .content-box { position: absolute; bottom: 12%; left: 5%; width: 85%; padding: 40px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); z-index: 10; border-left: 10px solid #00aaff; }
        .title { font-size: 3.8rem; font-weight: bold; margin-bottom: 20px; text-shadow: 2px 2px 10px #000; line-height: 1.2; }
        .excerpt { font-size: 1.8rem; line-height: 1.6; text-shadow: 1px 1px 5px #000; color: #eee; }
        .meta { margin-top: 15px; font-size: 1.2rem; color: #00aaff; font-weight: bold; }
        #progress { position: absolute; bottom: 0; left: 0; height: 10px; background: #00aaff; width: 0%; z-index: 20; }
    </style>
</head>
<body>
    <div id="app"></div>
    <div id="progress"></div>

    <script>
        const API_URL = '/api/news';
        let newsItems = [];
        let currentIndex = 0;

        async function init() {
            console.log("System Start");
            await updateNews();
            render();
            setInterval(render, 8000);
            setInterval(updateNews, 600000);
        }

        async function updateNews() {
            try {
                const res = await fetch(API_URL);
                const data = await res.json();
                if (data && data.length > 0) newsItems = data;
                console.log("News updated", newsItems.length);
            } catch (e) { console.error(e); }
        }

        function render() {
            if (newsItems.length === 0) return;
            const app = document.getElementById('app');
            const item = newsItems[currentIndex];
            const div = document.createElement('div');
            div.className = 'slide';
            
            const img = document.createElement('img');
            img.src = item.image;
            // 画像読み込みエラー時のフォールバック（一般的なニュース背景画像）
            img.onerror = function() {
                this.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1920";
            };

            div.appendChild(img);
            div.innerHTML += `
                <div class="content-box">
                    <div class="title">${item.title}</div>
                    <div class="excerpt">${item.excerpt}</div>
                    <div class="meta">出典：NHKニュース (${item.time} 更新)</div>
                </div>
            `;
            
            app.appendChild(div);
            setTimeout(() => div.classList.add('active'), 50);

            if (app.children.length > 1) {
                const old = app.children[0];
                old.classList.remove('active');
                setTimeout(() => app.removeChild(old), 1600);
            }

            const bar = document.getElementById('progress');
            bar.style.transition = 'none'; bar.style.width = '0%';
            setTimeout(() => { bar.style.transition = 'width 8s linear'; bar.style.width = '100%'; }, 50);

            currentIndex = (currentIndex + 1) % newsItems.length;
        }
        init();
    </script>
</body>
</html>
