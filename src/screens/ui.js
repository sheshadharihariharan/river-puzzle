// Small HTML pieces shared by the screens: star rows and pop-up panels.

const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L1.9 9.2l7-1z"/></svg>';

export function starRow(stars, animate = false) {
  return `<div class="stars${animate ? ' pop' : ''}">${[0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}" style="--i:${i}">${STAR}</i>`).join('')}</div>`;
}

// buttons: [{ label, act(close), main }]
export function popup(ui, { title, body, buttons }) {
  const el = document.createElement('div');
  el.className = 'veil';
  el.innerHTML = `<div class="popup"><h2>${title}</h2>${body}<div class="row"></div></div>`;
  const row = el.querySelector('.row');
  const close = () => el.remove();
  for (const b of buttons.filter(Boolean)) {
    const btn = document.createElement('button');
    btn.className = `btn${b.main ? ' go' : ''}`;
    btn.textContent = b.label;
    btn.onclick = () => b.act(close);
    row.append(btn);
  }
  ui.append(el);
  return close;
}
