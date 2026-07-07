// HTML dosyaları değiştirilemediği için mobil/tablet uyumluluğu için gereken
// viewport meta etiketini burada, JS ile ekliyoruz. Bu etiket olmadan mobil
// tarayıcılar sayfayı masaüstü genişliğinde render edip küçülterek gösterir
// ve style.css içindeki @media sorguları doğru tetiklenmez.
(function ensureViewportMeta() {
	if (document.querySelector('meta[name="viewport"]')) return;
	var meta = document.createElement('meta');
	meta.name = 'viewport';
	meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
	if (document.head) {
		document.head.appendChild(meta);
	} else {
		document.write('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">');
	}
})();

// Header'ın gerçek yüksekliğine göre içeriğin ve iframe'in konumunu ayarlar
// (Bu fonksiyon sadece ana sayfada işe yarar, header yoksa hiçbir şey yapmaz)
function adjustLayout() {
	var header = document.querySelector('.header');
	var frame = document.getElementById('contentFrame');
	if (!header || !frame) return;

	var headerHeight = header.offsetHeight;
	document.body.style.paddingTop = headerHeight + 'px';
	frame.style.top = headerHeight + 'px';
	frame.style.height = 'calc(100vh - ' + headerHeight + 'px)';
}

// Ana Sayfa'ya geçince: iframe'i gizle, ana içeriği ve footer'ı göster
function showHome() {
	var frame = document.getElementById('contentFrame');
	var anaSayfa = document.getElementById('anaSayfaIcerik');
	var footer = document.getElementById('site-footer');
	if (frame) frame.style.display = 'none';
	if (anaSayfa) anaSayfa.style.display = 'inline-block';
	if (footer) footer.style.display = 'block';
}

// Hakkında veya İletişim'e geçince: ana içeriği ve footer'ı gizle, iframe'i tam ekran göster
function showFrame() {
	var frame = document.getElementById('contentFrame');
	var anaSayfa = document.getElementById('anaSayfaIcerik');
	var footer = document.getElementById('site-footer');
	if (anaSayfa) anaSayfa.style.display = 'none';
	if (footer) footer.style.display = 'none';
	if (frame) frame.style.display = 'block';
}

window.addEventListener('load', adjustLayout);
window.addEventListener('resize', adjustLayout);
window.addEventListener('orientationchange', function() {
	// Tarayıcı boyutu döndürme sonrası hemen güncellenmeyebiliyor,
	// bu yüzden kısa bir gecikmeyle tekrar hesaplıyoruz
	setTimeout(adjustLayout, 200);
});

// Menü linkleri: Ana Sayfa / Hakkında / İletişim (eskiden onclick="" ile HTML içindeydi, artık burada)
// Menüdeki linklerden hangisinin "active" (aktif) görüneceğini ayarlar
function setActiveNav(activeLink) {
	var navLinks = document.querySelectorAll('#navAnaSayfa, #navIletisim');
	navLinks.forEach(function(link) {
		link.classList.remove('active');
	});
	if (activeLink) activeLink.classList.add('active');
}

// Mobil/tablet: hamburger (3 çizgi) butonunu HTML'e dokunmadan JS ile oluşturup menüye ekler
function closeMobileMenu() {
	var menu = document.querySelector('.menu');
	var btn = document.querySelector('.hamburger-btn');
	if (menu) menu.classList.remove('nav-open');
	if (btn) btn.setAttribute('aria-expanded', 'false');
}

window.addEventListener('DOMContentLoaded', function() {
	var menu = document.querySelector('.menu');
	if (!menu) return;

	var hamburger = document.createElement('button');
	hamburger.type = 'button';
	hamburger.className = 'hamburger-btn';
	hamburger.setAttribute('aria-label', 'Menüyü aç/kapat');
	hamburger.setAttribute('aria-expanded', 'false');
	hamburger.innerHTML = '<span></span><span></span><span></span>';

	menu.insertBefore(hamburger, menu.firstChild);

	hamburger.addEventListener('click', function() {
		var isOpen = menu.classList.toggle('nav-open');
		hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
		// Menü açılınca/kapanınca header yüksekliği değişebileceği için
		// iframe ve içerik konumunu yeniden hesapla
		adjustLayout();
	});

	// Menü dışına tıklanınca mobil menüyü kapat
	document.addEventListener('click', function(e) {
		if (!menu.classList.contains('nav-open')) return;
		if (menu.contains(e.target)) return;
		closeMobileMenu();
		adjustLayout();
	});
});

