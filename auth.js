/* auth.js — защита страниц + автозаполнение ФИО из аккаунта */
(function () {
  const KEY = 'mich_user';
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzbjmYk6lzqYcDAnsJZTqxuRO5vVcZs5Q9MlPbtPK9gEnMlEWFpJpq3FtQsdi_cPR4y/exec';

  const page = location.pathname.split('/').pop() || 'index.html';
  const isRegisterPage = page === 'register.html';
  const isAdminPage    = page === 'admin.html';

  if (isRegisterPage || isAdminPage) return;

  // Защита от кнопки "Назад" (чтобы не открывалась страница из кэша)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });

  const isIframe = window.top !== window.self;

  // СКРЫВАЕМ КОНТЕНТ ВСЕГДА (даже в iframe), пока не проверим доступ
  document.documentElement.style.display = 'none';

  function goToLogin() {
    try { localStorage.removeItem(KEY); } catch(e) {}
    if (isIframe) window.top.location.href = 'register.html';
    else location.replace('register.html');
  }

  let user = null;
  try { user = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}

  if (!user || user.status !== 'approved') {
    goToLogin();
    return;
  }

  let redirected = false;
  const redirectToLogin = () => {
    if (redirected) return;
    redirected = true;
    goToLogin();
  };

  const timeoutId = setTimeout(redirectToLogin, 8000);

  const cbName = 'cb_auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  window[cbName] = (data) => {
    clearTimeout(timeoutId);
    delete window[cbName];
    
    if (data && data.valid) {
      // Принудительно обновляем права из базы (даже если это пустой объект)
      if (data.access !== undefined) {
        user.access = data.access;
        localStorage.setItem(KEY, JSON.stringify(user));
      }
      
      document.documentElement.style.display = 'block';
      setupPage(user);
    } else {
      redirectToLogin();
    }
  };

  const s = document.createElement('script');
  s.src = `${WEB_APP_URL}?action=checkSession&userId=${encodeURIComponent(user.id)}&token=${encodeURIComponent(user.token)}&callback=${cbName}`;
  s.onerror = redirectToLogin;
  document.body.appendChild(s);

  function setupPage(user) {
    window.MICH_USER = user;

    // Вспомогательная функция проверки доступа
    function checkAccess(topicId) {
      if (!user.access) return false;
      
      // Если админ дал доступ ко всему (старая логика)
      if (user.access.all === true) return true;
      
      // Проверка на новые глобальные галочки
      if (topicId.startsWith('lec_') && user.access.lec_all === true) return true;
      if (!topicId.startsWith('lec_') && user.access.test_all === true) return true;

      // Индивидуальные разрешения (если кто-то выдавал точечно)
      return user.access[topicId] === true;
    }

    const testPages = [
      'test1.html', 'test2.html', 'test3.html', 
      'service.html', 
      'alco1.html', 'alco2.html', 'alco3.html', 
      'beer1.html', 'tincture1.html', 
      'reg-bar-test.html', 'reg-urv-test.html', 'reg-tincture-test.html', 
      'reg-compliments-test.html', 
      'reg-nonpayers-test.html',
      'final-attestation.html'
    ];
    
    if (testPages.includes(page)) {
      const topicId = page.replace('.html', '');
      if (!checkAccess(topicId)) {
        alert('⛔ У вас нет доступа к этому тесту.');
        if (isIframe) window.top.location.href = 'index.html';
        else location.replace('index.html');
        return;
      }
    }

    const initUI = () => {
      const nameInput = document.getElementById('userName');
      if (nameInput) {
        nameInput.value = user.name;
        nameInput.readOnly = true;
        nameInput.style.background = '#f0f2f5';
        nameInput.style.cursor = 'not-allowed';
        const hint = nameInput.parentElement.querySelector('.hint');
        if (hint) hint.textContent = `Вы вошли как ${user.name} · ${user.bar || ''}`;
      }

      if (!isIframe && (page === 'index.html' || page === '')) {
        const allCards = document.querySelectorAll('a.card');
        allCards.forEach(card => {
          const href = card.getAttribute('href') || '';
          let topicId = card.getAttribute('data-topic'); 
          
          if (!topicId && href.includes('.html')) {
            topicId = href.replace('.html', '');
          }

          if (topicId) {
            if (!checkAccess(topicId)) {
              card.style.opacity = '0.5';
              card.style.pointerEvents = 'none';
              card.style.filter = 'grayscale(1)';
              const badge = card.querySelector('.timer-badge') || card.querySelector('.meta span');
              if (badge) {
                badge.textContent = '🔒 Нет доступа';
                badge.style.background = '#fee2e2';
                badge.style.color = '#991b1b';
              }
            }
          }
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  }
})();
