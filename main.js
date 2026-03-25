(function(){
'use strict';

// Nav scroll
var nav = document.getElementById('site-nav');
var toggle = document.getElementById('nav-toggle');
var links = document.getElementById('nav-links');

window.addEventListener('scroll', function(){
    nav.classList.toggle('scrolled', window.scrollY > 40);
}, {passive:true});

// Mobile menu
toggle.addEventListener('click', function(){
    var open = toggle.classList.toggle('active');
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
        toggle.classList.remove('active');
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    });
});

// Theme toggle
var themeBtn = document.getElementById('theme-toggle');
var root = document.documentElement;
var stored = localStorage.getItem('theme');
if(stored) root.setAttribute('data-theme', stored);
else if(window.matchMedia('(prefers-color-scheme:dark)').matches) root.setAttribute('data-theme','dark');

themeBtn.addEventListener('click', function(){
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
});

// Scroll reveal
var els = document.querySelectorAll(
    '.section-heading, .overline, .card, .pub, .exp-block, .about-layout, ' +
    '.metrics, .contact-card, .skills-section, .contact-intro'
);
els.forEach(function(el){ el.classList.add('reveal'); });

var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
}, {threshold:0.06, rootMargin:'0px 0px -30px 0px'});
els.forEach(function(el){ obs.observe(el); });

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
        var t = document.querySelector(a.getAttribute('href'));
        if(t){ e.preventDefault(); t.scrollIntoView({behavior:'smooth'}); }
    });
});

// Active nav
var sections = document.querySelectorAll('section[id]');
var navAs = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', function(){
    var cur = '';
    sections.forEach(function(s){
        if(window.scrollY >= s.offsetTop - 120) cur = s.id;
    });
    navAs.forEach(function(a){
        a.classList.toggle('active', a.getAttribute('href') === '#'+cur);
    });
}, {passive:true});

})();
