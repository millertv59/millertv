var VAULT_KEY = 'maseidtv_admin_vault';
var creds = null; // bellekte: { repo, branch, token }

function $(id) { return document.getElementById(id); }

function show(view) {
	$('setupView').classList.add('hidden');
	$('loginView').classList.add('hidden');
	$('panelView').classList.add('hidden');
	$(view).classList.remove('hidden');
}

function ab2base64(bytes) {
	var binary = '';
	for (var i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

function base642ab(base64) {
	var binary = atob(base64);
	var bytes = new Uint8Array(binary.length);
	for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function deriveKey(password, saltBytes) {
	var passKey = await crypto.subtle.importKey(
		'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
		passKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

async function encryptVault(password, dataObj) {
	var salt = crypto.getRandomValues(new Uint8Array(16));
	var iv = crypto.getRandomValues(new Uint8Array(12));
	var key = await deriveKey(password, salt);
	var plaintext = new TextEncoder().encode(JSON.stringify(dataObj));
	var ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);
	return {
		salt: ab2base64(salt),
		iv: ab2base64(iv),
		data: ab2base64(new Uint8Array(ciphertext))
	};
}

async function decryptVault(password, vault) {
	var salt = base642ab(vault.salt);
	var iv = base642ab(vault.iv);
	var ciphertext = base642ab(vault.data);
	var key = await deriveKey(password, salt);
	var plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
	return JSON.parse(new TextDecoder().decode(plainBuf));
}

function utf8ToBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
	var binary = atob(b64.replace(/\n/g, ''));
	var bytes = new Uint8Array(binary.length);
	for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder('utf-8').decode(bytes);
}

// Bir YouTube linkinden veya doğrudan ID'den video ID'sini çıkarır
function extractVideoId(input) {
	input = (input || '').trim();
	if (!input) return '';
	if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
	var patterns = [
		/(?:youtube\.com\/watch\?v=|youtube\.com\/live\/|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
	];
	for (var i = 0; i < patterns.length; i++) {
		var m = input.match(patterns[i]);
		if (m) return m[1];
	}
	return input;
}

// GitHub'daki bir dosyayı oluşturur veya günceller (dosya yoksa otomatik oluşturur)
async function githubUpdateFile(path, content, message) {
	var apiUrl = 'https://api.github.com/repos/' + creds.repo + '/contents/' + path;
	var sha = null;

	var getRes = await fetch(apiUrl + '?ref=' + encodeURIComponent(creds.branch), {
		headers: { 'Authorization': 'token ' + creds.token, 'Accept': 'application/vnd.github+json' }
	});

	if (getRes.ok) {
		var fileData = await getRes.json();
		sha = fileData.sha;
	} else if (getRes.status !== 404) {
		throw new Error('Dosya bilgisi alınamadı (HTTP ' + getRes.status + '). Depo/branch/token izinlerini kontrol edin.');
	}

	var body = { message: message, content: utf8ToBase64(content), branch: creds.branch };
	if (sha) body.sha = sha;

	var putRes = await fetch(apiUrl, {
		method: 'PUT',
		headers: {
			'Authorization': 'token ' + creds.token,
			'Accept': 'application/vnd.github+json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!putRes.ok) {
		var errBody = await putRes.json().catch(function () { return {}; });
		throw new Error('Güncelleme başarısız (HTTP ' + putRes.status + '). ' + (errBody.message || ''));
	}
}

// GitHub'dan bir dosyanın mevcut içeriğini okur (yoksa boş döner)
async function githubReadFile(path) {
	try {
		var apiUrl = 'https://api.github.com/repos/' + creds.repo + '/contents/' + path;
		var res = await fetch(apiUrl + '?ref=' + encodeURIComponent(creds.branch), {
			headers: { 'Authorization': 'token ' + creds.token, 'Accept': 'application/vnd.github+json' }
		});
		if (!res.ok) return '';
		var fileData = await res.json();
		return base64ToUtf8(fileData.content || '').trim();
	} catch (e) {
		return '';
	}
}

// Galeri satırı ekler (link + başlık + sil butonu)
function addGaleriRow(link, baslik) {
	var row = document.createElement('div');
	row.className = 'galeri-satir';
	row.innerHTML =
		'<input type="text" class="galeri-link" placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX" value="' +
		escapeAttr(link || '') + '">' +
		'<input type="text" class="galeri-baslik" placeholder="Video başlığı" value="' +
		escapeAttr(baslik || '') + '">' +
		'<button type="button" class="galeri-sil">Sil</button>';
	row.querySelector('.galeri-sil').addEventListener('click', function () {
		row.remove();
	});
	$('videolarListe').appendChild(row);
}

function escapeAttr(str) {
	return String(str).replace(/"/g, '&quot;');
}

// Panel açıldığında mevcut abone/duyuru/canlı yayın/son video/galeri değerlerini alanlara doldurur
async function loadCurrentValues() {
	var abone = await githubReadFile('Abone.txt');
	var duyuru = await githubReadFile('Duyuru.txt');
	var canli = await githubReadFile('CanliYayin.txt');
	var sonvideo = await githubReadFile('SonVideolar.txt');
	var videolar = await githubReadFile('Videolar.txt');

	$('abone').value = abone || '';
	$('duyuru').value = duyuru || '';
	$('canli-link').value = canli || '';

	var sonLines = sonvideo ? sonvideo.split('\n').filter(function (l) { return l.trim(); }) : [];
	var sonParts = (sonLines[0] || '').split('|');
	$('sonvideo-link').value = sonParts[0] ? sonParts[0].trim() : '';
	$('sonvideo-baslik').value = sonParts[1] ? sonParts[1].trim() : '';

	$('videolarListe').innerHTML = '';
	var galeriLines = videolar ? videolar.split('\n').filter(function (l) { return l.trim(); }) : [];
	if (galeriLines.length === 0) {
		addGaleriRow('', '');
	} else {
		galeriLines.forEach(function (line) {
			var parts = line.split('|');
			addGaleriRow(parts[0] ? parts[0].trim() : '', parts[1] ? parts[1].trim() : '');
		});
	}

	var sosyal = await githubReadFile('Sosyal.txt');
	var sosyalMap = {};
	(sosyal ? sosyal.split('\n') : []).forEach(function (line) {
		var parts = line.split('|');
		var platform = parts[0] ? parts[0].trim().toLowerCase() : '';
		var url = parts[1] ? parts[1].trim() : '';
		if (platform) sosyalMap[platform] = url;
	});
	$('sosyal-instagram').value = sosyalMap['instagram'] || '';
	$('sosyal-discord').value = sosyalMap['discord'] || '';
	$('sosyal-tiktok').value = sosyalMap['tiktok'] || '';
	$('sosyal-twitter').value = sosyalMap['twitter'] || '';
	$('sosyal-twitch').value = sosyalMap['twitch'] || '';
}

// Tek bir alanı güncellerken kullanılan yardımcı fonksiyon
async function saveField(path, content, message, sonucEl) {
	if (!creds) {
		sonucEl.textContent = 'Oturum bulunamadı, lütfen yeniden giriş yapın.';
		sonucEl.style.color = '#FF0000';
		return;
	}
	sonucEl.textContent = 'Güncelleniyor...';
	sonucEl.style.color = '#FFFFFF';
	try {
		await githubUpdateFile(path, content, message);
		sonucEl.textContent = 'Başarılı! 1-2 dakika içinde sitede görünecek.';
		sonucEl.style.color = '#00FF00';
	} catch (err) {
		sonucEl.textContent = err.message;
		sonucEl.style.color = '#FF0000';
		console.error(err);
	}
}

// Sayfa yüklendiğinde: kurulum var mı, yok mu bak
window.addEventListener('DOMContentLoaded', function () {
	var saved = localStorage.getItem(VAULT_KEY);
	show(saved ? 'loginView' : 'setupView');
});

// KURULUM
$('setupBtn').addEventListener('click', async function () {
	var repo = $('s-repo').value.trim();
	var branch = $('s-branch').value.trim() || 'main';
	var token = $('s-token').value.trim();
	var pass1 = $('s-pass1').value;
	var pass2 = $('s-pass2').value;
	var sonuc = $('setupSonuc');

	if (!repo || !token || !pass1) {
		sonuc.textContent = 'Lütfen tüm alanları doldurun.';
		sonuc.style.color = '#FF6B6B';
		return;
	}
	if (pass1 !== pass2) {
		sonuc.textContent = 'Şifreler eşleşmiyor.';
		sonuc.style.color = '#FF6B6B';
		return;
	}
	if (pass1.length < 6) {
		sonuc.textContent = 'Şifre en az 6 karakter olmalı.';
		sonuc.style.color = '#FF6B6B';
		return;
	}

	sonuc.textContent = 'Kuruluyor...';
	sonuc.style.color = '#FFFFFF';

	try {
		var vault = await encryptVault(pass1, { repo: repo, branch: branch, token: token });
		localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
		creds = { repo: repo, branch: branch, token: token };
		$('repoBilgi').textContent = 'Bağlı depo: ' + repo + ' (' + branch + ')';
		show('panelView');
		loadCurrentValues();
	} catch (err) {
		sonuc.textContent = 'Kurulum başarısız: ' + err.message;
		sonuc.style.color = '#FF0000';
		console.error(err);
	}
});

// GİRİŞ
$('loginBtn').addEventListener('click', async function () {
	var password = $('l-pass').value;
	var sonuc = $('loginSonuc');

	if (!password) {
		sonuc.textContent = 'Lütfen şifrenizi girin.';
		sonuc.style.color = '#FF6B6B';
		return;
	}

	sonuc.textContent = 'Kontrol ediliyor...';
	sonuc.style.color = '#FFFFFF';

	try {
		var vault = JSON.parse(localStorage.getItem(VAULT_KEY));
		var data = await decryptVault(password, vault);
		creds = data;
		$('l-pass').value = '';
		sonuc.textContent = '';
		$('repoBilgi').textContent = 'Bağlı depo: ' + creds.repo + ' (' + creds.branch + ')';
		show('panelView');
		loadCurrentValues();
	} catch (err) {
		sonuc.textContent = 'Şifre yanlış.';
		sonuc.style.color = '#FF0000';
	}
});

// ŞİFREYİ SIFIRLA / YENİDEN KUR
$('resetLink').addEventListener('click', function () {
	if (confirm('Saklı GitHub bilgileri bu tarayıcıdan silinecek ve yeniden kurulum gerekecek. Emin misiniz?')) {
		localStorage.removeItem(VAULT_KEY);
		location.reload();
	}
});

// ÇIKIŞ YAP
$('logoutLink').addEventListener('click', function () {
	creds = null;
	location.reload();
});

// PANEL SEKMELERİ (sayfa sayfa geçiş)
document.querySelectorAll('.panel-sekme-btn').forEach(function (btn) {
	btn.addEventListener('click', function () {
		var hedef = btn.getAttribute('data-sayfa');

		document.querySelectorAll('.panel-sekme-btn').forEach(function (b) {
			b.classList.remove('active');
		});
		btn.classList.add('active');

		document.querySelectorAll('.panel-sayfa').forEach(function (sayfa) {
			if (sayfa.getAttribute('data-sayfa') === hedef) {
				sayfa.classList.remove('hidden');
			} else {
				sayfa.classList.add('hidden');
			}
		});
	});
});

// ABONE SAYISINI GÜNCELLE
$('aboneBtn').addEventListener('click', function () {
	var abone = $('abone').value.trim();
	var sonuc = $('aboneSonuc');
	if (!abone) {
		sonuc.textContent = 'Lütfen yeni abone sayısını yazın.';
		sonuc.style.color = '#FF6B6B';
		return;
	}
	saveField('Abone.txt', abone, 'Abone sayısı güncellendi: ' + abone, sonuc);
});

// CANLI YAYINI GÜNCELLE
$('canliBtn').addEventListener('click', function () {
	var raw = $('canli-link').value.trim();
	var sonuc = $('canliSonuc');
	var id = raw ? extractVideoId(raw) : '';
	$('canli-link').value = id;
	saveField('CanliYayin.txt', id, id ? ('Canlı yayın güncellendi: ' + id) : 'Canlı yayın kaldırıldı', sonuc);
});

// CANLI YAYINI KALDIR
$('canliKaldirBtn').addEventListener('click', function () {
	$('canli-link').value = '';
	saveField('CanliYayin.txt', '', 'Canlı yayın kaldırıldı', $('canliSonuc'));
});

// DUYURUYU GÜNCELLE
$('duyuruBtn').addEventListener('click', function () {
	var metin = $('duyuru').value.trim();
	saveField('Duyuru.txt', metin, metin ? ('Duyuru güncellendi: ' + metin) : 'Duyuru kaldırıldı', $('duyuruSonuc'));
});

// DUYURUYU KALDIR
$('duyuruKaldirBtn').addEventListener('click', function () {
	$('duyuru').value = '';
	saveField('Duyuru.txt', '', 'Duyuru kaldırıldı', $('duyuruSonuc'));
});

// SON VİDEOYU GÜNCELLE
$('sonVideoBtn').addEventListener('click', function () {
	var sonuc = $('sonVideoSonuc');
	var link = $('sonvideo-link').value.trim();
	var baslik = $('sonvideo-baslik').value.trim();

	if (!link) {
		saveField('SonVideolar.txt', '', 'Son video kaldırıldı', sonuc);
		return;
	}

	var id = extractVideoId(link);
	$('sonvideo-link').value = id;
	saveField('SonVideolar.txt', id + '|' + baslik, 'Son video güncellendi: ' + id, sonuc);
});

// GALERİYE YENİ SATIR EKLE
$('videoEkleBtn').addEventListener('click', function () {
	addGaleriRow('', '');
});

// GALERİYİ KAYDET
$('videolarKaydetBtn').addEventListener('click', function () {
	var sonuc = $('videolarSonuc');
	var satirlar = document.querySelectorAll('#videolarListe .galeri-satir');
	var lines = [];

	satirlar.forEach(function (row) {
		var linkInput = row.querySelector('.galeri-link');
		var baslikInput = row.querySelector('.galeri-baslik');
		var link = linkInput.value.trim();
		if (!link) return;
		var id = extractVideoId(link);
		linkInput.value = id;
		var baslik = baslikInput.value.trim();
		lines.push(id + '|' + baslik);
	});

	saveField('Videolar.txt', lines.join('\n'), 'Videolar galerisi güncellendi', sonuc);
});

// SOSYAL MEDYA LİNKLERİNİ GÜNCELLE
$('sosyalBtn').addEventListener('click', function () {
	var sonuc = $('sosyalSonuc');
	var platformlar = [
		['instagram', $('sosyal-instagram').value.trim()],
		['discord', $('sosyal-discord').value.trim()],
		['tiktok', $('sosyal-tiktok').value.trim()],
		['twitter', $('sosyal-twitter').value.trim()],
		['twitch', $('sosyal-twitch').value.trim()]
	];
	var lines = platformlar
		.filter(function (p) { return p[1]; })
		.map(function (p) { return p[0] + '|' + p[1]; });

	saveField('Sosyal.txt', lines.join('\n'), 'Sosyal medya linkleri güncellendi', sonuc);
});