window.addEventListener('DOMContentLoaded', function() {
	var anaSayfaLink = document.getElementById('navAnaSayfa');
	if (anaSayfaLink) {
		anaSayfaLink.addEventListener('click', function(e) {
			e.preventDefault();
			showHome();
			setActiveNav(anaSayfaLink);
			closeMobileMenu();
		});
	}

	var iletisimLink = document.getElementById('navIletisim');
	if (iletisimLink) {
		iletisimLink.addEventListener('click', function() {
			showFrame();
			setActiveNav(iletisimLink);
			closeMobileMenu();
		});
	}
});

// Abone sayısını text dosyasından çekme (sadece abone-sayisi elemanı varsa çalışır, yani Ana Sayfa)
window.addEventListener('DOMContentLoaded', function() {
	var aboneSpan = document.getElementById('abone-sayisi');
	if (!aboneSpan) return;

	fetch('Abone.txt')
		.then(function(response) {
			return response.text();
		})
		.then(function(data) {
			aboneSpan.textContent = data.trim();
		})
		.catch(function(error) {
			aboneSpan.textContent = 'Yüklenemedi';
			console.error('Abone.txt okunamadı:', error);
		});
});

// Duyuru: Duyuru.txt içeriğini göster, boşsa "Duyuru Yok"
window.addEventListener('DOMContentLoaded', function() {
	var duyuruDiv = document.getElementById('duyuru-icerik');
	if (!duyuruDiv) return;

	fetch('Duyuru.txt?t=' + Date.now())
		.then(function(response) {
			return response.ok ? response.text() : '';
		})
		.then(function(data) {
			var metin = data.trim();
			duyuruDiv.innerHTML = '<span class="dy-span">' + (metin ? escapeHtml(metin) : 'Duyuru Yok') + '</span>';
		})
		.catch(function() {
			duyuruDiv.innerHTML = '<span class="dy-span">Duyuru Yok</span>';
		});
});

