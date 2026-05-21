/* Shared navigation JS — hamburger menu + mobile bottom nav active state */

(function () {
  /* Hamburger toggle */
  var toggle = document.getElementById('navToggle');
  var nav = document.querySelector('.nav');
  var bottom = document.querySelector('.sidebar-bottom');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      if (bottom) bottom.classList.toggle('open', open);
      toggle.innerHTML = open ? '&#10005;' : '&#9776;';
    });
    document.querySelectorAll('.nav .nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        if (bottom) bottom.classList.remove('open');
        toggle.innerHTML = '&#9776;';
      });
    });
  }

  /* Mobile bottom nav active state */
  var path = window.location.pathname;
  document.querySelectorAll('.mbn-item').forEach(function (el) {
    var href = el.getAttribute('href');
    if (href === '/' && (path === '/' || path === '/index.html')) {
      el.classList.add('active');
    } else if (href !== '/' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });

  /* Hide reviews on mobile */
  if (window.innerWidth <= 820) {
    var reviews = document.querySelector('.reviews');
    if (reviews) reviews.style.display = 'none';
  }
})();