// Basit HTML escape (başlıklarda güvenli görüntüleme için)
function escapeHtml(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Canlı yayın: CanliYayin.txt içinde bir video ID varsa o videoyu göster, yoksa "yayın yok" mesajı
window.addEventListener('DOMContentLoaded', function() {
	var canliDiv = document.getElementById('canli-yayin-icerik');
	if (!canliDiv) return;

	fetch('CanliYayin.txt?t=' + Date.now())
		.then(function(response) {
			return response.ok ? response.text() : '';
		})
		.then(function(data) {
			var id = data.trim();
			if (id) {
				canliDiv.innerHTML =
					'<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(id) + '" ' +
					'title="Canlı Yayın" frameborder="0" ' +
					'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
					'allowfullscreen></iframe>';
			} else {
				canliDiv.innerHTML = '<span class="dy-span">Şu an canlı yayın yok</span>';
			}
		})
		.catch(function() {
			canliDiv.innerHTML = '<span class="dy-span">Şu an canlı yayın yok</span>';
		});
});

// Son video: SonVideolar.txt içindeki tek "videoId|Başlık" satırını kart olarak göster
window.addEventListener('DOMContentLoaded', function() {
	var sonVideoDiv = document.getElementById('son-video-icerik');
	if (!sonVideoDiv) return;

	fetch('SonVideolar.txt?t=' + Date.now())
		.then(function(response) {
			return response.ok ? response.text() : '';
		})
		.then(function(data) {
			var lines = data.split('\n')
				.map(function(l) { return l.trim(); })
				.filter(function(l) { return l.length > 0; });

			if (lines.length === 0) {
				sonVideoDiv.innerHTML = '<span class="dy-span">Henüz video eklenmedi</span>';
				return;
			}

			var parts = lines[0].split('|');
			var id = parts[0] ? parts[0].trim() : '';
			var baslik = parts[1] ? parts[1].trim() : '';

			if (!id) {
				sonVideoDiv.innerHTML = '<span class="dy-span">Henüz video eklenmedi</span>';
				return;
			}

			sonVideoDiv.innerHTML =
				'<a class="video-card" href="https://www.youtube.com/watch?v=' + encodeURIComponent(id) + '" target="_blank">' +
					'<img src="https://img.youtube.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg" alt="' + escapeHtml(baslik) + '">' +
					'<span class="video-baslik">' + escapeHtml(baslik) + '</span>' +
				'</a>';
		})
		.catch(function() {
			sonVideoDiv.innerHTML = '<span class="dy-span">Henüz video eklenmedi</span>';
		});
});

// Videolar galerisi: Videolar.txt içindeki "videoId|Başlık" satırlarını (sınırsız sayıda) kart olarak göster
window.addEventListener('DOMContentLoaded', function() {
	var videolarDiv = document.getElementById('videolar-icerik');
	if (!videolarDiv) return;

	fetch('Videolar.txt?t=' + Date.now())
		.then(function(response) {
			return response.ok ? response.text() : '';
		})
		.then(function(data) {
			var lines = data.split('\n')
				.map(function(l) { return l.trim(); })
				.filter(function(l) { return l.length > 0; });

			if (lines.length === 0) {
				videolarDiv.innerHTML = '<span class="dy-span">Henüz video eklenmedi</span>';
				return;
			}

			var html = '';
			lines.forEach(function(line) {
				var parts = line.split('|');
				var id = parts[0] ? parts[0].trim() : '';
				var baslik = parts[1] ? parts[1].trim() : '';
				if (!id) return;

				html += '<a class="video-card" href="https://www.youtube.com/watch?v=' + encodeURIComponent(id) + '" target="_blank">' +
							'<img src="https://img.youtube.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg" alt="' + escapeHtml(baslik) + '">' +
							'<span class="video-baslik">' + escapeHtml(baslik) + '</span>' +
						'</a>';
			});

			videolarDiv.innerHTML = html || '<span class="dy-span">Henüz video eklenmedi</span>';
		})
		.catch(function() {
			videolarDiv.innerHTML = '<span class="dy-span">Henüz video eklenmedi</span>';
		});
});

// Sosyal medya linkleri: Sosyal.txt içindeki "platform|url" satırlarına göre footer'a ikon ekler
window.addEventListener('DOMContentLoaded', function() {
	var sosyalSpan = document.getElementById('sosyal-linkler');
	if (!sosyalSpan) return;

	var ikonlar = {
		instagram: 'fa-instagram',
		discord: 'fa-discord',
		tiktok: 'fa-tiktok',
		twitter: 'fa-x-twitter',
		twitch: 'fa-twitch'
	};
	var isimler = {
		instagram: 'İnstagram',
		discord: 'Discord',
		tiktok: 'TikTok',
		twitter: 'X',
		twitch: 'Twitch'
	};

	fetch('Sosyal.txt?t=' + Date.now())
		.then(function(response) {
			return response.ok ? response.text() : '';
		})
		.then(function(data) {
			var lines = data.split('\n')
				.map(function(l) { return l.trim(); })
				.filter(function(l) { return l.length > 0; });

			var html = '';
			lines.forEach(function(line) {
				var parts = line.split('|');
				var platform = parts[0] ? parts[0].trim().toLowerCase() : '';
				var url = parts[1] ? parts[1].trim() : '';
				if (!platform || !url || !ikonlar[platform]) return;

				html += ' <a class="foter-a" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
							'<i class="fa-brands ' + ikonlar[platform] + '"></i>' + isimler[platform] +
						'</a>';
			});

			sosyalSpan.innerHTML = html;
		})
		.catch(function() {
			sosyalSpan.innerHTML = '';
		});
});

// İletişim formunu gönderme (sadece iletisimForm elemanı varsa çalışır, yani İletişim sayfası)
window.addEventListener('DOMContentLoaded', function() {
	var form = document.getElementById('iletisimForm');
	if (!form) return;

	var sonuc = document.getElementById('iletisimSonuc');

	form.addEventListener('submit', function(e) {
		e.preventDefault();
		sonuc.textContent = 'Gönderiliyor...';
		sonuc.style.color = '#FFFFFF';

		var formData = new FormData(form);
		var data = Object.fromEntries(formData);

		fetch('https://api.web3forms.com/submit', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(data)
		})
		.then(function(response) {
			return response.json();
		})
		.then(function(result) {
			if (result.success) {
				sonuc.textContent = 'Mesajınız gönderildi, teşekkürler!';
				sonuc.style.color = '#00FF00';
				form.reset();
			} else {
				sonuc.textContent = 'Bir hata oluştu, lütfen tekrar deneyin.';
				sonuc.style.color = '#FF0000';
			}
		})
		.catch(function() {
			sonuc.textContent = 'Bir hata oluştu, lütfen tekrar deneyin.';
			sonuc.style.color = '#FF0000';
		});
	});
});

